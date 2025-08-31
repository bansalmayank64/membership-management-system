/**
 * Database Logging Utility for Study Room Management System
 * Provides comprehensive database operation logging with performance monitoring
 */

const logger = require('./logger');

class DatabaseLogger {
  constructor() {
    this.connectionPool = null;
    this.slowQueryThreshold = 1000; // ms
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      totalTime: 0
    };
  }

  /**
   * Initialize with database pool for connection monitoring
   */
  init(pool) {
    this.connectionPool = pool;
  }

  /**
   * Log database connection status
   */
  logConnectionStatus() {
    if (this.connectionPool) {
      logger.info('🔌 Database pool status:', {
        totalConnections: this.connectionPool.totalCount,
        idleConnections: this.connectionPool.idleCount,
        waitingClients: this.connectionPool.waitingCount
      });
    }
  }

  /**
   * Log query with performance monitoring
   */
  async executeQuery(client, query, params = [], description = 'Database query') {
    const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    logger.info(`\n🔍 [${new Date().toISOString()}] Executing ${description} [${queryId}]`);

    // Log query details
    const truncatedQuery = query.length > 300 ? query.substring(0, 300) + '...' : query;
    logger.info('📝 SQL:', truncatedQuery.replace(/\s+/g, ' ').trim());

    if (params && params.length > 0) {
      logger.info('📋 Parameters:', this.maskSensitiveParams(params));
    }
    
    try {
      // Execute query
      const result = await client.query(query, params);
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.queryStats.totalQueries++;
      this.queryStats.totalTime += duration;
      
      if (duration > this.slowQueryThreshold) {
        this.queryStats.slowQueries++;
        logger.warn(`⚠️ SLOW QUERY DETECTED: ${duration}ms (threshold: ${this.slowQueryThreshold}ms)`);
      }
      
      // Log success
      logger.info(`✅ Query completed in ${duration}ms, affected/returned ${result.rows?.length || result.rowCount || 0} rows [${queryId}]`);
      
      // Log sample data for SELECT queries
      if (result.rows && result.rows.length > 0 && result.rows.length <= 3) {
        logger.info('📊 Sample result:', result.rows.slice(0, 2));
      }
      
      // Log connection status after query
      this.logConnectionStatus();
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update error statistics
      this.queryStats.failedQueries++;
      
      // Log error with comprehensive details
      logger.warn(`❌ Query FAILED after ${duration}ms [${queryId}]`);
      logger.warn('💥 Database error details:', {
        message: error.message,
        code: error.code,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        internalPosition: error.internalPosition,
        internalQuery: error.internalQuery,
        where: error.where,
        schema: error.schema,
        table: error.table,
        column: error.column,
        dataType: error.dataType,
        constraint: error.constraint,
        file: error.file,
        line: error.line,
        routine: error.routine
      });
      
      // Log query context for debugging
      logger.info('🔍 Query context:', {
        description,
        queryLength: query.length,
        paramCount: params ? params.length : 0,
        connectionPoolStatus: this.connectionPool ? {
          total: this.connectionPool.totalCount,
          idle: this.connectionPool.idleCount,
          waiting: this.connectionPool.waitingCount
        } : 'Not available'
      });
      
      throw error;
    }
  }

  /**
   * Log transaction operations
   */
  async executeTransaction(client, operations, description = 'Database transaction') {
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
  logger.info(`\n🔄 [${new Date().toISOString()}] Starting ${description} [${transactionId}]`);
    
    try {
      // Begin transaction
  logger.info('📝 BEGIN transaction...');
      await client.query('BEGIN');
      
      let operationResults = [];
      
      // Execute operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
  logger.info(`🔄 Transaction step ${i + 1}/${operations.length}: ${operation.description || `Operation ${i + 1}`}`);
        
        const result = await this.executeQuery(
          client, 
          operation.query, 
          operation.params, 
          operation.description || `Transaction operation ${i + 1}`
        );
        
        operationResults.push(result);
      }
      
      // Commit transaction
  logger.info('💯 COMMIT transaction...');
      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
  logger.info(`✅ Transaction completed successfully in ${duration}ms [${transactionId}]`);
  logger.info(`📊 Transaction summary: ${operations.length} operations executed`);
      
      return operationResults;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
  logger.warn(`❌ Transaction FAILED after ${duration}ms [${transactionId}]`);
  logger.info('🔄 Rolling back transaction...');
      
      try {
        await client.query('ROLLBACK');
  logger.info('✅ Transaction rollback completed');
      } catch (rollbackError) {
  logger.warn('💥 ROLLBACK FAILED:', rollbackError.message);
      }
      
      throw error;
    }
  }

  /**
   * Log bulk operations (like imports)
   */
  async executeBulkOperation(client, items, operation, description = 'Bulk operation') {
    const bulkId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
  logger.info(`\n📦 [${new Date().toISOString()}] Starting ${description} [${bulkId}]`);
  logger.info(`📊 Processing ${items.length} items`);
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        results.processed++;
        
        try {
          // Log progress every 10 items or at specific milestones
          if (i % 10 === 0 || i === items.length - 1) {
            logger.info(`📈 Progress: ${i + 1}/${items.length} (${Math.round((i + 1) / items.length * 100)}%)`);
          }
          
          await operation(client, item, i);
          results.successful++;
          
        } catch (itemError) {
          results.failed++;
          results.errors.push({
            index: i,
            item: item,
            error: {
              message: itemError.message,
              code: itemError.code,
              constraint: itemError.constraint
            }
          });
          
          logger.warn(`❌ Item ${i + 1} failed:`, {
            index: i,
            error: itemError.message,
            code: itemError.code
          });
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Bulk operation completed in ${duration}ms [${bulkId}]`);
      logger.info(`📊 Results: ${results.successful} successful, ${results.failed} failed out of ${results.processed} processed`);
      
      if (results.errors.length > 0) {
        logger.warn('⚠️ Errors occurred during bulk operation:', results.errors.slice(0, 5)); // Show first 5 errors
      }
      
      return results;
      
    } catch (error) {
  const duration = Date.now() - startTime;
  logger.warn(`❌ Bulk operation FAILED after ${duration}ms [${bulkId}]`);
  logger.warn('💥 Error:', error.message);
      
      throw error;
    }
  }

  /**
   * Log query performance statistics
   */
  logPerformanceStats() {
    logger.info('\n📈 Database Performance Statistics:');
    logger.info('📊 Total queries executed:', { totalQueries: this.queryStats.totalQueries });
    logger.info(`⚠️ Slow queries (>${this.slowQueryThreshold}ms): ${this.queryStats.slowQueries}`);
    logger.info(`❌ Failed queries: ${this.queryStats.failedQueries}`);
    logger.info(`⏱️ Average query time: ${this.queryStats.totalQueries > 0 ? Math.round(this.queryStats.totalTime / this.queryStats.totalQueries) : 0}ms`);
    logger.info('🔌 Connection pool status:', this.connectionPool ? {
      total: this.connectionPool.totalCount,
      idle: this.connectionPool.idleCount,
      waiting: this.connectionPool.waitingCount
    } : 'Not available');
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      totalTime: 0
    };
    logger.info('📊 Database statistics reset');
  }

  /**
   * Mask sensitive parameters
   */
  maskSensitiveParams(params) {
    if (!Array.isArray(params)) return params;
    
    return params.map((param, index) => {
      // Mask potential passwords, tokens, etc.
      if (typeof param === 'string' && param.length > 20 && /[A-Za-z0-9+/=]/.test(param)) {
        return '[MASKED_PARAM]';
      }
      return param;
    });
  }

  /**
   * Log database schema validation
   */
  async validateSchema(client, validations) {
  logger.info('\n🔍 Starting database schema validation...');
    
    const results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
    
    for (const validation of validations) {
      try {
  logger.info(`🔍 Validating: ${validation.description}`);
        
        const result = await this.executeQuery(client, validation.query, validation.params, validation.description);
        
        if (validation.expected) {
          const passed = validation.expected(result);
          if (passed) {
            results.passed++;
            logger.info(`✅ ${validation.description} - PASSED`);
          } else {
            results.failed++;
            logger.warn(`❌ ${validation.description} - FAILED`);
          }
        } else {
          results.passed++;
    logger.info(`✅ ${validation.description} - COMPLETED`);
        }
        
        results.details.push({
          name: validation.description,
          status: 'passed',
          result: result.rows
        });
        
      } catch (error) {
  results.failed++;
  logger.warn(`❌ ${validation.description} - ERROR: ${error.message}`);
        
        results.details.push({
          name: validation.description,
          status: 'failed',
          error: error.message
        });
      }
    }
    
  logger.info(`\n📊 Schema validation results: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
    
    return results;
  }
}

// Create singleton instance
const dbLogger = new DatabaseLogger();

module.exports = dbLogger;
