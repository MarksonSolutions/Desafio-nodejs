const baileysService = require('../services/baileysService');
const logger = require('../utils/logger');

class QueueController {
  constructor() {
    this.queueService = null;
  }

  async initialize() {
    if (this.queueService) return;
    
    try {
      await baileysService.initialize();
      this.queueService = baileysService;
      logger.info('QueueController initialized with Baileys service');
    } catch (error) {
      logger.error('Baileys service failed to initialize:', error);
      throw error;
    }
  }

  async getQueuesStatus(req, res) {
    try {
      await this.initialize();
      
      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const result = await this.queueService.getAllQueuesStatus();

      logger.info('Queues status retrieved successfully', {
        totalQueues: result.queues.length,
        rabbitMQStatus: result.rabbitMQStatus,
        whatsAppStatus: result.whatsAppStatus
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error getting queues status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queues status',
        details: error.message
      });
    }
  }

  async getQueueStatus(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: 'Queue name is required'
        });
      }

      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const result = await this.queueService.getQueueStatus(queueName);

      logger.info('Queue status retrieved successfully', {
        queueName,
        messageCount: result.messageCount,
        consumerCount: result.consumerCount
      });

      res.status(200).json({
        success: true,
        queue: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting queue status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        details: error.message
      });
    }
  }

  async createQueue(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;
      const { durable = true, autoDelete = false, arguments: queueArgs = {} } = req.body;

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: 'Queue name is required'
        });
      }

      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const options = {
        durable,
        autoDelete,
        arguments: queueArgs
      };

      const result = await this.queueService.createQueue(queueName, options);

      logger.info('Queue created successfully', {
        queueName,
        options
      });

      res.status(201).json(result);

    } catch (error) {
      logger.error('Error creating queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create queue',
        details: error.message
      });
    }
  }

  async deleteQueue(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;
      const { ifUnused = false, ifEmpty = false } = req.query;

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: 'Queue name is required'
        });
      }

      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const options = {
        ifUnused: ifUnused === 'true',
        ifEmpty: ifEmpty === 'true'
      };

      const result = await this.queueService.deleteQueue(queueName, options);

      logger.info('Queue deleted successfully', {
        queueName,
        options
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error deleting queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete queue',
        details: error.message
      });
    }
  }

  async purgeQueue(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: 'Queue name is required'
        });
      }

      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      res.status(200).json({
        success: true,
        queueName,
        message: 'Queue purged successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error purging queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to purge queue',
        details: error.message
      });
    }
  }

  async getQueueMessages(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const requeue = req.query.requeue === 'true';

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: 'Queue name is required'
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100'
        });
      }

      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const result = await this.queueService.receiveMessages(queueName, limit, 5000);

      res.status(200).json({
        success: true,
        queueName,
        messages: result.messages,
        totalMessages: result.totalReceived,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting queue messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue messages',
        details: error.message
      });
    }
  }

  async getHealthStatus(req, res) {
    try {
      await this.initialize();
      
      if (!this.queueService) {
        return res.status(503).json({
          success: false,
          error: 'Queue service not available'
        });
      }

      const queuesStatus = await this.queueService.getAllQueuesStatus();
      
      const activeQueues = queuesStatus.queues.filter(q => q.isActive).length;
      const totalQueues = queuesStatus.queues.length;

      res.status(200).json({
        success: true,
        status: 'healthy',
        queues: {
          total: totalQueues,
          active: activeQueues,
          inactive: totalQueues - activeQueues
        },
        rabbitMQ: {
          status: queuesStatus.rabbitMQStatus,
          version: '3.12.0'
        },
        whatsApp: {
          status: queuesStatus.whatsAppStatus
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting health status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status',
        details: error.message
      });
    }
  }
}

module.exports = new QueueController();
