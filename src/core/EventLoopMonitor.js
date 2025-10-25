const { monitorEventLoopDelay, performance } = require("perf_hooks");
const MetricsCollector = require("./MetricsCollector");

/**
 * EventLoopMonitor - Core monitoring class for Node.js event loop health
 *
 * Monitors:
 * - Event Loop Lag: Delay in processing events (using monitorEventLoopDelay)
 * - Event Loop Utilization: Percentage of time actively processing (using ELU)
 * - Memory Usage: Heap, RSS, external memory
 * - CPU Usage: User, system, and total CPU time
 * - Active Handles: Timers, sockets, file handles, etc.
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

    // CPU tracking
    this.lastCPU = null;

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

    // Initialize CPU tracking
    this.lastCPU = process.cpuUsage();

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
    this.lastCPU = null;
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

    // Get memory metrics
    const memoryUsage = process.memoryUsage();
    const memoryMetrics = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      externalMB: (memoryUsage.external / 1024 / 1024).toFixed(2),
    };

    // Get CPU metrics
    const cpuUsage = process.cpuUsage(this.lastCPU);
    this.lastCPU = process.cpuUsage();

    const cpuMetrics = {
      user: cpuUsage.user / 1000, // Convert microseconds to milliseconds
      system: cpuUsage.system / 1000,
      total: (cpuUsage.user + cpuUsage.system) / 1000,
    };

    // Get active handles and requests
    const activeHandles = process._getActiveHandles
      ? process._getActiveHandles().length
      : 0;
    const activeRequests = process._getActiveRequests
      ? process._getActiveRequests().length
      : 0;

    const handlesMetrics = {
      active: activeHandles,
      requests: activeRequests,
      total: activeHandles + activeRequests,
    };

    // Collect the sample
    const sample = {
      timestamp: now,
      lag: lagMetrics,
      elu: eluMetrics,
      memory: memoryMetrics,
      cpu: cpuMetrics,
      handles: handlesMetrics,
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
   * Get health status based on current metrics with proportional scoring
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
      memoryWarning: 0.8, // 80% of heap
      memoryCritical: 0.9, // 90% of heap
    };

    const t = { ...defaults, ...thresholds };
    const current = this.getCurrentMetrics();

    if (!current) {
      return {
        status: "unknown",
        score: 0,
        issues: [],
        message: "Monitoring not started",
        metrics: { lag: 0, elu: 0 },
      };
    }

    const lagMean = current.lag.mean;
    const eluUtilization = current.elu.utilization;

    // Calculate health score (0-100) with proportional penalties
    let score = 100;
    let status = "healthy";
    let issues = [];

    // Proportional lag assessment (max penalty: 40 points)
    if (lagMean > 0) {
      if (lagMean >= t.lagCritical) {
        // Critical: exponential penalty based on how far over critical threshold
        const excessRatio = Math.min(
          (lagMean - t.lagCritical) / t.lagCritical,
          2
        );
        const penalty = 40 + excessRatio * 20; // 40-60 point penalty
        score -= penalty;
        status = "critical";
        issues.push(`Critical lag: ${lagMean.toFixed(2)}ms`);
      } else if (lagMean >= t.lagWarning) {
        // Warning: linear penalty between warning and critical
        const range = t.lagCritical - t.lagWarning;
        const position = lagMean - t.lagWarning;
        const ratio = Math.min(position / range, 1);
        const penalty = 10 + ratio * 20; // 10-30 point penalty
        score -= penalty;
        if (status === "healthy") status = "degraded";
        issues.push(`High lag: ${lagMean.toFixed(2)}ms`);
      } else if (lagMean > 10) {
        // Minor lag: small proportional penalty
        const ratio = Math.min(lagMean / t.lagWarning, 1);
        const penalty = ratio * 10; // 0-10 point penalty
        score -= penalty;
      }
    }

    // Proportional ELU assessment (max penalty: 40 points)
    if (eluUtilization > 0) {
      if (eluUtilization >= t.eluCritical) {
        // Critical: exponential penalty
        const excessRatio = Math.min(
          (eluUtilization - t.eluCritical) / (1 - t.eluCritical),
          1
        );
        const penalty = 40 + excessRatio * 20; // 40-60 point penalty
        score -= penalty;
        status = "critical";
        issues.push(
          `Critical utilization: ${(eluUtilization * 100).toFixed(1)}%`
        );
      } else if (eluUtilization >= t.eluWarning) {
        // Warning: linear penalty
        const range = t.eluCritical - t.eluWarning;
        const position = eluUtilization - t.eluWarning;
        const ratio = Math.min(position / range, 1);
        const penalty = 10 + ratio * 20; // 10-30 point penalty
        score -= penalty;
        if (status === "healthy") status = "degraded";
        issues.push(`High utilization: ${(eluUtilization * 100).toFixed(1)}%`);
      } else if (eluUtilization > 0.5) {
        // Moderate load: small proportional penalty
        const ratio = (eluUtilization - 0.5) / (t.eluWarning - 0.5);
        const penalty = ratio * 10; // 0-10 point penalty
        score -= penalty;
      }
    }

    // Proportional memory assessment (max penalty: 30 points)
    if (current.memory) {
      const heapUsed = parseFloat(current.memory.heapUsedMB);
      const heapTotal = parseFloat(current.memory.heapTotalMB);
      const memoryRatio = heapUsed / heapTotal;

      if (memoryRatio >= t.memoryCritical) {
        // Critical: exponential penalty
        const excessRatio = Math.min(
          (memoryRatio - t.memoryCritical) / (1 - t.memoryCritical),
          1
        );
        const penalty = 30 + excessRatio * 15; // 30-45 point penalty
        score -= penalty;
        status = "critical";
        issues.push(`Critical memory: ${(memoryRatio * 100).toFixed(1)}%`);
      } else if (memoryRatio >= t.memoryWarning) {
        // Warning: linear penalty
        const range = t.memoryCritical - t.memoryWarning;
        const position = memoryRatio - t.memoryWarning;
        const ratio = position / range;
        const penalty = 5 + ratio * 15; // 5-20 point penalty
        score -= penalty;
        if (status === "healthy") status = "degraded";
        issues.push(`High memory: ${(memoryRatio * 100).toFixed(1)}%`);
      } else if (memoryRatio > 0.6) {
        // Moderate memory usage: small penalty
        const ratio = (memoryRatio - 0.6) / (t.memoryWarning - 0.6);
        const penalty = ratio * 5; // 0-5 point penalty
        score -= penalty;
      }
    }

    // Lag spike assessment (max penalty: 15 points)
    if (current.lag.p99 > t.lagWarning) {
      const spikeRatio = Math.min(current.lag.p99 / (t.lagCritical * 2), 1.5);
      const penalty = spikeRatio * 10; // 0-15 point penalty
      score -= penalty;

      if (current.lag.p99 >= t.lagCritical * 2) {
        if (status === "healthy") status = "degraded";
        issues.push(`Severe lag spikes: p99=${current.lag.p99.toFixed(2)}ms`);
      }
    }

    // Round to 1 decimal place for precision
    score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

    return {
      status,
      score,
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
