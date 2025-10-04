const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const fetch = require('node-fetch');
const constants = require('../config/constants');

/**
 * Local LLM Service supporting multiple backends:
 * - Ollama (recommended)
 * - llama.cpp
 * - GPT4All
 * - LM Studio
 */
class LocalLLMService {
  constructor() {
    // Configuration - use constants with env override capability
    this.backend = process.env.LOCAL_LLM_BACKEND || constants.LOCAL_LLM.DEFAULT_BACKEND;
    this.modelName = process.env.LOCAL_LLM_MODEL || constants.LOCAL_LLM.DEFAULT_MODEL;
    this.baseUrl = process.env.LOCAL_LLM_URL || constants.LOCAL_LLM.BACKENDS[this.backend]?.DEFAULT_URL || constants.LOCAL_LLM.BACKENDS.ollama.DEFAULT_URL;
    this.timeout = parseInt(process.env.LOCAL_LLM_TIMEOUT) || constants.LOCAL_LLM.TIMEOUT;
    this.maxTokens = parseInt(process.env.LOCAL_LLM_MAX_TOKENS) || constants.LOCAL_LLM.MAX_TOKENS;
    this.temperature = parseFloat(process.env.LOCAL_LLM_TEMPERATURE) || constants.LOCAL_LLM.TEMPERATURE;
    
    // Backend-specific configurations
    this.configurations = {
      ollama: {
        url: process.env.OLLAMA_URL || constants.LOCAL_LLM.BACKENDS.ollama.DEFAULT_URL,
        models: constants.LOCAL_LLM.BACKENDS.ollama.MODELS,
        endpoint: constants.LOCAL_LLM.BACKENDS.ollama.ENDPOINT
      },
      llamacpp: {
        url: process.env.LLAMACPP_URL || constants.LOCAL_LLM.BACKENDS.llamacpp.DEFAULT_URL,
        models: constants.LOCAL_LLM.BACKENDS.llamacpp.MODELS,
        endpoint: constants.LOCAL_LLM.BACKENDS.llamacpp.ENDPOINT
      },
      gpt4all: {
        url: process.env.GPT4ALL_URL || constants.LOCAL_LLM.BACKENDS.gpt4all.DEFAULT_URL,
        models: constants.LOCAL_LLM.BACKENDS.gpt4all.MODELS,
        endpoint: constants.LOCAL_LLM.BACKENDS.gpt4all.ENDPOINT
      },
      lmstudio: {
        url: process.env.LMSTUDIO_URL || constants.LOCAL_LLM.BACKENDS.lmstudio.DEFAULT_URL,
        models: constants.LOCAL_LLM.BACKENDS.lmstudio.MODELS,
        endpoint: constants.LOCAL_LLM.BACKENDS.lmstudio.ENDPOINT
      }
    };
    
    this.isInitialized = false;
    this.availableModels = [];
  }

