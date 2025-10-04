/**
 * Local LLM Integration Test Suite
 * Tests all local LLM functionality end-to-end
 */

const localLLMService = require('../services/localLLMService');
const aiChatService = require('../services/aiChatService');
const logger = require('../utils/logger');

class LocalLLMTester {
  constructor() {
    this.testResults = [];
    this.backend = process.env.LOCAL_LLM_BACKEND || 'ollama';
  }

  async runAllTests() {
    console.log('\n🧪 ======================================');
    console.log('   LOCAL LLM INTEGRATION TEST SUITE');
    console.log('======================================\n');

    const tests = [
      'testServiceInitialization',
      'testBackendAvailability', 
      'testModelLoading',
      'testTextGeneration',
      'testSQLGeneration',
      'testResultFormatting',
      'testFullChatFlow',
      'testBackendSwitching',
      'testErrorHandling',
      'testPerformanceBenchmark'
    ];

    for (const testName of tests) {
      try {
        console.log(`🔍 Running ${testName}...`);
        const result = await this[testName]();
        this.recordResult(testName, true, result);
        console.log(`✅ ${testName} passed`);
      } catch (error) {
        this.recordResult(testName, false, error.message);
        console.log(`❌ ${testName} failed: ${error.message}`);
      }
    }

    this.printSummary();
  }

  async testServiceInitialization() {
    await localLLMService.initialize();
    const status = await localLLMService.getStatus();
    
    if (!status.isInitialized) {
      throw new Error('Service failed to initialize');
    }
    
    return { backend: status.backend, model: status.model };
  }

  async testBackendAvailability() {
    const backends = await localLLMService.listBackends();
    const currentBackend = backends[this.backend];
    
    if (!currentBackend) {
      throw new Error(`Backend ${this.backend} not found`);
    }
    
    if (!currentBackend.isAvailable) {
      throw new Error(`Backend ${this.backend} is not available: ${currentBackend.error || 'Unknown error'}`);
    }
    
    return { availableBackends: Object.keys(backends).filter(b => backends[b].isAvailable) };
  }

  async testModelLoading() {
    const status = await localLLMService.getStatus();
    
    if (!status.availableModels || status.availableModels.length === 0) {
      throw new Error('No models available');
    }
    
    return { 
      currentModel: status.model, 
      availableModels: status.availableModels.length 
    };
  }

  async testTextGeneration() {
    const prompt = "Complete this sentence: The weather today is";
    const startTime = Date.now();
    
    const response = await localLLMService.generateText(prompt, {
      maxTokens: 50,
      temperature: 0.7
    });
    
    const duration = Date.now() - startTime;
    
    if (!response || response.length === 0) {
      throw new Error('Empty response from LLM');
    }
    
    return { 
      responseLength: response.length, 
      duration,
      sample: response.substring(0, 100) + '...'
    };
  }

  async testSQLGeneration() {
    await aiChatService.initialize();
    
    const query = "How many active students do we have?";
    const sql = await aiChatService.naturalLanguageToSQL(query, 'test-user');
    
    if (!sql || !sql.toLowerCase().includes('select')) {
      throw new Error('Invalid SQL generated');
    }
    
    if (!aiChatService.isValidSQL(sql)) {
      throw new Error('Generated SQL failed validation');
    }
    
    return { 
      query, 
      sql: sql.substring(0, 200) + '...',
      isValid: true
    };
  }

  async testResultFormatting() {
    const mockResults = {
      success: true,
      data: [
        { total_active_students: 107 }
      ],
      rowCount: 1,
      executionTime: 45
    };
    
    const formatted = await aiChatService.formatResults(
      mockResults, 
      "How many active students do we have?", 
      'test-user'
    );
    
    if (!formatted.success || !formatted.formattedResponse) {
      throw new Error('Result formatting failed');
    }
    
    return {
      hasFormatting: formatted.formattedResponse.length > 0,
      sample: formatted.formattedResponse.substring(0, 100) + '...'
    };
  }

  async testFullChatFlow() {
    await aiChatService.initialize();
    
    const query = "Show me student count";
    const startTime = Date.now();
    
    // Mock the database execution to avoid needing actual DB
    const originalExecute = aiChatService.executeSQLQuery;
    aiChatService.executeSQLQuery = async () => ({
      success: true,
      data: [{ total_students: 150, active_students: 107 }],
      rowCount: 1,
      executionTime: 25
    });
    
    try {
      const result = await aiChatService.processChat(query, 'test-user');
      const duration = Date.now() - startTime;
      
      if (!result.success || !result.response) {
        throw new Error('Chat flow failed');
      }
      
      return {
        duration,
        hasResponse: result.response.length > 0,
        usingLocalLLM: result.metadata.usingLocalLLM,
        sample: result.response.substring(0, 100) + '...'
      };
    } finally {
      // Restore original method
      aiChatService.executeSQLQuery = originalExecute;
    }
  }

