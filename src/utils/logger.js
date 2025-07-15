const winston = require('winston');

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

const customFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  let metaString = '';
  if (Object.keys(meta).length > 0) {
    metaString = ' ' + JSON.stringify(meta, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Error) {
          return {
            message: value.message,
            stack: value.stack,
            name: value.name
          };
        }
        if (value.toString === Object.prototype.toString) {
          return JSON.stringify(value);
        }
      }
      return value;
    }, 2);
  }
  
  return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
});

const logger = winston.createLogger({
  level: logLevel,
  format: logFormat === 'json' 
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        customFormat
      ),
  defaultMeta: { service: 'baileys-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

logger.child = function (options) {
  const childLogger = winston.createLogger({
    level: this.level,
    format: this.format,
    defaultMeta: { ...this.defaultMeta, ...options },
    transports: this.transports
  });
  childLogger.child = logger.child.bind(childLogger);
  return childLogger;
};

module.exports = logger;
