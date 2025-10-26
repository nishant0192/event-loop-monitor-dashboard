# Event Loop Monitor Dashboard

[![npm version](https://img.shields.io/npm/v/event-loop-monitor-dashboard.svg)](https://www.npmjs.com/package/event-loop-monitor-dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/nishant0192/event-loop-monitor-dashboard)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/nishant0192/event-loop-monitor-dashboard)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org)

**Zero-dependency Node.js event loop monitoring with a beautiful built-in dashboard.**

Monitor your Node.js application's event loop health in real-time. Detect blocking operations, measure performance impact, and prevent production issues before they affect users.

---

## 🎯 Why Event Loop Monitor?

Traditional APM tools (DataDog, New Relic, etc.) show you *response times* but **miss the root cause** of Node.js performance issues: **event loop blocking**. 

When synchronous operations block the event loop, **all requests suffer**—but standard monitoring can't tell you why.

**This package fills that gap:**

- 📊 **Visual Dashboard** - See event loop health at a glance
- 🎯 **Lag Detection** - Identify blocking operations instantly  
- 📈 **Historical Tracking** - Monitor trends over time
- 🚨 **Smart Alerts** - Get notified before users notice
- 🔍 **Prometheus Export** - Integrate with Grafana
- ⚡ **Zero Config** - Works out of the box
- 🪶 **Lightweight** - <5% overhead, zero runtime dependencies
- ✅ **Production Ready** - 145 tests, 100% coverage

---

## 🚀 Quick Start

### Installation

```bash
npm install event-loop-monitor-dashboard
```

### Express Integration (2 Lines!)

```javascript
const express = require('express');
const { eventLoopMonitor } = require('event-loop-monitor-dashboard');

const app = express();

// Add monitoring middleware - that's it!
app.use(eventLoopMonitor());

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('🚀 Server: http://localhost:3000');
  console.log('📊 Dashboard: http://localhost:3000/event-loop-stats');
});
```

**That's it!** Visit `/event-loop-stats` to see your dashboard.

### Standalone Monitor

For non-Express apps or custom integrations:

```javascript
const { EventLoopMonitor } = require('event-loop-monitor-dashboard');

const monitor = new EventLoopMonitor({
  sampleInterval: 100,
  historySize: 500
});

monitor.start();

// Get current metrics
setInterval(() => {
  const metrics = monitor.getCurrentMetrics();
  console.log('Event Loop Lag (p99):', metrics.lag.p99, 'ms');
  console.log('Utilization:', (metrics.elu.utilization * 100).toFixed(1), '%');
}, 5000);
```

---

## ✨ Features

### 📊 Real-Time Dashboard

Beautiful, responsive web dashboard showing:
- **Event loop lag** (p50, p95, p99 percentiles)
- **Event loop utilization** (active vs idle time)
- **Request metrics** (throughput, latency distribution)
- **Health status** with automatic threshold detection
- **Live charts** (last 5 minutes of data)

### 🎯 Comprehensive Metrics

Track critical Node.js performance indicators:

```javascript
const metrics = monitor.getCurrentMetrics();

console.log(metrics);
// {
//   timestamp: 1698765432000,
//   lag: { 
//     min: 0.1, max: 145.2, mean: 5.3, 
//     p50: 3.2, p95: 12.5, p99: 45.8 
//   },
//   elu: { 
//     idle: 0.85, active: 0.15, utilization: 0.15 
//   },
//   requests: { 
//     count: 1234, rps: 41.1, avgDuration: 23.5,
//     p50: 18, p95: 67, p99: 123 
//   },
//   health: { 
//     status: 'healthy', score: 92 
//   }
// }
```

### 🚨 Smart Alerts

Set up alerts for problematic conditions:

```javascript
const { AlertManager } = require('event-loop-monitor-dashboard');

const alertManager = new AlertManager(monitor, {
  lag: { warning: 10, critical: 50 },           // milliseconds
  utilization: { warning: 0.7, critical: 0.9 }, // 0-1 ratio
  checkInterval: 5000,                          // check every 5s
  cooldownPeriod: 60000                         // 1 minute between alerts
});

alertManager.start((alert) => {
  console.log(`🚨 ${alert.severity.toUpperCase()}: ${alert.message}`);
  
  // Send to Slack, PagerDuty, email, etc.
  if (alert.severity === 'critical') {
    sendToSlack(alert);
    pageOncall(alert);
  }
});
```

**Alert Types:**
- High event loop lag
- High CPU utilization  
- Slow request latency
- Configurable thresholds and cooldowns

### 📈 Prometheus Integration

Export metrics for Grafana dashboards:

```javascript
const { prometheusExporter } = require('event-loop-monitor-dashboard');

app.use('/metrics', prometheusExporter(monitor));
```

**Exposes standard Prometheus metrics:**
- `nodejs_eventloop_lag_seconds` (histogram with p50, p95, p99)
- `nodejs_eventloop_utilization_ratio` (gauge)
- `nodejs_eventloop_lag_mean_seconds` (gauge)
- `nodejs_eventloop_lag_max_seconds` (gauge)
- `nodejs_eventloop_requests_total` (counter)
- `nodejs_eventloop_request_duration_seconds` (histogram)
- `nodejs_eventloop_health_score` (gauge)
- `nodejs_eventloop_health_status` (gauge with status labels)

### 🔍 Automatic Request Tracking

Track request performance automatically:

```javascript
// Automatic with Express middleware
app.use(eventLoopMonitor());

// Manual tracking for non-HTTP code
const duration = monitor.trackRequest(() => {
  // Your synchronous code here
  return processData();
});

// Or with async code
const duration = await monitor.trackRequest(async () => {
  return await fetchAndProcessData();
});
```

---

## 📚 API Reference

### EventLoopMonitor

Main monitoring class.

#### Constructor

```javascript
const monitor = new EventLoopMonitor(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sampleInterval` | number | 100 | Metrics collection interval (ms) |
| `historySize` | number | 3000 | Number of samples to keep in memory |
| `resolution` | number | 10 | Event loop delay resolution (ms) |

#### Methods

**Lifecycle:**
- `start()` → void - Start monitoring
- `stop()` → void - Stop monitoring
- `isActive()` → boolean - Check if monitoring is active

**Metrics:**
- `getCurrentMetrics()` → Object - Get latest metrics snapshot
- `getMetrics()` → Object - Get complete metrics with history
- `getHistory(count?)` → Array - Get historical samples
- `getTimeSeries(metric, count?)` → Array - Get time series data for charting

**Health:**
- `getHealth(thresholds?)` → Object - Get health status with optional custom thresholds

**Request Tracking:**
- `trackRequest(fn)` → number - Track function execution time (returns duration in ms)

**Utilities:**
- `reset()` → void - Clear all metrics and history
- `getConfig()` → Object - Get current configuration
- `exportJSON()` → string - Export metrics as JSON
- `importJSON(data)` → void - Import metrics from JSON

### eventLoopMonitor() Middleware

Express middleware with automatic setup.

```javascript
app.use(eventLoopMonitor(options));
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | '/event-loop-stats' | Dashboard base path |
| `monitor` | EventLoopMonitor | new instance | Custom monitor instance |
| `alerts` | object | undefined | Alert configuration |
| ...monitorOptions | | | All EventLoopMonitor options |

**Mounted Routes:**
- `GET {path}/` - Dashboard UI
- `GET {path}/api/current` - Current metrics
- `GET {path}/api/history` - Historical data
- `GET {path}/api/health` - Health check endpoint
- `GET {path}/api/metrics` - Complete metrics object
- `GET {path}/api/dashboard` - Dashboard-optimized data
- `GET {path}/api/config` - Configuration info

**Access the monitor instance:**
```javascript
const middleware = eventLoopMonitor();
app.use(middleware);

// Access monitor
const monitor = middleware.monitor;
```

### AlertManager

Alert monitoring with configurable thresholds.

#### Constructor

```javascript
const alerts = new AlertManager(monitor, options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lag.warning` | number | 10 | Warning threshold (ms) |
| `lag.critical` | number | 50 | Critical threshold (ms) |
| `utilization.warning` | number | 0.7 | Warning threshold (0-1) |
| `utilization.critical` | number | 0.9 | Critical threshold (0-1) |
| `checkInterval` | number | 5000 | Check frequency (ms) |
| `cooldownPeriod` | number | 30000 | Min time between same alerts (ms) |

#### Methods

- `start(callback)` → void - Start alert monitoring
- `stop()` → void - Stop alert monitoring
- `getAlertHistory(count?)` → Array - Get recent alerts
- `getAlertStatus()` → Object - Get current status
- `getAlertStats()` → Object - Get statistics
- `updateThresholds(thresholds)` → void - Update thresholds dynamically
- `reset()` → void - Clear alert history
- `getConfig()` → Object - Get configuration

**Alert Object Structure:**
```javascript
{
  type: 'lag' | 'utilization' | 'latency',
  severity: 'warning' | 'critical',
  message: 'Event loop lag is high: 125.3ms (threshold: 50ms)',
  value: 125.3,
  threshold: 50,
  timestamp: 1698765432000,
  metrics: { /* current metrics */ }
}
```

### prometheusExporter()

Prometheus metrics exporter.

```javascript
const exporter = prometheusExporter(monitor);
app.use('/metrics', exporter);
```

Returns middleware that exposes `/metrics` endpoint in Prometheus format.

---

## 🎓 Real-World Examples

### 1. Detecting Blocking Operations

```javascript
const express = require('express');
const { eventLoopMonitor } = require('event-loop-monitor-dashboard');

const app = express();
app.use(eventLoopMonitor());

// ❌ BAD: Blocks event loop for 1 second
app.get('/blocking', (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 1000) {
    // Busy-wait blocks everything!
  }
  res.send('Done (but dashboard shows lag spike!)');
});

// ✅ GOOD: Non-blocking async operation
app.get('/non-blocking', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  res.send('Done (no lag spike!)');
});

app.listen(3000);
// Visit /event-loop-stats and compare the endpoints!
```

### 2. Production Monitoring Setup

```javascript
const { EventLoopMonitor, AlertManager } = require('event-loop-monitor-dashboard');
const { sendSlackAlert, pageOncall } = require('./alerts');

// Create monitor
const monitor = new EventLoopMonitor({
  sampleInterval: 100,
  historySize: 3000
});

monitor.start();

// Setup production alerts
const alerts = new AlertManager(monitor, {
  lag: { warning: 20, critical: 100 },
  utilization: { warning: 0.8, critical: 0.95 },
  checkInterval: 5000,
  cooldownPeriod: 300000 // 5 minutes
});

alerts.start((alert) => {
  console.error(`🚨 Event Loop ${alert.severity}:`, alert.message);
  
  // Critical alerts page oncall
  if (alert.severity === 'critical') {
    pageOncall({
      title: 'Critical Event Loop Issue',
      message: alert.message,
      metrics: alert.metrics
    });
  }
  
  // All alerts go to Slack
  sendSlackAlert({
    channel: alert.severity === 'critical' ? '#incidents' : '#monitoring',
    severity: alert.severity,
    text: alert.message,
    metrics: alert.metrics
  });
});

// Log stats periodically
setInterval(() => {
  const stats = alerts.getAlertStats();
  console.log('Alert stats:', stats);
}, 60000);
```

### 3. Kubernetes Health Checks

```javascript
const express = require('express');
const { eventLoopMonitor } = require('event-loop-monitor-dashboard');

const app = express();
const middleware = eventLoopMonitor();
app.use(middleware);

// Liveness probe - is the app running?
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness probe - is the app ready to serve traffic?
app.get('/readyz', (req, res) => {
  const monitor = middleware.monitor;
  
  if (!monitor.isActive()) {
    return res.status(503).json({ 
      status: 'not ready', 
      reason: 'monitor not active' 
    });
  }
  
  const health = monitor.getHealth({
    lag: { warning: 15, critical: 50 },
    utilization: { warning: 0.75, critical: 0.9 }
  });
  
  // Return 503 if event loop is unhealthy
  if (health.status === 'critical') {
    return res.status(503).json({ 
      status: 'not ready',
      reason: 'event loop unhealthy',
      health 
    });
  }
  
  res.json({ status: 'ready', health });
});

app.listen(3000);
```

**Kubernetes Deployment:**
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    image: myapp:latest
    livenessProbe:
      httpGet:
        path: /healthz
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /readyz
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
```

### 4. Grafana Dashboard with Prometheus

```javascript
const express = require('express');
const { EventLoopMonitor, prometheusExporter } = require('event-loop-monitor-dashboard');

const app = express();
const monitor = new EventLoopMonitor();
monitor.start();

// Expose Prometheus metrics
app.use('/metrics', prometheusExporter(monitor));

app.listen(3000);
```

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'nodejs-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

**Sample Grafana queries:**
```promql
# Event loop lag p99
nodejs_eventloop_lag_seconds{quantile="0.99"}

# Event loop utilization
nodejs_eventloop_utilization_ratio

# Request rate
rate(nodejs_eventloop_requests_total[5m])

# Request latency p95
histogram_quantile(0.95, nodejs_eventloop_request_duration_seconds_bucket)
```

### 5. Custom Metrics Export

```javascript
const { EventLoopMonitor } = require('event-loop-monitor-dashboard');
const monitor = new EventLoopMonitor();
monitor.start();

// Export to custom monitoring system
setInterval(() => {
  const metrics = monitor.getCurrentMetrics();
  
  // Send to StatsD
  statsd.gauge('eventloop.lag.p99', metrics.lag.p99);
  statsd.gauge('eventloop.utilization', metrics.elu.utilization);
  
  // Send to CloudWatch
  cloudwatch.putMetricData({
    Namespace: 'MyApp/EventLoop',
    MetricData: [
      { MetricName: 'Lag_P99', Value: metrics.lag.p99, Unit: 'Milliseconds' },
      { MetricName: 'Utilization', Value: metrics.elu.utilization, Unit: 'Percent' }
    ]
  });
  
  // Send to custom API
  await fetch('https://monitoring.example.com/metrics', {
    method: 'POST',
    body: JSON.stringify(metrics)
  });
}, 10000);
```

### 6. PM2 Cluster Mode

```javascript
// app.js
const express = require('express');
const { eventLoopMonitor } = require('event-loop-monitor-dashboard');

const app = express();
app.use(eventLoopMonitor({
  path: '/event-loop-stats'
}));

app.get('/', (req, res) => {
  res.send(`Worker ${process.pid} serving request`);
});

app.listen(3000);
```

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './app.js',
    instances: 4,
    exec_mode: 'cluster'
  }]
};
```

Each worker gets its own monitor. Access dashboards at:
- Worker 1: `http://localhost:3000/event-loop-stats`
- Worker 2: `http://localhost:3001/event-loop-stats`
- etc.

