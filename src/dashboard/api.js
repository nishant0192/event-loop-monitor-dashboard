/**
 * Complete Dashboard API Handlers
 *
 * This file includes ALL functions required by routes.js
 */

// ============================================================================
// EXISTING FUNCTIONS FROM YOUR FILE
// ============================================================================

function getDashboardData(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
      data: null,
    };
  }

  const current = monitor.getCurrentMetrics();
  const health = monitor.getHealth();
  const history = monitor.getHistory(300);

  if (!current) {
    return {
      status: "error",
      message: "No metrics available yet",
      data: null,
    };
  }

  const timeSeries = {
    lag: history.map((s) => ({
      t: s.timestamp,
      mean: s.lag.mean,
      p50: s.lag.p50,
      p95: s.lag.p95,
      p99: s.lag.p99,
      max: s.lag.max,
    })),
    elu: history.map((s) => ({
      t: s.timestamp,
      utilization: s.elu.utilization * 100,
    })),
    memory: history.map((s) => ({
      t: s.timestamp,
      heapUsedMB: s.memory ? s.memory.heapUsedMB : 0,
      heapTotalMB: s.memory ? s.memory.heapTotalMB : 0,
      rssMB: s.memory ? s.memory.rssMB : 0,
    })),
    requests: history.map((s) => ({
      t: s.timestamp,
      count: s.requests.count,
      avgTime: s.requests.avgTime,
    })),
    cpu: history.map((s) => ({
      t: s.timestamp,
      total: s.cpu ? s.cpu.total : 0,
    })),
    handles: history.map((s) => ({
      t: s.timestamp,
      active: s.handles ? s.handles.active : 0,
      requests: s.handles ? s.handles.requests : 0,
      total: s.handles ? s.handles.total : 0,
    })),
  };

  const trends = calculateTrends(history);
  const insights = generateInsights(current, history, health);
  const aggregated = calculateAggregatedStats(history);

  return {
    status: "ok",
    timestamp: Date.now(),
    data: {
      current: {
        lag: {
          mean: current.lag.mean,
          p50: current.lag.p50,
          p95: current.lag.p95,
          p99: current.lag.p99,
          max: current.lag.max,
        },
        elu: {
          utilization: current.elu.utilization * 100,
          active: current.elu.active,
          idle: current.elu.idle,
        },
        memory: current.memory
          ? {
              heapUsedMB: current.memory.heapUsedMB,
              heapTotalMB: current.memory.heapTotalMB,
              rssMB: current.memory.rssMB,
              external: (current.memory.external / 1024 / 1024).toFixed(2),
            }
          : null,
        cpu: current.cpu
          ? {
              user: current.cpu.user,
              system: current.cpu.system,
              total: current.cpu.total,
            }
          : null,
        handles: current.handles
          ? {
              active: current.handles.active,
              requests: current.handles.requests,
              total: current.handles.total,
            }
          : null,
        requests: current.requests,
      },
      health: {
        status: health.status,
        score: health.score,
        message: health.message,
        issues: health.issues,
      },
      timeSeries,
      trends,
      insights,
      aggregated,
    },
  };
}

function getCurrentMetrics(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  const current = monitor.getCurrentMetrics();

  if (!current) {
    return {
      status: "error",
      message: "No metrics available yet",
    };
  }

  return {
    status: "ok",
    timestamp: Date.now(),
    data: current,
  };
}

function getHealthStatus(monitor, thresholds) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  const health = monitor.getHealth(thresholds);
  const current = monitor.getCurrentMetrics();

  const enhancedHealth = {
    ...health,
    details: {
      lagStatus:
        current.lag.mean > 100
          ? "critical"
          : current.lag.mean > 50
          ? "warning"
          : "healthy",
      eluStatus:
        current.elu.utilization > 0.9
          ? "critical"
          : current.elu.utilization > 0.7
          ? "warning"
          : "healthy",
      memoryStatus:
        current.memory &&
        parseFloat(current.memory.heapUsedMB) /
          parseFloat(current.memory.heapTotalMB) >
          0.9
          ? "critical"
          : "healthy",
    },
  };

  return {
    status: "ok",
    timestamp: Date.now(),
    data: enhancedHealth,
  };
}

