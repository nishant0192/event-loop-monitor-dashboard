/**
 * Event Loop Monitor - Demo Application
 * 
 * Complete Express application demonstrating event loop monitoring capabilities.
 * 
 * Usage:
 *   node express-app.js
 * 
 * Then visit:
 *   - http://localhost:3000 - Home page
 *   - http://localhost:3000/event-loop-stats - Dashboard
 *   - http://localhost:3000/api/test - Test endpoint
 */

const express = require('express');
const { eventLoopMonitor } = require('../src/index');

// Create Express app
const app = express();
const PORT = 3000;

// Add event loop monitoring
app.use(eventLoopMonitor({
  path: '/event-loop-stats',
  sampleInterval: 100,
  historySize: 300,
  thresholds: {
    lagWarning: 50,
    lagCritical: 100,
    eluWarning: 0.7,
    eluCritical: 0.9
  },
  onAlert: (alert) => {
    console.log('\nALERT:', alert.message);
    console.log('Level:', alert.level);
    console.log('Metric:', alert.metric);
    console.log('Value:', alert.value.toFixed(2), alert.unit);
    if (alert.status === 'resolved') {
      console.log('Alert resolved\n');
    } else {
      console.log('Action needed\n');
    }
  }
}));

// Middleware - logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Home page route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Loop Monitor - Demo Application</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #ffffff;
          min-height: 100vh;
          padding: 0;
        }

        .header-banner {
          background: #ffffff;
          color: black;
          padding: 60px 20px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header-banner h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }

        .header-banner p {
          font-size: 1.1rem;
          opacity: 0.95;
          font-weight: 300;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }

        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .card-large {
          grid-column: 1 / -1;
        }

        .card h2 {
          font-size: 1.5rem;
          color: #2d3748;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .card p {
          color: #718096;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .button {
          display: inline-block;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          transition: all 0.2s;
          font-size: 0.95rem;
          border: none;
          cursor: pointer;
        }

        .button-primary {
          background: #667eea;
          color: white;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .button-primary:hover {
          background: #5568d3;
          transform: scale(1.02);
        }

        .button-success {
          background: #48bb78;
          color: white;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .button-success:hover {
          background: #38a169;
        }

        .button-danger {
          background: #f56565;
          color: white;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .button-danger:hover {
          background: #e53e3e;
        }

        .button-secondary {
          background: #edf2f7;
          color: #4a5568;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .button-secondary:hover {
          background: #e2e8f0;
        }

        .code-block {
          background: #2d3748;
          color: #e2e8f0;
          padding: 20px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: "Courier New", Consolas, monospace;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .code-block code {
          background: none;
          padding: 0;
        }

        .feature-list {
          list-style: none;
          margin-top: 20px;
        }

        .feature-list li {
          padding: 12px 0;
          color: #4a5568;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feature-list li:last-child {
          border-bottom: none;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          background: #e6fffa;
          color: #234e52;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .footer {
          text-align: center;
          color: #718096;
          padding: 40px 20px 20px;
          border-top: 1px solid #e2e8f0;
          margin-top: 40px;
        }

        @media (max-width: 768px) {
          .header-banner h1 {
            font-size: 2rem;
          }

          .card {
            padding: 24px;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="header-banner">
        <h1>Event Loop Monitor</h1>
        <p>Real-time performance monitoring for Node.js applications</p>
      </div>

      <div class="container">
        <div class="grid">
          <div class="card card-large">
            <h2>Live Dashboard</h2>
            <p>View comprehensive real-time metrics including event loop lag, CPU utilization, memory usage, and performance insights.</p>
            <a href="/event-loop-stats" class="button button-primary" target="_blank">Open Dashboard</a>
          </div>

          <div class="card">
            <h2>Test Endpoints</h2>
            <p>Explore different scenarios to observe their impact on event loop metrics.</p>
            <a href="/api/test" class="button button-success">Standard Request</a>
            <a href="/api/slow" class="button button-success">Async I/O (1s)</a>
            <a href="/api/cpu" class="button button-danger">CPU Intensive</a>
          </div>

          <div class="card">
            <h2>Monitoring Endpoints</h2>
            <p>Access health status and metrics for monitoring and alerting systems.</p>
            <a href="/health" class="button button-secondary" target="_blank">Health Check</a>
            <a href="/metrics" class="button button-secondary" target="_blank">Prometheus Metrics</a>
          </div>

          <div class="card card-large">
            <h2>Quick Integration</h2>
            <p>Add event loop monitoring to your Express application with minimal configuration.</p>
            <div class="code-block"><code>const { eventLoopMonitor } = require('event-loop-monitor-dashboard');

app.use(eventLoopMonitor({
  path: '/event-loop-stats',
  sampleInterval: 100,
  historySize: 300
}));</code></div>
          </div>

          <div class="card card-large">
            <h2>Available Features</h2>
            <ul class="feature-list">
              <li>
                <span>Real-time event loop lag monitoring</span>
                <span class="badge">Core</span>
              </li>
              <li>
                <span>CPU utilization tracking with Event Loop Utilization</span>
                <span class="badge">Core</span>
              </li>
              <li>
                <span>Memory usage analysis and visualization</span>
                <span class="badge">Core</span>
              </li>
              <li>
                <span>Configurable alerting with threshold notifications</span>
                <span class="badge">Alerts</span>
              </li>
              <li>
                <span>Interactive charts with historical data</span>
                <span class="badge">Visualization</span>
              </li>
              <li>
                <span>Prometheus metrics export</span>
                <span class="badge">Integration</span>
              </li>
              <li>
                <span>Health check endpoint for load balancers</span>
                <span class="badge">Integration</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Event Loop Monitor Demo Application v1.0</p>
        </div>
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
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  res.json({
    message: 'Slow endpoint completed',
    duration: '1000ms',
    note: 'This uses async I/O, so it does NOT block the event loop'
  });
});

// CPU intensive endpoint (blocks event loop)
app.get('/api/cpu', (req, res) => {
  console.log('\nWARNING: Running CPU-intensive operation...');
  
  const iterations = req.query.iterations || 1000000;
  
  const start = Date.now();
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }
  const duration = Date.now() - start;
  
  console.log(`Blocked event loop for ${duration}ms`);
  console.log('Check the dashboard - you should see lag spike\n');
  
  res.json({
    message: 'CPU intensive operation completed',
    duration: `${duration}ms`,
    iterations: iterations,
    result: result,
    warning: 'This operation BLOCKED the event loop',
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
  console.log('Event Loop Monitor - Demo Application');
  console.log('='.repeat(60));
  console.log(`\nServer running on http://localhost:${PORT}`);
  console.log(`\nDashboard: http://localhost:${PORT}/event-loop-stats`);
  console.log(`Metrics:   http://localhost:${PORT}/metrics`);
  console.log(`Health:    http://localhost:${PORT}/health`);
  console.log(`\nTry these endpoints to see event loop impact:`);
  console.log(`  GET /api/test  - Normal request`);
  console.log(`  GET /api/slow  - Async I/O (no blocking)`);
  console.log(`  GET /api/cpu   - CPU intensive (BLOCKS event loop)`);
  console.log(`\nWatch the dashboard while hitting these endpoints`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  
  const { cleanup } = require('../src/middleware/express');
  cleanup();
  
  console.log('Cleanup complete');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down...');
  
  const { cleanup } = require('../src/middleware/express');
  cleanup();
  
  process.exit(0);
});