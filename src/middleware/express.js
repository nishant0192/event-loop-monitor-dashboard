/**
 * Express Middleware for Event Loop Monitoring
 *
 * Provides zero-config integration with Express applications:
 * - Automatic request tracking
 * - Dashboard route mounting
 * - Optional alerting
 *
 * @module middleware/express
 */

const EventLoopMonitor = require("../core/EventLoopMonitor");

// Global monitor instance (shared across middleware calls)
let globalMonitor = null;
let globalAlertManager = null;

/**
 * Get or create the global monitor instance
 * @private
 */
function getOrCreateMonitor(options) {
  if (!globalMonitor) {
    globalMonitor = new EventLoopMonitor({
      sampleInterval: options.sampleInterval,
      historySize: options.historySize,
      resolution: options.resolution,
    });
    globalMonitor.start();
  }
  return globalMonitor;
}

/**
 * Setup alert manager if alerting is configured
 * @private
 */
function setupAlertManager(monitor, options) {
  if (!options.onAlert && !options.thresholds) {
    return null; // No alerting configured
  }

  // Lazy load AlertManager
  const AlertManager = require("../alerts/AlertManager");

  if (!globalAlertManager) {
    globalAlertManager = new AlertManager(monitor, {
      thresholds: options.thresholds,
      onAlert: options.onAlert,
    });
    globalAlertManager.start();
  }

  return globalAlertManager;
}

/**
 * Create Express middleware for event loop monitoring
 *
 * @param {Object} [options] - Configuration options
 * @param {string} [options.path='/event-loop-stats'] - Dashboard route path
 * @param {number} [options.sampleInterval=100] - Sampling interval in ms
 * @param {number} [options.historySize=300] - Number of samples to retain
 * @param {number} [options.resolution=10] - Histogram resolution
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
 * app.use(eventLoopMonitor({
 *   path: '/monitoring',
 *   thresholds: {
 *     lagWarning: 50,
 *     lagCritical: 100
 *   },
 *   onAlert: (alert) => {
 *     console.error('Event Loop Alert:', alert);
 *   }
 * }));
 */
function createMiddleware(options = {}) {
  // Default options
  const config = {
    path: options.path || "/event-loop-stats",
    sampleInterval: options.sampleInterval || 100,
    historySize: options.historySize || 300,
    resolution: options.resolution || 10,
    thresholds: options.thresholds,
    onAlert: options.onAlert,
  };

  // Normalize path (ensure it starts with /)
  if (!config.path.startsWith("/")) {
    config.path = "/" + config.path;
  }

  // Get or create monitor instance
  const monitor = getOrCreateMonitor(config);

  // Setup alert manager if configured
  const alertManager = setupAlertManager(monitor, config);

  // Lazy load dashboard routes
  let dashboardRouter = null;
  function getDashboardRouter() {
    if (!dashboardRouter) {
      const createDashboardRoutes = require("../dashboard/routes");
      dashboardRouter = createDashboardRoutes(monitor);
    }
    return dashboardRouter;
  }

  // Main middleware function
  return function eventLoopMiddleware(req, res, next) {
    // Check if this request is for the dashboard

    if (req.path === config.path) {
      // Redirect to version with trailing slash for proper relative URL resolution
      return res.redirect(301, config.path + "/");
    }

    if (req.path === config.path || req.path.startsWith(config.path + "/")) {
      // Mount dashboard routes
      const router = getDashboardRouter();

      // Adjust path for sub-router
      const originalUrl = req.url;
      const originalPath = req.path;

      // Strip the base path so the dashboard router sees relative paths
      if (req.url.startsWith(config.path)) {
        req.url = req.url.slice(config.path.length) || "/";
      }
      if (req.path.startsWith(config.path)) {
        req.path = req.path.slice(config.path.length) || "/";
      }

      // Handle the request with dashboard router
      router(req, res, (err) => {
        // Restore original paths
        req.url = originalUrl;
        req.path = originalPath;

        if (err) {
          next(err);
        } else {
          // If router didn't handle it, continue
          next();
        }
      });

      return;
    }

    // Track request timing for non-dashboard requests
    const startTime = Date.now();

    // Capture the original res.end to measure request duration
    const originalEnd = res.end;

    res.end = function (...args) {
      // Calculate request duration
      const duration = Date.now() - startTime;

      // Track in monitor
      monitor.trackRequest(duration);

      // Call original end
      originalEnd.apply(res, args);
    };

    // Continue to next middleware
    next();
  };
}

/**
 * Get the global monitor instance
 * Useful for accessing metrics outside of middleware
 *
 * @returns {EventLoopMonitor|null} Global monitor instance or null if not initialized
 */
function getGlobalMonitor() {
  return globalMonitor;
}

/**
 * Get the global alert manager instance
 *
 * @returns {AlertManager|null} Global alert manager or null if not initialized
 */
function getGlobalAlertManager() {
  return globalAlertManager;
}

/**
 * Stop and cleanup global instances
 * Useful for testing or graceful shutdown
 */
function cleanup() {
  if (globalAlertManager) {
    globalAlertManager.stop();
    globalAlertManager = null;
  }

  if (globalMonitor) {
    globalMonitor.stop();
    globalMonitor = null;
  }
}

// Main export
module.exports = createMiddleware;

// Additional exports
module.exports.getGlobalMonitor = getGlobalMonitor;
module.exports.getGlobalAlertManager = getGlobalAlertManager;
module.exports.cleanup = cleanup;