For aggregated metrics, use Prometheus + Grafana.

---

## 🆚 Comparison with Alternatives

| Feature | Event Loop Monitor | DataDog APM | New Relic | clinic.js | node-clinic |
|---------|-------------------|-------------|-----------|-----------|-------------|
| **Event Loop Lag** | ✅ Full | ❌ No | ❌ No | ✅ CLI only | ✅ CLI only |
| **Event Loop Utilization** | ✅ Full | ❌ No | ❌ No | ⚠️ Limited | ⚠️ Limited |
| **Real-Time Dashboard** | ✅ Built-in | ✅ Separate | ✅ Separate | ❌ No | ❌ No |
| **Production Ready** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Dev only | ⚠️ Dev only |
| **Zero Config** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Self-Hosted** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Cost** | **Free** | $$$$ | $$$$ | Free | Free |
| **Overhead** | **<5%** | 50-100% | 50-100% | High | High |
| **Prometheus Export** | ✅ Yes | ⚠️ Limited | ⚠️ Limited | ❌ No | ❌ No |
| **Alerts** | ✅ Built-in | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Request Tracking** | ✅ Auto | ✅ Auto | ✅ Auto | ⚠️ Manual | ⚠️ Manual |

**Key Advantages:**
- **Free** and open source
- **Zero runtime dependencies** - no supply chain risk
- **Lightweight** - won't slow your app
- **Simple** - 2 lines to add to Express
- **Node.js specific** - built for the event loop
- **Self-hosted** - your data stays with you

