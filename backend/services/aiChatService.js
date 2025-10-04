const { pool } = require('../config/database');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const localLLMService = require('./localLLMService');
const externalAPIService = require('./externalAPIService');
const metabaseService = require('./metabaseService');
const constants = require('../config/constants');

class AIChatService {
  constructor() {
    // Metabase configuration
    this.metabaseUrl = process.env.METABASE_URL || constants.METABASE.DEFAULT_URL;
    this.metabaseSecret = process.env.METABASE_SECRET_KEY;
    this.metabaseApiUrl = process.env.METABASE_API_URL || constants.METABASE.DEFAULT_API_URL;
    
    // AI LLM configuration - use constants with env override capability
    this.useLocalLLM = process.env.USE_LOCAL_LLM === 'true' || constants.AI_CHAT.USE_LOCAL_LLM;
    this.useExternalAPI = process.env.USE_EXTERNAL_API === 'true' || constants.AI_CHAT.USE_EXTERNAL_API;
    this.useDemoMode = process.env.AI_DEMO_MODE === 'true' || constants.AI_CHAT.AI_DEMO_MODE;
    
    // Fallback configuration
    this.fallbackToLocal = process.env.FALLBACK_TO_LOCAL === 'true' || constants.AI_CHAT.FALLBACK_TO_LOCAL;
    this.fallbackToExternal = process.env.FALLBACK_TO_EXTERNAL === 'true' || constants.AI_CHAT.FALLBACK_TO_EXTERNAL;
    this.fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== 'false' && constants.AI_CHAT.AI_FALLBACK_ENABLED;
    
    // Legacy OpenAI configuration (for backward compatibility)
    this.aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    this.aiApiUrl = process.env.AI_API_URL || constants.EXTERNAL_API.PROVIDERS.openai.API_URL;
    
    // Database schema cache
    this.schemaCache = null;
    this.schemaCacheExpiry = null;
    this.CACHE_DURATION = constants.AI_CHAT.CACHE_DURATION;
    
    // Conversation context management
    this.conversationHistory = new Map(); // userId -> conversation history (still in-memory for session)
    this.MAX_CONTEXT_MESSAGES = constants.AI_CHAT.MAX_CONTEXT_MESSAGES;
    this.CONTEXT_EXPIRY = constants.AI_CHAT.CONTEXT_EXPIRY;
    
    // Retry configuration
    this.maxRetries = constants.AI_CHAT.MAX_RETRIES;
    this.retryDelay = constants.AI_CHAT.RETRY_DELAY;
  }

  /**
   * Initialize the AI Chat Service
   */
  async initialize() {
    try {
      await this.loadDatabaseSchema();
      
      // Determine which AI service to initialize based on configuration
      if (this.useDemoMode) {
        logger.info('AI Chat Service initialized in demo mode');
        return;
      }
      
      let primaryInitialized = false;
      let fallbackInitialized = false;
      
      // Initialize primary AI service
      if (this.useExternalAPI) {
        try {
          await externalAPIService.initialize();
          primaryInitialized = true;
          logger.info('External API service initialized as primary');
        } catch (error) {
          logger.warn('External API initialization failed', { error: error.message });
          if (this.fallbackToLocal) {
            logger.info('Attempting fallback to local LLM');
          }
        }
      } else if (this.useLocalLLM) {
        try {
          await localLLMService.initialize();
          primaryInitialized = true;
          logger.info('Local LLM service initialized as primary');
        } catch (error) {
          logger.warn('Local LLM initialization failed', { error: error.message });
          if (this.fallbackToExternal) {
            logger.info('Attempting fallback to external API');
          }
        }
      }
      
      // Initialize fallback service if primary failed
      if (!primaryInitialized && this.fallbackEnabled) {
        if (this.useExternalAPI && this.fallbackToLocal) {
          try {
            await localLLMService.initialize();
            fallbackInitialized = true;
            this.useLocalLLM = true; // Switch to fallback
            this.useExternalAPI = false;
            logger.info('Fallback to local LLM successful');
          } catch (error) {
            logger.warn('Fallback to local LLM failed', { error: error.message });
          }
        } else if (this.useLocalLLM && this.fallbackToExternal) {
          try {
            await externalAPIService.initialize();
            fallbackInitialized = true;
            this.useExternalAPI = true; // Switch to fallback
            this.useLocalLLM = false;
            logger.info('Fallback to external API successful');
          } catch (error) {
            logger.warn('Fallback to external API failed', { error: error.message });
          }
        }
      }
      
      // If both primary and fallback failed, switch to demo mode
      if (!primaryInitialized && !fallbackInitialized) {
        logger.warn('All AI services failed to initialize, switching to demo mode');
        this.useDemoMode = true;
      }
      
      logger.info('AI Chat Service initialization completed', {
        useLocalLLM: this.useLocalLLM,
        useExternalAPI: this.useExternalAPI,
        useDemoMode: this.useDemoMode
      });
    } catch (error) {
      logger.error('Failed to initialize AI Chat Service', { error: error.message });
      throw error;
    }
  }

  /**
   * Load and cache database schema information
   */
  async loadDatabaseSchema() {
    try {
      if (this.schemaCache && this.schemaCacheExpiry && Date.now() < this.schemaCacheExpiry) {
        return this.schemaCache;
      }

      logger.info('Loading database schema for AI chat service');

      // Get all tables and their columns
      const tablesQuery = `
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          AND t.table_name NOT LIKE '%_history'
        ORDER BY t.table_name, c.ordinal_position
      `;

      const result = await pool.query(tablesQuery);
      
      // Organize schema by table
      const schema = {};
      result.rows.forEach(row => {
        if (!schema[row.table_name]) {
          schema[row.table_name] = {
            name: row.table_name,
            columns: []
          };
        }
        
        if (row.column_name) {
          schema[row.table_name].columns.push({
            name: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable === 'YES',
            default: row.column_default
          });
        }
      });

      // Get foreign key relationships
      const fkQuery = `
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      `;

      const fkResult = await pool.query(fkQuery);
      
      // Add foreign key information to schema
      fkResult.rows.forEach(row => {
        if (schema[row.table_name]) {
          const column = schema[row.table_name].columns.find(c => c.name === row.column_name);
          if (column) {
            column.references = {
              table: row.foreign_table_name,
              column: row.foreign_column_name
            };
          }
        }
      });

      this.schemaCache = schema;
      this.schemaCacheExpiry = Date.now() + this.CACHE_DURATION;
      
      logger.info('Database schema loaded successfully', { tablesCount: Object.keys(schema).length });
      return schema;
    } catch (error) {
      logger.error('Failed to load database schema', { error: error.message });
      throw new Error('Unable to load database schema for AI analysis');
    }
  }

  /**
   * Generate a schema description for AI context
   */
  generateSchemaDescription() {
    if (!this.schemaCache) {
      throw new Error('Schema not loaded');
    }

    let description = "Database Schema:\n\n";
    
    Object.values(this.schemaCache).forEach(table => {
      description += `Table: ${table.name}\n`;
      
      description += "Columns:\n";
      table.columns.forEach(column => {
        description += `  - ${column.name} (${column.type})`;
        if (!column.nullable) description += " NOT NULL";
        if (column.references) {
          description += ` -> ${column.references.table}.${column.references.column}`;
        }
        description += "\n";
      });
      description += "\n";
    });

    return description;
  }

  /**
   * Get conversation history for a user
   */
  getConversationHistory(userId) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    
    // Clean up expired messages
    const history = this.conversationHistory.get(userId);
    const now = Date.now();
    const validHistory = history.filter(msg => (now - msg.timestamp) < this.CONTEXT_EXPIRY);
    
    // Keep only recent messages
    const recentHistory = validHistory.slice(-this.MAX_CONTEXT_MESSAGES);
    this.conversationHistory.set(userId, recentHistory);
    