  /**
   * Initialize the local LLM service
   */
  async initialize() {
    try {
      logger.info('Initializing Local LLM Service', { backend: this.backend });
      
      // Check if the backend is available
      await this.checkBackendAvailability();
      
      // Get available models
      await this.loadAvailableModels();
      
      // Verify the selected model
      await this.verifyModel();
      
      this.isInitialized = true;
      logger.info('Local LLM Service initialized successfully', { 
        backend: this.backend,
        model: this.modelName,
        availableModels: this.availableModels.length
      });
    } catch (error) {
      logger.error('Failed to initialize Local LLM Service', { error: error.message });
      throw new Error(`Local LLM initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if the selected backend is available
   */
  async checkBackendAvailability() {
    const config = this.configurations[this.backend];
    if (!config) {
      throw new Error(`Unsupported backend: ${this.backend}`);
    }

    try {
      const response = await fetch(`${config.url}/health`, { 
        method: 'GET',
        timeout: 5000 
      }).catch(() => null);

      if (!response || !response.ok) {
        // Try a backend-specific endpoint
        const testResponse = await this.testBackendConnection();
        if (!testResponse) {
          throw new Error(`Backend ${this.backend} is not responding at ${config.url}`);
        }
      }
    } catch (error) {
      throw new Error(`Cannot connect to ${this.backend} backend: ${error.message}`);
    }
  }

  /**
   * Test backend-specific connection
   */
  async testBackendConnection() {
    const config = this.configurations[this.backend];
    
    try {
      switch (this.backend) {
        case 'ollama':
          const ollamaResponse = await fetch(`${config.url}/api/tags`, { timeout: 5000 });
          return ollamaResponse.ok;
          
        case 'llamacpp':
          const llamaResponse = await fetch(`${config.url}/health`, { timeout: 5000 });
          return llamaResponse.ok;
          
        case 'gpt4all':
          const gpt4allResponse = await fetch(`${config.url}/v1/models`, { timeout: 5000 });
          return gpt4allResponse.ok;
          
        case 'lmstudio':
          const lmstudioResponse = await fetch(`${config.url}/v1/models`, { timeout: 5000 });
          return lmstudioResponse.ok;
          
        default:
          return false;
      }
    } catch (error) {
      logger.warn('Backend connection test failed', { backend: this.backend, error: error.message });
      return false;
    }
  }

  /**
   * Load available models from the backend
   */
  async loadAvailableModels() {
    const config = this.configurations[this.backend];
    
    try {
      switch (this.backend) {
        case 'ollama':
          const ollamaResponse = await fetch(`${config.url}/api/tags`);
          if (ollamaResponse.ok) {
            const data = await ollamaResponse.json();
            this.availableModels = data.models?.map(m => m.name) || [];
          }
          break;
          
        case 'llamacpp':
          // llama.cpp doesn't have a models endpoint, use configured models
          this.availableModels = config.models;
          break;
          
        case 'gpt4all':
        case 'lmstudio':
          const response = await fetch(`${config.url}/v1/models`);
          if (response.ok) {
            const data = await response.json();
            this.availableModels = data.data?.map(m => m.id) || [];
          }
          break;
      }
      
      if (this.availableModels.length === 0) {
        this.availableModels = config.models; // Fallback to default models
      }
      
    } catch (error) {
      logger.warn('Could not load models list, using defaults', { error: error.message });
      this.availableModels = config.models;
    }
  }

  /**
   * Verify that the selected model is available
   */
  async verifyModel() {
    if (!this.availableModels.includes(this.modelName)) {
      logger.warn('Selected model not found, using first available', { 
        selected: this.modelName, 
        available: this.availableModels 
      });
      this.modelName = this.availableModels[0] || 'llama2';
    }
    
    // For Ollama, try to pull the model if it's not available
    if (this.backend === 'ollama' && !this.availableModels.includes(this.modelName)) {
      await this.pullOllamaModel(this.modelName);
    }
  }

  /**
   * Pull a model in Ollama (if needed)
   */
  async pullOllamaModel(modelName) {
    try {
      logger.info('Attempting to pull Ollama model', { model: modelName });
      
      const response = await fetch(`${this.configurations.ollama.url}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      });
      
      if (response.ok) {
        logger.info('Successfully pulled Ollama model', { model: modelName });
        this.availableModels.push(modelName);
      }
    } catch (error) {
      logger.error('Failed to pull Ollama model', { model: modelName, error: error.message });
    }
  }

  /**
   * Generate text using the local LLM
   */
  async generateText(prompt, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      logger.info('Generating text with local LLM', { 
        backend: this.backend, 
        model: this.modelName,
        promptLength: prompt.length 
      });

      let response;
      
      switch (this.backend) {
        case 'ollama':
          response = await this.generateWithOllama(prompt, options);
          break;
          
        case 'llamacpp':
          response = await this.generateWithLlamaCpp(prompt, options);
          break;
          
        case 'gpt4all':
          response = await this.generateWithGPT4All(prompt, options);
          break;
          
        case 'lmstudio':
          response = await this.generateWithLMStudio(prompt, options);
          break;
          
        default:
          throw new Error(`Unsupported backend: ${this.backend}`);
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('Local LLM generation completed', { 
        backend: this.backend,
        model: this.modelName,
        executionTime,
        responseLength: response.length
      });

      return response;
    } catch (error) {
      logger.error('Local LLM generation failed', { 
        backend: this.backend,
        model: this.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate text using Ollama
   */
  async generateWithOllama(prompt, options = {}) {
    const config = this.configurations.ollama;
    
    const requestBody = {
      model: this.modelName,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || this.temperature,
        num_predict: options.maxTokens || this.maxTokens,
        top_p: options.topP || 0.9,
        top_k: options.topK || 40
      }
    };

    const response = await fetch(`${config.url}${config.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Generate text using llama.cpp
   */
  async generateWithLlamaCpp(prompt, options = {}) {
    const config = this.configurations.llamacpp;
    
    const requestBody = {
      prompt: prompt,
      n_predict: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      top_p: options.topP || 0.9,
      top_k: options.topK || 40,
      stream: false
    };

    const response = await fetch(`${config.url}${config.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`llama.cpp API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.content || '';
  }

  /**
   * Generate text using GPT4All
   */
  async generateWithGPT4All(prompt, options = {}) {
    const config = this.configurations.gpt4all;
    
    const requestBody = {
      model: this.modelName,
      prompt: prompt,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      top_p: options.topP || 0.9,
      stream: false
    };

    const response = await fetch(`${config.url}${config.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`GPT4All API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.text || '';
  }

  /**
   * Generate text using LM Studio
   */
  async generateWithLMStudio(prompt, options = {}) {
    const config = this.configurations.lmstudio;
    
    const requestBody = {
      model: this.modelName,
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
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: false
    };

    const response = await fetch(`${config.url}${config.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Get service status and information
   */
  async getStatus() {
    try {
      const isAvailable = await this.testBackendConnection();
      
      return {
        backend: this.backend,
        model: this.modelName,
        isInitialized: this.isInitialized,
        isAvailable,
        availableModels: this.availableModels,
        configuration: this.configurations[this.backend]
      };
    } catch (error) {
      return {
        backend: this.backend,
        model: this.modelName,
        isInitialized: false,
        isAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * List available backends and their status
   */
  async listBackends() {
    const backends = {};
    
    for (const [name, config] of Object.entries(this.configurations)) {
      try {
        const originalBackend = this.backend;
        this.backend = name;
        const isAvailable = await this.testBackendConnection();
        this.backend = originalBackend;
        
        backends[name] = {
          url: config.url,
          isAvailable,
          models: config.models
        };
      } catch (error) {
        backends[name] = {
          url: config.url,
          isAvailable: false,
          error: error.message
        };
      }
    }
    
    return backends;
  }

  /**
   * Switch to a different backend
   */
  async switchBackend(newBackend, newModel = null) {
    if (!this.configurations[newBackend]) {
      throw new Error(`Unsupported backend: ${newBackend}`);
    }
    
    this.backend = newBackend;
    if (newModel) {
      this.modelName = newModel;
    }
    
    this.isInitialized = false;
    await this.initialize();
    
    logger.info('Switched LLM backend', { 
      backend: this.backend, 
      model: this.modelName 
    });
  }

  /**
   * Install and setup guides for different backends
   */
  getInstallationGuide() {
    return {
      ollama: {
        description: "Ollama is the easiest to setup and most recommended option",
        installation: [
          "1. Download Ollama from https://ollama.ai",
          "2. Install and run: ollama serve",
          "3. Pull a model: ollama pull llama2",
          "4. Set LOCAL_LLM_BACKEND=ollama in your .env"
        ],
        models: ["llama2", "codellama", "mistral", "llama2:13b"],
        pros: ["Easy setup", "Good model selection", "Active development"]
      },
      llamacpp: {
        description: "llama.cpp provides high performance and flexibility",
        installation: [
          "1. Clone: git clone https://github.com/ggerganov/llama.cpp",
          "2. Build: make",
          "3. Download GGML model files",
          "4. Run: ./server -m model.ggml -c 2048 --host 0.0.0.0 --port 8080",
          "5. Set LOCAL_LLM_BACKEND=llamacpp in your .env"
        ],
        models: ["llama-2-7b", "llama-2-13b", "codellama"],
        pros: ["High performance", "Low memory usage", "Many model formats"]
      },
      gpt4all: {
        description: "GPT4All provides a simple API and desktop app",
        installation: [
          "1. Download GPT4All from https://gpt4all.io",
          "2. Install and start the application",
          "3. Enable API server in settings",
          "4. Set LOCAL_LLM_BACKEND=gpt4all in your .env"
        ],
        models: ["gpt4all-j", "vicuna-7b", "wizard-13b"],
        pros: ["User-friendly", "Desktop app", "Built-in model management"]
      },
      lmstudio: {
        description: "LM Studio provides a polished experience with model management",
        installation: [
          "1. Download LM Studio from https://lmstudio.ai",
          "2. Install and start the application",
          "3. Download models through the UI",
          "4. Start the local server",
          "5. Set LOCAL_LLM_BACKEND=lmstudio in your .env"
        ],
        models: ["Various GGML models"],
        pros: ["Professional UI", "Easy model management", "Good performance"]
      }
    };
  }
}

module.exports = new LocalLLMService();