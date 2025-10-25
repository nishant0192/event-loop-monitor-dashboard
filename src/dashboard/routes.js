/**
 * Dashboard Routes
 * 
 * Express router for serving dashboard and API endpoints
 * 
 * @module dashboard/routes
 */

const path = require('path');
const fs = require('fs');
const api = require('./api');

/**
 * Create dashboard router
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Function} Express router middleware
 */
function createDashboardRoutes(monitor) {
  // Mini router implementation (no external dependencies)
  const router = function(req, res, next) {
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    try {
      // Route: Dashboard HTML
      if (pathname === '/' || pathname === '') {
        return serveDashboard(req, res);
      }

      // Route: Current metrics
      if (pathname === '/api/current') {
        return serveCurrentMetrics(req, res, monitor);
      }

      // Route: All metrics
      if (pathname === '/api/metrics') {
        return serveMetrics(req, res, monitor);
      }

      // Route: History
      if (pathname === '/api/history') {
        const count = parseInt(query.count) || undefined;
        return serveHistory(req, res, monitor, count);
      }

      // Route: Health status
      if (pathname === '/api/health') {
        return serveHealth(req, res, monitor, query.thresholds);
      }

      // Route: Time series data
      if (pathname === '/api/timeseries') {
        const metric = query.metric || 'lag';
        const count = parseInt(query.count) || 60;
        return serveTimeSeries(req, res, monitor, metric, count);
      }

      // Route: Aggregated metrics
      if (pathname === '/api/aggregated') {
        const duration = parseInt(query.duration) || undefined;
        return serveAggregated(req, res, monitor, duration);
      }

      // Route: Configuration
      if (pathname === '/api/config') {
        return serveConfig(req, res, monitor);
      }

      // Route: Dashboard data (optimized for frontend)
      if (pathname === '/api/dashboard') {
        return serveDashboardData(req, res, monitor);
      }

      // Route: Export metrics
      if (pathname === '/api/export') {
        const count = parseInt(query.count) || undefined;
        return serveExport(req, res, monitor, count);
      }

      // 404 - Not found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        message: 'Not found'
      }));
    } catch (error) {
      // 500 - Internal server error
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(api.handleError(error)));
    }
  };

  return router;
}

/**
 * Serve the dashboard HTML
 */
function serveDashboard(req, res) {
  const dashboardPath = path.join(__dirname, 'dashboard.html');
  
  fs.readFile(dashboardPath, 'utf8', (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading dashboard');
      return;
    }

    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
}

/**
 * Serve current metrics
 */
function serveCurrentMetrics(req, res, monitor) {
  const data = api.getCurrentMetrics(monitor);
  sendJSON(res, data);
}

/**
 * Serve all metrics
 */
function serveMetrics(req, res, monitor) {
  const data = api.getMetricsResponse(monitor);
  sendJSON(res, data);
}

/**
 * Serve historical metrics
 */
function serveHistory(req, res, monitor, count) {
  const data = api.getHistoryMetrics(monitor, count);
  sendJSON(res, data);
}

/**
 * Serve health status
 */
function serveHealth(req, res, monitor, thresholdsQuery) {
  let thresholds;
  if (thresholdsQuery) {
    try {
      thresholds = JSON.parse(thresholdsQuery);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }
  
  const data = api.getHealthStatus(monitor, thresholds);
  sendJSON(res, data);
}

/**
 * Serve time series data
 */
function serveTimeSeries(req, res, monitor, metric, count) {
  const data = api.getTimeSeriesData(monitor, metric, count);
  sendJSON(res, data);
}

/**
 * Serve aggregated metrics
 */
function serveAggregated(req, res, monitor, duration) {
  const data = api.getAggregatedMetrics(monitor, duration);
  sendJSON(res, data);
}

/**
 * Serve configuration
 */
function serveConfig(req, res, monitor) {
  const data = api.getMonitorConfig(monitor);
  sendJSON(res, data);
}

/**
 * Serve dashboard-optimized data
 */
function serveDashboardData(req, res, monitor) {
  const data = api.getDashboardData(monitor);
  sendJSON(res, data);
}

/**
 * Serve exported metrics
 */
function serveExport(req, res, monitor, count) {
  const data = api.exportMetrics(monitor, count);
  
  if (data.status === 'ok') {
    // Send as downloadable JSON file
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="event-loop-metrics-${Date.now()}.json"`,
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(data.data, null, 2));
  } else {
    sendJSON(res, data);
  }
}

/**
 * Helper: Send JSON response
 */
function sendJSON(res, data) {
  const statusCode = data.status === 'ok' ? 200 : 
                     data.status === 'error' ? 500 : 200;
  
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*' // Allow CORS for API endpoints
  });
  res.end(JSON.stringify(data, null, 2));
}

module.exports = createDashboardRoutes;