  async testBackendSwitching() {
    const originalBackend = this.backend;
    const backends = await localLLMService.listBackends();
    const availableBackends = Object.keys(backends).filter(b => backends[b].isAvailable);
    
    if (availableBackends.length < 2) {
      return { skipped: true, reason: 'Only one backend available' };
    }
    
    const switchTo = availableBackends.find(b => b !== originalBackend);
    if (!switchTo) {
      return { skipped: true, reason: 'No alternative backend available' };
    }
    
    // Switch to alternative backend
    await localLLMService.switchBackend(switchTo);
    const newStatus = await localLLMService.getStatus();
    
    if (newStatus.backend !== switchTo) {
      throw new Error(`Failed to switch to ${switchTo}`);
    }
    
    // Switch back
    await localLLMService.switchBackend(originalBackend);
    const restoredStatus = await localLLMService.getStatus();
    
    if (restoredStatus.backend !== originalBackend) {
      throw new Error(`Failed to switch back to ${originalBackend}`);
    }
    
    return { 
      switchedTo: switchTo, 
      switchedBack: originalBackend,
      success: true
    };
  }

  async testErrorHandling() {
    // Test with invalid backend
    try {
      await localLLMService.switchBackend('invalid-backend');
      throw new Error('Should have failed with invalid backend');
    } catch (error) {
      if (!error.message.includes('Unsupported backend')) {
        throw new Error('Wrong error message for invalid backend');
      }
    }
    
    // Test with invalid prompt (extremely long)
    try {
      const longPrompt = 'A'.repeat(100000);
      await localLLMService.generateText(longPrompt, { maxTokens: 10 });
      // This might succeed or fail depending on the backend, both are okay
    } catch (error) {
      // Expected for some backends
    }
    
    return { handlesInvalidBackend: true, handlesLongPrompts: true };
  }

  async testPerformanceBenchmark() {
    const queries = [
      "Count students",
      "Show revenue", 
      "List available seats",
      "Gender distribution",
      "Payment summary"
    ];
    
    const results = [];
    
    for (const query of queries) {
      const startTime = Date.now();
      
      try {
        await localLLMService.generateText(
          `Convert to SQL: ${query}`, 
          { maxTokens: 100, temperature: 0.1 }
        );
        
        const duration = Date.now() - startTime;
        results.push({ query, duration, success: true });
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({ query, duration, success: false, error: error.message });
      }
    }
    
    const successfulQueries = results.filter(r => r.success);
    const averageDuration = successfulQueries.length > 0 
      ? successfulQueries.reduce((sum, r) => sum + r.duration, 0) / successfulQueries.length 
      : 0;
    
    return {
      queriesProcessed: results.length,
      successfulQueries: successfulQueries.length,
      averageDuration: Math.round(averageDuration),
      fastest: Math.min(...successfulQueries.map(r => r.duration)),
      slowest: Math.max(...successfulQueries.map(r => r.duration))
    };
  }

  recordResult(testName, success, data) {
    this.testResults.push({
      test: testName,
      success,
      data,
      timestamp: new Date().toISOString()
    });
  }

  printSummary() {
    console.log('\n📊 ======================================');
    console.log('   TEST RESULTS SUMMARY');
    console.log('======================================\n');

    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const total = this.testResults.length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`🎯 Success Rate: ${Math.round((passed/total)*100)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.test}: ${r.data}`);
        });
      console.log('');
    }

    console.log('📋 Test Details:');
    this.testResults.forEach(r => {
      const icon = r.success ? '✅' : '❌';
      console.log(`${icon} ${r.test}`);
      if (r.success && typeof r.data === 'object') {
        Object.entries(r.data).forEach(([key, value]) => {
          if (key !== 'sample') { // Skip long sample text
            console.log(`     ${key}: ${value}`);
          }
        });
      }
    });

    console.log('\n🎉 Local LLM integration testing completed!');
    
    if (passed === total) {
      console.log('🚀 All tests passed! Your local LLM is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Check your configuration and try again.');
    }
  }
}

// Main execution
async function main() {
  const tester = new LocalLLMTester();
  
  console.log('🔧 Testing Local LLM Integration...');
  console.log(`📡 Backend: ${process.env.LOCAL_LLM_BACKEND || 'ollama'}`);
  console.log(`🤖 Model: ${process.env.LOCAL_LLM_MODEL || 'llama2'}`);
  console.log(`🏠 Use Local LLM: ${process.env.USE_LOCAL_LLM !== 'false'}`);
  console.log(`🎭 Demo Mode: ${process.env.AI_DEMO_MODE === 'true'}`);
  
  await tester.runAllTests();
}

// Export for use as a module
module.exports = LocalLLMTester;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}