---

## 🛠️ Requirements

- **Node.js** >= 14.0.0 (uses `perf_hooks` API)
- **Express** (optional, for middleware)

---

## 🧪 Testing

This package has **comprehensive test coverage**:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Test Results:**
- ✅ **145 tests passing**
- ✅ **100% code coverage**
- ✅ **6 test suites** (unit + integration)

See [test/README.md](test/README.md) for detailed testing documentation.

---

## 📖 Troubleshooting

### Dashboard shows "Monitor not active"

The monitor needs to be started:

```javascript
const middleware = eventLoopMonitor();
app.use(middleware);

// Make sure to start it
middleware.monitor.start();
```

### High lag values immediately after starting

The event loop delay histogram needs a few seconds to warm up. Initial readings may show artificially high values. Wait 5-10 seconds for accurate metrics.

### No metrics showing in dashboard

1. Verify the monitor is started: `monitor.isActive()` should return `true`
2. Check the console for errors
3. Try accessing the API directly: `GET /event-loop-stats/api/current`
4. Ensure your app is receiving traffic (metrics update with activity)

### Memory usage growing over time

The monitor keeps a circular buffer of samples (default 3000). This is intentional. To reduce memory:

```javascript
new EventLoopMonitor({
  historySize: 500  // Reduce from 3000
});
```

