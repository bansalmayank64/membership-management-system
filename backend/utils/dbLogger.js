/**
 * Database Logging Utility for Study Room Management System
 * Provides comprehensive database operation logging with performance monitoring
 */

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
      console.log(`🔌 Database pool status:`, {
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
    
    console.log(`\n🔍 [${new Date().toISOString()}] Executing ${description} [${queryId}]`);
    
    // Log query details
    const truncatedQuery = query.length > 300 ? query.substring(0, 300) + '...' : query;
    console.log(`📝 SQL:`, truncatedQuery.replace(/\s+/g, ' ').trim());
    
    if (params && params.length > 0) {
      console.log(`📋 Parameters:`, this.maskSensitiveParams(params));
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
        console.warn(`⚠️ SLOW QUERY DETECTED: ${duration}ms (threshold: ${this.slowQueryThreshold}ms)`);
      }
      
      // Log success
      console.log(`✅ Query completed in ${duration}ms, affected/returned ${result.rows?.length || result.rowCount || 0} rows [${queryId}]`);
      
      // Log sample data for SELECT queries
      if (result.rows && result.rows.length > 0 && result.rows.length <= 3) {
        console.log(`📊 Sample result:`, result.rows.slice(0, 2));
      }
      
      // Log connection status after query
      this.logConnectionStatus();
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update error statistics
      this.queryStats.failedQueries++;
      
      // Log error with comprehensive details
      console.error(`❌ Query FAILED after ${duration}ms [${queryId}]`);
      console.error(`💥 Database error details:`, {
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
      console.error(`🔍 Query context:`, {
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
    
    console.log(`\n🔄 [${new Date().toISOString()}] Starting ${description} [${transactionId}]`);
    
    try {
      // Begin transaction
      console.log(`📝 BEGIN transaction...`);
      await client.query('BEGIN');
      
      let operationResults = [];
      
      // Execute operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        console.log(`🔄 Transaction step ${i + 1}/${operations.length}: ${operation.description || `Operation ${i + 1}`}`);
        
        const result = await this.executeQuery(
          client, 
          operation.query, 
          operation.params, 
          operation.description || `Transaction operation ${i + 1}`
        );
        
        operationResults.push(result);
      }
      
      // Commit transaction
      console.log(`💯 COMMIT transaction...`);
      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      console.log(`✅ Transaction completed successfully in ${duration}ms [${transactionId}]`);
      console.log(`📊 Transaction summary: ${operations.length} operations executed`);
      
      return operationResults;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ Transaction FAILED after ${duration}ms [${transactionId}]`);
      console.error(`🔄 Rolling back transaction...`);
      
      try {
        await client.query('ROLLBACK');
        console.log(`✅ Transaction rollback completed`);
      } catch (rollbackError) {
        console.error(`💥 ROLLBACK FAILED:`, rollbackError.message);
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
    
    console.log(`\n📦 [${new Date().toISOString()}] Starting ${description} [${bulkId}]`);
    console.log(`📊 Processing ${items.length} items`);
    
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
            console.log(`📈 Progress: ${i + 1}/${items.length} (${Math.round((i + 1) / items.length * 100)}%)`);
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
          
          console.error(`❌ Item ${i + 1} failed:`, {
            item,
            error: itemError.message,
            code: itemError.code
          });
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Bulk operation completed in ${duration}ms [${bulkId}]`);
      console.log(`📊 Results: ${results.successful} successful, ${results.failed} failed out of ${results.processed} processed`);
      
      if (results.errors.length > 0) {
        console.warn(`⚠️ Errors occurred during bulk operation:`, results.errors.slice(0, 5)); // Show first 5 errors
      }
      
      return results;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Bulk operation FAILED after ${duration}ms [${bulkId}]`);
      console.error(`💥 Error:`, error.message);
      
      throw error;
    }
  }

  /**
   * Log query performance statistics
   */
  logPerformanceStats() {
    console.log(`\n📈 Database Performance Statistics:`);
    console.log(`📊 Total queries executed: ${this.queryStats.totalQueries}`);
    console.log(`⚠️ Slow queries (>${this.slowQueryThreshold}ms): ${this.queryStats.slowQueries}`);
    console.log(`❌ Failed queries: ${this.queryStats.failedQueries}`);
    console.log(`⏱️ Average query time: ${this.queryStats.totalQueries > 0 ? Math.round(this.queryStats.totalTime / this.queryStats.totalQueries) : 0}ms`);
    console.log(`🔌 Connection pool status:`, this.connectionPool ? {
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
    console.log(`📊 Database statistics reset`);
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
    console.log(`\n🔍 Starting database schema validation...`);
    
    const results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
    
    for (const validation of validations) {
      try {
        console.log(`🔍 Validating: ${validation.description}`);
        
        const result = await this.executeQuery(client, validation.query, validation.params, validation.description);
        
        if (validation.expected) {
          const passed = validation.expected(result);
          if (passed) {
            results.passed++;
            console.log(`✅ ${validation.description} - PASSED`);
          } else {
            results.failed++;
            console.error(`❌ ${validation.description} - FAILED`);
          }
        } else {
          results.passed++;
          console.log(`✅ ${validation.description} - COMPLETED`);
        }
        
        results.details.push({
          name: validation.description,
          status: 'passed',
          result: result.rows
        });
        
      } catch (error) {
        results.failed++;
        console.error(`❌ ${validation.description} - ERROR: ${error.message}`);
        
        results.details.push({
          name: validation.description,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Schema validation results: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
    
    return results;
  }
}

// Create singleton instance
const dbLogger = new DatabaseLogger();

module.exports = dbLogger;