function exportMetrics(monitor, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    const history = monitor.getHistory(count);
    const current = monitor.getCurrentMetrics();
    const health = monitor.getHealth();
    const insights = generateInsights(current, history, health);

    return {
      status: "ok",
      timestamp: Date.now(),
      count: history.length,
      data: {
        metadata: {
          exportDate: new Date().toISOString(),
          sampleCount: history.length,
          timeRange:
            history.length > 0
              ? {
                  start: new Date(history[0].timestamp).toISOString(),
                  end: new Date(
                    history[history.length - 1].timestamp
                  ).toISOString(),
                }
              : null,
        },
        current,
        health,
        insights,
        history,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Export failed: ${error.message}`,
    };
  }
}

// ============================================================================
// MISSING FUNCTIONS - ADD THESE TO YOUR FILE
// ============================================================================

/**
 * Get all metrics (called by /api/metrics endpoint)
 */
function getMetricsResponse(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    const metrics = monitor.getMetrics();
    return {
      status: "ok",
      timestamp: Date.now(),
      data: metrics,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Failed to get metrics: ${error.message}`,
    };
  }
}

/**
 * Get historical metrics (called by /api/history endpoint)
 */
function getHistoryMetrics(monitor, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    const history = monitor.getHistory(count);
    return {
      status: "ok",
      timestamp: Date.now(),
      count: history.length,
      data: history,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Failed to get history: ${error.message}`,
    };
  }
}

/**
 * Get time series data for a specific metric (called by /api/timeseries endpoint)
 */
function getTimeSeriesData(monitor, metric, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    const history = monitor.getHistory(count);

    let timeSeries;
    switch (metric) {
      case "lag":
        timeSeries = history.map((s) => ({
          timestamp: s.timestamp,
          min: s.lag.min,
          max: s.lag.max,
          mean: s.lag.mean,
          p50: s.lag.p50,
          p95: s.lag.p95,
          p99: s.lag.p99,
        }));
        break;

      case "elu":
        timeSeries = history.map((s) => ({
          timestamp: s.timestamp,
          utilization: s.elu.utilization,
          active: s.elu.active,
          idle: s.elu.idle,
        }));
        break;

      case "memory":
        timeSeries = history.map((s) => ({
          timestamp: s.timestamp,
          heapUsed: s.memory ? parseFloat(s.memory.heapUsedMB) : 0,
          heapTotal: s.memory ? parseFloat(s.memory.heapTotalMB) : 0,
          rss: s.memory ? parseFloat(s.memory.rssMB) : 0,
        }));
        break;

      case "requests":
        timeSeries = history.map((s) => ({
          timestamp: s.timestamp,
          count: s.requests.count,
          avgTime: s.requests.avgTime,
        }));
        break;

      default:
        return {
          status: "error",
          message: `Unknown metric: ${metric}`,
        };
    }

    return {
      status: "ok",
      timestamp: Date.now(),
      metric,
      count: timeSeries.length,
      data: timeSeries,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Failed to get time series: ${error.message}`,
    };
  }
}

/**
 * Get aggregated metrics over a duration (called by /api/aggregated endpoint)
 */
function getAggregatedMetrics(monitor, duration) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    // If duration specified, filter history to that time window
    let history = monitor.getHistory();
    if (duration) {
      const cutoff = Date.now() - duration;
      history = history.filter((s) => s.timestamp >= cutoff);
    }

    const aggregated = calculateAggregatedStats(history);

    return {
      status: "ok",
      timestamp: Date.now(),
      duration: duration || "all",
      sampleCount: history.length,
      data: aggregated,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Failed to get aggregated metrics: ${error.message}`,
    };
  }
}

/**
 * Get monitor configuration (called by /api/config endpoint)
 */
function getMonitorConfig(monitor) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: "error",
      message: "Monitor not active",
    };
  }

  try {
    const config = monitor.getConfig();
    return {
      status: "ok",
      timestamp: Date.now(),
      data: config,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Failed to get config: ${error.message}`,
    };
  }
}

/**
 * Handle and format errors (called by error handler in routes)
 */
