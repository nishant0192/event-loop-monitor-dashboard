/**
 * Event Loop Monitor Dashboard
 * 
 * Lightweight, zero-config event loop health monitoring with built-in dashboard
 * for Node.js applications.
 * 
 * @module event-loop-monitor-dashboard
 */

const EventLoopMonitor = require('./core/EventLoopMonitor');
const MetricsCollector = require('./core/MetricsCollector');

// Lazy-loaded optional dependencies (private - prefixed with _)
let _expressMiddleware;
let _prometheusExporter;
let _alertManager;
let _dashboardRoutes;

/**
 * Get Express middleware (lazy-loaded)
 * @private
 */
function getExpressMiddleware() {
  if (!_expressMiddleware) {
    _expressMiddleware = require('./middleware/express');
  }
  return _expressMiddleware;
}

/**
 * Get Prometheus exporter (lazy-loaded)
 * @private
 */
function getPrometheusExporter() {
  if (!_prometheusExporter) {
    _prometheusExporter = require('./exporters/prometheus');
  }
  return _prometheusExporter;
}

/**
 * Get Alert Manager (lazy-loaded)
 * @private
 */
function getAlertManager() {
  if (!_alertManager) {
    _alertManager = require('./alerts/AlertManager');
  }
  return _alertManager;
}

/**
 * Get Dashboard Routes (lazy-loaded)
 * @private
 */
function _getDashboardRoutes() {
  if (!_dashboardRoutes) {
    _dashboardRoutes = require('./dashboard/routes');
  }
  return _dashboardRoutes;
}

/**
 * Create Express middleware for event loop monitoring
 * 
 * @param {Object} [options] - Configuration options
 * @param {string} [options.path='/event-loop-stats'] - Dashboard route path
 * @param {number} [options.sampleInterval=100] - Sampling interval in ms
 * @param {number} [options.historySize=300] - Number of samples to retain
 * @param {Object} [options.thresholds] - Alert thresholds
 * @param {number} [options.thresholds.lagWarning=50] - Warning lag threshold (ms)
 * @param {number} [options.thresholds.lagCritical=100] - Critical lag threshold (ms)
 * @param {number} [options.thresholds.eluWarning=0.7] - Warning ELU threshold (0-1)
 * @param {number} [options.thresholds.eluCritical=0.9] - Critical ELU threshold (0-1)
 * @param {Function} [options.onAlert] - Alert callback function
 * @returns {Function} Express middleware
 * 
 * @example
 * const express = require('express');
 * const { eventLoopMonitor } = require('event-loop-monitor-dashboard');
 * 
 * const app = express();
 * app.use(eventLoopMonitor());
 * 
 * // Dashboard available at: http://localhost:3000/event-loop-stats
 */
function eventLoopMonitor(options = {}) {
  const middleware = getExpressMiddleware();
  return middleware(options);
}

/**
 * Create Prometheus metrics exporter
 * 
 * @param {EventLoopMonitor} [monitor] - Optional monitor instance (uses global if not provided)
 * @returns {Function} Express middleware for /metrics endpoint
 * 
 * @example
 * const { prometheusExporter } = require('event-loop-monitor-dashboard');
 * 
 * app.get('/metrics', prometheusExporter());
 */
function prometheusExporter(monitor) {
  const exporter = getPrometheusExporter();
  return exporter(monitor);
}

/**
 * Create an Alert Manager instance
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance to attach to
 * @param {Object} [options] - Alert configuration
 * @returns {AlertManager} Alert manager instance
 * 
 * @example
 * const monitor = new EventLoopMonitor();
 * const alerts = createAlertManager(monitor, {
 *   thresholds: {
 *     lagWarning: 50,
 *     lagCritical: 100
 *   },
 *   onAlert: (alert) => {
 *     console.error('Alert:', alert);
 *   }
 * });
 */
function createAlertManager(monitor, options) {
  const AlertManager = getAlertManager();
  return new AlertManager(monitor, options);
}

/**
 * Create a standalone monitor instance
 * 
 * @param {Object} [options] - Configuration options
 * @param {number} [options.sampleInterval=100] - Sampling interval in ms
 * @param {number} [options.historySize=300] - Number of samples to retain
 * @returns {EventLoopMonitor} Monitor instance
 * 
 * @example
 * const { createMonitor } = require('event-loop-monitor-dashboard');
 * 
 * const monitor = createMonitor({ sampleInterval: 50 });
 * monitor.start();
 * 
 * setInterval(() => {
 *   const metrics = monitor.getCurrentMetrics();
 *   console.log('Lag:', metrics.lag.mean, 'ms');
 * }, 5000);
 */
function createMonitor(options) {
  return new EventLoopMonitor(options);
}

/**
 * Get or create the global monitor instance
 * Useful for sharing a single monitor across modules
 * 
 * @returns {EventLoopMonitor} Global monitor instance
 * 
 * @example
 * const { getGlobalMonitor } = require('event-loop-monitor-dashboard');
 * 
 * const monitor = getGlobalMonitor();
 * if (!monitor.isActive()) {
 *   monitor.start();
 * }
 */
let globalMonitor = null;
function getGlobalMonitor() {
  if (!globalMonitor) {
    globalMonitor = new EventLoopMonitor();
  }
  return globalMonitor;
}

/**
 * Quick start helper - creates and starts monitoring with Express
 * 
 * @param {Object} app - Express app instance
 * @param {Object} [options] - Configuration options
 * @returns {EventLoopMonitor} Monitor instance
 * 
 * @example
 * const express = require('express');
 * const { quickStart } = require('event-loop-monitor-dashboard');
 * 
 * const app = express();
 * const monitor = quickStart(app);
 * 
 * // Dashboard automatically available at /event-loop-stats
 */
function quickStart(app, options = {}) {
  if (!app || typeof app.use !== 'function') {
    throw new Error('quickStart requires an Express app instance');
  }
  
  app.use(eventLoopMonitor(options));
  return getGlobalMonitor();
}

// Main exports
module.exports = {
  // Core classes
  EventLoopMonitor,
  MetricsCollector,
  
  // High-level API (recommended)
  eventLoopMonitor,
  prometheusExporter,
  createAlertManager,
  
  // Utility functions
  createMonitor,
  getGlobalMonitor,
  quickStart,
  
  // Aliases for convenience
  monitor: eventLoopMonitor,
  middleware: eventLoopMonitor,
  
  // Version info (try to load, fallback to unknown)
  get version() {
    try {
      return require('../package.json').version;
    } catch (error) {
      return 'unknown';
    }
  },
  
  // Low-level access (advanced users)
  core: {
    EventLoopMonitor,
    MetricsCollector
  }
};

// Default export (for ES module compatibility)
module.exports.default = module.exports;