/**
 * Enhanced Dashboard API Handlers
 * 
 * Provides comprehensive, actionable metrics including:
 * - Event loop lag and utilization
 * - Memory usage and trends
 * - CPU metrics
 * - Active handles/requests
 * - Intelligent insights and recommendations
 * 
 * @module dashboard/api-enhanced
 */

/**
 * Get comprehensive dashboard data with all metrics
 * 
 * @param {EventLoopMonitor} monitor - Monitor instance
 * @returns {Object} Complete dashboard data
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
  const history = monitor.getHistory(300); // Last 5 minutes

  if (!current) {
    return {
      status: 'error',
      message: 'No metrics available yet',
      data: null
    };
  }

  // Extract time series for all metrics
  const timeSeries = {
    lag: history.map(s => ({
      t: s.timestamp,
      mean: s.lag.mean,
      p50: s.lag.p50,
      p95: s.lag.p95,
      p99: s.lag.p99,
      max: s.lag.max
    })),
    elu: history.map(s => ({
      t: s.timestamp,
      utilization: s.elu.utilization * 100 // Convert to percentage
    })),
    memory: history.map(s => ({
      t: s.timestamp,
      heapUsedMB: s.memory ? s.memory.heapUsedMB : 0,
      heapTotalMB: s.memory ? s.memory.heapTotalMB : 0,
      rssMB: s.memory ? s.memory.rssMB : 0
    })),
    requests: history.map(s => ({
      t: s.timestamp,
      count: s.requests.count,
      avgTime: s.requests.avgTime
    })),
    cpu: history.map(s => ({
      t: s.timestamp,
      total: s.cpu ? s.cpu.total : 0
    })),
    handles: history.map(s => ({
      t: s.timestamp,
      active: s.handles ? s.handles.active : 0,
      requests: s.handles ? s.handles.requests : 0,
      total: s.handles ? s.handles.total : 0
    }))
  };

  // Calculate trends
  const trends = calculateTrends(history);

  // Generate actionable insights
  const insights = generateInsights(current, history, health);

  // Calculate aggregated statistics
  const aggregated = calculateAggregatedStats(history);

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
        memory: current.memory ? {
          heapUsedMB: current.memory.heapUsedMB,
          heapTotalMB: current.memory.heapTotalMB,
          rssMB: current.memory.rssMB,
          external: (current.memory.external / 1024 / 1024).toFixed(2)
        } : null,
        cpu: current.cpu ? {
          user: current.cpu.user,
          system: current.cpu.system,
          total: current.cpu.total
        } : null,
        handles: current.handles ? {
          active: current.handles.active,
          requests: current.handles.requests,
          total: current.handles.total
        } : null,
        requests: current.requests
      },
      health: {
        status: health.status,
        score: health.score,
        message: health.message,
        issues: health.issues
      },
      timeSeries,
      trends,
      insights,
      aggregated
    }
  };
}

/**
 * Calculate trends for key metrics
 */
function calculateTrends(history) {
  if (history.length < 2) {
    return {
      lag: { change: 0, direction: 'stable' },
      elu: { change: 0, direction: 'stable' },
      memory: { change: 0, direction: 'stable' },
      requests: { change: 0, direction: 'stable' }
    };
  }

  const recent = history.slice(-10);
  const earlier = history.slice(-20, -10);

  const recentAvg = {
    lag: calculateMean(recent.map(s => s.lag.mean)),
    elu: calculateMean(recent.map(s => s.elu.utilization)),
    memory: calculateMean(recent.map(s => s.memory ? parseFloat(s.memory.heapUsedMB) : 0)),
    requests: calculateMean(recent.map(s => s.requests.count))
  };

  const earlierAvg = {
    lag: calculateMean(earlier.map(s => s.lag.mean)),
    elu: calculateMean(earlier.map(s => s.elu.utilization)),
    memory: calculateMean(earlier.map(s => s.memory ? parseFloat(s.memory.heapUsedMB) : 0)),
    requests: calculateMean(earlier.map(s => s.requests.count))
  };

  return {
    lag: calculateTrend(recentAvg.lag, earlierAvg.lag),
    elu: calculateTrend(recentAvg.elu, earlierAvg.elu),
    memory: calculateTrend(recentAvg.memory, earlierAvg.memory),
    requests: calculateTrend(recentAvg.requests, earlierAvg.requests)
  };
}

/**
 * Calculate trend direction and percentage change
 */
function calculateTrend(current, previous) {
  if (previous === 0) {
    return { change: 0, direction: 'stable' };
  }

  const change = ((current - previous) / previous) * 100;
  const absChange = Math.abs(change);

  let direction = 'stable';
  if (absChange > 5) {
    direction = change > 0 ? 'up' : 'down';
  }

  return {
    change: Math.round(absChange),
    direction
  };
}

