const express = require('express');
const auth = require('../middleware/auth');
const aiChatService = require('../services/aiChatService');
const localLLMService = require('../services/localLLMService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to check admin permissions for AI chat
const requireAdmin = (req, res, next) => {
  const requestId = `ai-chat-auth-${Date.now()}`;
  logger.info(`Checking admin permissions for AI chat`, { requestId, user: req.user?.username });
  
  if (req.user && (req.user.role === 'admin' || req.user.permissions?.canUseAIChat)) {
    logger.info(`AI chat access granted`, { requestId, user: req.user?.username });
    next();
  } else {
    logger.warn('AI chat access denied', { requestId, user: req.user?.username || 'anonymous' });
    res.status(403).json({ 
      error: 'Admin access required for AI chat features', 
      requestId: requestId, 
      timestamp: new Date().toISOString() 
    });
  }
};

// Initialize AI chat service
router.use(async (req, res, next) => {
  try {
    if (!aiChatService.schemaCache) {
      await aiChatService.initialize();
    }
    next();
  } catch (error) {
    logger.error('Failed to initialize AI chat service', { error: error.message });
    res.status(500).json({ 
      error: 'AI chat service unavailable', 
      message: 'Please try again later' 
    });
  }
});

// Main AI chat endpoint
router.post('/query', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-query-${Date.now()}`;
  
  try {
    const { query } = req.body;
    const userId = req.user.userId || req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required',
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    if (query.length > 1000) {
      return res.status(400).json({
        error: 'Query too long. Please keep it under 1000 characters.',
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Processing AI chat query', { 
      query: query.substring(0, 100) + '...', 
      userId, 
      requestId 
    });

    // Process the chat query
    const startTime = Date.now();
    const result = await aiChatService.processChat(query.trim(), userId);
    const processingTime = Date.now() - startTime;

    logger.info('AI chat query processed', { 
      success: result.success, 
      processingTime, 
      userId, 
      requestId 
    });

    // Return the result
    res.json({
      success: result.success,
      response: result.response,
      responseType: 'html', // Indicate that response contains HTML content
      data: result.data,
      metadata: {
        ...result.metadata,
        processingTime,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI chat query failed', { 
      error: error.message, 
      stack: error.stack, 
      requestId 
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Please try again later or contact support',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Get chat history for user
router.get('/history', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-history-${Date.now()}`;
  
  try {
    const userId = req.user.userId || req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 records
    const offset = parseInt(req.query.offset) || 0;

    logger.info('Fetching AI chat history', { userId, limit, offset, requestId });

    // Get conversation history from memory instead of database
    const conversationHistory = aiChatService.getConversationHistory(userId);
    
    // Apply pagination to in-memory history
    const total = conversationHistory.length;
    const paginatedHistory = conversationHistory
      .slice()
      .reverse() // Most recent first
      .slice(offset, offset + limit);

    const history = paginatedHistory.map((entry, index) => ({
      id: `mem-${Date.now()}-${index}`, // Generate a temporary ID
      query: entry.query,
      sql: entry.metadata?.sql,
      success: entry.metadata?.success || false,
      error: entry.metadata?.error,
      timestamp: new Date(entry.timestamp),
      requestId: entry.metadata?.requestId
    }));

    res.json({
      success: true,
      history,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch AI chat history', { 
      error: error.message, 
      requestId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Get database schema information (for help/assistance)
router.get('/schema', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-schema-${Date.now()}`;
  
  try {
    logger.info('Fetching database schema for AI chat', { requestId });

    const schema = await aiChatService.loadDatabaseSchema();
    
    // Simplify schema for frontend display
    const simplifiedSchema = Object.values(schema).map(table => ({
      name: table.name,
      description: getTableDescription(table.name),
      columns: table.columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        references: col.references
      }))
    }));

    res.json({
      success: true,
      schema: simplifiedSchema,
      tableCount: simplifiedSchema.length,
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch database schema', { 
      error: error.message, 
      requestId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch database schema',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Get suggested queries/examples
router.get('/suggestions', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-suggestions-${Date.now()}`;
  
  try {
    const userId = req.user.userId || req.user.id;
    
    // Get context-aware suggestions based on user's conversation history
    const suggestions = await aiChatService.getContextAwareSuggestions(userId);

    res.json({
      success: true,
      suggestions,
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch suggestions', { 
      error: error.message, 
      requestId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear conversation history for the current user
router.delete('/history/clear', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-clear-history-${Date.now()}`;
  
  try {
    const userId = req.user.userId || req.user.id;
    
    logger.info('Clearing AI chat conversation history', { userId, requestId });
    
    // Clear conversation history for this user
    aiChatService.conversationHistory.delete(userId);
    
    // Note: No need to clear query frequency from database since we don't store queries there anymore
    // await require('../config/database').pool.query(
    //   'DELETE FROM ai_query_frequency WHERE user_id = $1',
    //   [userId]
    // );
    
    res.json({
      success: true,
      message: 'Conversation history cleared successfully',
      requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to clear conversation history', { 
      error: error.message, 
      requestId,
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation history',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Get query frequency statistics
router.get('/stats', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-stats-${Date.now()}`;
  
  try {
    const userId = req.user.userId || req.user.id;
    
    logger.info('Fetching AI chat statistics', { userId, requestId });
    
    const frequentQueries = await aiChatService.getMostFrequentQueries(userId, 10);
    const conversationHistory = aiChatService.getConversationHistory(userId);
    
    const stats = {
      totalQueries: conversationHistory.length,
      frequentQueries: frequentQueries,
      lastQueryTime: conversationHistory.length > 0 ? 
        new Date(conversationHistory[conversationHistory.length - 1].timestamp).toISOString() : null,
      conversationDuration: conversationHistory.length > 0 ? 
        conversationHistory[conversationHistory.length - 1].timestamp - conversationHistory[0].timestamp : 0
    };
    
    res.json({
      success: true,
      stats,
      requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to fetch chat statistics', { 
      error: error.message, 
      requestId,
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat statistics',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Get detailed query analytics from database
router.get('/analytics', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-analytics-${Date.now()}`;
  
  try {
    const userId = req.user.userId || req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    
    logger.info('Fetching AI chat analytics', { userId, requestId });
    
    // Get analytics from in-memory conversation history since we don't store queries in database
    const conversationHistory = aiChatService.getConversationHistory(userId);
    
    // Calculate basic analytics from conversation history
    const analytics = {
      summary: {
        unique_patterns: 0, // Since we don't track patterns anymore
        total_queries: conversationHistory.length,
        first_query_date: conversationHistory.length > 0 ? new Date(Math.min(...conversationHistory.map(entry => entry.timestamp))) : null,
        last_query_date: conversationHistory.length > 0 ? new Date(Math.max(...conversationHistory.map(entry => entry.timestamp))) : null
      },
      patterns: [] // Empty since we don't store query patterns in database anymore
    };
    
    res.json({
      success: true,
      analytics,
      requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to fetch chat analytics', { 
      error: error.message, 
      requestId,
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat analytics',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to verify AI service health
router.get('/health', auth, requireAdmin, async (req, res) => {
  const requestId = `ai-chat-health-${Date.now()}`;
  
  try {
    const healthCheck = {
      service: 'AI Chat Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: false,
        schema: false,
        aiService: false
      }
    };

    // Check database connection
    try {
      const { pool } = require('../config/database');
      await pool.query('SELECT 1');
      healthCheck.checks.database = true;
    } catch (error) {
      healthCheck.checks.database = false;
    }

    // Check schema cache
    try {
      await aiChatService.loadDatabaseSchema();
      healthCheck.checks.schema = true;
    } catch (error) {
      healthCheck.checks.schema = false;
    }

    // Check AI service configuration
    healthCheck.checks.aiService = !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);

    const allHealthy = Object.values(healthCheck.checks).every(check => check === true);
    healthCheck.status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json({
      ...healthCheck,
      requestId
    });

  } catch (error) {
    logger.error('Health check failed', { 
      error: error.message, 
      requestId 
    });

    res.status(500).json({
      service: 'AI Chat Service',
      status: 'unhealthy',
      error: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// **NEW ROUTES FOR LOCAL LLM MANAGEMENT**

/**
 * GET /ai-chat/llm/status
 * Get local LLM service status and configuration
 */
router.get('/llm/status', auth, requireAdmin, async (req, res) => {
  const requestId = `llm-status-${Date.now()}`;
  
  try {
    logger.info('Fetching local LLM status', { requestId, userId: req.user?.id });
    
    const status = await aiChatService.getLocalLLMStatus();
    const installationGuide = localLLMService.getInstallationGuide();
    
    logger.info('Local LLM status retrieved successfully', { requestId, status });
    
    res.json({
      success: true,
      data: {
        status,
        installationGuide,
        currentConfig: {
          useLocalLLM: process.env.USE_LOCAL_LLM !== 'false',
          useDemoMode: process.env.AI_DEMO_MODE === 'true',
          backend: process.env.LOCAL_LLM_BACKEND || 'ollama',
          model: process.env.LOCAL_LLM_MODEL || 'llama2'
        }
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get local LLM status', { 
      error: error.message, 
      requestId, 
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get local LLM status',
      details: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /ai-chat/llm/backends
 * List all available LLM backends and their status
 */
router.get('/llm/backends', auth, requireAdmin, async (req, res) => {
  const requestId = `llm-backends-${Date.now()}`;
  
  try {
    logger.info('Listing LLM backends', { requestId, userId: req.user?.id });
    
    const backends = await localLLMService.listBackends();
    
    logger.info('LLM backends listed successfully', { requestId, backendCount: Object.keys(backends).length });
    
    res.json({
      success: true,
      data: {
        backends,
        recommended: 'ollama'
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to list LLM backends', { 
      error: error.message, 
      requestId, 
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to list LLM backends',
      details: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /ai-chat/llm/switch
 * Switch to a different LLM backend
 */
router.post('/llm/switch', auth, requireAdmin, async (req, res) => {
  const requestId = `llm-switch-${Date.now()}`;
  
  try {
    const { backend, model } = req.body;
    
    if (!backend) {
      return res.status(400).json({
        success: false,
        error: 'Backend is required',
        requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Switching LLM backend', { requestId, userId: req.user?.id, backend, model });
    
    const result = await aiChatService.switchLLMBackend(backend, model);
    
    if (result.success) {
      logger.info('LLM backend switched successfully', { requestId, backend, model });
      
      res.json({
        success: true,
        data: result,
        message: `Successfully switched to ${backend} backend${model ? ` with model ${model}` : ''}`,
        requestId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to switch LLM backend', { 
      error: error.message, 
      requestId, 
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to switch LLM backend',
      details: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /ai-chat/llm/test
 * Test the local LLM with a simple query
 */
router.post('/llm/test', auth, requireAdmin, async (req, res) => {
  const requestId = `llm-test-${Date.now()}`;
  
  try {
    const { query = "How many students do we have?" } = req.body;
    
    logger.info('Testing local LLM', { requestId, userId: req.user?.id, query });
    
    const startTime = Date.now();
    const response = await aiChatService.processChat(query, req.user.id);
    const executionTime = Date.now() - startTime;
    
    logger.info('Local LLM test completed', { 
      requestId, 
      executionTime, 
      success: response.success 
    });
    
    res.json({
      success: true,
      data: {
        testQuery: query,
        response: response.response,
        executionTime,
        metadata: response.metadata
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to test local LLM', { 
      error: error.message, 
      requestId, 
      userId: req.user?.id 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to test local LLM',
      details: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to provide table descriptions
function getTableDescription(tableName) {
  const descriptions = {
    'users': 'System users and administrators',
    'students': 'Student records with membership and contact information',
    'seats': 'Physical seat assignments and restrictions',
    'payments': 'Student payment records and transactions',
    'expenses': 'Business expenses and operational costs',
    'expense_categories': 'Categories for organizing expenses',
    'student_fees_config': 'Fee structure for different membership types',
    'activity_logs': 'System activity and audit logs',
    'token_blacklist': 'Revoked authentication tokens'
  };
  
  return descriptions[tableName] || 'Database table';
}

module.exports = router;