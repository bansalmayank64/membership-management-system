/**
 * Comprehensive Logging Utility for Study Room Management System
 * Provides consistent logging patterns across all route files
 */

class APILogger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId(endpoint) {
    return `${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format timestamp
   */
  timestamp() {
    return new Date().toISOString();
  }

  /**
   * Log API request start
   */
  requestStart(method, endpoint, req, requestId = null) {
    const id = requestId || this.generateRequestId(endpoint);
    const emoji = this.getMethodEmoji(method);
    
    console.log(`\n${emoji} [${this.timestamp()}] Starting ${method.toUpperCase()} ${endpoint} [${id}]`);
    console.log(`📊 Request details: IP=${req.ip}, User-Agent=${req.get('User-Agent')?.substring(0, 50)}...`);
    
    if (Object.keys(req.query || {}).length > 0) {
      console.log(`🔍 Query params:`, req.query);
    }
    
    if (Object.keys(req.params || {}).length > 0) {
      console.log(`📋 Route params:`, req.params);
    }
    
    if (req.body && Object.keys(req.body).length > 0) {
      // Mask sensitive data
      const safBody = this.maskSensitiveData(req.body);
      console.log(`📨 Request body:`, safBody);
    }
    
    if (req.user) {
      console.log(`👤 Authenticated user: ${req.user.username} (ID: ${req.user.userId}, Role: ${req.user.role})`);
    }
    
    return id;
  }

  /**
   * Log API request success
   */
  requestSuccess(method, endpoint, requestId, startTime, result = null) {
    const emoji = this.getMethodEmoji(method);
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${emoji} [${this.timestamp()}] ${method.toUpperCase()} ${endpoint} completed successfully in ${duration}ms [${requestId}]`);
    
    if (result) {
      if (Array.isArray(result)) {
        console.log(`📊 Result: ${result.length} records returned`);
        if (result.length > 0 && result.length <= 3) {
          console.log(`📋 Sample data:`, result.slice(0, 2));
        }
      } else if (typeof result === 'object') {
        // console.log(`📋 Result data:`, result);
      }
    }
  }

  /**
   * Log API request error
   */
  requestError(method, endpoint, requestId, startTime, error, additionalContext = {}) {
    const emoji = this.getMethodEmoji(method);
    const duration = Date.now() - startTime;
    
    console.error(`❌ ${emoji} [${this.timestamp()}] ${method.toUpperCase()} ${endpoint} FAILED after ${duration}ms [${requestId}]`);
    console.error(`💥 Error details:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      ...additionalContext
    });
  }

  /**
   * Log database query execution
   */
  queryStart(queryDescription, query = null, params = null) {
    console.log(`🔍 Step: ${queryDescription}...`);
    
    if (query) {
      // Log query but truncate if too long
      const truncatedQuery = query.length > 500 ? query.substring(0, 500) + '...' : query;
      console.log(`📝 SQL Query:`, truncatedQuery.replace(/\s+/g, ' ').trim());
    }
    
    if (params && params.length > 0) {
      // Mask sensitive parameters
      const safeParams = this.maskSensitiveData(params);
      console.log(`📋 Query params:`, safeParams);
    }
    
    return Date.now();
  }

  /**
   * Log database query completion
   */
  querySuccess(queryDescription, queryStartTime, result, showSampleData = true) {
    const duration = Date.now() - queryStartTime;
    const rowCount = result.rows ? result.rows.length : result.rowCount || 0;
    
    console.log(`✅ ${queryDescription} completed in ${duration}ms, affected/returned ${rowCount} rows`);
    
    if (showSampleData && result.rows && result.rows.length > 0 && result.rows.length <= 3) {
      console.log(`📋 Sample result:`, result.rows.slice(0, 2));
    }
    
    return duration;
  }

  /**
   * Log database query error
   */
  queryError(queryDescription, queryStartTime, error) {
    const duration = Date.now() - queryStartTime;
    
    console.error(`❌ ${queryDescription} FAILED after ${duration}ms`);
    console.error(`💥 Database error:`, {
      message: error.message,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });
  }

  /**
   * Log validation steps
   */
  validationStart(step) {
    console.log(`🔍 Step: ${step}...`);
  }

  /**
   * Log validation success
   */
  validationSuccess(step, details = null) {
    console.log(`✅ ${step} - validation passed`);
    if (details) {
      console.log(`📋 Validation details:`, details);
    }
  }

  /**
   * Log validation error
   */
  validationError(step, errors) {
    console.log(`❌ ${step} - validation failed`);
    console.log(`📋 Validation errors:`, errors);
  }

  /**
   * Log business logic steps
   */
  businessLogic(step, details = null) {
    console.log(`🔄 Step: ${step}`);
    if (details) {
      console.log(`📊 Details:`, details);
    }
  }

  /**
   * Log transaction operations
   */
  transactionStart() {
    console.log(`📝 Starting database transaction...`);
  }

  /**
   * Log transaction commit
   */
  transactionCommit() {
    console.log(`💯 Transaction committed successfully`);
  }

  /**
   * Log transaction rollback
   */
  transactionRollback(reason = null) {
    console.log(`🔄 Rolling back transaction${reason ? `: ${reason}` : ''}...`);
  }

  /**
   * Log statistics and summaries
   */
  statistics(title, stats) {
    console.log(`📈 ${title}:`, stats);
  }

  /**
   * Log general info
   */
  info(message, data = null) {
    console.log(`ℹ️ ${message}`);
    if (data) {
      console.log(`📋 Data:`, data);
    }
  }

  /**
   * Log warnings
   */
  warn(message, data = null) {
    console.warn(`⚠️ ${message}`);
    if (data) {
      console.warn(`📋 Warning data:`, data);
    }
  }

  /**
   * Log errors (general-purpose)
   * This mirrors the interface expected by middleware (logger.error(message, data))
   */
  error(message, data = null) {
    console.error(`❌ ${message}`);
    if (data) {
      // Avoid dumping very large objects directly; show masked/summarized where possible
      try {
        console.error(`📋 Error data:`, data);
      } catch (e) {
        console.error(`📋 Error data (stringified):`, String(data));
      }
    }
  }

  /**
   * Get emoji for HTTP method
   */
  getMethodEmoji(method) {
    const emojis = {
      GET: '📖',
      POST: '➕',
      PUT: '✏️',
      PATCH: '🔧',
      DELETE: '🗑️'
    };
    return emojis[method.toUpperCase()] || '🔗';
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data) {
    if (!data) return data;
    
    const sensitiveFields = [
      'password', 'password_hash', 'token', 'authorization',
      'auth', 'secret', 'key', 'private', 'confidential'
    ];
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }
    
    if (typeof data === 'object') {
      const masked = { ...data };
      
      Object.keys(masked).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          masked[key] = '[MASKED]';
        } else if (typeof masked[key] === 'object') {
          masked[key] = this.maskSensitiveData(masked[key]);
        }
      });
      
      return masked;
    }
    
    return data;
  }

  /**
   * Create a scoped logger for a specific request
   */
  createRequestLogger(method, endpoint, req) {
    const requestId = this.generateRequestId(endpoint);
    const startTime = Date.now();
    
    // Log request start
    this.requestStart(method, endpoint, req, requestId);
    
    return {
      requestId,
      startTime,
      success: (result) => this.requestSuccess(method, endpoint, requestId, startTime, result),
      error: (error, context) => this.requestError(method, endpoint, requestId, startTime, error, context),
      queryStart: (desc, query, params) => this.queryStart(desc, query, params),
      querySuccess: (desc, queryStartTime, result, showSample) => this.querySuccess(desc, queryStartTime, result, showSample),
      queryError: (desc, queryStartTime, error) => this.queryError(desc, queryStartTime, error),
      validationStart: (step) => this.validationStart(step),
      validationSuccess: (step, details) => this.validationSuccess(step, details),
      validationError: (step, errors) => this.validationError(step, errors),
      businessLogic: (step, details) => this.businessLogic(step, details),
      transactionStart: () => this.transactionStart(),
      transactionCommit: () => this.transactionCommit(),
      transactionRollback: (reason) => this.transactionRollback(reason),
      statistics: (title, stats) => this.statistics(title, stats),
      info: (message, data) => this.info(message, data),
      warn: (message, data) => this.warn(message, data)
  ,
  // Backwards-compatible request-level helpers
  requestStart: (req) => this.requestStart(method, endpoint, req, requestId),
  requestSuccess: (result) => this.requestSuccess(method, endpoint, requestId, startTime, result),
  requestError: (error, context) => this.requestError(method, endpoint, requestId, startTime, error, context)
    };
  }
}

// Create singleton instance
const logger = new APILogger();

module.exports = logger;
