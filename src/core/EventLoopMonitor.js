const { monitorEventLoopDelay, performance } = require("perf_hooks");
const MetricsCollector = require("./MetricsCollector");

class EventLoopMonitor {
  constructor(options = {}) {
    this.options = {
      sampleInterval: options.sampleInterval || 100,
      historySize: options.historySize || 300,
      resolution: options.resolution || 10,
    };

    this.metricsCollector = new MetricsCollector({
      historySize: this.options.historySize,
    });

    this.delayHistogram = null;
    this.lastELU = null;
    this.eluStartTime = null;
    this.lastCPU = null;
    this.isMonitoring = false;
    this.sampleTimer = null;
    this.requestCount = 0;
    this.totalRequestTime = 0;
  }

  start() {
    if (this.isMonitoring) {
      return;
    }

    this.delayHistogram = monitorEventLoopDelay({
      resolution: this.options.resolution,
    });
    this.delayHistogram.enable();

    this.lastELU = performance.eventLoopUtilization();
    this.eluStartTime = Date.now();
    this.lastCPU = process.cpuUsage();

    this.isMonitoring = true;
    this._scheduleSample();
  }

  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.sampleTimer) {
      clearTimeout(this.sampleTimer);
      this.sampleTimer = null;
    }

    if (this.delayHistogram) {
      this.delayHistogram.disable();
      this.delayHistogram = null;
    }

    this.lastELU = null;
    this.eluStartTime = null;
    this.lastCPU = null;
  }

  _scheduleSample() {
    if (!this.isMonitoring) {
      return;
    }

    this.sampleTimer = setTimeout(() => {
      this._takeSample();
      this._scheduleSample();
    }, this.options.sampleInterval);
  }

  _takeSample() {
    if (!this.delayHistogram) {
      return;
    }

    const now = Date.now();

    const lagMetrics = {
      min: this.delayHistogram.min / 1e6,
      max: this.delayHistogram.max / 1e6,
      mean: this.delayHistogram.mean / 1e6,
      stddev: this.delayHistogram.stddev / 1e6,
      p50: this.delayHistogram.percentile(50) / 1e6,
      p90: this.delayHistogram.percentile(90) / 1e6,
      p95: this.delayHistogram.percentile(95) / 1e6,
      p99: this.delayHistogram.percentile(99) / 1e6,
      p999: this.delayHistogram.percentile(99.9) / 1e6,
    };

    const currentELU = performance.eventLoopUtilization();
    const eluDiff = performance.eventLoopUtilization(currentELU, this.lastELU);

    const eluMetrics = {
      utilization: eluDiff.utilization,
      active: eluDiff.active,
      idle: eluDiff.idle,
    };

    this.lastELU = currentELU;

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

    const cpuUsage = process.cpuUsage(this.lastCPU);
    this.lastCPU = process.cpuUsage();

    const cpuMetrics = {
      user: cpuUsage.user / 1000,
      system: cpuUsage.system / 1000,
      total: (cpuUsage.user + cpuUsage.system) / 1000,
    };

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
    this.delayHistogram.reset();
    this.requestCount = 0;
    this.totalRequestTime = 0;
  }

  getCurrentMetrics() {
    if (!this.isMonitoring) {
      return null;
    }
    return this.metricsCollector.getLatestSample();
  }

  getMetrics() {
    return {
      current: this.getCurrentMetrics(),
      history: this.metricsCollector.getHistory(),
      aggregated: this.metricsCollector.getAggregatedMetrics(),
      isMonitoring: this.isMonitoring,
    };
  }

  getHistory(count) {
    return this.metricsCollector.getHistory(count);
  }

  getHealth(thresholds = {}) {
    const defaults = {
      lagWarning: 50,
      lagCritical: 100,
      eluWarning: 0.7,
      eluCritical: 0.9,
      memoryWarning: 0.8,
      memoryCritical: 0.9,
    };

    const t = { ...defaults, ...thresholds };

    if (!this.isMonitoring) {
      return {
        status: "unknown",
        score: 0,
        issues: ["Monitoring is not active"],
        message: "Cannot determine health - monitoring is not active",
        metrics: null,
      };
    }

    const current = this.getCurrentMetrics();
    if (!current) {
      return {
        status: "unknown",
        score: 0,
        issues: ["No metrics available"],
        message: "Cannot determine health - no metrics available",
        metrics: null,
      };
    }

    let score = 100;
    let status = "healthy";
    const issues = [];

    const lagMean = current.lag.mean;
    const eluUtilization = current.elu.utilization;

    if (lagMean >= t.lagCritical) {
      const excessRatio = Math.min((lagMean - t.lagCritical) / t.lagCritical, 2);
      const penalty = 40 + excessRatio * 20;
      score -= penalty;
      status = "critical";
      issues.push(`Critical event loop lag: ${lagMean.toFixed(2)}ms`);
    } else if (lagMean >= t.lagWarning) {
      const range = t.lagCritical - t.lagWarning;
      const position = lagMean - t.lagWarning;
      const ratio = position / range;
      const penalty = 10 + ratio * 20;
      score -= penalty;
      if (status === "healthy") status = "degraded";
      issues.push(`High event loop lag: ${lagMean.toFixed(2)}ms`);
    }

    if (eluUtilization >= t.eluCritical) {
      const excessRatio = Math.min(
        (eluUtilization - t.eluCritical) / (1 - t.eluCritical),
        1
      );
      const penalty = 30 + excessRatio * 10;
      score -= penalty;
      status = "critical";
      issues.push(`Critical ELU: ${(eluUtilization * 100).toFixed(1)}%`);
    } else if (eluUtilization >= t.eluWarning) {
      const range = t.eluCritical - t.eluWarning;
      const position = eluUtilization - t.eluWarning;
      const ratio = position / range;
      const penalty = 10 + ratio * 15;
      score -= penalty;
      if (status === "healthy") status = "degraded";
      issues.push(`High ELU: ${(eluUtilization * 100).toFixed(1)}%`);
    }

    if (current.memory) {
      const memoryRatio = current.memory.heapUsed / current.memory.heapTotal;

      if (memoryRatio >= t.memoryCritical) {
        const excessRatio = Math.min(
          (memoryRatio - t.memoryCritical) / (1 - t.memoryCritical),
          1
        );
        const penalty = 30 + excessRatio * 15;
        score -= penalty;
        status = "critical";
        issues.push(`Critical memory: ${(memoryRatio * 100).toFixed(1)}%`);
      } else if (memoryRatio >= t.memoryWarning) {
        const range = t.memoryCritical - t.memoryWarning;
        const position = memoryRatio - t.memoryWarning;
        const ratio = position / range;
        const penalty = 5 + ratio * 15;
        score -= penalty;
        if (status === "healthy") status = "degraded";
        issues.push(`High memory: ${(memoryRatio * 100).toFixed(1)}%`);
      } else if (memoryRatio > 0.6) {
        const ratio = (memoryRatio - 0.6) / (t.memoryWarning - 0.6);
        const penalty = ratio * 5;
        score -= penalty;
      }
    }

    if (current.lag.p99 > t.lagWarning) {
      const spikeRatio = Math.min(current.lag.p99 / (t.lagCritical * 2), 1.5);
      const penalty = spikeRatio * 10;
      score -= penalty;

      if (current.lag.p99 >= t.lagCritical * 2) {
        if (status === "healthy") status = "degraded";
        issues.push(`Severe lag spikes: p99=${current.lag.p99.toFixed(2)}ms`);
      }
    }

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
   * Track a request - supports BOTH APIs for backward compatibility
   * 
   * NEW API (returns timer function):
   *   const end = monitor.trackRequest();
   *   // ... do work ...
   *   end();
   * 
   * OLD API (accepts duration directly for middleware):
   *   monitor.trackRequest(duration);
   */
  trackRequest(duration) {
    // If duration is provided, use old API (for Express middleware)
    if (typeof duration === 'number') {
      this.requestCount++;
      this.totalRequestTime += duration;
      return;
    }

    // Otherwise, return timer function (new API for tests)
    const startTime = Date.now();
    return () => {
      const elapsed = Date.now() - startTime;
      this.requestCount++;
      this.totalRequestTime += elapsed;
    };
  }

  isActive() {
    return this.isMonitoring;
  }

  reset() {
    this.metricsCollector.reset();
    this.requestCount = 0;
    this.totalRequestTime = 0;

    if (this.delayHistogram) {
      this.delayHistogram.reset();
    }
  }

  getConfig() {
    return {
      ...this.options,
      active: this.isMonitoring,
    };
  }

  exportJSON(count) {
    return this.metricsCollector.exportJSON(count);
  }

  importJSON(json) {
    return this.metricsCollector.importJSON(json);
  }

  getTimeSeries(metric, count) {
    return this.metricsCollector.getTimeSeries(metric, count);
  }
}

module.exports = EventLoopMonitor;