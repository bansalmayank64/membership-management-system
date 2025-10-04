const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const localLLMService = require('../services/localLLMService');
const logger = require('../utils/logger');

/**
 * Local LLM Setup and Management Script
 * Helps users install, configure, and test local LLM backends
 */

class LocalLLMSetup {
  constructor() {
    this.supportedBackends = ['ollama', 'llamacpp', 'gpt4all', 'lmstudio'];
  }

  /**
   * Display the main setup menu
   */
  async showMainMenu() {
    console.log('\n🤖 ======================================');
    console.log('   LOCAL LLM SETUP & CONFIGURATION');
    console.log('======================================\n');
    
    console.log('Available options:');
    console.log('1. 🚀 Quick Setup (Recommended: Ollama)');
    console.log('2. 📋 Check Current Status');
    console.log('3. 🔧 Configure Backend');
    console.log('4. 🧪 Test LLM Connection');
    console.log('5. 📚 Installation Guides');
    console.log('6. ❌ Exit\n');
  }

  /**
   * Quick setup with Ollama (recommended)
   */
  async quickSetup() {
    console.log('\n🚀 QUICK SETUP - Installing Ollama\n');
    
    try {
      // Check if Ollama is already installed
      const isInstalled = await this.checkOllamaInstalled();
      
      if (!isInstalled) {
        console.log('📥 Ollama not found. Please install it manually:');
        console.log('   1. Visit: https://ollama.ai');
        console.log('   2. Download and install Ollama');
        console.log('   3. Run this setup again\n');
        return;
      }
      
      console.log('✅ Ollama is installed!');
      
      // Check if Ollama is running
      const isRunning = await this.checkOllamaRunning();
      
      if (!isRunning) {
        console.log('🔄 Starting Ollama server...');
        await this.startOllama();
        
        // Wait a bit for the server to start
        await this.delay(3000);
      }
      
      console.log('✅ Ollama server is running!');
      
      // Pull a recommended model
      console.log('📦 Pulling llama2 model (this may take a while)...');
      await this.pullOllamaModel('llama2');
      
      // Update environment configuration
      await this.updateEnvConfig({
        USE_LOCAL_LLM: 'true',
        AI_DEMO_MODE: 'false',
        LOCAL_LLM_BACKEND: 'ollama',
        LOCAL_LLM_MODEL: 'llama2',
        OLLAMA_URL: 'http://localhost:11434'
      });
      
      console.log('✅ Quick setup completed successfully!');
      console.log('🎉 Your local LLM is ready to use!');
      
      // Test the setup
      await this.testConnection();
      
    } catch (error) {
      console.error('❌ Quick setup failed:', error.message);
      console.log('💡 Try manual installation or check the guides (option 5)');
    }
  }

