/**
 * Application Constants
 * Non-sensitive configuration values that don't need to be environment variables
 */

module.exports = {
  // Server Configuration
  DEFAULT_PORT: 3001,
  DEFAULT_CORS_ORIGIN: 'http://localhost:5173',
  
  // AI Chat Service Configuration
  AI_CHAT: {
    // Feature flags (can be overridden by env vars if needed)
    USE_LOCAL_LLM: false,
    USE_EXTERNAL_API: true,
    AI_DEMO_MODE: false,
    
    // Fallback Configuration
    FALLBACK_TO_LOCAL: true,
    FALLBACK_TO_EXTERNAL: false,
    AI_FALLBACK_ENABLED: true,
    
    // Cache Configuration
    CACHE_DURATION: 1000 * 60 * 60, // 1 hour
    MAX_CONTEXT_MESSAGES: 10,
    CONTEXT_EXPIRY: 1000 * 60 * 30, // 30 minutes
    
    // Retry Configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
  },
  
  // External API Service Configuration
  EXTERNAL_API: {
    DEFAULT_PROVIDER: 'openai', // perplexity, openai
    TIMEOUT: 30000, // 30 seconds
    MAX_TOKENS: 2048,
    TEMPERATURE: 0.1,
    
    // Provider configurations (URLs and models - not secrets)
    PROVIDERS: {
      perplexity: {
        DEFAULT_MODEL: 'llama-3.1-sonar-small-128k-online',
        API_URL: 'https://api.perplexity.ai',
        ENDPOINT: '/chat/completions',
      },
      openai: {
        DEFAULT_MODEL: 'gpt-3.5-turbo',
        API_URL: 'https://api.openai.com/v1',
        ENDPOINT: '/chat/completions',
      }
    }
  },
  
  // Local LLM Service Configuration
  LOCAL_LLM: {
    DEFAULT_BACKEND: 'ollama', // ollama, llamacpp, gpt4all, lmstudio
    DEFAULT_MODEL: 'llama2',
    TIMEOUT: 30000, // 30 seconds
    MAX_TOKENS: 2048,
    TEMPERATURE: 0.1,
    
    // Backend configurations
    BACKENDS: {
      ollama: {
        DEFAULT_URL: 'http://localhost:11434',
        MODELS: ['llama2', 'codellama', 'mistral', 'llama2:13b', 'llama2:70b'],
        ENDPOINT: '/api/generate'
      },
      llamacpp: {
        DEFAULT_URL: 'http://localhost:8080',
        MODELS: ['llama-2-7b', 'llama-2-13b', 'llama-2-70b'],
        ENDPOINT: '/completion'
      },
      gpt4all: {
        DEFAULT_URL: 'http://localhost:4891',
        MODELS: ['gpt4all-j', 'vicuna-7b', 'wizard-13b'],
        ENDPOINT: '/v1/completions'
      },
      lmstudio: {
        DEFAULT_URL: 'http://localhost:1234',
        MODELS: ['local-model'],
        ENDPOINT: '/v1/chat/completions'
      }
    }
  },
  
  // Metabase Configuration (non-secret parts)
  METABASE: {
    DEFAULT_URL: 'http://localhost:3000',
    DEFAULT_API_URL: 'http://localhost:3000/api',
  },
  
  // Node Environment
  NODE_ENV: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test'
  }
};