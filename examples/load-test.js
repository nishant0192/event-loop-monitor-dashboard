/**
 * Production-like Load Testing for Event Loop Monitor
 * 
 * Simulates realistic production scenarios:
 * - Normal traffic patterns
 * - Traffic spikes
 * - Mixed operation types (fast, slow, blocking)
 * - Background tasks
 * - Sustained high load
 * 
 * Usage: node load-test.js
 */

const http = require('http');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  duration: 10 * 60 * 1000, // 10 minutes
  
  // Traffic patterns (requests per second)
  patterns: {
    baseline: 10,      // Normal traffic: 10 req/s
    peak: 50,          // Peak traffic: 50 req/s
    spike: 100,        // Traffic spike: 100 req/s
    stress: 200        // Stress test: 200 req/s
  },
  
  // Operation mix (percentages)
  operationMix: {
    fast: 70,          // 70% fast operations
    slow: 20,          // 20% slow async operations
    blocking: 5,       // 5% blocking operations
    cpu: 5             // 5% CPU intensive
  },
  
  // Test phases (in seconds)
  phases: [
    { name: 'Warmup', duration: 30, rps: 5 },
    { name: 'Baseline', duration: 60, rps: 10 },
    { name: 'Ramp Up', duration: 30, rps: 25 },
    { name: 'Peak Hour', duration: 120, rps: 50 },
    { name: 'Spike 1', duration: 15, rps: 100 },
    { name: 'Recovery 1', duration: 30, rps: 20 },
    { name: 'Sustained High Load', duration: 120, rps: 75 },
    { name: 'Spike 2', duration: 20, rps: 150 },
    { name: 'Recovery 2', duration: 30, rps: 15 },
    { name: 'Stress Test', duration: 30, rps: 200 },
    { name: 'Cooldown', duration: 60, rps: 5 }
  ]
};

// Statistics
const stats = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    timeouts: 0
  },
  responseTimes: [],
  errors: {},
  phases: []
};

// Operation types
const operations = [
  { name: 'fast', endpoint: '/api/test', weight: 70 },
  { name: 'slow', endpoint: '/api/slow', weight: 20 },
  { name: 'blocking-light', endpoint: '/api/cpu?iterations=500000', weight: 5 },
  { name: 'blocking-heavy', endpoint: '/api/cpu?iterations=2000000', weight: 5 }
];

/**
 * Make HTTP request
 */
function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.get(`${CONFIG.baseUrl}${endpoint}`, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode === 200
        });
      });
    });
    
    req.on('error', (error) => {
      reject({
        error: error.message,
        duration: Date.now() - startTime
      });
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject({
        error: 'Timeout',
        duration: 30000
      });
    });
  });
}

/**
 * Select random operation based on weights
 */
function selectOperation() {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const op of operations) {
    cumulative += op.weight;
    if (random <= cumulative) {
      return op;
    }
  }
  
  return operations[0];
}

/**
 * Execute single request
 */
async function executeRequest() {
  const operation = selectOperation();
  stats.requests.total++;
  
  try {
    const result = await makeRequest(operation.endpoint);
    
    if (result.success) {
      stats.requests.successful++;
      stats.responseTimes.push(result.duration);
    } else {
      stats.requests.failed++;
    }
    
    return result;
  } catch (error) {
    stats.requests.failed++;
    
    if (error.error === 'Timeout') {
      stats.requests.timeouts++;
    }
    
    // Track error types
    const errorType = error.error || 'Unknown';
    stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;
    
    return error;
  }
}

/**
 * Generate load at specified rate
 */
async function generateLoad(rps, duration) {
  const interval = 1000 / rps; // milliseconds between requests
  const endTime = Date.now() + duration;
  
  const workers = [];
  let requestCount = 0;
  
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(timer);
        Promise.all(workers).then(() => resolve());
        return;
      }
      
      // Launch request
      requestCount++;
      workers.push(executeRequest());
      
      // Clean up completed workers periodically
      if (requestCount % 100 === 0) {
        workers.length = 0;
      }
    }, interval);
  });
}

/**
 * Get percentile from sorted array
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const responseTimes = stats.responseTimes;
  
  if (responseTimes.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0
    };
  }
  
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  
  return {
    count: responseTimes.length,
    min: Math.min(...responseTimes),
    max: Math.max(...responseTimes),
    mean: (sum / responseTimes.length).toFixed(2),
    median: percentile(responseTimes, 50).toFixed(2),
    p95: percentile(responseTimes, 95).toFixed(2),
    p99: percentile(responseTimes, 99).toFixed(2)
  };
}

/**
 * Print statistics
 */
