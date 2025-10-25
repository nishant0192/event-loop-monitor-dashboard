/**
 * Real-time Event Loop Monitor (Terminal Dashboard)
 * 
 * Displays live event loop metrics in the terminal while load test runs
 * 
 * Usage: node monitor.js
 */

const http = require('http');

const CONFIG = {
  baseUrl: 'http://localhost:3000',
  refreshInterval: 1000 // 1 second
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Fetch dashboard data
 */
function fetchDashboardData() {
  return new Promise((resolve, reject) => {
    http.get(`${CONFIG.baseUrl}/event-loop-stats/api/dashboard`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Clear terminal
 */
function clearScreen() {
  console.clear();
  // Alternative: console.log('\x1Bc');
}

/**
 * Draw progress bar
 */
function drawBar(value, max, width = 30) {
  const percentage = Math.min(100, (value / max) * 100);
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  let color = colors.green;
  if (percentage > 70) color = colors.yellow;
  if (percentage > 90) color = colors.red;
  
  return color + '█'.repeat(filled) + colors.dim + '░'.repeat(empty) + colors.reset;
}

/**
 * Format number with fixed decimals
 */
function fmt(num, decimals = 2) {
  return num.toFixed(decimals);
}

/**
 * Draw mini sparkline
 */
function sparkline(values, width = 20) {
  if (!values || values.length === 0) return ' '.repeat(width);
  
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const recent = values.slice(-width);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  
  return recent.map(v => {
    const normalized = (v - min) / range;
    const index = Math.min(chars.length - 1, Math.floor(normalized * chars.length));
    return chars[index];
  }).join('');
}

/**
 * Render dashboard
 */
function renderDashboard(data) {
  if (!data || data.status !== 'ok' || !data.data) {
    console.log(colors.red + '❌ Unable to fetch metrics' + colors.reset);
    return;
  }
  
  const { current, health, timeSeries } = data.data;
  
  // Clear and draw header
  clearScreen();
  
  console.log(colors.bright + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          ⚡ REAL-TIME EVENT LOOP MONITOR - Terminal Dashboard ⚡              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  // Health status
  const statusColor = health.status === 'healthy' ? colors.green :
                     health.status === 'degraded' ? colors.yellow : colors.red;
  const statusEmoji = health.status === 'healthy' ? '✅' :
                     health.status === 'degraded' ? '⚠️' : '🔴';
  
  console.log(colors.bright + '\n🏥 HEALTH STATUS' + colors.reset);
  console.log('─'.repeat(80));
  console.log(`${statusEmoji}  Status: ${statusColor}${health.status.toUpperCase()}${colors.reset} (Score: ${health.score}/100)`);
  console.log(`   ${health.message}`);
  
  if (health.issues && health.issues.length > 0) {
    health.issues.forEach(issue => {
      console.log(`   ${colors.yellow}⚠${colors.reset}  ${issue}`);
    });
  }
  
  // Event Loop Lag
  console.log(colors.bright + '\n📊 EVENT LOOP LAG' + colors.reset);
  console.log('─'.repeat(80));
  console.log(`Mean:   ${colors.cyan}${fmt(current.lag.mean)} ms${colors.reset}  ${drawBar(current.lag.mean, 100)}`);
  console.log(`P50:    ${fmt(current.lag.p50)} ms`);
  console.log(`P95:    ${colors.yellow}${fmt(current.lag.p95)} ms${colors.reset}`);
  console.log(`P99:    ${colors.red}${fmt(current.lag.p99)} ms${colors.reset}`);
  console.log(`Max:    ${fmt(current.lag.max)} ms`);
  
  // Mini chart for lag
  const lagValues = timeSeries.lag.map(d => d.mean);
  console.log(`\nTrend:  ${colors.blue}${sparkline(lagValues, 60)}${colors.reset}`);
  
  // Event Loop Utilization
  console.log(colors.bright + '\n⚙️  EVENT LOOP UTILIZATION' + colors.reset);
  console.log('─'.repeat(80));
  console.log(`Current: ${colors.magenta}${fmt(current.elu.utilization, 1)}%${colors.reset}  ${drawBar(current.elu.utilization, 100)}`);
  console.log(`Active:  ${fmt(current.elu.active)} ms`);
  console.log(`Idle:    ${fmt(current.elu.idle)} ms`);
  
  // Mini chart for ELU
  const eluValues = timeSeries.elu.map(d => d.utilization);
  console.log(`\nTrend:  ${colors.magenta}${sparkline(eluValues, 60)}${colors.reset}`);
  
  // Request Metrics
  console.log(colors.bright + '\n📈 REQUEST METRICS' + colors.reset);
  console.log('─'.repeat(80));
  console.log(`Requests: ${colors.green}${current.requests.count}${colors.reset} in last sample`);
  console.log(`Avg Time: ${fmt(current.requests.avgTime)} ms`);
  
  // Request rate trend
  const reqCounts = timeSeries.requests.slice(-10).map(d => d.count);
  const avgReqRate = reqCounts.reduce((a, b) => a + b, 0) / reqCounts.length;
  console.log(`Rate:     ${fmt(avgReqRate * 10, 0)} req/s (approx)`);
  
  // Footer
  console.log('\n' + colors.dim + '─'.repeat(80));
  console.log(`Last updated: ${new Date().toLocaleTimeString()}  |  Refreshing every ${CONFIG.refreshInterval}ms`);
  console.log(`Dashboard: ${CONFIG.baseUrl}/event-loop-stats/`);
  console.log(`Press Ctrl+C to exit${colors.reset}`);
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log(colors.cyan + '\n🚀 Starting real-time monitoring...\n' + colors.reset);
  console.log('📊 Open ' + colors.bright + CONFIG.baseUrl + '/event-loop-stats/' + colors.reset);
  console.log('   in your browser to see the web dashboard\n');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const monitor = async () => {
    try {
      const data = await fetchDashboardData();
      renderDashboard(data);
    } catch (error) {
      clearScreen();
      console.log(colors.red + '\n❌ Error fetching metrics: ' + error.message + colors.reset);
      console.log('\nIs the server running at ' + CONFIG.baseUrl + '?');
    }
    
    // Schedule next update
    setTimeout(monitor, CONFIG.refreshInterval);
  };
  
  monitor();
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log(colors.cyan + '\n\n👋 Monitoring stopped\n' + colors.reset);
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(error => {
  console.error(colors.red + '❌ Failed to start monitoring:', error + colors.reset);
  process.exit(1);
});