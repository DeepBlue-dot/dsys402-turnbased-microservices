const amqp = require('amqplib');
const gameController = require('../controllers/gameController');

let channel = null;

/**
 * Start consuming events from other services
 */
async function start() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        channel = await connection.createChannel();

        // Assert queue exists
        await channel.assertQueue('match_created', { durable: true });

        console.log('Started consuming match_created events...');

        // Consume match_created events from Matchmaking Service
        channel.consume('match_created', async (msg) => {
            if (msg !== null) {
                try {
                    const matchData = JSON.parse(msg.content.toString());
                    console.log(`Received match_created: ${matchData.gameId}`);

                    // Create a new game session
                    await gameController.createGameFromMatch(matchData);

                    channel.ack(msg); // Acknowledge message processing
                } catch (error) {
                    console.error('Error processing match_created:', error);
                    channel.nack(msg); // Negative acknowledgment - requeue the message
                }
            }
        });

    } catch (error) {
        console.error('Failed to start event consumer:', error);
        setTimeout(start, 5000); // Retry after 5 seconds
    }
}

module.exports = { start };