/**
 * Calculate mean of array
 */
function calculateMean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Generate actionable insights based on metrics
 */
function generateInsights(current, history, health) {
  const insights = [];

  // 1. Event Loop Lag Analysis
  if (current.lag.mean > 50) {
    const severity = current.lag.mean > 100 ? 'critical' : 'warning';
    insights.push({
      type: 'lag',
      severity,
      title: 'Event Loop Blocking Detected',
      message: `Average lag is ${current.lag.mean.toFixed(2)}ms. ${current.lag.mean > 100 ? 'This is critically high.' : 'This is higher than optimal.'}`,
      recommendation: 'Profile your application to identify synchronous operations. Consider using async alternatives for file I/O, database queries, and large JSON parsing.',
      timestamp: Date.now()
    });
  }

  // 2. Lag Spike Analysis
  if (history.length >= 60) {
    const last60 = history.slice(-60);
    const maxLag = Math.max(...last60.map(s => s.lag.p99));
    const avgLag = calculateMean(last60.map(s => s.lag.mean));
    
    if (maxLag > avgLag * 5 && maxLag > 50) {
      insights.push({
        type: 'lag-spike',
        severity: 'warning',
        title: 'Intermittent Lag Spikes',
        message: `Detected P99 lag spikes up to ${maxLag.toFixed(2)}ms, while average is ${avgLag.toFixed(2)}ms.`,
        recommendation: 'These spikes indicate occasional blocking operations. Check for large JSON parsing, synchronous crypto, or regex operations.',
        timestamp: Date.now()
      });
    }
  }

  // 3. CPU Utilization Analysis
  if (current.elu.utilization > 0.7) {
    const severity = current.elu.utilization > 0.9 ? 'critical' : 'warning';
    insights.push({
      type: 'cpu',
      severity,
      title: 'High CPU Utilization',
      message: `Event loop is ${(current.elu.utilization * 100).toFixed(1)}% utilized. ${current.elu.utilization > 0.9 ? 'System is under heavy load.' : 'System is experiencing increased load.'}`,
      recommendation: current.elu.utilization > 0.9 
        ? 'Consider horizontal scaling or optimizing hot code paths. Profile using --prof flag.'
        : 'Monitor for continued high utilization. Consider implementing request queuing or rate limiting.',
      timestamp: Date.now()
    });
  }

  // 4. Memory Trend Analysis
  if (history.length >= 60 && current.memory) {
    const last60 = history.slice(-60);
    const memValues = last60.map(s => s.memory ? parseFloat(s.memory.heapUsedMB) : 0).filter(v => v > 0);
    
    if (memValues.length > 10) {
      const firstHalf = memValues.slice(0, Math.floor(memValues.length / 2));
      const secondHalf = memValues.slice(Math.floor(memValues.length / 2));
      const firstAvg = calculateMean(firstHalf);
      const secondAvg = calculateMean(secondHalf);
      const increase = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (increase > 20) {
        insights.push({
          type: 'memory',
          severity: increase > 50 ? 'critical' : 'warning',
          title: 'Memory Usage Increasing',
          message: `Heap memory increased ${increase.toFixed(1)}% in the last minute. Currently at ${current.memory.heapUsedMB}MB.`,
          recommendation: 'Monitor for memory leaks. Check for accumulating caches, event listeners, or closures. Consider implementing heap snapshots.',
          timestamp: Date.now()
        });
      }
    }
  }

  // 5. High Memory Usage
  if (current.memory) {
    const heapUsed = parseFloat(current.memory.heapUsedMB);
    const heapTotal = parseFloat(current.memory.heapTotalMB);
    const usagePercent = (heapUsed / heapTotal) * 100;

    if (usagePercent > 80) {
      insights.push({
        type: 'memory-high',
        severity: usagePercent > 90 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Heap is ${usagePercent.toFixed(1)}% full (${heapUsed}MB / ${heapTotal}MB).`,
        recommendation: usagePercent > 90
          ? 'Memory pressure is critical. Garbage collection may be impacting performance. Consider increasing heap size or optimizing memory usage.'
          : 'Memory usage is high. Review object retention and consider implementing memory-efficient data structures.',
        timestamp: Date.now()
      });
    }
  }

  // 6. Active Handles Warning
  if (current.handles && current.handles.active > 1000) {
    insights.push({
      type: 'handles',
      severity: current.handles.active > 5000 ? 'critical' : 'warning',
      title: 'High Active Handle Count',
      message: `${current.handles.active} active handles detected. This may indicate resource leaks.`,
      recommendation: 'Check for unclosed database connections, file handles, or timers. Use diagnostic tools to identify leaking resources.',
      timestamp: Date.now()
    });
  }

  // 7. Request Rate Analysis
  if (history.length >= 60) {
    const last60 = history.slice(-60);
    const requestRates = last60.map(s => s.requests.count);
    const avgRate = calculateMean(requestRates);
    const maxRate = Math.max(...requestRates);

    if (maxRate > avgRate * 10 && maxRate > 50) {
      insights.push({
        type: 'traffic-spike',
        severity: 'info',
        title: 'Traffic Spike Detected',
        message: `Request rate spiked to ${maxRate * 10}req/s (avg: ${(avgRate * 10).toFixed(0)}req/s).`,
        recommendation: 'Monitor for continued high traffic. Ensure auto-scaling is configured if this pattern persists.',
        timestamp: Date.now()
      });
    }
  }

  // 8. Optimization Recommendations (for healthy systems)
  if (health.status === 'healthy' && insights.length === 0) {
    insights.push({
      type: 'optimization',
      severity: 'info',
      title: 'System Performing Optimally',
      message: 'All metrics are within healthy ranges. Consider these optimizations:',
      recommendation: '• Implement caching for frequently accessed data\n• Use connection pooling for databases\n• Consider CDN for static assets\n• Implement request coalescing for duplicate queries',
      timestamp: Date.now()
    });
  }

  // 9. Detailed Performance Breakdown
  if (current.lag.mean > 10 && current.lag.mean < 50) {
    insights.push({
      type: 'performance-tip',
      severity: 'info',
      title: 'Performance Optimization Opportunity',
      message: `Event loop lag is ${current.lag.mean.toFixed(2)}ms. While acceptable, there's room for improvement.`,
      recommendation: '• Profile your application to identify slow operations\n• Consider implementing worker threads for CPU-intensive tasks\n• Use streaming for large data processing\n• Optimize database queries with proper indexing',
      timestamp: Date.now()
    });
  }

  return insights;
}

/**
 * Calculate aggregated statistics
 */
function calculateAggregatedStats(history) {
  if (history.length === 0) {
    return null;
  }

  const lagValues = history.map(s => s.lag.mean);
  const eluValues = history.map(s => s.elu.utilization);
  const memValues = history.map(s => s.memory ? parseFloat(s.memory.heapUsedMB) : 0).filter(v => v > 0);

  return {
    lag: {
      min: Math.min(...lagValues),
      max: Math.max(...lagValues),
      avg: calculateMean(lagValues),
      p95: calculatePercentile(lagValues, 95),
      p99: calculatePercentile(lagValues, 99)
    },
    elu: {
      min: Math.min(...eluValues) * 100,
      max: Math.max(...eluValues) * 100,
      avg: calculateMean(eluValues) * 100
    },
    memory: memValues.length > 0 ? {
      min: Math.min(...memValues),
      max: Math.max(...memValues),
      avg: calculateMean(memValues)
    } : null
  };
}

/**
 * Calculate percentile
 */
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get current metrics snapshot
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
 * Get health status with enhanced details
 */
function getHealthStatus(monitor, thresholds) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  const health = monitor.getHealth(thresholds);
  const current = monitor.getCurrentMetrics();
  
  // Add additional context
  const enhancedHealth = {
    ...health,
    details: {
      lagStatus: current.lag.mean > 100 ? 'critical' : current.lag.mean > 50 ? 'warning' : 'healthy',
      eluStatus: current.elu.utilization > 0.9 ? 'critical' : current.elu.utilization > 0.7 ? 'warning' : 'healthy',
      memoryStatus: current.memory && parseFloat(current.memory.heapUsedMB) / parseFloat(current.memory.heapTotalMB) > 0.9 ? 'critical' : 'healthy'
    }
  };
  
  return {
    status: 'ok',
    timestamp: Date.now(),
    data: enhancedHealth
  };
}

/**
 * Export metrics with insights
 */
function exportMetrics(monitor, count) {
  if (!monitor || !monitor.isActive()) {
    return {
      status: 'error',
      message: 'Monitor not active'
    };
  }

  try {
    const history = monitor.getHistory(count);
    const current = monitor.getCurrentMetrics();
    const health = monitor.getHealth();
    const insights = generateInsights(current, history, health);
    
    return {
      status: 'ok',
      timestamp: Date.now(),
      count: history.length,
      data: {
        metadata: {
          exportDate: new Date().toISOString(),
          sampleCount: history.length,
          timeRange: history.length > 0 ? {
            start: new Date(history[0].timestamp).toISOString(),
            end: new Date(history[history.length - 1].timestamp).toISOString()
          } : null
        },
        current,
        health,
        insights,
        history
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Export failed: ${error.message}`
    };
  }
}

module.exports = {
  getDashboardData,
  getCurrentMetrics,
  getHealthStatus,
  exportMetrics,
  generateInsights,
  calculateTrends,
  calculateAggregatedStats
};