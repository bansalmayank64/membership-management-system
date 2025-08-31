/**
 * Request Logging Middleware for Study Room Management System
 * Automatically logs all incoming requests and responses
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware that tracks all API calls
 */
function requestLoggingMiddleware(req, res, next) {
  // Generate unique request ID
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Add request ID to request object for use in route handlers
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Extract request information
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Log incoming request (minimal and structured)
  const contentLength = req.get('Content-Length');
  logger.info(`Incoming ${method} ${url}`, {
    requestId,
    ip,
    userAgent: userAgent.substring(0, 100),
    contentLength: contentLength ? Number(contentLength) : undefined
  });

  // Log authentication presence only (never print tokens)
  if (req.headers.authorization) {
    logger.info('Authorization header present', { requestId });
  }

  if (Object.keys(req.query || {}).length > 0) {
    logger.info('Query params', { requestId, query: req.query });
  }

  if (Object.keys(req.params || {}).length > 0) {
    logger.info('Route params', { requestId, params: req.params });
  }

  if (req.body && Object.keys(req.body).length > 0 && method !== 'GET') {
    const maskedBody = logger.maskSensitiveData(req.body);
    logger.info('Request body received', { requestId, body: maskedBody });
  }
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    if (statusCode >= 200 && statusCode < 300) {
      logger.info('Response sent', { requestId, method, url, statusCode, duration, count: Array.isArray(data) ? data.length : undefined });
    } else if (statusCode >= 400 && statusCode < 500) {
      logger.warn('Client error response', { requestId, method, url, statusCode, data });
    } else if (statusCode >= 500) {
      logger.error('Server error response', { requestId, method, url, statusCode });
    }

    return originalJson.call(this, data);
  };
  
  // Override res.status to capture status codes
  const originalStatus = res.status;
  res.status = function(code) {
    return originalStatus.call(this, code);
  };
  
  // Handle response end for non-JSON responses
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Only log if we haven't already logged via res.json
    if (!res.headersSent || res.getHeader('content-type')?.includes('json') === false) {
      if (statusCode >= 200 && statusCode < 300) {
        logger.info('Request completed', { requestId, method, url, statusCode, duration });
      } else if (statusCode >= 300 && statusCode < 400) {
        // Redirects / Not Modified etc. are informational in this context
        logger.info('Request completed with redirect/info', { requestId, method, url, statusCode, duration });
      } else if (statusCode >= 400 && statusCode < 500) {
        logger.warn('Request completed with client error', { requestId, method, url, statusCode, duration });
      } else {
        logger.error('Request completed with server error', { requestId, method, url, statusCode, duration });
      }
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Log any unhandled errors
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    logger.error('Response error', { requestId, method, url, duration, error: { message: error.message, stack: error.stack } });
  });
  
  // Continue to next middleware
  next();
}

/**
 * Enhanced error logging middleware
 */
function errorLoggingMiddleware(error, req, res, next) {
  const requestId = req.requestId || `error-${Date.now()}`;
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  logger.error('Unhandled error in request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    duration,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status || error.statusCode
    },
    context: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      params: req.params,
      query: req.query,
      body: logger.maskSensitiveData(req.body),
      user: req.user ? { id: req.user.userId, username: req.user.username, role: req.user.role } : null
    }
  });
  
  // Send error response if not already sent
  if (!res.headersSent) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : error.message,
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

/**
 * Database connection logging middleware
 */
function dbConnectionMiddleware(req, res, next) {
  // Log database pool status periodically (every 100 requests)
  if (!dbConnectionMiddleware.requestCounter) {
    dbConnectionMiddleware.requestCounter = 0;
  }
  
  dbConnectionMiddleware.requestCounter++;
  
  if (dbConnectionMiddleware.requestCounter % 100 === 0) {
    logger.info('Database connection status check', { requestCounter: dbConnectionMiddleware.requestCounter });
    if (global.dbPool) {
      logger.info('Connection pool status', {
        total: global.dbPool.totalCount,
        idle: global.dbPool.idleCount,
        waiting: global.dbPool.waitingCount
      });
    }
  }
  
  next();
}

/**
 * Performance monitoring middleware
 */
function performanceMiddleware(req, res, next) {
  // Track memory usage for large requests
  const memBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const memAfter = process.memoryUsage();
    const memDiff = {
      rss: memAfter.rss - memBefore.rss,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal
    };
    
    // Log if significant memory change (> 10MB)
    if (Math.abs(memDiff.heapUsed) > 10 * 1024 * 1024) {
      logger.info('Significant memory usage change', {
        requestId: req.requestId,
        heapUsed: `${(memDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(memDiff.rss / 1024 / 1024).toFixed(2)}MB`
      });
    }
  });
  
  next();
}

module.exports = {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  dbConnectionMiddleware,
  performanceMiddleware
};
