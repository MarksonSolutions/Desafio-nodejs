const logger = require('../utils/logger');

// Configuração de banco de dados (para futuras implementações)
const databaseConfig = {
  // Configuração para banco de dados relacional (opcional)
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'bayles_api',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  
  // Configuração para Redis (opcional, para cache)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASS || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  }
};

const validateDatabaseConfig = () => {
  const errors = [];

  // Validações básicas para PostgreSQL
  if (databaseConfig.postgres.host && !databaseConfig.postgres.database) {
    errors.push('DB_NAME is required when using PostgreSQL');
  }

  if (databaseConfig.postgres.host && !databaseConfig.postgres.username) {
    errors.push('DB_USER is required when using PostgreSQL');
  }

  // Validações básicas para Redis
  if (databaseConfig.redis.host && databaseConfig.redis.port < 1) {
    errors.push('REDIS_PORT must be a valid port number');
  }

  if (errors.length > 0) {
    logger.error('Database configuration validation failed:', errors);
    throw new Error(`Invalid database configuration: ${errors.join(', ')}`);
  }

  logger.info('Database configuration validated successfully');
  return true;
};

const getConnectionString = (type = 'postgres') => {
  if (type === 'postgres') {
    const { host, port, database, username, password } = databaseConfig.postgres;
    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }
  
  if (type === 'redis') {
    const { host, port, password, db } = databaseConfig.redis;
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}/${db}`;
  }
  
  throw new Error(`Unsupported database type: ${type}`);
};

module.exports = {
  databaseConfig,
  validateDatabaseConfig,
  getConnectionString
}; 