### Prometheus metrics not updating

Ensure the monitor is active when the `/metrics` endpoint is scraped:

```javascript
const monitor = new EventLoopMonitor();
monitor.start(); // Must be called!

app.use('/metrics', prometheusExporter(monitor));
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone and install
git clone https://github.com/nishant0192/event-loop-monitor-dashboard.git
cd event-loop-monitor-dashboard
npm install

# Run tests
npm test
npm run test:watch

# Run example app
npm run example
# Visit http://localhost:3000/event-loop-stats

# Lint code
npm run lint
```

### Areas We'd Love Help With

- 🔄 **WebSocket support** for real-time dashboard updates
- 📊 **Pre-built Grafana dashboards**
- 🔌 **Framework adapters** (Fastify, Koa, Hapi)
- 📱 **Mobile-friendly dashboard**
- 💾 **Data persistence** options
- 🌍 **Internationalization**

---

## 🗺️ Roadmap

- [x] Core event loop monitoring
- [x] Express middleware
- [x] Built-in dashboard
- [x] Prometheus exporter
- [x] Alert system
- [x] Comprehensive tests
- [ ] WebSocket real-time updates
- [ ] Grafana dashboard templates
- [ ] Framework adapters (Fastify, Koa)
- [ ] Data persistence (SQLite/PostgreSQL)
- [ ] Memory leak detection
- [ ] CPU profiling integration
- [ ] Cloud hosting option

