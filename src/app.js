require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const logger = require('./utils/logger');
const { errorHandler, notFound, requestLogger, corsOptions } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { validateMessage, validateQueueName, validateQueryParams, validateQueueOptions, validateMessageId } = require('./middleware/validation');

const messageController = require('./controllers/messageController');
const queueController = require('./controllers/queueController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use(rateLimiter);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Baileys API - WhatsApp Message Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      messages: {
        send: 'POST /api/messages/send',
        sendWhatsApp: 'POST /api/messages/whatsapp/send',
        receive: 'GET /api/messages/receive/:queueName',
        status: 'GET /api/messages/:messageId/status',
        delete: 'DELETE /api/messages/:messageId'
      },
      whatsapp: {
        status: 'GET /api/whatsapp/status',
        qr: 'GET /api/whatsapp/qr',
        queues: 'GET /api/whatsapp/queues'
      },
      queues: {
        status: 'GET /api/queues/status',
        queueStatus: 'GET /api/queues/:queueName/status',
        create: 'POST /api/queues/:queueName',
        delete: 'DELETE /api/queues/:queueName',
        purge: 'POST /api/queues/:queueName/purge',
        messages: 'GET /api/queues/:queueName/messages',
        health: 'GET /api/queues/health'
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'baileys-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'baileys-api',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/messages/send', validateMessage, async (req, res) => {
  try {
    await messageController.sendMessage(req, res);
  } catch (error) {
    logger.error('Unhandled error in sendMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/messages/whatsapp/send', async (req, res) => {
  try {
    await messageController.sendWhatsAppMessage(req, res);
  } catch (error) {
    logger.error('Unhandled error in sendWhatsAppMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/messages/receive/:queueName', validateQueueName, validateQueryParams, async (req, res) => {
  try {
    await messageController.receiveMessages(req, res);
  } catch (error) {
    logger.error('Unhandled error in receiveMessages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/messages/:messageId/status', validateMessageId, async (req, res) => {
  try {
    await messageController.getMessageStatus(req, res);
  } catch (error) {
    logger.error('Unhandled error in getMessageStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.delete('/api/messages/:messageId', validateMessageId, async (req, res) => {
  try {
    await messageController.deleteMessage(req, res);
  } catch (error) {
    logger.error('Unhandled error in deleteMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    await messageController.getWhatsAppStatus(req, res);
  } catch (error) {
    logger.error('Unhandled error in getWhatsAppStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/whatsapp/queues', async (req, res) => {
  try {
    await messageController.getWhatsAppQueues(req, res);
  } catch (error) {
    logger.error('Unhandled error in getWhatsAppQueues:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    await messageController.getWhatsAppQR(req, res);
  } catch (error) {
    logger.error('Unhandled error in getWhatsAppQR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/queues/status', async (req, res) => {
  try {
    await queueController.getQueuesStatus(req, res);
  } catch (error) {
    logger.error('Unhandled error in getQueuesStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/queues/:queueName/status', validateQueueName, async (req, res) => {
  try {
    await queueController.getQueueStatus(req, res);
  } catch (error) {
    logger.error('Unhandled error in getQueueStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/queues/:queueName', validateQueueName, validateQueueOptions, async (req, res) => {
  try {
    await queueController.createQueue(req, res);
  } catch (error) {
    logger.error('Unhandled error in createQueue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.delete('/api/queues/:queueName', validateQueueName, validateQueryParams, async (req, res) => {
  try {
    await queueController.deleteQueue(req, res);
  } catch (error) {
    logger.error('Unhandled error in deleteQueue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/queues/:queueName/purge', validateQueueName, async (req, res) => {
  try {
    await queueController.purgeQueue(req, res);
  } catch (error) {
    logger.error('Unhandled error in purgeQueue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/queues/:queueName/messages', validateQueueName, validateQueryParams, async (req, res) => {
  try {
    await queueController.getQueueMessages(req, res);
  } catch (error) {
    logger.error('Unhandled error in getQueueMessages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/queues/health', async (req, res) => {
  try {
    await queueController.getHealthStatus(req, res);
  } catch (error) {
    logger.error('Unhandled error in getHealthStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = app;