  /**
   * Check current LLM status
   */
  async checkStatus() {
    console.log('\n📋 CURRENT LLM STATUS\n');
    
    try {
      const status = await localLLMService.getStatus();
      const backends = await localLLMService.listBackends();
      
      console.log('Current Configuration:');
      console.log(`📊 Backend: ${status.backend}`);
      console.log(`🤖 Model: ${status.model}`);
      console.log(`🔧 Initialized: ${status.isInitialized ? '✅' : '❌'}`);
      console.log(`🌐 Available: ${status.isAvailable ? '✅' : '❌'}`);
      
      if (status.error) {
        console.log(`❌ Error: ${status.error}`);
      }
      
      console.log('\nBackend Availability:');
      for (const [name, info] of Object.entries(backends)) {
        const statusIcon = info.isAvailable ? '✅' : '❌';
        console.log(`${statusIcon} ${name}: ${info.url}`);
        if (!info.isAvailable && info.error) {
          console.log(`   Error: ${info.error}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to check status:', error.message);
    }
  }

  /**
   * Configure backend selection
   */
  async configureBackend() {
    console.log('\n🔧 BACKEND CONFIGURATION\n');
    
    try {
      const backends = await localLLMService.listBackends();
      
      console.log('Available backends:');
      let index = 1;
      const availableBackends = [];
      
      for (const [name, info] of Object.entries(backends)) {
        const statusIcon = info.isAvailable ? '✅' : '❌';
        console.log(`${index}. ${statusIcon} ${name} (${info.url})`);
        availableBackends.push(name);
        index++;
      }
      
      console.log('\nSelect a backend (enter number):');
      
      // In a real interactive script, you'd get user input here
      // For this demo, we'll show what the configuration would look like
      console.log('📝 To manually configure, update your .env file:');
      console.log('   LOCAL_LLM_BACKEND=ollama');
      console.log('   LOCAL_LLM_MODEL=llama2');
      console.log('   USE_LOCAL_LLM=true');
      console.log('   AI_DEMO_MODE=false');
      
    } catch (error) {
      console.error('❌ Failed to configure backend:', error.message);
    }
  }

  /**
   * Test LLM connection
   */
  async testConnection() {
    console.log('\n🧪 TESTING LLM CONNECTION\n');
    
    try {
      console.log('🔄 Initializing local LLM service...');
      await localLLMService.initialize();
      
      console.log('📝 Testing with sample query...');
      const testPrompt = 'Generate a simple SQL query to count all students: SELECT';
      
      const startTime = Date.now();
      const response = await localLLMService.generateText(testPrompt, {
        maxTokens: 100,
        temperature: 0.1
      });
      const duration = Date.now() - startTime;
      
      console.log('✅ Test successful!');
      console.log(`⏱️  Response time: ${duration}ms`);
      console.log(`📄 Response: ${response.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.log('💡 Try checking your backend configuration or installation');
    }
  }

  /**
   * Show installation guides
   */
  showInstallationGuides() {
    console.log('\n📚 INSTALLATION GUIDES\n');
    
    const guides = localLLMService.getInstallationGuide();
    
    for (const [backend, guide] of Object.entries(guides)) {
      console.log(`🔧 ${backend.toUpperCase()}`);
      console.log(`Description: ${guide.description}`);
      console.log('Installation Steps:');
      guide.installation.forEach(step => {
        console.log(`   ${step}`);
      });
      console.log(`Models: ${guide.models.join(', ')}`);
      console.log(`Pros: ${guide.pros.join(', ')}`);
      console.log('');
    }
    
    console.log('💡 Recommendation: Start with Ollama for the easiest setup!\n');
  }

  /**
   * Utility functions
   */
  
  async checkOllamaInstalled() {
    try {
      await this.execCommand('ollama --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkOllamaRunning() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async startOllama() {
    return new Promise((resolve, reject) => {
      const ollama = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });
      
      ollama.unref();
      
      // Give it a moment to start
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  async pullOllamaModel(model) {
    return new Promise((resolve, reject) => {
      const pull = spawn('ollama', ['pull', model], {
        stdio: 'inherit'
      });
      
      pull.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to pull model ${model}`));
        }
      });
    });
  }

  async updateEnvConfig(config) {
    try {
      const envPath = path.join(__dirname, '../.env');
      let envContent = '';
      
      // Read existing .env file if it exists
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      // Update or add configuration values
      for (const [key, value] of Object.entries(config)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        const line = `${key}=${value}`;
        
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, line);
        } else {
          envContent += `\n${line}`;
        }
      }
      
      // Write back to .env file
      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('✅ Environment configuration updated');
      
    } catch (error) {
      console.error('❌ Failed to update environment configuration:', error.message);
    }
  }

  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const setup = new LocalLLMSetup();
  
  // Check if we're running interactively or with command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await setup.showMainMenu();
    console.log('💡 Run this script with arguments for non-interactive mode:');
    console.log('   node setup-local-llm.js quick     # Quick setup');
    console.log('   node setup-local-llm.js status    # Check status');
    console.log('   node setup-local-llm.js test      # Test connection');
    console.log('   node setup-local-llm.js guides    # Show guides');
  } else {
    // Command line mode
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'quick':
        await setup.quickSetup();
        break;
      case 'status':
        await setup.checkStatus();
        break;
      case 'config':
        await setup.configureBackend();
        break;
      case 'test':
        await setup.testConnection();
        break;
      case 'guides':
        setup.showInstallationGuides();
        break;
      default:
        console.log('❌ Unknown command. Available: quick, status, config, test, guides');
    }
  }
}

// Export for use as a module
module.exports = LocalLLMSetup;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}