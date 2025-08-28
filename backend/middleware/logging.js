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
  
  // Log incoming request
  console.log(`\n🌐 [${new Date().toISOString()}] Incoming ${method} ${url} [${requestId}]`);
  console.log(`📍 Client: IP=${ip}, User-Agent=${userAgent.substring(0, 50)}...`);
  
  // Log authentication info if available
  if (req.headers.authorization) {
    console.log(`🔐 Authorization: [TOKEN_PRESENT]`);
  }
  
  // Log request size
  const contentLength = req.get('Content-Length');
  if (contentLength) {
    console.log(`📦 Content-Length: ${contentLength} bytes`);
  }
  
  // Log query parameters
  if (Object.keys(req.query || {}).length > 0) {
    console.log(`🔍 Query params:`, req.query);
  }
  
  // Log route parameters
  if (Object.keys(req.params || {}).length > 0) {
    console.log(`📋 Route params:`, req.params);
  }
  
  // Log request body (for non-GET requests, mask sensitive data)
  if (req.body && Object.keys(req.body).length > 0 && method !== 'GET') {
    const maskedBody = logger.maskSensitiveData(req.body);
    console.log(`📨 Request body:`, maskedBody);
  }
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log response
    if (statusCode >= 200 && statusCode < 300) {
      console.log(`✅ [${new Date().toISOString()}] ${method} ${url} completed with ${statusCode} in ${duration}ms [${requestId}]`);
      
      // Log response data summary
      if (Array.isArray(data)) {
        console.log(`📊 Response: ${data.length} records returned`);
      } else if (data && typeof data === 'object') {
        if (data.error) {
          console.log(`❌ Error response: ${data.error}`);
        } else {
          console.log(`📋 Response: Object with ${Object.keys(data).length} properties`);
        }
      }
    } else if (statusCode >= 400 && statusCode < 500) {
      console.warn(`⚠️ [${new Date().toISOString()}] ${method} ${url} failed with ${statusCode} in ${duration}ms [${requestId}]`);
      console.warn(`📋 Client error response:`, data);
    } else if (statusCode >= 500) {
      console.error(`❌ [${new Date().toISOString()}] ${method} ${url} failed with ${statusCode} in ${duration}ms [${requestId}]`);
      console.error(`📋 Server error response:`, data);
    }
    
    // Call original json method
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
        console.log(`✅ [${new Date().toISOString()}] ${method} ${url} completed with ${statusCode} in ${duration}ms [${requestId}]`);
      } else {
        console.error(`❌ [${new Date().toISOString()}] ${method} ${url} failed with ${statusCode} in ${duration}ms [${requestId}]`);
      }
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Log any unhandled errors
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    console.error(`💥 [${new Date().toISOString()}] Response error for ${method} ${url} after ${duration}ms [${requestId}]`);
    console.error(`Error details:`, error);
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
  
  console.error(`💥 [${new Date().toISOString()}] Unhandled error in ${req.method} ${req.originalUrl} after ${duration}ms [${requestId}]`);
  console.error(`Error details:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.status,
    statusCode: error.statusCode
  });
  
  console.error(`Request context:`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    params: req.params,
    query: req.query,
    body: logger.maskSensitiveData(req.body),
    user: req.user ? {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    } : null
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
    console.log(`\n📊 [${new Date().toISOString()}] Database connection status check (request #${dbConnectionMiddleware.requestCounter})`);
    
    // This would be set by the database logger when initialized
    if (global.dbPool) {
      console.log(`🔌 Connection pool:`, {
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
      console.log(`📈 [${req.requestId}] Memory usage change:`, {
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
