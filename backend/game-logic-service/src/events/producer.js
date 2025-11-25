const amqp = require('amqplib');

let connection = null;
let channel = null;

//connect to RabbitMQ
async function connectToMessageQueue(){
    try{
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        channel = await connection.createChannel();

        // assert queues exist
        channel.assertQueue("turn_completed", {durable: true});
        channel.assertQueue("game_ended", {durable: true});
        
        console.log("Connected to RabbitMQ");
        return channel;
    } catch(error){
        console.error("Failed to connect to RabbitMQ", error);
        throw error;
    }
}

// publish turn completed event
async function purlishTurnCompleted(game){
    if(!channel){
        console.error("No channel available to publish message");
        return;
    }

    try {
    const event = {
      type: 'TURN_COMPLETED',
      gameId: game.gameId,
      board: game.board,
      currentPlayer: game.currentPlayer,
      previousPlayer: game.currentPlayer === 'X' ? 'O' : 'X',
      status: game.status,
      moveCount: game.moveHistory.length,
      timestamp: new Date().toISOString()
    };

    const success = channel.sendToQueue(
      'turn_completed',
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );

    if (success) {
      console.log(`📨 Published turn_completed for game: ${game.gameId}`);
    } else {
      console.warn('⚠️ Failed to publish turn_completed event');
    }
  } catch (error) {
    console.error('❌ Error publishing turn_completed:', error);
  }
}

/**
 * Publish game_ended event
 */
async function publishGameEnded(game) {
  if (!channel) {
    console.warn('⚠️ RabbitMQ channel not ready, skipping event');
    return;
  }

  try {
    const event = {
      type: 'GAME_ENDED',
      gameId: game.gameId,
      winner: game.winner,
      finalBoard: game.board,
      players: game.players,
      totalMoves: game.moveHistory.length,
      timestamp: new Date().toISOString()
    };

    const success = channel.sendToQueue(
      'game_ended', 
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );

    if (success) {
      console.log(`🏁 Published game_ended for game: ${game.gameId}, Winner: ${game.winner}`);
    } else {
      console.warn('⚠️ Failed to publish game_ended event');
    }
  } catch (error) {
    console.error('❌ Error publishing game_ended:', error);
  }
}

/**
 * Close connections gracefully
 */
async function closeConnection() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  console.log('🔌 RabbitMQ connection closed');
}

module.exports = {
  connectToMessageQueue,
  publishTurnCompleted,
  publishGameEnded,
  closeConnection
};