const Joi = require('joi');
const logger = require('../utils/logger');

const messageSchema = Joi.object({
  queue: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z0-9_-]+$/),
  message: Joi.object({
    id: Joi.string().required().min(1).max(255),
    content: Joi.string().required().min(1).max(10000),
    timestamp: Joi.string().isoDate().optional(),
    metadata: Joi.object({
      sender: Joi.string().optional().max(100),
      priority: Joi.string().valid('high', 'medium', 'low').optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      retryCount: Joi.number().integer().min(0).max(10).optional()
    }).optional()
  }).required()
});

const queueNameSchema = Joi.object({
  queueName: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z0-9_-]+$/)
});

const queryParamsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional(),
  timeout: Joi.number().integer().min(1).max(60000).optional(),
  requeue: Joi.boolean().optional(),
  ifUnused: Joi.boolean().optional(),
  ifEmpty: Joi.boolean().optional()
});

const queueOptionsSchema = Joi.object({
  durable: Joi.boolean().optional(),
  autoDelete: Joi.boolean().optional(),
  arguments: Joi.object().optional()
});

const validateMessage = (req, res, next) => {
  try {
    const { error, value } = messageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error for message:', {
        errors: errorDetails,
        body: req.body
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails
      });
    }

    req.validatedData = value;
    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
};

const validateQueueName = (req, res, next) => {
  try {
    const { error, value } = queueNameSchema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error for queue name:', {
        errors: errorDetails,
        params: req.params
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid queue name',
        details: errorDetails
      });
    }

    req.validatedData = value;
    next();
  } catch (error) {
    logger.error('Queue name validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
};

const validateQueryParams = (req, res, next) => {
  try {
    const { error, value } = queryParamsSchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error for query parameters:', {
        errors: errorDetails,
        query: req.query
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errorDetails
      });
    }

    req.validatedData = value;
    next();
  } catch (error) {
    logger.error('Query params validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
};

const validateQueueOptions = (req, res, next) => {
  try {
    const { error, value } = queueOptionsSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error for queue options:', {
        errors: errorDetails,
        body: req.body
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid queue options',
        details: errorDetails
      });
    }

    req.validatedData = value;
    next();
  } catch (error) {
    logger.error('Queue options validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
};

const validateMessageId = (req, res, next) => {
  try {
    const messageIdSchema = Joi.object({
      messageId: Joi.string().required().min(1).max(255)
    });

    const { error, value } = messageIdSchema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error for message ID:', {
        errors: errorDetails,
        params: req.params
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid message ID',
        details: errorDetails
      });
    }

    req.validatedData = value;
    next();
  } catch (error) {
    logger.error('Message ID validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
};

module.exports = {
  validateMessage,
  validateQueueName,
  validateQueryParams,
  validateQueueOptions,
  validateMessageId
};
