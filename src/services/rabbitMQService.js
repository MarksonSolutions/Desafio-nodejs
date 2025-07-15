const amqp = require('amqplib');
const logger = require('../utils/logger');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async initialize() {
    try {
      const connectionString = `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'}`;
      
      this.connection = await amqp.connect(connectionString);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      this.connectionRetries = 0;

      this.connection.on('error', (error) => {
        logger.error('RabbitMQ connection error:', error);
        this.isConnected = false;
        this.handleReconnection();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.handleReconnection();
      });

      logger.info('RabbitMQ service initialized successfully');
      return this.channel;

    } catch (error) {
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }

  async handleReconnection() {
    if (this.connectionRetries >= this.maxRetries) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.connectionRetries++;
    logger.info(`Attempting to reconnect (${this.connectionRetries}/${this.maxRetries})`);

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed:', error);
        this.handleReconnection();
      }
    }, this.retryDelay);
  }

  async sendMessage(queueName, message) {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      await this.channel.assertQueue(queueName, { durable: true });

      const messageData = {
        id: message.id,
        content: message.content,
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata || {}
      };

      const success = this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(messageData)), {
        persistent: true
      });

      if (!success) {
        throw new Error('Failed to send message to queue');
      }

      logger.info(`Message sent to queue ${queueName}:`, {
        messageId: message.id,
        queueName,
        timestamp: messageData.timestamp
      });

      return {
        success: true,
        messageId: message.id,
        queueName,
        timestamp: messageData.timestamp
      };

    } catch (error) {
      logger.error(`Failed to send message to queue ${queueName}:`, error);
      throw error;
    }
  }

  async receiveMessages(queueName, limit = 10, timeout = 5000) {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      await this.channel.assertQueue(queueName, { durable: true });

      const messages = [];
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve({
            success: true,
            messages,
            queueName,
            totalReceived: messages.length
          });
        }, timeout);

        this.channel.consume(queueName, (msg) => {
          if (msg) {
            try {
              const messageData = JSON.parse(msg.content.toString());
              const receivedMessage = {
                ...messageData,
                receivedAt: new Date().toISOString()
              };

              messages.push(receivedMessage);
              
              this.channel.ack(msg);

              logger.info(`Message received from queue ${queueName}:`, {
                messageId: messageData.id,
                queueName
              });

              if (messages.length >= limit) {
                clearTimeout(timeoutId);
                resolve({
                  success: true,
                  messages,
                  queueName,
                  totalReceived: messages.length
                });
              }
            } catch (error) {
              logger.error('Error processing message:', error);
              this.channel.nack(msg);
            }
          }
        });

        this.channel.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });

    } catch (error) {
      logger.error(`Failed to receive messages from queue ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueStatus(queueName) {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      const queueInfo = await this.channel.checkQueue(queueName);
      
      return {
        name: queueName,
        messageCount: queueInfo.messageCount || 0,
        consumerCount: queueInfo.consumerCount || 0,
        isActive: true
      };

    } catch (error) {
      logger.error(`Failed to get queue status for ${queueName}:`, error);
      return {
        name: queueName,
        messageCount: 0,
        consumerCount: 0,
        isActive: false
      };
    }
  }

  async getAllQueuesStatus() {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      const queueStatuses = [];
      
      try {
        const testQueue = 'test_queue_status';
        await this.channel.assertQueue(testQueue, { durable: true });
        const status = await this.getQueueStatus(testQueue);
        queueStatuses.push(status);
        await this.channel.deleteQueue(testQueue);
      } catch (error) {
        logger.warn('Could not get queue status:', error);
      }

      return {
        success: true,
        queues: queueStatuses,
        rabbitMQStatus: this.isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get all queues status:', error);
      throw error;
    }
  }

  async createQueue(queueName, options = {}) {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      const queueOptions = {
        durable: true,
        autoDelete: false,
        ...options
      };

      await this.channel.assertQueue(queueName, queueOptions);
      
      logger.info(`Queue created: ${queueName}`);
      
      return {
        success: true,
        queueName,
        message: 'Queue created successfully'
      };

    } catch (error) {
      logger.error(`Failed to create queue ${queueName}:`, error);
      throw error;
    }
  }

  async deleteQueue(queueName) {
    try {
      if (!this.isConnected || !this.channel) {
        throw new Error('RabbitMQ not connected');
      }

      await this.channel.deleteQueue(queueName);
      
      logger.info(`Queue deleted: ${queueName}`);
      
      return {
        success: true,
        queueName,
        message: 'Queue deleted successfully'
      };

    } catch (error) {
      logger.error(`Failed to delete queue ${queueName}:`, error);
      throw error;
    }
  }

  isConnected() {
    return this.isConnected;
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      logger.info('RabbitMQ disconnected');
    } catch (error) {
      logger.error('Error disconnecting RabbitMQ:', error);
      throw error;
    }
  }
}

module.exports = new RabbitMQService();