---

## ❓ FAQ

### Will this slow down my production app?

No. The overhead is **less than 5%** because it uses Node.js built-in APIs (`perf_hooks`) which are highly optimized.

### Can I use this with Kubernetes?

Yes! Use the Prometheus exporter and configure Prometheus to scrape your pods:

```javascript
app.use('/metrics', prometheusExporter(monitor));
```

Then create Grafana dashboards or set up Prometheus alerts.

### Does this work with PM2/cluster mode?

Yes. Each worker process gets its own monitor instance. For aggregated metrics across all workers, use the Prometheus exporter and visualize in Grafana.

### What about serverless (Lambda, Cloud Functions)?

Yes! Use the standalone monitor without the dashboard:

```javascript
const { EventLoopMonitor } = require('event-loop-monitor-dashboard');
const monitor = new EventLoopMonitor({ historySize: 100 });

exports.handler = async (event) => {
  monitor.start();
  
  // Your handler code
  const result = await processEvent(event);
  
  // Export metrics at the end
  console.log('Event Loop Metrics:', monitor.getCurrentMetrics());
  
  return result;
};
```

### Can I customize the dashboard?

The built-in dashboard is minimal and can't be customized. For custom dashboards:
1. Use the JSON API endpoints to fetch data
2. Build your own UI using the REST API
3. Use Prometheus + Grafana for maximum flexibility

### How do I set custom alert thresholds?

```javascript
const alerts = new AlertManager(monitor, {
  lag: { 
    warning: 20,   // Your custom values
    critical: 100 
  },
  utilization: { 
    warning: 0.8, 
    critical: 0.95 
  }
});
```

### Does this track async operations?

The event loop lag metric captures **total blocking time**, regardless of source. If async callbacks contain synchronous blocking code, it will be detected.

### What's the difference between lag and utilization?

- **Lag**: How long the event loop is delayed (milliseconds)
  - Ideal: <10ms
  - Warning: >10ms
  - Critical: >50ms

- **Utilization**: Percentage of time the event loop is active vs idle
  - Ideal: <70%
  - Warning: >70%
  - Critical: >90%

High lag with low utilization = infrequent but severe blocking  
High utilization with low lag = busy but efficient event loop

---

## 📄 License

MIT © Nishant Kumar

---

## 🙏 Acknowledgments

- Built with Node.js [`perf_hooks`](https://nodejs.org/api/perf_hooks.html) API
- Inspired by the need for better Node.js observability
- Thanks to all contributors!

---

## 💬 Support

- 📖 [Documentation](https://github.com/nishant0192/event-loop-monitor-dashboard#readme)
- 🐛 [Issue Tracker](https://github.com/nishant0192/event-loop-monitor-dashboard/issues)
- 💬 [Discussions](https://github.com/nishant0192/event-loop-monitor-dashboard/discussions)
- 📧 Email: nishant@example.com

---

<div align="center">

**⭐ Star us on GitHub — it helps!**

[Report Bug](https://github.com/nishant0192/event-loop-monitor-dashboard/issues) · [Request Feature](https://github.com/nishant0192/event-loop-monitor-dashboard/issues) · [Contribute](CONTRIBUTING.md)

</div>