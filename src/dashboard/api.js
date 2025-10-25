/**
 * Dashboard API Handlers
 * 
 * Provides data formatting and processing for dashboard endpoints
 * 
 * @module dashboard/api
 */

/**
 * Format metrics response for API consumers
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Formatted metrics response
 */
function getMetricsResponse(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active',
      data: null
    };
  }

  const metrics = monitor.getMetrics();
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    data: metrics
  };
}

/**
 * Get current metrics snapshot
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Current metrics
 */
function getCurrentMetrics(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const current = monitor.getCurrentMetrics();
  
  if (!current) {
    return {
      status: 'error',
      message: 'No metrics available yet'
    };
  }

  return {
    status: 'ok',
    timestamp: Date.now(),
    data: current
  };
}

/**
 * Get historical metrics
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {number} count - Number of samples to retrieve
 * @returns {Object} Historical metrics
 */
function getHistoryMetrics(monitor, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const history = monitor.getHistory(count);
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    count: history.length,
    data: history
  };
}

/**
 * Get health status
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {Object} thresholds - Optional custom thresholds
 * @returns {Object} Health status
 */
function getHealthStatus(monitor, thresholds) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const health = monitor.getHealth(thresholds);
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    data: health
  };
}

/**
 * Get time series data for charting
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {string} metric - Metric name ('lag', 'elu', 'requests')
 * @param {number} count - Number of samples
 * @returns {Object} Time series data
 */
function getTimeSeriesData(monitor, metric, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const metrics = monitor.getMetrics();
  if (!metrics.current) {
    return {
      status: 'error',
      message: 'No metrics available yet'
    };
  }

  const timeSeries = monitor.metricsCollector.getTimeSeries(metric, count);
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    metric: metric,
    count: timeSeries.length,
    data: timeSeries
  };
}

/**
 * Get aggregated statistics
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {number} duration - Time window in milliseconds
 * @returns {Object} Aggregated metrics
 */
function getAggregatedMetrics(monitor, duration) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const aggregated = monitor.metricsCollector.getAggregatedMetrics(duration);
  
  if (!aggregated) {
    return {
      status: 'error',
      message: 'Not enough data for aggregation'
    };
  }

  return {
    status: 'ok',
    timestamp: Date.now(),
    data: aggregated
  };
}

/**
 * Get monitor configuration
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Configuration info
 */
function getMonitorConfig(monitor) {
  if (!monitor) {
    return {
      status: 'error',
      message: 'Monitor not available'
    };
  }

  const config = monitor.getConfig();
  const stats = monitor.metricsCollector.getStats();
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    data: {
      config,
      stats
    }
  };
}

/**
 * Format metrics for dashboard consumption
 * Optimized payload for frontend
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Dashboard-optimized metrics
 */
function getDashboardData(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active',
      data: null
    };
  }

  const current = monitor.getCurrentMetrics();
  const health = monitor.getHealth();
  const history = monitor.getHistory(60); // Last 60 samples (1 minute at 100ms intervals)

  if (!current) {
    return {
      status: 'error',
      message: 'No metrics available yet',
      data: null
    };
  }

  // Extract time series for charts
  const lagTimeSeries = history.map(s => ({
    t: s.timestamp,
    mean: s.lag.mean,
    p95: s.lag.p95,
    p99: s.lag.p99
  }));

  const eluTimeSeries = history.map(s => ({
    t: s.timestamp,
    utilization: s.elu.utilization * 100 // Convert to percentage
  }));

  const requestTimeSeries = history.map(s => ({
    t: s.timestamp,
    count: s.requests.count,
    avgTime: s.requests.avgTime
  }));

  return {
    status: 'ok',
    timestamp: Date.now(),
    data: {
      current: {
        lag: {
          mean: current.lag.mean,
          p50: current.lag.p50,
          p95: current.lag.p95,
          p99: current.lag.p99,
          max: current.lag.max
        },
        elu: {
          utilization: current.elu.utilization * 100, // Percentage
          active: current.elu.active,
          idle: current.elu.idle
        },
        requests: current.requests
      },
      health: {
        status: health.status,
        score: health.score,
        message: health.message,
        issues: health.issues
      },
      timeSeries: {
        lag: lagTimeSeries,
        elu: eluTimeSeries,
        requests: requestTimeSeries
      }
    }
  };
}

/**
 * Export metrics as JSON
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @param {number} count - Number of samples to export
 * @returns {Object} Exported data
 */
function exportMetrics(monitor, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  try {
    const json = monitor.metricsCollector.exportJSON(count);
    
    return {
      status: 'ok',
      timestamp: Date.now(),
      count: count,
      data: JSON.parse(json)
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Export failed: ${error.message}`
    };
  }
}

/**
 * Handle errors and send appropriate response
 * 
 * @param {Error} error - Error object
 * @returns {Object} Error response
 */
function handleError(error) {
  return {
    status: 'error',
    timestamp: Date.now(),
    message: error.message || 'Internal server error'
  };
}

module.exports = {
  getMetricsResponse,
  getCurrentMetrics,
  getHistoryMetrics,
  getHealthStatus,
  getTimeSeriesData,
  getAggregatedMetrics,
  getMonitorConfig,
  getDashboardData,
  exportMetrics,
  handleError
};