function printStats(phase = null) {
  console.log('\n' + '='.repeat(80));
  
  if (phase) {
    console.log(`📊 Phase: ${phase.name} (${phase.rps} req/s for ${phase.duration}s)`);
  } else {
    console.log('📊 FINAL STATISTICS');
  }
  
  console.log('='.repeat(80));
  
  console.log('\n🔢 Request Summary:');
  console.log(`   Total:      ${stats.requests.total.toLocaleString()}`);
  console.log(`   Successful: ${stats.requests.successful.toLocaleString()} (${((stats.requests.successful / stats.requests.total) * 100).toFixed(2)}%)`);
  console.log(`   Failed:     ${stats.requests.failed.toLocaleString()} (${((stats.requests.failed / stats.requests.total) * 100).toFixed(2)}%)`);
  console.log(`   Timeouts:   ${stats.requests.timeouts.toLocaleString()}`);
  
  const rtStats = calculateStats();
  console.log('\n⏱️  Response Times:');
  console.log(`   Min:    ${rtStats.min} ms`);
  console.log(`   Mean:   ${rtStats.mean} ms`);
  console.log(`   Median: ${rtStats.median} ms`);
  console.log(`   P95:    ${rtStats.p95} ms`);
  console.log(`   P99:    ${rtStats.p99} ms`);
  console.log(`   Max:    ${rtStats.max} ms`);
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\n❌ Errors:');
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`   ${error}: ${count}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Get event loop health from monitor
 */
async function getEventLoopHealth() {
  return new Promise((resolve) => {
    http.get(`${CONFIG.baseUrl}/event-loop-stats/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Print event loop health
 */
function printEventLoopHealth(health) {
  if (!health || !health.data) {
    console.log('⚠️  Could not fetch event loop health');
    return;
  }
  
  const data = health.data;
  const statusEmoji = {
    'healthy': '✅',
    'degraded': '⚠️',
    'critical': '🔴'
  };
  
  console.log('\n🔄 Event Loop Health:');
  console.log(`   Status: ${statusEmoji[data.status] || '❓'} ${data.status.toUpperCase()} (Score: ${data.score})`);
  console.log(`   Lag:    ${data.metrics.lag.toFixed(2)} ms`);
  console.log(`   ELU:    ${(data.metrics.elu * 100).toFixed(2)}%`);
  
  if (data.issues && data.issues.length > 0) {
    console.log('   Issues:');
    data.issues.forEach(issue => {
      console.log(`     - ${issue}`);
    });
  }
}

/**
 * Run test phases
 */
async function runTest() {
  console.log('\n🚀 Starting Production-Like Load Test\n');
  console.log('📈 Dashboard: ' + CONFIG.baseUrl + '/event-loop-stats/');
  console.log('⏱️  Total Duration: ' + (CONFIG.phases.reduce((sum, p) => sum + p.duration, 0) / 60).toFixed(1) + ' minutes\n');
  console.log('💡 Keep the dashboard open to watch real-time metrics!\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const startTime = Date.now();
  
  for (const phase of CONFIG.phases) {
    const phaseStart = Date.now();
    
    console.log(`\n▶️  Starting Phase: ${phase.name}`);
    console.log(`   Target: ${phase.rps} req/s for ${phase.duration}s`);
    
    // Reset phase stats
    const phaseStartStats = {
      total: stats.requests.total,
      successful: stats.requests.successful,
      failed: stats.requests.failed,
      responseTimesStart: stats.responseTimes.length
    };
    
    // Generate load
    await generateLoad(phase.rps, phase.duration * 1000);
    
    // Calculate phase stats
    const phaseEnd = Date.now();
    const phaseDuration = (phaseEnd - phaseStart) / 1000;
    const phaseRequests = stats.requests.total - phaseStartStats.total;
    const actualRPS = (phaseRequests / phaseDuration).toFixed(2);
    
    console.log(`✓  Phase Complete: ${phase.name}`);
    console.log(`   Actual: ${actualRPS} req/s (target: ${phase.rps})`);
    console.log(`   Requests: ${phaseRequests}`);
    
    // Get event loop health
    const health = await getEventLoopHealth();
    printEventLoopHealth(health);
    
    // Store phase results
    stats.phases.push({
      name: phase.name,
      targetRPS: phase.rps,
      actualRPS: parseFloat(actualRPS),
      duration: phaseDuration,
      requests: phaseRequests,
      health: health
    });
    
    // Small pause between phases
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const totalDuration = (Date.now() - startTime) / 1000;
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ LOAD TEST COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total Duration: ${(totalDuration / 60).toFixed(2)} minutes`);
  console.log(`Average RPS: ${(stats.requests.total / totalDuration).toFixed(2)}`);
  
  printStats();
  
  // Phase summary
  console.log('\n📋 Phase Summary:\n');
  console.log('Phase'.padEnd(25) + 'Target RPS'.padEnd(15) + 'Actual RPS'.padEnd(15) + 'Requests'.padEnd(15) + 'Health');
  console.log('-'.repeat(80));
  
  stats.phases.forEach(phase => {
    const healthEmoji = phase.health && phase.health.data ? 
      (phase.health.data.status === 'healthy' ? '✅' : 
       phase.health.data.status === 'degraded' ? '⚠️' : '🔴') : '❓';
    
    console.log(
      phase.name.padEnd(25) +
      phase.targetRPS.toString().padEnd(15) +
      phase.actualRPS.toFixed(2).padEnd(15) +
      phase.requests.toString().padEnd(15) +
      healthEmoji
    );
  });
  
  console.log('\n✨ Test Complete! Check your dashboard for detailed metrics.\n');
}

// Start the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});