function handleError(error) {
  return {
    status: "error",
    message: error.message || "Internal server error",
    timestamp: Date.now(),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateTrends(history) {
  if (history.length < 2) {
    return {
      lag: { change: 0, direction: "stable" },
      elu: { change: 0, direction: "stable" },
      memory: { change: 0, direction: "stable" },
      requests: { change: 0, direction: "stable" },
    };
  }

  const recent = history.slice(-10);
  const earlier = history.slice(-20, -10);

  const recentAvg = {
    lag: calculateMean(recent.map((s) => s.lag.mean)),
    elu: calculateMean(recent.map((s) => s.elu.utilization)),
    memory: calculateMean(
      recent.map((s) => (s.memory ? parseFloat(s.memory.heapUsedMB) : 0))
    ),
    requests: calculateMean(recent.map((s) => s.requests.count)),
  };

  const earlierAvg = {
    lag: calculateMean(earlier.map((s) => s.lag.mean)),
    elu: calculateMean(earlier.map((s) => s.elu.utilization)),
    memory: calculateMean(
      earlier.map((s) => (s.memory ? parseFloat(s.memory.heapUsedMB) : 0))
    ),
    requests: calculateMean(earlier.map((s) => s.requests.count)),
  };

  return {
    lag: calculateTrend(recentAvg.lag, earlierAvg.lag),
    elu: calculateTrend(recentAvg.elu, earlierAvg.elu),
    memory: calculateTrend(recentAvg.memory, earlierAvg.memory),
    requests: calculateTrend(recentAvg.requests, earlierAvg.requests),
  };
}

function calculateTrend(current, previous) {
  if (previous === 0) {
    return { change: 0, direction: "stable" };
  }

  const change = ((current - previous) / previous) * 100;
  const absChange = Math.abs(change);

  let direction = "stable";
  if (absChange > 5) {
    direction = change > 0 ? "up" : "down";
  }

  return {
    change: Math.round(absChange),
    direction,
  };
}

function calculateMean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function generateInsights(current, history, health) {
  const insights = [];

  if (current.lag.mean > 50) {
    const severity = current.lag.mean > 100 ? "critical" : "warning";
    insights.push({
      type: "lag",
      severity,
      title: "Event Loop Blocking Detected",
      message: `Average lag is ${current.lag.mean.toFixed(2)}ms. ${
        current.lag.mean > 100
          ? "This is critically high."
          : "This is higher than optimal."
      }`,
      recommendation:
        "Profile your application to identify synchronous operations.",
      timestamp: Date.now(),
    });
  }

  if (current.elu.utilization > 0.7) {
    const severity = current.elu.utilization > 0.9 ? "critical" : "warning";
    insights.push({
      type: "cpu",
      severity,
      title: "High CPU Utilization",
      message: `Event loop is ${(current.elu.utilization * 100).toFixed(
        1
      )}% utilized.`,
      recommendation:
        severity === "critical"
          ? "Consider horizontal scaling."
          : "Monitor for continued high utilization.",
      timestamp: Date.now(),
    });
  }

  if (current.memory) {
    const heapUsed = parseFloat(current.memory.heapUsedMB);
    const heapTotal = parseFloat(current.memory.heapTotalMB);
    const usagePercent = (heapUsed / heapTotal) * 100;

    if (usagePercent > 80) {
      insights.push({
        type: "memory-high",
        severity: usagePercent > 90 ? "critical" : "warning",
        title: "High Memory Usage",
        message: `Heap is ${usagePercent.toFixed(
          1
        )}% full (${heapUsed}MB / ${heapTotal}MB).`,
        recommendation:
          "Review object retention and consider memory optimization.",
        timestamp: Date.now(),
      });
    }
  }

  if (health.status === "healthy" && insights.length === 0) {
    insights.push({
      type: "optimization",
      severity: "info",
      title: "System Performing Optimally",
      message: "All metrics are within healthy ranges.",
      recommendation:
        "Consider implementing caching and connection pooling for further optimization.",
      timestamp: Date.now(),
    });
  }

  return insights;
}

function calculateAggregatedStats(history) {
  if (history.length === 0) {
    return null;
  }

  const lagValues = history.map((s) => s.lag.mean);
  const eluValues = history.map((s) => s.elu.utilization);
  const memValues = history
    .map((s) => (s.memory ? parseFloat(s.memory.heapUsedMB) : 0))
    .filter((v) => v > 0);

  return {
    lag: {
      min: Math.min(...lagValues),
      max: Math.max(...lagValues),
      avg: calculateMean(lagValues),
      p95: calculatePercentile(lagValues, 95),
      p99: calculatePercentile(lagValues, 99),
    },
    elu: {
      min: Math.min(...eluValues) * 100,
      max: Math.max(...eluValues) * 100,
      avg: calculateMean(eluValues) * 100,
    },
    memory:
      memValues.length > 0
        ? {
            min: Math.min(...memValues),
            max: Math.max(...memValues),
            avg: calculateMean(memValues),
          }
        : null,
  };
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// EXPORTS - COMPLETE LIST
// ============================================================================

module.exports = {
  // Dashboard functions
  getDashboardData,
  getCurrentMetrics,
  getHealthStatus,
  exportMetrics,

  // Additional API functions (THESE WERE MISSING!)
  getMetricsResponse,
  getHistoryMetrics,
  getTimeSeriesData,
  getAggregatedMetrics,
  getMonitorConfig,
  handleError,

  // Helper functions
  generateInsights,
  calculateTrends,
  calculateAggregatedStats,
};
