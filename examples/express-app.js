/**
 * Example: Basic Express App with Event Loop Monitoring
 * 
 * This example demonstrates the simplest way to add event loop monitoring
 * to an Express application.
 * 
 * Usage:
 *   node examples/express-app.js
 * 
 * Then visit:
 *   - http://localhost:3000 - Test the app
 *   - http://localhost:3000/event-loop-stats - View the dashboard
 *   - http://localhost:3000/api/test - Test endpoint
 */

const express = require('express');
const { eventLoopMonitor } = require('../src/index');

// Create Express app
const app = express();
const PORT = 3000;

// Add event loop monitoring with one line!
app.use(eventLoopMonitor({
  path: '/event-loop-stats',
  sampleInterval: 100,
  historySize: 300,
  thresholds: {
    lagWarning: 50,      // Warn if lag > 50ms
    lagCritical: 100,    // Critical if lag > 100ms
    eluWarning: 0.7,     // Warn if utilization > 70%
    eluCritical: 0.9     // Critical if utilization > 90%
  },
  onAlert: (alert) => {
    // This callback is called when thresholds are breached
    console.log('\n🚨 ALERT:', alert.message);
    console.log('   Level:', alert.level);
    console.log('   Metric:', alert.metric);
    console.log('   Value:', alert.value.toFixed(2), alert.unit);
    if (alert.status === 'resolved') {
      console.log('✅ Alert resolved\n');
    } else {
      console.log('⚠️  Action needed!\n');
    }
  }
}));

// Middleware - logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Event Loop Monitor Demo</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        h1 {
          color: #333;
        }
        .card {
          background: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .link-button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 10px 10px 0;
          transition: background 0.3s;
        }
        .link-button:hover {
          background: #5568d3;
        }
        .test-button {
          background: #48bb78;
        }
        .test-button:hover {
          background: #38a169;
        }
        .danger-button {
          background: #f56565;
        }
        .danger-button:hover {
          background: #e53e3e;
        }
        code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <h1>⚡ Event Loop Monitor Demo</h1>
      
      <div class="card">
        <h2>📊 View the Dashboard</h2>
        <p>See real-time event loop metrics, health status, and charts.</p>
        <a href="/event-loop-stats" class="link-button" target="_blank">
          Open Dashboard
        </a>
      </div>

      <div class="card">
        <h2>🧪 Test Endpoints</h2>
        <p>Try these endpoints to see how they affect event loop metrics:</p>
        <a href="/api/test" class="link-button test-button">Simple Request</a>
        <a href="/api/slow" class="link-button test-button">Slow Request (1s)</a>
        <a href="/api/cpu" class="link-button danger-button">CPU Intensive (WARNING)</a>
      </div>

      <div class="card">
        <h2>📝 Quick Start</h2>
        <p>Adding monitoring to your Express app is just one line:</p>
        <pre><code>const { eventLoopMonitor } = require('event-loop-monitor-dashboard');
app.use(eventLoopMonitor());</code></pre>
      </div>

      <div class="card">
        <h2>📈 Prometheus Metrics</h2>
        <p>This example also exposes Prometheus metrics:</p>
        <a href="/metrics" class="link-button" target="_blank">View Metrics</a>
      </div>
    </body>
    </html>
  `);
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test endpoint',
    timestamp: Date.now(),
    success: true
  });
});

// Slow endpoint (simulates async I/O)
app.get('/api/slow', async (req, res) => {
  // This is fine - doesn't block event loop
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  res.json({
    message: 'Slow endpoint completed',
    duration: '1000ms',
    note: 'This uses async I/O, so it does NOT block the event loop'
  });
});

// CPU intensive endpoint (blocks event loop - demonstrates the problem!)
app.get('/api/cpu', (req, res) => {
  console.log('\n⚠️  WARNING: Running CPU-intensive operation...');
  
  const iterations = req.query.iterations || 1000000;
  
  // This BLOCKS the event loop!
  const start = Date.now();
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }
  const duration = Date.now() - start;
  
  console.log(`⚠️  Blocked event loop for ${duration}ms`);
  console.log('💡 Check the dashboard - you should see lag spike!\n');
  
  res.json({
    message: 'CPU intensive operation completed',
    duration: `${duration}ms`,
    iterations: iterations,
    result: result,
    warning: 'This operation BLOCKED the event loop!',
    tip: 'Check /event-loop-stats to see the lag spike'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const { getGlobalMonitor } = require('../src/middleware/express');
  const monitor = getGlobalMonitor();
  
  if (!monitor) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Monitor not available'
    });
  }

  const health = monitor.getHealth();
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    status: health.status,
    score: health.score,
    message: health.message,
    timestamp: Date.now()
  });
});

// Prometheus metrics endpoint
const { prometheusExporter } = require('../src/index');
app.get('/metrics', prometheusExporter());

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ Event Loop Monitor - Demo Application');
  console.log('='.repeat(60));
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📊 Dashboard: http://localhost:${PORT}/event-loop-stats`);
  console.log(`📈 Metrics:   http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health:    http://localhost:${PORT}/health`);
  console.log(`\n💡 Try these endpoints to see event loop impact:`);
  console.log(`   • GET /api/test     - Normal request`);
  console.log(`   • GET /api/slow     - Async I/O (no blocking)`);
  console.log(`   • GET /api/cpu      - CPU intensive (BLOCKS event loop)`);
  console.log(`\n👀 Watch the dashboard while hitting these endpoints!`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  
  const { cleanup } = require('../src/middleware/express');
  cleanup();
  
  console.log('✅ Cleanup complete');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down...');
  
  const { cleanup } = require('../src/middleware/express');
  cleanup();
  
  process.exit(0);
});