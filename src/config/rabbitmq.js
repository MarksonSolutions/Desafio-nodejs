const logger = require('../utils/logger');

const rabbitMQConfig = {
  connection: {
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT) || 5672,
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASS || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/'
  },
  queues: {
    defaultExchange: 'direct',
    prefetch: parseInt(process.env.RABBITMQ_PREFETCH) || 10,
    durable: process.env.RABBITMQ_DURABLE !== 'false',
    autoDelete: process.env.RABBITMQ_AUTO_DELETE === 'true'
  },
  retry: {
    maxRetries: parseInt(process.env.RABBITMQ_MAX_RETRIES) || 5,
    retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY) || 5000,
    backoffMultiplier: parseFloat(process.env.RABBITMQ_BACKOFF_MULTIPLIER) || 2
  },
  deadLetter: {
    exchange: process.env.RABBITMQ_DLX_EXCHANGE || 'dlx',
    routingKey: process.env.RABBITMQ_DLX_ROUTING_KEY || 'failed',
    ttl: parseInt(process.env.RABBITMQ_DLX_TTL) || 86400000
  }
};

const getConnectionString = () => {
  const { hostname, port, username, password, vhost } = rabbitMQConfig.connection;
  return `amqp://${username}:${password}@${hostname}:${port}${vhost}`;
};

const validateConfig = () => {
  const errors = [];

  if (!rabbitMQConfig.connection.hostname) {
    errors.push('RABBITMQ_HOST is required');
  }

  if (rabbitMQConfig.connection.port < 1 || rabbitMQConfig.connection.port > 65535) {
    errors.push('RABBITMQ_PORT must be between 1 and 65535');
  }

  if (!rabbitMQConfig.connection.username) {
    errors.push('RABBITMQ_USER is required');
  }

  if (!rabbitMQConfig.connection.password) {
    errors.push('RABBITMQ_PASS is required');
  }

  if (errors.length > 0) {
    logger.error('RabbitMQ configuration validation failed:', errors);
    throw new Error(`Invalid RabbitMQ configuration: ${errors.join(', ')}`);
  }

  logger.info('RabbitMQ configuration validated successfully');
  return true;
};

module.exports = {
  rabbitMQConfig,
  getConnectionString,
  validateConfig
};