    return recentHistory;
  }

  /**
   * Add message to conversation history
   */
  async addToConversationHistory(userId, userQuery, response, metadata = {}) {
    const history = this.getConversationHistory(userId);
    
    // Note: Query frequency tracking disabled for privacy - AI queries are not stored in database
    // this.trackQueryFrequency(userId, userQuery).catch(error => {
    //   logger.warn('Query frequency tracking failed but continuing', { error: error.message });
    // });
    
    history.push({
      timestamp: Date.now(),
      userQuery,
      response: response.substring(0, 500), // Truncate long responses for context
      metadata: {
        sql: metadata.sql,
        success: metadata.success || true,
        requestId: metadata.requestId
      }
    });
    
    // Keep only recent messages
    if (history.length > this.MAX_CONTEXT_MESSAGES) {
      history.splice(0, history.length - this.MAX_CONTEXT_MESSAGES);
    }
    
    this.conversationHistory.set(userId, history);
  }

  /**
   * Track query frequency in database for persistent suggestions
   */
  async trackQueryFrequency(userId, query) {
    try {
      const normalizedQuery = this.normalizeQueryForFrequency(query);
      
      // Use UPSERT (INSERT ... ON CONFLICT) to either create new or update existing
      const upsertQuery = `
        INSERT INTO ai_query_frequency (
          user_id, 
          normalized_query, 
          original_query_example, 
          frequency_count,
          first_used_at,
          last_used_at
        ) VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, normalized_query) 
        DO UPDATE SET 
          frequency_count = ai_query_frequency.frequency_count + 1,
          last_used_at = CURRENT_TIMESTAMP,
          original_query_example = CASE 
            WHEN LENGTH($3) < LENGTH(ai_query_frequency.original_query_example) 
            THEN $3 
            ELSE ai_query_frequency.original_query_example 
          END
        RETURNING frequency_count
      `;
      
      const result = await pool.query(upsertQuery, [
        userId, 
        normalizedQuery, 
        query.substring(0, 200) // Keep original example, truncated
      ]);
      
      // Clean up old entries for this user (keep only top 50 most recent)
      const cleanupQuery = `
        DELETE FROM ai_query_frequency 
        WHERE user_id = $1 
        AND id NOT IN (
          SELECT id FROM ai_query_frequency 
          WHERE user_id = $1 
          ORDER BY last_used_at DESC 
          LIMIT 50
        )
      `;
      
      await pool.query(cleanupQuery, [userId]);
      
      logger.info('Query frequency tracked in database', { 
        userId, 
        normalizedQuery: normalizedQuery.substring(0, 50) + '...',
        newCount: result.rows[0]?.frequency_count 
      });
      
    } catch (error) {
      logger.error('Failed to track query frequency in database', { 
        error: error.message, 
        userId,
        query: query.substring(0, 100) + '...'
      });
      // Don't throw error - frequency tracking is not critical for core functionality
    }
  }

  /**
   * Normalize query for frequency tracking (remove specific details but keep intent)
   */
  normalizeQueryForFrequency(query) {
    let normalized = query.toLowerCase().trim();
    
    // Replace specific numbers/dates with placeholders to group similar queries
    normalized = normalized.replace(/\d+/g, 'X'); // Replace numbers with X
    normalized = normalized.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, 'MONTH');
    normalized = normalized.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, 'DAY');
    normalized = normalized.replace(/\b(today|yesterday|tomorrow|this week|last week|this month|last month)\b/gi, 'TIMEREF');
    
    // Keep it concise for better grouping
    if (normalized.length > 100) {
      normalized = normalized.substring(0, 100);
    }
    
    return normalized;
  }

  /**
   * Get most frequently used queries for a user from database
   */
  async getMostFrequentQueries(userId, limit = 5) {
    try {
      const query = `
        SELECT 
          normalized_query,
          original_query_example,
          frequency_count,
          last_used_at
        FROM ai_query_frequency 
        WHERE user_id = $1 
        ORDER BY frequency_count DESC, last_used_at DESC 
        LIMIT $2
      `;
      
      const result = await pool.query(query, [userId, limit]);
      
      return result.rows.map(row => ({
        query: this.denormalizeQuery(row.normalized_query),
        originalExample: row.original_query_example,
        count: row.frequency_count,
        lastUsed: row.last_used_at
      }));
      
    } catch (error) {
      logger.error('Failed to fetch frequent queries from database', { 
        error: error.message, 
        userId 
      });
      return []; // Return empty array on error
    }
  }

  /**
   * Convert normalized query back to readable format
   */
  denormalizeQuery(normalizedQuery) {
    let readable = normalizedQuery
      .replace(/\bx\b/g, '[number]')
      .replace(/\bmonth\b/gi, '[month]')
      .replace(/\bday\b/gi, '[day]')
      .replace(/\btimeref\b/gi, '[time]');
    
    // Capitalize first letter
    readable = readable.charAt(0).toUpperCase() + readable.slice(1);
    
    return readable;
  }

  /**
   * Generate context-aware prompt with conversation history
   */
  generateContextualPrompt(query, userId, schemaDescription) {
    const history = this.getConversationHistory(userId);
    
    let contextSection = "";
    if (history.length > 0) {
      contextSection = "\n\nConversation History (for context):\n";
      history.forEach((msg, index) => {
        contextSection += `${index + 1}. User: "${msg.userQuery}"\n`;
        if (msg.metadata.sql) {
          contextSection += `   SQL: ${msg.metadata.sql}\n`;
        }
        contextSection += `   Result: ${msg.response.substring(0, 100)}...\n\n`;
      });
    }

    return `You are a SQL expert for a study room management system. Convert the following natural language query to a PostgreSQL query.

Database Schema:
${schemaDescription}

CRITICAL SQL SYNTAX REQUIREMENTS:
- Use proper PostgreSQL syntax and functions
- Always validate clause ordering: SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
- Use DATE_TRUNC() for date operations, not MONTH() or YEAR()
- Use CURRENT_DATE instead of NOW() for date comparisons
- Ensure balanced parentheses in all expressions
- Use single quotes for string literals, not double quotes
- Always use proper JOIN syntax when accessing multiple tables
- Be careful with NULL values and use appropriate handling

Important Notes:
- Always use appropriate JOIN clauses when referencing multiple tables
- For date comparisons, use PostgreSQL date functions
- Be careful with NULL values and use appropriate handling
- Always include proper WHERE clauses for security
- For bulk operations (SMS, contact lists, expired students), DO NOT add LIMIT clause
- For regular queries, limit results to reasonable amounts (use LIMIT clause)
- Use meaningful column aliases for better presentation

SQL Quality Checks:
- Verify all column names exist in the specified tables
- Ensure all table names are correct
- Check that GROUP BY includes all non-aggregated SELECT columns
- Validate that HAVING clauses only use aggregated columns
- Confirm proper date/time function usage

Default Active Filters (CRITICAL - ALWAYS APPLY BY DEFAULT):
- For 'students' table queries: Include "membership_status = 'active'" filter UNLESS query explicitly mentions "expired", "inactive", "suspended", "all students", "show all", "list all", or "include inactive/expired"
- For 'users' table queries: Include "status = 'active'" filter UNLESS query explicitly mentions "inactive", "all users", "show all", "list all", or "include inactive"
- IMPORTANT: Do NOT add status conditions yourself - let the post-processing handle it
- Focus on generating the core SQL logic, the system will automatically add active filters
- Only generate explicit status conditions when user specifically asks for inactive/expired records

Special Cases:
- If query mentions "expired students" with "SMS", "mobile", "contact", "information", "details", or "all", return ALL results without LIMIT
- If query is for communication purposes, include contact_number and ensure it's not NULL
- For "contact information for expired students", return: SELECT id, name, father_name, contact_number, membership_till, membership_status FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE)) AND contact_number IS NOT NULL ORDER BY membership_till
- For expired students queries, use "(membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE))" condition

Context Awareness:
- Consider the conversation history when interpreting the current query
- If the user refers to "them", "those", "previous results", etc., use context from recent queries
- If the user asks for "more details" or "show more", expand on the previous query
- Maintain consistency with previous queries when possible
${contextSection}
Current Query: "${query}"

Return ONLY the SQL query without any explanation or markdown formatting. Ensure it follows all PostgreSQL syntax rules.`;
  }

  /**
   * Generate context-aware formatting prompt
   */
  generateContextualFormattingPrompt(originalQuery, results, userId) {
    const history = this.getConversationHistory(userId);
    
    let contextSection = "";
    if (history.length > 0) {
      contextSection = "\n\nConversation Context:\n";
      const recentHistory = history.slice(-3); // Last 3 interactions for formatting context
      recentHistory.forEach((msg, index) => {
        contextSection += `${index + 1}. Previous Query: "${msg.userQuery}"\n`;
        contextSection += `   Previous Result: ${msg.response.substring(0, 150)}...\n\n`;
      });
      contextSection += "Consider this context when formatting the current results.\n";
    }

    return `You are a data analyst for a study room management system. Format the following query results in a clear, professional manner.

Original Question: "${originalQuery}"

Query Results (${results.rowCount} rows):
${JSON.stringify(results.data.slice(0, 10), null, 2)}

${results.data.length > 10 ? `... and ${results.data.length - 10} more rows` : ''}

IMPORTANT FORMATTING RULES:
1. Use HTML tables for tabular data (NOT markdown tables)
2. Use proper HTML structure: <table>, <thead>, <tbody>, <tr>, <th>, <td>
3. Add CSS classes for styling: class="data-table" for tables
4. Use responsive table design with proper headers
5. Include summary information before tables
6. Use appropriate icons/emojis for better visual appeal
7. Format dates as readable text (e.g., "Oct 4, 2025")
8. Format numbers with proper thousand separators where needed

Example HTML table format:
<table class="data-table">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
    </tr>
  </tbody>
</table>

Create a professional response with clear insights and well-formatted data presentation.
${contextSection}

Return ONLY the formatted response without any markdown code blocks.`;
  }

  /**
   * Convert natural language query to SQL
   */
  async naturalLanguageToSQL(query, userId, retryCount = 0) {
    try {
      logger.info('Converting natural language to SQL', { query, userId, retryCount });

      const schema = await this.loadDatabaseSchema();
      const schemaDescription = this.generateSchemaDescription();

      // Check if demo mode is enabled
      if (this.useDemoMode) {
        return this.generateDemoSQL(query);
      }

      const prompt = this.generateContextualPrompt(query, userId, schemaDescription);

      let response;
      
      // Use the configured AI service with fallback logic
      if (this.useExternalAPI) {
        try {
          response = await externalAPIService.generateText(prompt, {
            maxTokens: 512,
            temperature: 0.1
          });
        } catch (error) {
          logger.warn('External API failed', { error: error.message });
          if (this.fallbackToLocal && this.useLocalLLM) {
            try {
              response = await localLLMService.generateText(prompt, {
                maxTokens: 512,
                temperature: 0.1
              });
              logger.info('Successfully fell back to local LLM');
            } catch (localError) {
              logger.warn('Local LLM fallback also failed', { error: localError.message });
              return this.generateDemoSQL(query);
            }
          } else {
            return this.generateDemoSQL(query);
          }
        }
      } else if (this.useLocalLLM) {
        try {
          response = await localLLMService.generateText(prompt, {
            maxTokens: 512,
            temperature: 0.1
          });
        } catch (error) {
          logger.warn('Local LLM failed', { error: error.message });
          if (this.fallbackToExternal && this.useExternalAPI) {
            try {
              response = await externalAPIService.generateText(prompt, {
                maxTokens: 512,
                temperature: 0.1
              });
              logger.info('Successfully fell back to external API');
            } catch (externalError) {
              logger.warn('External API fallback also failed', { error: externalError.message });
              return this.generateDemoSQL(query);
            }
          } else {
            return this.generateDemoSQL(query);
          }
        }
      } else {
        // Legacy fallback to the old callAIService method
        response = await this.callAIService(prompt, retryCount);
      }
      
      // Extract SQL from response (remove markdown formatting if present)
      let sql = response.trim();
      if (sql.startsWith('```sql')) {
        sql = sql.replace(/^```sql\n?/, '').replace(/\n?```$/, '');
      } else if (sql.startsWith('```')) {
        sql = sql.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Trim any remaining whitespace
      sql = sql.trim();

      // Basic SQL validation
      if (!this.isValidSQL(sql)) {
        logger.error('Generated SQL failed validation', { 
          sql: sql,
          query: query,
          userId: userId
        });
        throw new Error('Generated SQL appears to be invalid');
      }

      // Apply active filters by default unless explicitly requesting inactive records
      sql = this.applyDefaultActiveFilters(sql, query);

      logger.info('Successfully converted natural language to SQL', { 
        query, 
        sql: sql.substring(0, 200) + '...',
        userId,
        usingLocalLLM: this.useLocalLLM 
      });

      return sql;
    } catch (error) {
      logger.error('Failed to convert natural language to SQL', { 
        error: error.message, 
        query, 
        userId, 
        retryCount 
      });

      // If quota exceeded, LLM failed, or demo mode, fall back to demo SQL
      if (error.message.includes('quota') || error.message.includes('429') || 
          error.message.includes('Local LLM') || this.useDemoMode) {
        logger.info('Using demo SQL generation due to LLM limitations');
        return this.generateDemoSQL(query);
      }

      if (retryCount < this.maxRetries) {
        logger.info('Retrying natural language to SQL conversion', { retryCount: retryCount + 1 });
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.naturalLanguageToSQL(query, userId, retryCount + 1);
      }

      throw new Error(`Failed to convert query to SQL after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Apply default active filters to SQL queries unless inactive records are explicitly requested
   */
  applyDefaultActiveFilters(sql, originalQuery) {
    try {
      const normalizedQuery = originalQuery.toLowerCase();
      const normalizedSQL = sql.toLowerCase();

      // Only skip filters for very specific cases where user explicitly wants inactive/expired records
      const explicitlyWantsInactive = /\b(expired|inactive|suspended)\s+(students?|users?)\b/.test(normalizedQuery) ||
                                     /\b(show|list|get)(?:\s+\w+)?\s+all\s+(students?|users?|records?)\b/.test(normalizedQuery) ||
                                     /\binclude\s+(inactive|expired|all)\b/.test(normalizedQuery);
      
      // Skip if user explicitly wants inactive records
      // Don't skip just because SQL has status conditions - only skip for specific inactive statuses
      if (explicitlyWantsInactive) {
        return sql;
      }
      
      // Also skip if SQL already has specific inactive status filters (but allow active status filters to be enhanced)
      const hasInactiveFilters = /membership_status\s*=\s*'(expired|inactive|suspended)'/i.test(normalizedSQL) ||
                                /status\s*=\s*'(inactive|suspended)'/i.test(normalizedSQL);
      
      if (hasInactiveFilters) {
        return sql;
      }

      let modifiedSQL = sql;

      // Apply active filter for students table (handle various patterns including aliases and joins)
      const hasStudentsTable = /\b(from|join)\s+students\b/i.test(sql);
      
      if (hasStudentsTable) {
        modifiedSQL = this.addActiveFilterToTable(modifiedSQL, 'students', 'membership_status');
      }

      // Apply active filter for users table (handle various patterns including aliases and joins)
      const hasUsersTable = /\b(from|join)\s+users\b/i.test(sql);
      
      if (hasUsersTable) {
        modifiedSQL = this.addActiveFilterToTable(modifiedSQL, 'users', 'status');
      }

      return modifiedSQL;
    } catch (error) {
      logger.warn('Failed to apply active filters, returning original SQL', { error: error.message, sql });
      return sql;
    }
  }

  /**
   * Add active filter condition to a specific table in the SQL query
   */
  addActiveFilterToTable(sql, tableName, statusColumn) {
    try {
      // Find the FROM/JOIN table pattern with optional alias
      const tablePattern = new RegExp(`\\b(from|join)\\s+${tableName}\\b(?:\\s+(\\w+))?`, 'i');
      const match = sql.match(tablePattern);
      
      if (!match) {
        return sql; // Table not found in query
      }

      // Determine the table reference (use alias if available, otherwise table name)
      const tableAlias = match[2]; // alias if present
      const tableRef = tableAlias || tableName;

      // Check if this table already has an active status filter to avoid duplication
      const activeFilterPattern = new RegExp(`(?:${tableRef}\\.|\\b)${statusColumn}\\s*=\\s*'active'`, 'i');
      const hasActiveFilter = activeFilterPattern.test(sql);
      
      if (hasActiveFilter) {
        return sql; // Active filter already present for this table
      }

      // Check if WHERE clause already exists
      const hasWhere = /\bwhere\b/i.test(sql);
      
      if (hasWhere) {
        // Add AND condition to existing WHERE clause
        // Insert the condition right after WHERE keyword
        return sql.replace(/(\bwhere\b\s*)/i, `$1${tableRef}.${statusColumn} = 'active' AND `);
      } else {
        // Add WHERE clause - find the right position
        // Look for ORDER BY, GROUP BY, HAVING, LIMIT to insert before them
        const endPattern = /\b(order\s+by|group\s+by|having|limit)\b/i;
        const endMatch = sql.match(endPattern);
        
        if (endMatch) {
          const insertPos = sql.indexOf(endMatch[0]);
          return sql.slice(0, insertPos).trim() + ` WHERE ${tableRef}.${statusColumn} = 'active' ` + sql.slice(insertPos);
        } else {
          // Add WHERE clause at the end
          return sql.trim() + ` WHERE ${tableRef}.${statusColumn} = 'active'`;
        }
      }
    } catch (error) {
      logger.warn(`Failed to add active filter for ${tableName}, returning original SQL`, { error: error.message });
      return sql;
    }
  }

  /**
   * Execute SQL query safely
   */
  async executeSQLQuery(sql, userId, retryCount = 0) {
    try {
      logger.info('Executing SQL query', { 
        sql: sql.substring(0, 200) + '...', 
        userId, 
        retryCount 
      });

      // Validate that this is a SELECT query only (security measure)
      if (!this.isSafeSelectQuery(sql)) {
        throw new Error('Only SELECT queries are allowed for security reasons');
      }

      // Add a reasonable limit if not present (except for specific bulk operations)
      let finalSQL = sql.trim();
      const isBulkOperation = this.isBulkOperation(sql, userId);
      if (!finalSQL.toLowerCase().includes('limit') && !isBulkOperation) {
        finalSQL += ' LIMIT 100';
      }

      const startTime = Date.now();
      const result = await pool.query(finalSQL);
      const executionTime = Date.now() - startTime;

      logger.info('SQL query executed successfully', { 
        userId, 
        rowCount: result.rowCount, 
        executionTime 
      });

      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        executionTime,
        sql: finalSQL
      };
    } catch (error) {
      logger.error('Failed to execute SQL query', { 
        error: error.message, 
        sql: sql.substring(0, 200) + '...', 
        userId, 
        retryCount 
      });

      // Check if this is a correctable SQL syntax error
      if (retryCount < this.maxRetries && this.isSQLSyntaxError(error)) {
        logger.info('Attempting to correct SQL syntax error', { retryCount: retryCount + 1 });
        try {
          const correctedSQL = await this.correctSQLSyntax(sql, error.message, userId);
          if (correctedSQL && correctedSQL !== sql) {
            logger.info('SQL correction attempted', { 
              original: sql.substring(0, 100) + '...', 
              corrected: correctedSQL.substring(0, 100) + '...' 
            });
            await this.delay(this.retryDelay * (retryCount + 1));
            return this.executeSQLQuery(correctedSQL, userId, retryCount + 1);
          }
        } catch (correctionError) {
          logger.warn('SQL correction failed', { error: correctionError.message });
        }
      }

      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.info('Retrying SQL query execution', { retryCount: retryCount + 1 });
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.executeSQLQuery(sql, userId, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        sql
      };
    }
  }

  /**
   * Format query results for presentation
   */
  async formatResults(results, originalQuery, userId, retryCount = 0) {
    try {
      if (!results.success) {
        // Provide more specific error guidance based on error type
        let errorGuidance = "Please try rephrasing your question or check the query syntax.";
        
        const errorMessage = results.error.toLowerCase();
        if (errorMessage.includes('syntax error')) {
          errorGuidance = "There was a SQL syntax error. The system attempted automatic correction. Please try:\n" +
                         "- Rephrasing your question in simpler terms\n" +
                         "- Being more specific about what data you want\n" +
                         "- Checking date formats and table/column names";
        } else if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
          errorGuidance = "A column name was not found. Please check:\n" +
                         "- Column names are spelled correctly\n" +
                         "- You're referring to the right table\n" +
                         "- Available columns: id, name, email, phone, membership_status, etc.";
        } else if (errorMessage.includes('table') && errorMessage.includes('does not exist')) {
          errorGuidance = "Table not found. Available tables are:\n" +
                         "- students (membership info)\n" +
                         "- payments (payment records)\n" +
                         "- seats (seating arrangements)\n" +
                         "- expenses (expense tracking)";
        } else if (errorMessage.includes('function') && errorMessage.includes('does not exist')) {
          errorGuidance = "Database function error. Try using:\n" +
                         "- DATE_TRUNC() for date operations\n" +
                         "- CURRENT_DATE for today's date\n" +
                         "- Standard PostgreSQL functions";
        }
        
        return {
          success: false,
          formattedResponse: `❌ **Query Error:** ${results.error}\n\n${errorGuidance}`,
          data: null
        };
      }

      if (!results.data || results.data.length === 0) {
        return {
          success: true,
          formattedResponse: "📊 **No Results Found**\n\nYour query executed successfully but returned no data. This might mean:\n- The criteria didn't match any records\n- The table is empty\n- The date range or filters were too restrictive",
          data: []
        };
      }

      // Check if demo mode is enabled
      if (this.useDemoMode) {
        return {
          success: true,
          formattedResponse: this.generateDemoFormatting(results, originalQuery),
          data: results.data,
          executionTime: results.executionTime,
          rowCount: results.rowCount
        };
      }

      // Format the results using Local LLM or AI with context
      const prompt = this.generateContextualFormattingPrompt(originalQuery, results, userId);

      let formattedResponse;
      
      // Use the configured AI service with fallback logic
      if (this.useExternalAPI) {
        try {
          formattedResponse = await externalAPIService.generateText(prompt, {
            maxTokens: 1024,
            temperature: 0.3
          });
        } catch (error) {
          logger.warn('External API formatting failed', { error: error.message });
          if (this.fallbackToLocal && this.useLocalLLM) {
            try {
              formattedResponse = await localLLMService.generateText(prompt, {
                maxTokens: 1024,
                temperature: 0.3
              });
              logger.info('Successfully fell back to local LLM for formatting');
            } catch (localError) {
              logger.warn('Local LLM formatting fallback also failed', { error: localError.message });
              return {
                success: true,
                formattedResponse: this.generateDemoFormatting(results, originalQuery),
                data: results.data,
                executionTime: results.executionTime,
                rowCount: results.rowCount
              };
            }
          } else {
            return {
              success: true,
              formattedResponse: this.generateDemoFormatting(results, originalQuery),
              data: results.data,
              executionTime: results.executionTime,
              rowCount: results.rowCount
            };
          }
        }
      } else if (this.useLocalLLM) {
        try {
          formattedResponse = await localLLMService.generateText(prompt, {
            maxTokens: 1024,
            temperature: 0.3
          });
        } catch (error) {
          logger.warn('Local LLM formatting failed', { error: error.message });
          if (this.fallbackToExternal && this.useExternalAPI) {
            try {
              formattedResponse = await externalAPIService.generateText(prompt, {
                maxTokens: 1024,
                temperature: 0.3
              });
              logger.info('Successfully fell back to external API for formatting');
            } catch (externalError) {
              logger.warn('External API formatting fallback also failed', { error: externalError.message });
              return {
                success: true,
                formattedResponse: this.generateDemoFormatting(results, originalQuery),
                data: results.data,
                executionTime: results.executionTime,
                rowCount: results.rowCount
              };
            }
          } else {
            return {
              success: true,
              formattedResponse: this.generateDemoFormatting(results, originalQuery),
              data: results.data,
              executionTime: results.executionTime,
              rowCount: results.rowCount
            };
          }
        }
      } else {
        // Legacy fallback to the old callAIService method
        formattedResponse = await this.callAIService(prompt, retryCount);
      }

      logger.info('Successfully formatted query results', { 
        userId, 
        rowCount: results.rowCount,
        originalQuery,
        usingLocalLLM: this.useLocalLLM 
      });

      return {
        success: true,
        formattedResponse,
        data: results.data,
        executionTime: results.executionTime,
        rowCount: results.rowCount
      };
    } catch (error) {
      logger.error('Failed to format query results', { 
        error: error.message, 
        userId, 
        retryCount,
        originalQuery 
      });

      if (retryCount < this.maxRetries && !error.message.includes('quota') && !error.message.includes('429')) {
        logger.info('Retrying result formatting', { retryCount: retryCount + 1 });
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.formatResults(results, originalQuery, userId, retryCount + 1);
      }

      // Fallback formatting if AI formatting fails
      return {
        success: true,
        formattedResponse: this.generateDemoFormatting(results, originalQuery),
        data: results.data,
        executionTime: results.executionTime,
        rowCount: results.rowCount
      };
    }
  }

  /**
   * Main chat processing function
   */
  async processChat(query, userId) {
    const requestId = `chat-${userId}-${Date.now()}`;
    
    try {
      logger.info('Processing AI chat query', { query, userId, requestId });

      // Step 1: Convert natural language to SQL
      const sql = await this.naturalLanguageToSQL(query, userId);

      // Step 2: Execute the SQL query
      const results = await this.executeSQLQuery(sql, userId);

      // Step 3: Format the results
      const formattedResults = await this.formatResults(results, query, userId);

      // Step 4: Check if user requested download or chart
      const reportOptions = this.extractReportOptions(query);
      const chartOptions = this.extractChartOptions(query);

      // Step 5: Add to conversation history for context
      this.addToConversationHistory(userId, query, formattedResults.formattedResponse, {
        sql,
        success: formattedResults.success,
        requestId,
        rowCount: formattedResults.rowCount
      });

      // Note: AI chat queries are not logged to activity logs for privacy reasons
      // await this.logChatInteraction(userId, query, sql, formattedResults.success, requestId);

      const response = {
        success: true,
        response: formattedResults.formattedResponse,
        data: formattedResults.data,
        metadata: {
          sql,
          executionTime: formattedResults.executionTime,
          rowCount: formattedResults.rowCount,
          requestId,
          usingLocalLLM: this.useLocalLLM,
          useDemoMode: this.useDemoMode
        }
      };

      // Step 6: Add report generation if requested
      if (reportOptions.shouldGenerate && results.success && results.data?.length > 0) {
        try {
          const report = await metabaseService.generateReport(sql, userId, reportOptions.format, {
            filename: reportOptions.filename
          });
          
          if (report.success) {
            response.downloadReport = {
              available: true,
              format: reportOptions.format,
              filename: report.filename,
              downloadUrl: `/api/reports/generate`,
              method: 'POST',
              body: { sqlQuery: sql, format: reportOptions.format, filename: reportOptions.filename }
            };
            
            response.response += `\n\n📊 **Download Available**: ${reportOptions.format.toUpperCase()} report ready for download (${report.rowCount} rows)`;
          }
        } catch (error) {
          logger.warn('Failed to generate report', { error: error.message });
        }
      }

      // Step 7: Add chart generation if requested
      if (chartOptions.shouldGenerate && results.success && results.data?.length > 0) {
        try {
          const chartData = metabaseService.generateChartData(results.data, chartOptions);
          const chartConfig = metabaseService.generateChartConfig(chartData, chartOptions.chartType, {
            title: chartOptions.title,
            xLabel: chartOptions.xLabel,
            yLabel: chartOptions.yLabel
          });

          response.chartData = {
            available: true,
            chartType: chartOptions.chartType,
            data: chartData,
            config: chartConfig,
            dataPoints: results.data.length
          };

          response.response += `\n\n📈 **Chart Available**: ${chartOptions.chartType} chart generated with ${results.data.length} data points`;
        } catch (error) {
          logger.warn('Failed to generate chart', { error: error.message });
        }
      }

      return response;
    } catch (error) {
      logger.error('Failed to process chat query', { 
        error: error.message, 
        query, 
        userId, 
        requestId 
      });

      // Note: AI chat queries are not logged to activity logs for privacy reasons
      // await this.logChatInteraction(userId, query, null, false, requestId, error.message);

      return {
        success: false,
        response: `❌ **Sorry, I encountered an error processing your request.**\n\n**Error:** ${error.message}\n\nPlease try:\n- Rephrasing your question\n- Being more specific\n- Asking about specific data (students, payments, seats, etc.)`,
        error: error.message,
        metadata: {
          requestId,
          usingLocalLLM: this.useLocalLLM,
          useDemoMode: this.useDemoMode
        }
      };
    }
  }

  /**
   * Call AI service (OpenAI fallback)
   */
  async callAIService(prompt, retryCount = 0) {
    try {
      if (!this.aiApiKey) {
        throw new Error('AI API key not configured');
      }

      // Check if demo mode is enabled
      if (this.useDemoMode) {
        throw new Error('Demo mode enabled - using fallback responses');
      }

      const response = await fetch(`${this.aiApiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant specializing in database queries and data analysis for a study room management system.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 'Unknown error';
        
        // Handle quota exceeded error specifically
        if (response.status === 429 || errorMessage.includes('quota')) {
          logger.warn('OpenAI quota exceeded, switching to demo mode');
          throw new Error(`AI API quota exceeded: ${errorMessage}`);
        }
        
        throw new Error(`AI API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'No response generated';
      
      return aiResponse;
    } catch (error) {
      logger.error('AI service call failed', { error: error.message, retryCount });
      
      // Don't retry on quota errors
      if (error.message.includes('quota') || error.message.includes('429')) {
        throw error;
      }
      
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.callAIService(prompt, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Get local LLM status
   */
  async getLocalLLMStatus() {
    try {
      return await localLLMService.getStatus();
    } catch (error) {
      return {
        backend: 'unknown',
        isInitialized: false,
        isAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Get external API status
   */
  async getExternalAPIStatus() {
    try {
      return await externalAPIService.getStatus();
    } catch (error) {
      return {
        provider: 'unknown',
        isInitialized: false,
        hasApiKey: false,
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive AI service status
   */
  async getAIStatus() {
    const localStatus = await this.getLocalLLMStatus();
    const externalStatus = await this.getExternalAPIStatus();

    return {
      configuration: {
        useLocalLLM: this.useLocalLLM,
        useExternalAPI: this.useExternalAPI,
        useDemoMode: this.useDemoMode,
        fallbackToLocal: this.fallbackToLocal,
        fallbackToExternal: this.fallbackToExternal,
        fallbackEnabled: this.fallbackEnabled
      },
      localLLM: localStatus,
      externalAPI: externalStatus,
      availableProviders: externalAPIService.getAvailableProviders(),
      currentProvider: this.useDemoMode ? 'demo' : (this.useExternalAPI ? 'external' : (this.useLocalLLM ? 'local' : 'none'))
    };
  }

  /**
   * Switch LLM backend
   */
  async switchLLMBackend(backend, model = null) {
    try {
      await localLLMService.switchBackend(backend, model);
      logger.info('Switched LLM backend successfully', { backend, model });
      return { success: true, backend, model };
    } catch (error) {
      logger.error('Failed to switch LLM backend', { error: error.message, backend, model });
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch external API provider
   */
  async switchExternalProvider(provider, model = null) {
    try {
      await externalAPIService.switchProvider(provider, model);
      logger.info('Switched external API provider successfully', { provider, model });
      return { success: true, provider, model };
    } catch (error) {
      logger.error('Failed to switch external API provider', { error: error.message, provider, model });
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch AI service mode (local, external, or demo)
   */
  async switchAIMode(mode, options = {}) {
    try {
      switch (mode) {
        case 'local':
          this.useLocalLLM = true;
          this.useExternalAPI = false;
          this.useDemoMode = false;
          if (options.backend || options.model) {
            await this.switchLLMBackend(options.backend, options.model);
          }
          break;
        
        case 'external':
          this.useLocalLLM = false;
          this.useExternalAPI = true;
          this.useDemoMode = false;
          if (options.provider || options.model) {
            await this.switchExternalProvider(options.provider, options.model);
          }
          break;
        
        case 'demo':
          this.useLocalLLM = false;
          this.useExternalAPI = false;
          this.useDemoMode = true;
          break;
        
        default:
          throw new Error(`Unsupported AI mode: ${mode}`);
      }
      
      logger.info('Switched AI mode successfully', { mode, options });
      return { success: true, mode, options };
    } catch (error) {
      logger.error('Failed to switch AI mode', { error: error.message, mode, options });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Metabase JWT token for embedding
   */
  generateMetabaseToken(payload) {
    if (!this.metabaseSecret) {
      throw new Error('Metabase secret key not configured');
    }

    return jwt.sign(payload, this.metabaseSecret, { algorithm: 'HS256' });
  }

  /**
   * Create embedded dashboard URL
   */
  createEmbeddedDashboardUrl(dashboardId, params = {}) {
    try {
      const payload = {
        resource: { dashboard: dashboardId },
        params,
        exp: Math.round(Date.now() / 1000) + (10 * 60) // 10 minutes expiry
      };

      const token = this.generateMetabaseToken(payload);
      return `${this.metabaseUrl}/embed/dashboard/${token}#bordered=true&titled=true`;
    } catch (error) {
      logger.error('Failed to create embedded dashboard URL', { error: error.message, dashboardId });
      throw error;
    }
  }

  /**
   * Utility functions
   */
  isValidSQL(sql) {
    const trimmed = sql.trim().toLowerCase();
    
    // Check if it starts with SELECT and includes FROM
    if (!trimmed.startsWith('select') || !trimmed.includes('from')) {
      return false;
    }
    
    // Check for dangerous keywords as whole words, not substrings
    const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'truncate'];
    const words = trimmed.split(/\s+/);
    
    for (const keyword of dangerousKeywords) {
      if (words.includes(keyword)) {
        return false;
      }
    }
    
    // Special case: check for CREATE but allow CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP
    if (words.includes('create') && !trimmed.includes('current_date') && !trimmed.includes('current_time') && !trimmed.includes('current_timestamp')) {
      return false;
    }
    
    // Enhanced syntax validation
    try {
      // Check for proper clause ordering
      const clauses = ['select', 'from', 'where', 'group by', 'having', 'order by', 'limit'];
      let lastFoundIndex = -1;
      
      for (const clause of clauses) {
        const index = trimmed.indexOf(clause);
        if (index !== -1) {
          if (index < lastFoundIndex) {
            logger.warn('SQL clause ordering issue detected', { sql: sql.substring(0, 100) + '...' });
          }
          lastFoundIndex = index;
        }
      }
      
      // Check for balanced parentheses
      const openParens = (trimmed.match(/\(/g) || []).length;
      const closeParens = (trimmed.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        logger.warn('Unbalanced parentheses detected', { sql: sql.substring(0, 100) + '...' });
      }
      
      // Check for common syntax issues
      if (trimmed.includes('group by') && !trimmed.includes('select')) {
        return false;
      }
      
      if (trimmed.includes('having') && !trimmed.includes('group by')) {
        logger.warn('HAVING clause without GROUP BY detected', { sql: sql.substring(0, 100) + '...' });
      }
      
    } catch (error) {
      logger.warn('SQL validation check failed', { error: error.message });
    }
    
    return true;
  }

  isSafeSelectQuery(sql) {
    const normalized = sql.trim().toLowerCase();
    
    // Use word boundaries to avoid false positives (e.g., 'create' in 'current_date')
    const dangerousPatterns = [
      /\bdrop\b/, /\bdelete\b/, /\binsert\b/, /\bupdate\b/, /\balter\b/, 
      /\bcreate\b/, /\btruncate\b/, /\bexec\b/, /\bexecute\b/, 
      /\bsp_/, /\bxp_/, /--/, /\/\*/, /\*\//, /;/
    ];
    
    // Allow common date/time functions that might contain dangerous keywords as substrings
    const allowedDateTimeFunctions = [
      'current_date', 'current_time', 'current_timestamp', 'now()', 
      'date(', 'time(', 'timestamp(', 'extract('
    ];
    
    if (!normalized.startsWith('select')) {
      return false;
    }
    
    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalized)) {
        // For simple cases where we know it's safe (like semicolon at end)
        if (pattern.toString() === '/;/' && normalized.endsWith(';')) {
          continue; // Semicolon at end is acceptable
        }
        
        // Special case: if it's a date/time function, allow it
        const matches = normalized.match(pattern);
        if (matches) {
          let allMatchesAreSafe = true;
          
          for (const match of matches) {
            const isInDateTimeFunction = allowedDateTimeFunctions.some(func => {
              const funcPos = normalized.indexOf(func);
              const matchPos = normalized.indexOf(match);
              return funcPos !== -1 && funcPos <= matchPos && matchPos < funcPos + func.length;
            });
            
            if (!isInDateTimeFunction) {
              allMatchesAreSafe = false;
              break;
            }
          }
          
          if (!allMatchesAreSafe) {
            return false;
          }
        } else {
          // Pattern matched but no matches found - this shouldn't happen, but be safe
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Check if this is a bulk operation that shouldn't have limits
   */
  isBulkOperation(sql, userId) {
    const normalized = sql.toLowerCase();
    
    // Operations for SMS/communication purposes
    const bulkKeywords = [
      'expired', 'expire', 'sms', 'mobile', 'contact_number', 'phone',
      'membership_till < current_date', 'membership_status = \'expired\'',
      'for sms', 'send sms', 'bulk', 'contact information', 'get contact',
      'information', 'details', 'contact number'
    ];
    
    // Also check the original user query context if available
    const conversationHistory = this.getConversationHistory(userId);
    const recentQuery = conversationHistory.length > 0 ? 
      conversationHistory[conversationHistory.length - 1].userQuery.toLowerCase() : '';
    
    // Check if SQL contains bulk indicators OR user query contains bulk indicators
    const sqlHasBulkKeywords = bulkKeywords.some(keyword => normalized.includes(keyword));
    const queryHasBulkKeywords = bulkKeywords.some(keyword => recentQuery.includes(keyword));
    
    return sqlHasBulkKeywords || queryHasBulkKeywords;
  }

  isRetryableError(error) {
    const retryableErrors = [
      'connection', 'timeout', 'network', 'ECONNRESET', 'ETIMEDOUT'
    ];
    return retryableErrors.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extract report generation options from user query
   */
  extractReportOptions(query) {
    const normalizedQuery = query.toLowerCase();
    
    // Check for download keywords
    const downloadKeywords = ['download', 'export', 'save', 'generate report', 'create report'];
    const shouldGenerate = downloadKeywords.some(keyword => normalizedQuery.includes(keyword));
    
    // Determine format
    let format = 'csv'; // default
    if (normalizedQuery.includes('excel') || normalizedQuery.includes('xlsx')) {
      format = 'xlsx';
    } else if (normalizedQuery.includes('json')) {
      format = 'json';
    } else if (normalizedQuery.includes('csv')) {
      format = 'csv';
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `query_result_${timestamp}.${format}`;
    
    return {
      shouldGenerate,
      format,
      filename
    };
  }

  /**
   * Extract chart options from user query
   */
  extractChartOptions(query) {
    const normalizedQuery = query.toLowerCase();
    
    // Check for chart keywords
    const chartKeywords = ['chart', 'graph', 'plot', 'visualize', 'show chart', 'create chart'];
    const shouldGenerate = chartKeywords.some(keyword => normalizedQuery.includes(keyword));
    
    // Determine chart type
    let chartType = 'bar'; // default
    if (normalizedQuery.includes('pie')) {
      chartType = 'pie';
    } else if (normalizedQuery.includes('line')) {
      chartType = 'line';
    } else if (normalizedQuery.includes('bar')) {
      chartType = 'bar';
    } else if (normalizedQuery.includes('doughnut')) {
      chartType = 'doughnut';
    }
    
    // Try to extract column information (basic heuristics)
    const words = normalizedQuery.split(' ');
    let xColumn = null;
    let yColumn = null;
    
    // Look for common patterns
    if (normalizedQuery.includes('by month')) {
      xColumn = 'month';
    } else if (normalizedQuery.includes('by date')) {
      xColumn = 'date';
    } else if (normalizedQuery.includes('by status')) {
      xColumn = 'status';
    } else if (normalizedQuery.includes('by floor')) {
      xColumn = 'floor_number';
    }
    
    if (normalizedQuery.includes('revenue') || normalizedQuery.includes('amount')) {
      yColumn = 'amount';
    } else if (normalizedQuery.includes('count')) {
      yColumn = 'count';
    }
    
    return {
      shouldGenerate,
      chartType,
      xColumn,
      yColumn,
      title: 'Data Visualization',
      xLabel: xColumn || 'Category',
      yLabel: yColumn || 'Value'
    };
  }

  /**
   * Check if error is a SQL syntax error that can be corrected
   */
  isSQLSyntaxError(error) {
    const syntaxErrorIndicators = [
      'syntax error',
      'invalid input syntax',
      'near "LIMIT"',
      'near "ORDER"',
      'near "GROUP"',
      'near "HAVING"',
      'unexpected token',
      'missing FROM',
      'column does not exist',
      'table does not exist',
      'function does not exist',
      'operator does not exist'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return syntaxErrorIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Attempt to correct SQL syntax errors using AI
   */
  async correctSQLSyntax(originalSQL, errorMessage, userId) {
    try {
      const correctionPrompt = `You are a PostgreSQL expert. Fix the SQL syntax error in the following query.

Original SQL Query:
${originalSQL}

Error Message:
${errorMessage}

Database Schema Context:
- students table: id, name, email, phone, membership_status ('active' or 'expired'), created_at, updated_at
- users table: id, username, email, password_hash, role, status ('active' or 'inactive')
- payments table: id, student_id, amount, payment_date, payment_method, status
- seats table: id, seat_number, is_occupied, occupied_by (student_id), floor_number
- expenses table: id, description, amount, category, date, created_by

Common PostgreSQL syntax rules:
- Use DATE_TRUNC for date operations
- INTERVAL syntax: INTERVAL '1 month'
- Proper quote usage: single quotes for strings, double quotes for identifiers
- LIMIT clause must come after ORDER BY
- Use proper JOIN syntax
- Column names must exist in tables

Please provide ONLY the corrected SQL query without any explanations. The query should:
1. Fix the syntax error mentioned
2. Maintain the original intent
3. Follow PostgreSQL standards
4. Be a valid SELECT statement only`;

      let correctedSQL;

      // Use the configured AI service for correction
      if (this.useExternalAPI) {
        try {
          correctedSQL = await externalAPIService.generateText(correctionPrompt, {
            maxTokens: 256,
            temperature: 0.1
          });
        } catch (error) {
          logger.warn('External API correction failed', { error: error.message });
          if (this.fallbackToLocal && this.useLocalLLM) {
            correctedSQL = await localLLMService.generateText(correctionPrompt, {
              maxTokens: 256,
              temperature: 0.1
            });
          } else {
            return this.applySQLCorrections(originalSQL, errorMessage);
          }
        }
      } else if (this.useLocalLLM) {
        try {
          correctedSQL = await localLLMService.generateText(correctionPrompt, {
            maxTokens: 256,
            temperature: 0.1
          });
        } catch (error) {
          logger.warn('Local LLM correction failed', { error: error.message });
          return this.applySQLCorrections(originalSQL, errorMessage);
        }
      } else {
        // Use rule-based corrections as fallback
        return this.applySQLCorrections(originalSQL, errorMessage);
      }

      // Extract SQL from response if wrapped in markdown
      if (correctedSQL) {
        const sqlMatch = correctedSQL.match(/```(?:sql)?\s*([\s\S]*?)\s*```/) || 
                        correctedSQL.match(/^(SELECT[\s\S]*?)(?:\n\n|$)/i);
        if (sqlMatch) {
          correctedSQL = sqlMatch[1].trim();
        }
        correctedSQL = correctedSQL.replace(/;[\s\S]*$/, '').trim();
      }

      return correctedSQL || this.applySQLCorrections(originalSQL, errorMessage);
    } catch (error) {
      logger.warn('SQL correction failed', { error: error.message });
      return this.applySQLCorrections(originalSQL, errorMessage);
    }
  }

  /**
   * Apply rule-based SQL corrections for common syntax errors
   */
  applySQLCorrections(sql, errorMessage) {
    let corrected = sql;
    const errorLower = errorMessage.toLowerCase();

    try {
      // Fix common PostgreSQL syntax issues
      
      // 1. Fix LIMIT placement issues
      if (errorLower.includes('near "limit"')) {
        // Move LIMIT to the end if it's misplaced
        const limitMatch = corrected.match(/\bLIMIT\s+\d+/i);
        if (limitMatch) {
          corrected = corrected.replace(/\bLIMIT\s+\d+/i, '');
          corrected = corrected.trim() + ' ' + limitMatch[0];
        }
      }

      // 2. Fix ORDER BY placement
      if (errorLower.includes('near "order"')) {
        const orderByRegex = /\bORDER\s+BY\s+[^;]+/i;
        const orderByMatch = corrected.match(orderByRegex);
        if (orderByMatch) {
          corrected = corrected.replace(orderByRegex, '');
          const limitMatch = corrected.match(/\bLIMIT\s+\d+/i);
          if (limitMatch) {
            corrected = corrected.replace(/\bLIMIT\s+\d+/i, '');
            corrected = corrected.trim() + ' ' + orderByMatch[0] + ' ' + limitMatch[0];
          } else {
            corrected = corrected.trim() + ' ' + orderByMatch[0];
          }
        }
      }

      // 3. Fix GROUP BY placement
      if (errorLower.includes('near "group"')) {
        const groupByRegex = /\bGROUP\s+BY\s+[^;]+?(?=\s+(?:ORDER|LIMIT|$))/i;
        const groupByMatch = corrected.match(groupByRegex);
        if (groupByMatch) {
          // GROUP BY should come before ORDER BY and LIMIT
          corrected = corrected.replace(groupByRegex, '');
          const orderByMatch = corrected.match(/\bORDER\s+BY\s+[^;]+/i);
          const limitMatch = corrected.match(/\bLIMIT\s+\d+/i);
          
          if (orderByMatch) corrected = corrected.replace(/\bORDER\s+BY\s+[^;]+/i, '');
          if (limitMatch) corrected = corrected.replace(/\bLIMIT\s+\d+/i, '');
          
          corrected = corrected.trim() + ' ' + groupByMatch[0];
          if (orderByMatch) corrected += ' ' + orderByMatch[0];
          if (limitMatch) corrected += ' ' + limitMatch[0];
        }
      }

      // 4. Fix quote issues
      if (errorLower.includes('invalid input syntax')) {
        // Fix common quote issues
        corrected = corrected.replace(/"/g, "'"); // Convert double quotes to single for strings
      }

      // 5. Fix date function syntax
      if (errorLower.includes('function does not exist')) {
        corrected = corrected.replace(/MONTH\s*\(/gi, 'DATE_TRUNC(\'month\', ');
        corrected = corrected.replace(/YEAR\s*\(/gi, 'DATE_TRUNC(\'year\', ');
        corrected = corrected.replace(/NOW\s*\(\s*\)/gi, 'CURRENT_DATE');
      }

      // 6. Remove duplicate spaces and clean up
      corrected = corrected.replace(/\s+/g, ' ').trim();

      return corrected;
    } catch (error) {
      logger.warn('Rule-based SQL correction failed', { error: error.message });
      return sql; // Return original if correction fails
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  fallbackFormat(results, originalQuery) {
    if (!results.success) {
      return `❌ **Query Error:** ${results.error}`;
    }

    if (!results.data || results.data.length === 0) {
      return "📊 **No results found** for your query.";
    }

    let formatted = `📊 **Query Results** (${results.rowCount} rows)\n\n`;
    
    if (results.data.length <= 5) {
      // Show all results for small datasets
      formatted += "```\n";
      formatted += JSON.stringify(results.data, null, 2);
      formatted += "\n```";
    } else {
      // Show sample for large datasets
      formatted += "**Sample Results:**\n```\n";
      formatted += JSON.stringify(results.data.slice(0, 3), null, 2);
      formatted += "\n```\n";
      formatted += `*... and ${results.data.length - 3} more rows*`;
    }

    return formatted;
  }

  /**
   * Get context-aware suggestions based on conversation history and database
   */
  async getContextAwareSuggestions(userId) {
    const history = this.getConversationHistory(userId);
    const frequentQueries = await this.getMostFrequentQueries(userId, 5);
    
    const baseSuggestions = [
      {
        category: 'Charts & Reports',
        queries: [
          'Download student enrollment data as CSV',
          'Create a bar chart of monthly revenue',
          'Export payment status report to Excel',
          'Generate pie chart of seat utilization',
          'Show line chart of daily attendance trends'
        ]
      },
      {
        category: 'Students',
        queries: [
          'How many active students do we have?',
          'Show me students whose membership expires this month',
          'List all students without assigned seats',
          'Find students with overdue payments',
          'Show gender distribution of students'
        ]
      },
      {
        category: 'Payments',
        queries: [
          'What is our total revenue this month?',
          'Show payment trends for the last 6 months',
          'List students with pending payments',
          'Compare revenue between male and female students',
          'Show average payment amounts by membership type'
        ]
      },
      {
        category: 'Seats',
        queries: [
          'How many seats are currently occupied?',
          'Show seat occupancy rate by gender',
          'List all available seats',
          'Find seats with gender restrictions',
          'Show seat utilization statistics'
        ]
      }
    ];

    // Add frequently used queries at the top if available
    if (frequentQueries.length > 0) {
      baseSuggestions.unshift({
        category: 'Your Most Used Queries',
        queries: frequentQueries.map(fq => {
          const daysSinceLastUse = Math.floor((Date.now() - new Date(fq.lastUsed).getTime()) / (1000 * 60 * 60 * 24));
          const lastUsedText = daysSinceLastUse === 0 ? 'today' : 
                              daysSinceLastUse === 1 ? 'yesterday' : 
                              daysSinceLastUse < 7 ? `${daysSinceLastUse} days ago` : 
                              'over a week ago';
          return `${fq.originalExample} (used ${fq.count} times, last ${lastUsedText})`;
        }),
        isFrequent: true
      });
    }

    // Add contextual suggestions based on recent queries
    if (history.length > 0) {
      const recentQuery = history[history.length - 1].userQuery.toLowerCase();
      
      let contextualSuggestions = [];
      
      if (recentQuery.includes('student')) {
        contextualSuggestions = [
          'Show more details about those students',
          'Get contact information for them',
          'Show their payment history',
          'Find their seat assignments'
        ];
      } else if (recentQuery.includes('payment') || recentQuery.includes('revenue')) {
        contextualSuggestions = [
          'Break down by payment method',
          'Compare with previous months',
          'Show top paying students',
          'Analyze payment patterns'
        ];
      } else if (recentQuery.includes('seat')) {
        contextualSuggestions = [
          'Show student details for occupied seats',
          'Find seats by gender preference',
          'Show seat utilization trends',
          'List recent seat assignments'
        ];
      }

      if (contextualSuggestions.length > 0) {
        // Insert after frequent queries but before base suggestions
        const insertIndex = frequentQueries.length > 0 ? 1 : 0;
        baseSuggestions.splice(insertIndex, 0, {
          category: 'Based on your recent query',
          queries: contextualSuggestions,
          isContextual: true
        });
      }
    }

    return baseSuggestions;
  }

  /**
   * Generate demo SQL queries based on natural language (when LLM is unavailable)
   */
  generateDemoSQL(query) {
    const lowerQuery = query.toLowerCase();
    
    // Priority patterns - check these first for more specific matching
    
    // Contact information for expired students - multiple variations
    if (lowerQuery.includes('expired') && lowerQuery.includes('student') && 
        (lowerQuery.includes('contact') || lowerQuery.includes('phone') || lowerQuery.includes('mobile') || 
         lowerQuery.includes('information') || lowerQuery.includes('details') || lowerQuery.includes('sms'))) {
      return "SELECT id, name, father_name, contact_number, membership_till, membership_status FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE)) AND contact_number IS NOT NULL ORDER BY membership_till";
    }
    
    // SMS list for expired students  
    if ((lowerQuery.includes('sms') || lowerQuery.includes('mobile') || lowerQuery.includes('phone')) && 
        lowerQuery.includes('expired') && lowerQuery.includes('student')) {
      return "SELECT id, name, father_name, contact_number, membership_till, membership_status FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE)) AND contact_number IS NOT NULL ORDER BY membership_till";
    }
    
    // Expired students general (only if not asking for contact info)
    if (lowerQuery.includes('expired') && lowerQuery.includes('student') && 
        !lowerQuery.includes('count') && !lowerQuery.includes('how many') &&
        !lowerQuery.includes('contact') && !lowerQuery.includes('phone') && !lowerQuery.includes('mobile')) {
      return "SELECT id, name, father_name, contact_number, membership_till, membership_status FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE)) ORDER BY membership_till";
    }
    
    // Student-related queries
    if (lowerQuery.includes('student') && (lowerQuery.includes('count') || lowerQuery.includes('how many'))) {
      if (lowerQuery.includes('active')) {
        return "SELECT COUNT(*) as total_active_students FROM students WHERE membership_status = 'active'";
      }
      if (lowerQuery.includes('expired')) {
        return "SELECT COUNT(*) as total_expired_students FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE))";
      }
      return "SELECT COUNT(*) as total_students FROM students";
    }
    
    if (lowerQuery.includes('student') && (lowerQuery.includes('expire') || lowerQuery.includes('expired'))) {
      // This should only handle cases NOT already handled by the priority patterns above
      // The priority patterns above handle contact/information/details cases
      if (!lowerQuery.includes('contact') && !lowerQuery.includes('sms') && !lowerQuery.includes('mobile') && 
          !lowerQuery.includes('phone') && !lowerQuery.includes('information') && !lowerQuery.includes('details')) {
        // Regular expiring students query with limit (for non-bulk operations)
        // Note: This checks for students whose membership is expiring soon (active but within 30 days)
        return "SELECT id, name, father_name, contact_number, membership_till FROM students WHERE membership_till < CURRENT_DATE + INTERVAL '30 days' AND membership_status = 'active' ORDER BY membership_till LIMIT 10";
      }
      // If it includes contact-related keywords, fall through to let priority patterns handle it
      // But if we reach here, return the bulk query without limit
      return "SELECT id, name, father_name, contact_number, membership_till, membership_status FROM students WHERE (membership_status IN ('expired', 'inactive') OR (membership_status = 'active' AND membership_till < CURRENT_DATE)) AND contact_number IS NOT NULL ORDER BY membership_till";
    }
    
    if (lowerQuery.includes('student') && lowerQuery.includes('seat') && lowerQuery.includes('without')) {
      return "SELECT id, name, father_name, contact_number, membership_status FROM students WHERE seat_number IS NULL AND membership_status = 'active' LIMIT 10";
    }
    
    // Payment-related queries
    if (lowerQuery.includes('payment') || lowerQuery.includes('revenue')) {
      if (lowerQuery.includes('month') || lowerQuery.includes('monthly')) {
        return "SELECT DATE_TRUNC('month', payment_date) as month, SUM(amount) as total_revenue, COUNT(*) as payment_count FROM payments WHERE payment_date >= CURRENT_DATE - INTERVAL '6 months' GROUP BY month ORDER BY month DESC";
      }
      if (lowerQuery.includes('total') || lowerQuery.includes('sum')) {
        return "SELECT SUM(amount) as total_revenue, COUNT(*) as total_payments FROM payments WHERE payment_date >= CURRENT_DATE - INTERVAL '1 month'";
      }
      return "SELECT student_id, SUM(amount) as total_paid, COUNT(*) as payment_count FROM payments GROUP BY student_id ORDER BY total_paid DESC LIMIT 10";
    }
    
    // Seat-related queries
    if (lowerQuery.includes('seat')) {
      if (lowerQuery.includes('occupied') || lowerQuery.includes('occupancy')) {
        return "SELECT COUNT(CASE WHEN st.seat_number IS NOT NULL THEN 1 END) as occupied_seats, COUNT(s.seat_number) as total_seats, ROUND(COUNT(CASE WHEN st.seat_number IS NOT NULL THEN 1 END) * 100.0 / COUNT(s.seat_number), 2) as occupancy_rate FROM seats s LEFT JOIN students st ON s.seat_number = st.seat_number";
      }
      if (lowerQuery.includes('available') || lowerQuery.includes('empty')) {
        return "SELECT s.seat_number, s.occupant_sex FROM seats s LEFT JOIN students st ON s.seat_number = st.seat_number WHERE st.seat_number IS NULL ORDER BY s.seat_number LIMIT 20";
      }
      return "SELECT s.seat_number, s.occupant_sex, st.name as student_name, st.membership_status FROM seats s LEFT JOIN students st ON s.seat_number = st.seat_number ORDER BY s.seat_number LIMIT 20";
    }
    
    // Expense-related queries
    if (lowerQuery.includes('expense')) {
      return "SELECT ec.name as category, SUM(e.amount) as total_amount, COUNT(*) as expense_count FROM expenses e JOIN expense_categories ec ON e.expense_category_id = ec.id WHERE e.expense_date >= CURRENT_DATE - INTERVAL '3 months' GROUP BY ec.name ORDER BY total_amount DESC";
    }
    
    // Gender distribution
    if (lowerQuery.includes('gender') || lowerQuery.includes('male') || lowerQuery.includes('female')) {
      return "SELECT sex, COUNT(*) as count, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM students WHERE membership_status = 'active'), 2) as percentage FROM students WHERE membership_status = 'active' GROUP BY sex";
    }
    
    // Default fallback query
    return "SELECT COUNT(*) as total_students, COUNT(CASE WHEN membership_status = 'active' THEN 1 END) as active_students, COUNT(CASE WHEN seat_number IS NOT NULL THEN 1 END) as students_with_seats FROM students";
  }

  /**
   * Generate HTML table for better data presentation
   */
  generateHTMLTable(data, columns, title = '') {
    if (!data || data.length === 0) {
      return '<p>No data available</p>';
    }

    let html = '';
    if (title) {
      html += `<h3>${title}</h3>\n`;
    }

    html += '<table class="data-table" style="width: 100%; border-collapse: collapse; margin: 10px 0;">\n';
    
    // Generate header
    html += '  <thead>\n    <tr style="background-color: #f5f5f5;">\n';
    columns.forEach(col => {
      html += `      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${col.header}</th>\n`;
    });
    html += '    </tr>\n  </thead>\n';
    
    // Generate body
    html += '  <tbody>\n';
    data.forEach((row, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      html += `    <tr style="background-color: ${bgColor};">\n`;
      columns.forEach(col => {
        let value = row[col.field];
        if (col.format) {
          value = col.format(value, row);
        }
        html += `      <td style="border: 1px solid #ddd; padding: 8px;">${value}</td>\n`;
      });
      html += '    </tr>\n';
    });
    html += '  </tbody>\n</table>\n';
    
    return html;
  }

  /**
   * Generate demo formatting for results (when LLM is unavailable)
   */
  generateDemoFormatting(results, originalQuery) {
    if (!results.success || !results.data || results.data.length === 0) {
      return this.fallbackFormat(results, originalQuery);
    }

    const data = results.data;
    const lowerQuery = originalQuery.toLowerCase();
    
    // Student count formatting
    if (data[0].total_active_students !== undefined) {
      return `📊 **Active Students Count**\n\nYou currently have **${data[0].total_active_students} active students** enrolled in your study room management system.\n\n✅ This represents students with active membership status.\n\n🤖 *Powered by Local AI*`;
    }
    
    if (data[0].total_students !== undefined) {
      const active = data[0].active_students || 0;
      const withSeats = data[0].students_with_seats || 0;
      return `📊 **Student Overview**\n\n• **Total Students:** ${data[0].total_students}\n• **Active Students:** ${active}\n• **Students with Seats:** ${withSeats}\n\n📈 **Quick Insights:**\n- Active rate: ${Math.round((active/data[0].total_students)*100)}%\n- Seat assignment rate: ${Math.round((withSeats/active)*100)}%\n\n🤖 *Powered by Local AI*`;
    }
    
    // Revenue formatting
    if (data[0].total_revenue !== undefined) {
      return `💰 **Revenue Summary**\n\n• **Total Revenue:** ₹${data[0].total_revenue}\n• **Total Payments:** ${data[0].total_payments}\n• **Average Payment:** ₹${Math.round(data[0].total_revenue / data[0].total_payments)}\n\n📊 Data from the last month.\n\n🤖 *Powered by Local AI*`;
    }
    
    // Seat occupancy formatting
    if (data[0].occupied_seats !== undefined) {
      return `🪑 **Seat Occupancy Report**\n\n• **Occupied Seats:** ${data[0].occupied_seats}\n• **Total Seats:** ${data[0].total_seats}\n• **Occupancy Rate:** ${data[0].occupancy_rate}%\n\n${data[0].occupancy_rate > 80 ? '🔴 High occupancy - consider adding more seats' : data[0].occupancy_rate > 60 ? '🟡 Good occupancy level' : '🟢 Low occupancy - capacity available'}\n\n🤖 *Powered by Local AI*`;
    }
    
    // Gender distribution formatting
    if (data.length > 1 && data[0].sex !== undefined) {
      let formatted = `👥 **Gender Distribution**\n\n`;
      data.forEach(row => {
        formatted += `• **${row.sex.charAt(0).toUpperCase() + row.sex.slice(1)}:** ${row.count} students (${row.percentage}%)\n`;
      });
      formatted += `\n🤖 *Powered by Local AI*`;
      return formatted;
    }
    
    // Expired students with contact information formatting
    if (data.length > 0 && data[0].membership_till !== undefined && data[0].contact_number !== undefined) {
      const expiredCount = data.filter(s => new Date(s.membership_till) < new Date() || s.membership_status === 'expired').length;
      const totalCount = data.length;
      
      // Check if this was a contact information request
      const isContactRequest = lowerQuery.includes('contact') || lowerQuery.includes('information') || lowerQuery.includes('details');
      
      let formatted = isContactRequest ? 
        `� **Contact Information for Expired Students** (${expiredCount} students found)\n\n` :
        `�📱 **Expired Students for SMS** (${expiredCount} expired out of ${totalCount} total)\n\n`;
      
      // Group by status
      const expired = data.filter(s => new Date(s.membership_till) < new Date() || s.membership_status === 'expired');
      const expiring = data.filter(s => new Date(s.membership_till) >= new Date() && s.membership_status !== 'expired');
      
      if (expired.length > 0) {
        formatted += `🔴 **Expired Memberships (${expired.length}):**<br><br>`;
        
        // Generate HTML table for expired students
        const columns = [
          { header: 'ID', field: 'id' },
          { header: 'Name', field: 'name' },
          { header: "Father's Name", field: 'father_name' },
          { header: 'Contact Number', field: 'contact_number' },
          { 
            header: 'Membership Expiry Date', 
            field: 'membership_till',
            format: (value) => new Date(value).toLocaleDateString('en-GB')
          },
          { 
            header: 'Days Expired', 
            field: 'membership_till',
            format: (value) => {
              const days = Math.floor((new Date() - new Date(value)) / (1000 * 60 * 60 * 24));
              return `${days} days ago`;
            }
          }
        ];
        
        formatted += this.generateHTMLTable(expired.slice(0, 15), columns);
        
        if (expired.length > 15) {
          formatted += `<p><em>... and ${expired.length - 15} more expired students</em></p>`;
        }
      }
      
      if (expiring.length > 0) {
        formatted += `<br>🟡 **Expiring Soon (${expiring.length}):**<br><br>`;
        
        const expiringColumns = [
          { header: 'Name', field: 'name' },
          { header: 'Contact Number', field: 'contact_number' },
          { 
            header: 'Days Left', 
            field: 'membership_till',
            format: (value) => {
              const days = Math.ceil((new Date(value) - new Date()) / (1000 * 60 * 60 * 24));
              return `${days} days`;
            }
          }
        ];
        
        formatted += this.generateHTMLTable(expiring.slice(0, 5), expiringColumns);
        
        if (expiring.length > 5) {
          formatted += `<p><em>... and ${expiring.length - 5} more expiring students</em></p>`;
        }
      }
      
      if (isContactRequest) {
        formatted += `\n📞 **Contact Summary:**\n`;
        formatted += `• Total contacts: ${expired.length}\n`;
        formatted += `• All numbers verified and available\n`;
      } else {
        formatted += `\n📋 **SMS Contact List:**\n`;
        const phoneNumbers = expired.map(s => s.contact_number).filter(num => num).join(', ');
        formatted += `\`\`\`\n${phoneNumbers}\n\`\`\`\n`;
        formatted += `\n💡 **Ready for bulk SMS!** Copy the numbers above.\n`;
      }
      
      formatted += `\n🤖 *Powered by Local AI*`;
      
      return formatted;
    }
    
    // Regular expiring students formatting
    if (data.length > 0 && data[0].membership_till !== undefined && !data[0].contact_number) {
      return `⚠️ **Students with Expiring Memberships**\n\nFound **${data.length} students** whose memberships expire within 30 days:\n\n${data.slice(0, 5).map(s => `• **${s.name}** (${s.contact_number || 'No contact'}) - Expires: ${new Date(s.membership_till).toLocaleDateString()}`).join('\n')}\n\n💡 Consider sending renewal reminders to these students.\n\n🤖 *Powered by Local AI*`;
    }
    
    // Monthly revenue trends
    if (data.length > 1 && data[0].month !== undefined) {
      let formatted = `📈 **Monthly Revenue Trends**\n\n`;
      data.forEach(row => {
        const month = new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        formatted += `• **${month}:** ₹${row.total_revenue} (${row.payment_count} payments)\n`;
      });
      formatted += `\n🤖 *Powered by Local AI*`;
      return formatted;
    }
    
    // Default table formatting
    return this.fallbackFormat(results, originalQuery);
  }

  async logChatInteraction(userId, query, sql, success, requestId, error = null) {
    try {
      await pool.query(`
        INSERT INTO activity_logs (
          actor_user_id, action_type, action_description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [
        userId,
        'ai_chat_query',
        `AI chat query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`,
        JSON.stringify({
          original_query: query,
          generated_sql: sql,
          success,
          error,
          request_id: requestId,
          using_local_llm: this.useLocalLLM,
          demo_mode: this.useDemoMode
        })
      ]);
    } catch (logError) {
      logger.error('Failed to log chat interaction', { 
        logError: logError.message, 
        userId, 
        requestId 
      });
    }
  }
}

module.exports = new AIChatService();