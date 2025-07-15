const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000; // 15 minutos
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now - data.timestamp > this.windowMs) {
        this.requests.delete(key);
      }
    }
  }

  getClientIdentifier(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  isWhitelisted(req) {
    const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST 
      ? process.env.RATE_LIMIT_WHITELIST.split(',') 
      : [];
    
    const clientIP = this.getClientIdentifier(req);
    return whitelistedIPs.includes(clientIP);
  }

  rateLimit = (req, res, next) => {
    if (this.isWhitelisted(req)) {
      return next();
    }

    const clientId = this.getClientIdentifier(req);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, {
        count: 1,
        timestamp: now,
        resetTime: now + this.windowMs
      });
      return next();
    }

    const clientData = this.requests.get(clientId);

    if (now - clientData.timestamp > this.windowMs) {
      clientData.count = 1;
      clientData.timestamp = now;
      clientData.resetTime = now + this.windowMs;
    } else {
      clientData.count++;
    }

    if (clientData.count > this.maxRequests) {
      logger.warn('Rate limit exceeded', {
        clientId,
        count: clientData.count,
        maxRequests: this.maxRequests,
        resetTime: new Date(clientData.resetTime).toISOString()
      });

      const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);

      res.set({
        'X-RateLimit-Limit': this.maxRequests,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
        'Retry-After': retryAfter
      });

      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }

    res.set({
      'X-RateLimit-Limit': this.maxRequests,
      'X-RateLimit-Remaining': this.maxRequests - clientData.count,
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
    });

    next();
  };

  specificRateLimit = (maxRequests, windowMs = this.windowMs) => {
    const specificRequests = new Map();
    
    return (req, res, next) => {
      const clientId = this.getClientIdentifier(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!specificRequests.has(clientId)) {
        specificRequests.set(clientId, {
          count: 1,
          timestamp: now,
          resetTime: now + windowMs
        });
        return next();
      }

      const clientData = specificRequests.get(clientId);

      if (now - clientData.timestamp > windowMs) {
        clientData.count = 1;
        clientData.timestamp = now;
        clientData.resetTime = now + windowMs;
      } else {
        clientData.count++;
      }

      if (clientData.count > maxRequests) {
        logger.warn('Specific rate limit exceeded', {
          clientId,
          count: clientData.count,
          maxRequests,
          endpoint: req.path
        });

        const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);

        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded for this endpoint. Try again in ${retryAfter} seconds.`,
          retryAfter
        });
      }

      next();
    };
  };

  burstRateLimit = (maxBurst = 10, windowMs = 60000) => {
    const burstRequests = new Map();
    
    return (req, res, next) => {
      const clientId = this.getClientIdentifier(req);
      const now = Date.now();

      if (!burstRequests.has(clientId)) {
        burstRequests.set(clientId, {
          tokens: maxBurst,
          lastRefill: now,
          maxBurst
        });
      }

      const clientData = burstRequests.get(clientId);
      const timePassed = now - clientData.lastRefill;
      const tokensToAdd = Math.floor(timePassed / windowMs);
      
      clientData.tokens = Math.min(clientData.maxBurst, clientData.tokens + tokensToAdd);
      clientData.lastRefill = now;

      if (clientData.tokens > 0) {
        clientData.tokens--;
        next();
      } else {
        logger.warn('Burst rate limit exceeded', {
          clientId,
          endpoint: req.path
        });

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: 'Burst rate limit exceeded. Please slow down your requests.'
        });
      }
    };
  };

  getStats() {
    const stats = {
      totalClients: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      clients: []
    };

    for (const [clientId, data] of this.requests.entries()) {
      stats.clients.push({
        clientId,
        count: data.count,
        timestamp: new Date(data.timestamp).toISOString(),
        resetTime: new Date(data.resetTime).toISOString()
      });
    }

    return stats;
  }

  reset() {
    this.requests.clear();
    logger.info('Rate limiter reset');
  }
}

const rateLimiter = new RateLimiter();

module.exports = {
  rateLimiter: rateLimiter.rateLimit,
  specificRateLimit: rateLimiter.specificRateLimit.bind(rateLimiter),
  burstRateLimit: rateLimiter.burstRateLimit.bind(rateLimiter),
  getStats: rateLimiter.getStats.bind(rateLimiter),
  reset: rateLimiter.reset.bind(rateLimiter)
};
