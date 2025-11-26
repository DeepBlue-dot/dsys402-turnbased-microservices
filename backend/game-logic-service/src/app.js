const express = require('express');
const gameRoutes = require('./routes/gameRoutes');
const { connectToMessageQueue } = require('./events/producer');
const eventConsumer = require('./events/consumer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/games', gameRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'game-logic-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// (Detailed dependency health checks removed - keep a simple /health endpoint)

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown handling
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
    console.log('\n🔻 Received shutdown signal. Gracefully shutting down...');

    try {
        // Close RabbitMQ connections
        const { closeConnection } = require('./events/producer');
        await closeConnection();

        console.log('✅ All connections closed. Exiting process.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting Game Logic Service...');

        // Connect to message queue (with retry logic)
        let retryCount = 0;
        const maxRetries = 5;

        while (retryCount < maxRetries) {
            try {
                await connectToMessageQueue();
                console.log('✅ Successfully connected to RabbitMQ');
                break;
            } catch (error) {
                retryCount++;
                console.warn(`⚠️ RabbitMQ connection failed (attempt ${retryCount}/${maxRetries}):`, error.message);

                if (retryCount === maxRetries) {
                    console.error('❌ Max retries reached. Starting without RabbitMQ...');
                    // We'll start the server anyway, but events won't work
                    break;
                }

                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
        }

        // Start event consumers (only if RabbitMQ is connected)
        if (retryCount < maxRetries) {
            try {
                await eventConsumer.start();
                console.log('✅ Event consumers started');
            } catch (error) {
                console.error('❌ Failed to start event consumers:', error);
            }
        } else {
            console.warn('⚠️ Event consumers disabled due to RabbitMQ connection issues');
        }

        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🎮 Game Logic Service running on port ${PORT}`);
            console.log(`📍 Health: http://localhost:${PORT}/health`);
            console.log(`📍 Detailed Health: http://localhost:${PORT}/health/detailed`);
            console.log(`📍 API Base: http://localhost:${PORT}/api/games`);
            console.log('Press Ctrl+C to stop the server');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Only start server if this file is run directly (not when testing)
if (require.main === module) {
    startServer();
}

module.exports = app; // For testing