const { monitorEventLoopDelay, performance } = require("perf_hooks");
const MetricsCollector = require("./MetricsCollector");

/**
 * EventLoopMonitor - Core monitoring class for Node.js event loop health
 *
 * Monitors:
 * - Event Loop Lag: Delay in processing events (using monitorEventLoopDelay)
 * - Event Loop Utilization: Percentage of time actively processing (using ELU)
 *
 * @class
 */
class EventLoopMonitor {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.sampleInterval=100] - Sampling interval in milliseconds
   * @param {number} [options.historySize=300] - Number of samples to retain (default: 5 minutes at 100ms intervals)
   * @param {number} [options.resolution=10] - Histogram resolution for lag measurement
   */
  constructor(options = {}) {
    this.options = {
      sampleInterval: options.sampleInterval || 100,
      historySize: options.historySize || 300, // 5 minutes of history at 100ms intervals
      resolution: options.resolution || 10,
    };

    // Metrics collector for storing and analyzing data
    this.metricsCollector = new MetricsCollector({
      historySize: this.options.historySize,
    });

    // Event loop delay histogram
    this.delayHistogram = null;

    // ELU tracking
    this.lastELU = null;
    this.eluStartTime = null;

    // Monitoring state
    this.isMonitoring = false;
    this.sampleTimer = null;

    // Request tracking (optional, for integration with Express)
    this.requestCount = 0;
    this.totalRequestTime = 0;
  }

  /**
   * Start monitoring the event loop
   * Initializes the delay histogram and starts sampling
   */
  start() {
    if (this.isMonitoring) {
      return; // Already monitoring
    }

    // Initialize event loop delay monitoring
    this.delayHistogram = monitorEventLoopDelay({
      resolution: this.options.resolution,
    });
    this.delayHistogram.enable();

    // Initialize ELU tracking
    this.lastELU = performance.eventLoopUtilization();
    this.eluStartTime = Date.now();

    // Start sampling
    this.isMonitoring = true;
    this._scheduleSample();
  }

  /**
   * Stop monitoring the event loop
   * Cleans up resources and stops sampling
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Clear sample timer
    if (this.sampleTimer) {
      clearTimeout(this.sampleTimer);
      this.sampleTimer = null;
    }

    // Disable and cleanup histogram
    if (this.delayHistogram) {
      this.delayHistogram.disable();
      this.delayHistogram = null;
    }

    this.lastELU = null;
    this.eluStartTime = null;
  }

  /**
   * Schedule the next sample
   * @private
   */
  _scheduleSample() {
    if (!this.isMonitoring) {
      return;
    }

    this.sampleTimer = setTimeout(() => {
      this._takeSample();
      this._scheduleSample();
    }, this.options.sampleInterval);
  }

  /**
   * Take a sample of current metrics
   * @private
   */
  _takeSample() {
    if (!this.delayHistogram) {
      return;
    }

    const now = Date.now();

    // Get lag metrics from histogram
    const lagMetrics = {
      min: this.delayHistogram.min / 1e6, // Convert nanoseconds to milliseconds
      max: this.delayHistogram.max / 1e6,
      mean: this.delayHistogram.mean / 1e6,
      stddev: this.delayHistogram.stddev / 1e6,
      p50: this.delayHistogram.percentile(50) / 1e6,
      p90: this.delayHistogram.percentile(90) / 1e6,
      p95: this.delayHistogram.percentile(95) / 1e6,
      p99: this.delayHistogram.percentile(99) / 1e6,
      p999: this.delayHistogram.percentile(99.9) / 1e6,
    };

    // Get ELU (Event Loop Utilization) metrics
    const currentELU = performance.eventLoopUtilization();
    const eluDiff = performance.eventLoopUtilization(currentELU, this.lastELU);

    const eluMetrics = {
      utilization: eluDiff.utilization, // 0 to 1 (0% to 100%)
      active: eluDiff.active, // Time spent processing (ms)
      idle: eluDiff.idle, // Time spent idle (ms)
    };

    // Update last ELU for next diff calculation
    this.lastELU = currentELU;

    // Collect the sample
    const sample = {
      timestamp: now,
      lag: lagMetrics,
      elu: eluMetrics,
      requests: {
        count: this.requestCount,
        totalTime: this.totalRequestTime,
        avgTime:
          this.requestCount > 0 ? this.totalRequestTime / this.requestCount : 0,
      },
    };

    this.metricsCollector.addSample(sample);

    // Reset histogram for next interval
    this.delayHistogram.reset();

    // Reset request metrics (if tracked per interval)
    this.requestCount = 0;
    this.totalRequestTime = 0;
  }

  /**
   * Get current metrics snapshot
   * Returns the most recent sample or aggregated current state
   *
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    if (!this.isMonitoring) {
      return null;
    }

    const latestSample = this.metricsCollector.getLatestSample();
    return latestSample;
  }

  /**
   * Get all metrics (current + historical)
   *
   * @returns {Object} Complete metrics including history
   */
  getMetrics() {
    return {
      current: this.getCurrentMetrics(),
      history: this.metricsCollector.getHistory(),
      aggregated: this.metricsCollector.getAggregatedMetrics(),
      isMonitoring: this.isMonitoring,
    };
  }

  /**
   * Get historical metrics
   *
   * @param {number} [count] - Number of recent samples to retrieve
   * @returns {Array} Array of historical samples
   */
  getHistory(count) {
    return this.metricsCollector.getHistory(count);
  }

  /**
   * Get health status based on current metrics
   *
   * @param {Object} [thresholds] - Custom thresholds for health assessment
   * @returns {Object} Health status and score
   */
  getHealth(thresholds = {}) {
    const defaults = {
      lagWarning: 50, // milliseconds
      lagCritical: 100,
      eluWarning: 0.7, // 70%
      eluCritical: 0.9, // 90%
    };

    const t = { ...defaults, ...thresholds };
    const current = this.getCurrentMetrics();

    if (!current) {
      return {
        status: "unknown",
        score: 0,
        message: "Monitoring not started",
      };
    }

    const lagMean = current.lag.mean;
    const eluUtilization = current.elu.utilization;

    // Calculate health score (0-100)
    let score = 100;
    let status = "healthy";
    let issues = [];

    // Lag assessment
    if (lagMean >= t.lagCritical) {
      score -= 40;
      status = "critical";
      issues.push(`Critical lag: ${lagMean.toFixed(2)}ms`);
    } else if (lagMean >= t.lagWarning) {
      score -= 20;
      if (status === "healthy") status = "degraded";
      issues.push(`High lag: ${lagMean.toFixed(2)}ms`);
    }

    // ELU assessment
    if (eluUtilization >= t.eluCritical) {
      score -= 40;
      status = "critical";
      issues.push(
        `Critical utilization: ${(eluUtilization * 100).toFixed(1)}%`
      );
    } else if (eluUtilization >= t.eluWarning) {
      score -= 20;
      if (status === "healthy") status = "degraded";
      issues.push(`High utilization: ${(eluUtilization * 100).toFixed(1)}%`);
    }

    // Check for extreme lag spikes (p99)
    if (current.lag.p99 >= t.lagCritical * 2) {
      score -= 10;
      if (status === "healthy") status = "degraded";
      issues.push(`Severe lag spikes: p99=${current.lag.p99.toFixed(2)}ms`);
    }

    return {
      status,
      score: Math.max(0, score),
      issues,
      message: issues.length > 0 ? issues.join(", ") : "Event loop is healthy",
      metrics: {
        lag: lagMean,
        elu: eluUtilization,
      },
    };
  }

  /**
   * Track a request (for integration with Express middleware)
   *
   * @param {number} duration - Request duration in milliseconds
   */
  trackRequest(duration) {
    this.requestCount++;
    this.totalRequestTime += duration;
  }

  /**
   * Get monitoring status
   *
   * @returns {boolean} True if monitoring is active
   */
  isActive() {
    return this.isMonitoring;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metricsCollector.reset();
    this.requestCount = 0;
    this.totalRequestTime = 0;

    if (this.delayHistogram) {
      this.delayHistogram.reset();
    }
  }

  /**
   * Get configuration options
   *
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      ...this.options,
      isMonitoring: this.isMonitoring,
    };
  }
}

module.exports = EventLoopMonitor;
