const fetch = require('node-fetch');
const logger = require('../utils/logger');
const constants = require('../config/constants');

/**
 * External API Service supporting multiple providers:
 * - Perplexity (recommended)
 * - OpenAI
 */
class ExternalAPIService {
  constructor() {
    // Configuration - use constants with env override capability
    this.provider = process.env.EXTERNAL_API_PROVIDER || constants.EXTERNAL_API.DEFAULT_PROVIDER;
    this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT) || constants.EXTERNAL_API.TIMEOUT;
    this.maxTokens = parseInt(process.env.EXTERNAL_API_MAX_TOKENS) || constants.EXTERNAL_API.MAX_TOKENS;
    this.temperature = parseFloat(process.env.EXTERNAL_API_TEMPERATURE) || constants.EXTERNAL_API.TEMPERATURE;
    
    // Provider-specific configurations
    this.configurations = {
      perplexity: {
        apiKey: process.env.PERPLEXITY_API_KEY,
        model: process.env.PERPLEXITY_MODEL || constants.EXTERNAL_API.PROVIDERS.perplexity.DEFAULT_MODEL,
        url: process.env.PERPLEXITY_API_URL || constants.EXTERNAL_API.PROVIDERS.perplexity.API_URL,
        endpoint: constants.EXTERNAL_API.PROVIDERS.perplexity.ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': (apiKey) => `Bearer ${apiKey}`
        }
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || constants.EXTERNAL_API.PROVIDERS.openai.DEFAULT_MODEL,
        url: process.env.OPENAI_API_URL || constants.EXTERNAL_API.PROVIDERS.openai.API_URL,
        endpoint: constants.EXTERNAL_API.PROVIDERS.openai.ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': (apiKey) => `Bearer ${apiKey}`
        }
      }
    };
    
    this.isInitialized = false;
  }

  /**
   * Initialize the External API Service
   */
  async initialize() {
    try {
      const config = this.configurations[this.provider];
      
      if (!config) {
        throw new Error(`Unsupported external API provider: ${this.provider}`);
      }
      
      if (!config.apiKey) {
        throw new Error(`API key not configured for provider: ${this.provider}`);
      }
      
      // Set as initialized before testing to avoid circular dependency
      this.isInitialized = true;
      
      // Test the connection
      await this.testConnection();
      
      logger.info(`External API service initialized successfully with provider: ${this.provider}`);
      
      return {
        success: true,
        provider: this.provider,
        model: config.model
      };
    } catch (error) {
      this.isInitialized = false; // Reset on failure
      logger.error('External API service initialization failed', { 
        error: error.message, 
        provider: this.provider 
      });
      throw error;
    }
  }

  /**
   * Test connection to the external API
   */
  async testConnection() {
    try {
      const response = await this.generateText('Hello', { maxTokens: 10 });
      if (response && response.length > 0) {
        logger.info(`External API test successful for provider: ${this.provider}`);
        return true;
      } else {
        throw new Error('No response received from API');
      }
    } catch (error) {
      logger.error(`External API test failed for provider: ${this.provider}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Generate text using the external API
   */
  async generateText(prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('External API service not initialized');
    }

    const config = this.configurations[this.provider];
    const maxTokens = options.maxTokens || this.maxTokens;
    const temperature = options.temperature || this.temperature;

    try {
      const url = `${config.url}${config.endpoint}`;
      
      const body = {
        model: config.model,
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
        max_tokens: maxTokens,
        temperature: temperature
      };

      // Add provider-specific options
      if (this.provider === 'perplexity') {
        // Perplexity supports additional options
        body.stream = false;
        body.search_domain_filter = ["perplexity.ai"];
        body.return_images = false;
        body.return_related_questions = false;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.headers.Authorization(config.apiKey)
        },
        body: JSON.stringify(body),
        timeout: this.timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
        
        // Handle common error types
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded for ${this.provider}: ${errorMessage}`);
        } else if (response.status === 401) {
          throw new Error(`Authentication failed for ${this.provider}: ${errorMessage}`);
        } else if (response.status === 403) {
          throw new Error(`Access forbidden for ${this.provider}: ${errorMessage}`);
        }
        
        throw new Error(`${this.provider} API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      
      // Extract the response text
      const responseText = data.choices?.[0]?.message?.content || 
                          data.choices?.[0]?.text || 
                          'No response generated';

      logger.info('External API response generated', { 
        provider: this.provider,
        model: config.model,
        promptLength: prompt.length,
        responseLength: responseText.length
      });

      return responseText;
    } catch (error) {
      logger.error('External API text generation failed', { 
        error: error.message,
        provider: this.provider,
        promptLength: prompt.length
      });
      throw error;
    }
  }

  /**
   * Get current status of the external API service
   */
  async getStatus() {
    const config = this.configurations[this.provider];
    
    return {
      provider: this.provider,
      model: config?.model,
      isInitialized: this.isInitialized,
      hasApiKey: !!config?.apiKey,
      url: config?.url
    };
  }

  /**
   * Switch to a different provider
   */
  async switchProvider(provider, model = null) {
    if (!this.configurations[provider]) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    this.provider = provider;
    
    if (model) {
      this.configurations[provider].model = model;
    }
    
    this.isInitialized = false;
    await this.initialize();
    
    logger.info(`Switched to external API provider: ${provider}`);
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(this.configurations).map(provider => ({
      name: provider,
      model: this.configurations[provider].model,
      hasApiKey: !!this.configurations[provider].apiKey
    }));
  }
}

module.exports = new ExternalAPIService();