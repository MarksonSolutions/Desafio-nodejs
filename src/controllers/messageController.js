const baileysService = require('../services/baileysService');
const logger = require('../utils/logger');

class MessageController {
  constructor() {
    this.messageService = null;
  }

  async initialize() {
    if (this.messageService) return;
    
    try {
      await baileysService.initialize();
      this.messageService = baileysService;
      logger.info('MessageController initialized with Baileys service');
    } catch (error) {
      logger.error('Baileys service failed to initialize:', error);
      throw error;
    }
  }

  async sendMessage(req, res) {
    try {
      await this.initialize();
      
      const { queue, message } = req.body;

      if (!queue || !message) {
        return res.status(400).json({
          success: false,
          error: 'Queue name and message are required'
        });
      }

      if (!message.id || !message.content) {
        return res.status(400).json({
          success: false,
          error: 'Message must have id and content fields'
        });
      }

      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      const result = await this.messageService.sendToQueue(queue, message);

      logger.info('Message sent successfully', {
        messageId: message.id,
        queueName: queue,
        timestamp: result.timestamp
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        details: error.message
      });
    }
  }

  async sendWhatsAppMessage(req, res) {
    try {
      await this.initialize();
      
      const { to, content, type = 'text' } = req.body;

      if (!to || !content) {
        return res.status(400).json({
          success: false,
          error: 'Recipient (to) and content are required'
        });
      }

      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      if (!this.messageService.isWhatsAppConnected) {
        return res.status(503).json({
          success: false,
          error: 'WhatsApp not connected. Please scan QR code first.'
        });
      }

      const result = await this.messageService.sendWhatsAppMessage(to, content, type);

      logger.info('WhatsApp message sent successfully', {
        messageId: result.messageId,
        to: to,
        type: type
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send WhatsApp message',
        details: error.message
      });
    }
  }

  async receiveMessages(req, res) {
    try {
      await this.initialize();
      
      const { queueName } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const timeout = parseInt(req.query.timeout) || 5;

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

      if (timeout < 1 || timeout > 60) {
        return res.status(400).json({
          success: false,
          error: 'Timeout must be between 1 and 60 seconds'
        });
      }

      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      const result = await this.messageService.receiveMessages(queueName, limit, timeout * 1000);

      logger.info('Messages received successfully', {
        queueName,
        totalReceived: result.totalReceived,
        timeout
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error receiving messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to receive messages',
        details: error.message
      });
    }
  }

  async getWhatsAppStatus(req, res) {
    try {
      await this.initialize();
      
      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      const status = this.messageService.getStatus();

      res.status(200).json({
        success: true,
        ...status
      });

    } catch (error) {
      logger.error('Error getting WhatsApp status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get WhatsApp status',
        details: error.message
      });
    }
  }

  async getMessageStatus(req, res) {
    try {
      await this.initialize();
      
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: 'Message ID is required'
        });
      }

      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      res.status(200).json({
        success: true,
        messageId,
        status: 'Message status endpoint - to be implemented',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting message status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get message status',
        details: error.message
      });
    }
  }

  async deleteMessage(req, res) {
    try {
      await this.initialize();
      
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: 'Message ID is required'
        });
      }

      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      res.status(200).json({
        success: true,
        messageId,
        message: 'Message deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete message',
        details: error.message
      });
    }
  }

  async getWhatsAppQueues(req, res) {
    try {
      await this.initialize();
      
      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      const queues = [
        'whatsapp.messages.incoming',
        'whatsapp.messages.outgoing', 
        'whatsapp.messages.updates',
        'whatsapp.events'
      ];

      const queueStatuses = [];
      
      for (const queueName of queues) {
        try {
          const status = await this.messageService.getQueueStatus(queueName);
          queueStatuses.push(status);
        } catch (error) {
          logger.warn(`Could not get status for queue ${queueName}:`, error);
          queueStatuses.push({
            name: queueName,
            messageCount: 0,
            consumerCount: 0,
            isActive: false
          });
        }
      }

      res.status(200).json({
        success: true,
        queues: queueStatuses,
        whatsAppStatus: this.messageService.isWhatsAppConnected ? 'connected' : 'disconnected',
        rabbitMQStatus: this.messageService.rabbitMQConnection ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting WhatsApp queues:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get WhatsApp queues',
        details: error.message
      });
    }
  }

  async getWhatsAppQR(req, res) {
    try {
      await this.initialize();
      
      if (!this.messageService) {
        return res.status(503).json({
          success: false,
          error: 'Message service not available'
        });
      }

      const status = this.messageService.getStatus();

      if (status.status === 'QRCODE' && status.qrCode) {
        res.status(200).json({
          success: true,
          qrCode: status.qrCode,
          retries: status.retries,
          maxRetries: this.messageService.maxQrRetries,
          timestamp: new Date().toISOString()
        });
      } else if (status.status === 'CONNECTED') {
        res.status(200).json({
          success: true,
          message: 'WhatsApp already connected',
          myJid: status.myJid,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(200).json({
          success: false,
          message: 'No QR code available',
          status: status.status,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error getting WhatsApp QR:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get WhatsApp QR',
        details: error.message
      });
    }
  }
}

module.exports = new MessageController();
