/**
 * Prometheus Exporter
 * 
 * Exports event loop metrics in Prometheus text format for scraping
 * Compatible with Prometheus and Grafana
 * 
 * @module exporters/prometheus
 */

/**
 * Format metrics in Prometheus text format
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {string} Metrics in Prometheus format
 */
function formatPrometheusMetrics(monitor) {
  if (!monitor || !monitor.isActive()) {
    return '# Monitor not active\n';
  }

  const current = monitor.getCurrentMetrics();
  if (!current) {
    return '# No metrics available\n';
  }

  const lines = [];
  const timestamp = Date.now();

  // Event Loop Lag Metrics
  lines.push('# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds');
  lines.push('# TYPE nodejs_eventloop_lag_seconds gauge');
  lines.push(`nodejs_eventloop_lag_seconds{quantile="0.5"} ${(current.lag.p50 / 1000).toFixed(6)} ${timestamp}`);
  lines.push(`nodejs_eventloop_lag_seconds{quantile="0.9"} ${(current.lag.p90 / 1000).toFixed(6)} ${timestamp}`);
  lines.push(`nodejs_eventloop_lag_seconds{quantile="0.95"} ${(current.lag.p95 / 1000).toFixed(6)} ${timestamp}`);
  lines.push(`nodejs_eventloop_lag_seconds{quantile="0.99"} ${(current.lag.p99 / 1000).toFixed(6)} ${timestamp}`);
  lines.push(`nodejs_eventloop_lag_seconds{quantile="0.999"} ${(current.lag.p999 / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Lag Mean
  lines.push('# HELP nodejs_eventloop_lag_mean_seconds Mean event loop lag in seconds');
  lines.push('# TYPE nodejs_eventloop_lag_mean_seconds gauge');
  lines.push(`nodejs_eventloop_lag_mean_seconds ${(current.lag.mean / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Lag Min
  lines.push('# HELP nodejs_eventloop_lag_min_seconds Minimum event loop lag in seconds');
  lines.push('# TYPE nodejs_eventloop_lag_min_seconds gauge');
  lines.push(`nodejs_eventloop_lag_min_seconds ${(current.lag.min / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Lag Max
  lines.push('# HELP nodejs_eventloop_lag_max_seconds Maximum event loop lag in seconds');
  lines.push('# TYPE nodejs_eventloop_lag_max_seconds gauge');
  lines.push(`nodejs_eventloop_lag_max_seconds ${(current.lag.max / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Utilization
  lines.push('# HELP nodejs_eventloop_utilization Event loop utilization ratio (0-1)');
  lines.push('# TYPE nodejs_eventloop_utilization gauge');
  lines.push(`nodejs_eventloop_utilization ${current.elu.utilization.toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Active Time
  lines.push('# HELP nodejs_eventloop_active_seconds Time spent actively processing in seconds');
  lines.push('# TYPE nodejs_eventloop_active_seconds gauge');
  lines.push(`nodejs_eventloop_active_seconds ${(current.elu.active / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Event Loop Idle Time
  lines.push('# HELP nodejs_eventloop_idle_seconds Time spent idle in seconds');
  lines.push('# TYPE nodejs_eventloop_idle_seconds gauge');
  lines.push(`nodejs_eventloop_idle_seconds ${(current.elu.idle / 1000).toFixed(6)} ${timestamp}`);
  lines.push('');

  // Request Count (if tracked)
  if (current.requests) {
    lines.push('# HELP nodejs_eventloop_requests_total Total number of requests tracked');
    lines.push('# TYPE nodejs_eventloop_requests_total counter');
    lines.push(`nodejs_eventloop_requests_total ${current.requests.count} ${timestamp}`);
    lines.push('');

    lines.push('# HELP nodejs_eventloop_request_duration_seconds Average request duration in seconds');
    lines.push('# TYPE nodejs_eventloop_request_duration_seconds gauge');
    lines.push(`nodejs_eventloop_request_duration_seconds ${(current.requests.avgTime / 1000).toFixed(6)} ${timestamp}`);
    lines.push('');
  }

  // Health Score
  const health = monitor.getHealth();
  lines.push('# HELP nodejs_eventloop_health_score Event loop health score (0-100)');
  lines.push('# TYPE nodejs_eventloop_health_score gauge');
  lines.push(`nodejs_eventloop_health_score ${health.score} ${timestamp}`);
  lines.push('');

  // Health Status (as numeric: 0=unknown, 1=healthy, 2=degraded, 3=critical)
  const statusMap = {
    'unknown': 0,
    'healthy': 1,
    'degraded': 2,
    'critical': 3
  };
  lines.push('# HELP nodejs_eventloop_health_status Event loop health status (0=unknown, 1=healthy, 2=degraded, 3=critical)');
  lines.push('# TYPE nodejs_eventloop_health_status gauge');
  lines.push(`nodejs_eventloop_health_status ${statusMap[health.status] || 0} ${timestamp}`);
  lines.push('');

  // Monitoring Info
  lines.push('# HELP nodejs_eventloop_monitor_active Monitor active status (1=active, 0=inactive)');
  lines.push('# TYPE nodejs_eventloop_monitor_active gauge');
  lines.push(`nodejs_eventloop_monitor_active ${monitor.isActive() ? 1 : 0} ${timestamp}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Create Prometheus exporter middleware
 * Returns Express middleware that serves metrics at /metrics endpoint
 * 
 * @param {EventLoopMonitor} [monitor] - Optional monitor instance (uses global if not provided)
 * @returns {Function} Express middleware
 * 
 * @example
 * const { prometheusExporter } = require('event-loop-monitor-dashboard');
 * 
 * app.get('/metrics', prometheusExporter());
 */
function createPrometheusExporter(monitor) {
  return function prometheusMiddleware(req, res) {
    // Get monitor instance
    let monitorInstance = monitor;
    
    if (!monitorInstance) {
      // Try to get global monitor from express middleware
      try {
        const expressMiddleware = require('../middleware/express');
        monitorInstance = expressMiddleware.getGlobalMonitor();
      } catch (error) {
        // Ignore error, will handle below
      }
    }

    if (!monitorInstance || !monitorInstance.isActive()) {
      res.writeHead(503, { 
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache'
      });
      res.end('# Monitor not active or not available\n');
      return;
    }

    try {
      const metrics = formatPrometheusMetrics(monitorInstance);
      
      res.writeHead(200, { 
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(metrics);
    } catch (error) {
      res.writeHead(500, { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      });
      res.end(`# Error generating metrics: ${error.message}\n`);
    }
  };
}

/**
 * Get metrics as JSON (alternative to Prometheus format)
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Metrics in JSON format
 */
function getMetricsJSON(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      error: 'Monitor not active'
    };
  }

  const current = monitor.getCurrentMetrics();
  if (!current) {
    return {
      error: 'No metrics available'
    };
  }

  const health = monitor.getHealth();

  return {
    timestamp: Date.now(),
    lag: {
      min: current.lag.min,
      max: current.lag.max,
      mean: current.lag.mean,
      stddev: current.lag.stddev,
      p50: current.lag.p50,
      p90: current.lag.p90,
      p95: current.lag.p95,
      p99: current.lag.p99,
      p999: current.lag.p999
    },
    elu: {
      utilization: current.elu.utilization,
      active: current.elu.active,
      idle: current.elu.idle
    },
    requests: current.requests ? {
      count: current.requests.count,
      totalTime: current.requests.totalTime,
      avgTime: current.requests.avgTime
    } : null,
    health: {
      status: health.status,
      score: health.score,
      message: health.message,
      issues: health.issues
    },
    monitoring: {
      active: monitor.isActive(),
      config: monitor.getConfig()
    }
  };
}

/**
 * Export metrics in OpenMetrics format (newer Prometheus format)
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {string} Metrics in OpenMetrics format
 */
function formatOpenMetrics(monitor) {
  const prometheus = formatPrometheusMetrics(monitor);
  
  // OpenMetrics requires EOF marker
  return prometheus + '# EOF\n';
}

/**
 * Create custom exporter with labels
 * Useful for multi-instance deployments
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {Object} labels - Custom labels (e.g., {instance: "web-1", region: "us-east"})
 * @returns {Function} Express middleware with custom labels
 */
function createCustomExporter(monitor, labels = {}) {
  const labelString = Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');

  return function customPrometheusMiddleware(req, res) {
    if (!monitor || !monitor.isActive()) {
      res.writeHead(503, { 
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache'
      });
      res.end('# Monitor not active\n');
      return;
    }

    try {
      let metrics = formatPrometheusMetrics(monitor);
      
      // Add custom labels to each metric line
      if (labelString) {
        metrics = metrics.split('\n').map(line => {
          if (line.startsWith('nodejs_eventloop_') && !line.startsWith('#')) {
            // Find the metric name end
            const spaceIndex = line.indexOf(' ');
            if (spaceIndex > 0) {
              const metricName = line.substring(0, spaceIndex);
              const rest = line.substring(spaceIndex);
              
              // Check if metric already has labels
              if (metricName.includes('{')) {
                // Add to existing labels
                return line.replace('{', `{${labelString},`);
              } else {
                // Add new labels
                return `${metricName}{${labelString}}${rest}`;
              }
            }
          }
          return line;
        }).join('\n');
      }
      
      res.writeHead(200, { 
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(metrics);
    } catch (error) {
      res.writeHead(500, { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      });
      res.end(`# Error generating metrics: ${error.message}\n`);
    }
  };
}

// Main export
module.exports = createPrometheusExporter;

// Additional exports
module.exports.formatPrometheusMetrics = formatPrometheusMetrics;
module.exports.formatOpenMetrics = formatOpenMetrics;
module.exports.getMetricsJSON = getMetricsJSON;
module.exports.createCustomExporter = createCustomExporter;