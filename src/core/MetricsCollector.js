/**
 * MetricsCollector - Production-Ready Metrics Collection and Analysis
 */

const EventEmitter = require("events");

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    // CRITICAL FIX: Use !== undefined instead of || to allow 0 as valid value
    this.config = {
      historySize: options.historySize !== undefined ? options.historySize : 300,
      maxMemoryMB: options.maxMemoryMB !== undefined ? options.maxMemoryMB : 50,
      enableValidation: options.enableValidation !== false,
      enableEvents: options.enableEvents !== false,
      cleanupInterval: options.cleanupInterval !== undefined ? options.cleanupInterval : 60000,
      aggregationWindows: options.aggregationWindows || {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
      },
    };

    // Circular buffer for samples
    this.samples = new Array(this.config.historySize);
    this.currentIndex = 0;
    this.sampleCount = 0;
    this.totalSamples = 0;

    // Cache for frequently accessed data
    this.cache = {
      latest: null,
      aggregated: new Map(),
      cacheTTL: 1000,
    };

    // Statistics tracking
    this.stats = {
      firstSampleTime: null,
      lastSampleTime: null,
      droppedSamples: 0,
      validationErrors: 0,
      memoryWarnings: 0,
    };

    // Performance tracking
    this.performance = {
      addSampleDuration: [],
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Auto-cleanup timer
    this._startAutoCleanup();
  }

  addSample(sample) {
    const startTime = Date.now();

    try {
      // CRITICAL FIX: Return early if historySize is 0
      if (this.config.historySize === 0) {
        return false;
      }

      // Validate sample if enabled
      if (this.config.enableValidation) {
        const validation = this._validateSample(sample);
        if (!validation.valid) {
          this.stats.validationErrors++;
          console.warn(
            "MetricsCollector: Invalid sample received",
            validation.errors
          );
          return false;
        }
      }

      // Check memory limits
      if (this._shouldTriggerCleanup()) {
        this._performCleanup();
      }

      // Add to circular buffer
      this.samples[this.currentIndex] = Object.freeze(sample);
      this.currentIndex = (this.currentIndex + 1) % this.config.historySize;

      // Update counters
      if (this.sampleCount < this.config.historySize) {
        this.sampleCount++;
      }
      this.totalSamples++;

      // Update statistics
      if (!this.stats.firstSampleTime) {
        this.stats.firstSampleTime = sample.timestamp;
      }
      this.stats.lastSampleTime = sample.timestamp;

      // Invalidate cache
      this._invalidateCache();

      // Update latest sample cache
      this.cache.latest = sample;

      // Emit event if enabled
      if (this.config.enableEvents) {
        this.emit("sample-added", {
          sample,
          totalSamples: this.totalSamples,
          timestamp: Date.now(),
        });
      }

      // Track performance
      const duration = Date.now() - startTime;
      this._trackPerformance("addSample", duration);

      return true;
    } catch (error) {
      console.error("MetricsCollector: Error adding sample", error);
      this.emit("error", {
        operation: "addSample",
        error,
        sample,
        timestamp: Date.now(),
      });
      return false;
    }
  }

  getLatestSample() {
    if (this.cache.latest) {
      this.performance.cacheHits++;
      return this.cache.latest;
    }

    this.performance.cacheMisses++;

    if (this.sampleCount === 0) {
      return null;
    }

    const latestIndex =
      this.currentIndex === 0 ? this.sampleCount - 1 : this.currentIndex - 1;

    const latest = this.samples[latestIndex];
    this.cache.latest = latest;

    return latest;
  }

  getHistory(countOrOptions) {
    this.performance.queriesExecuted++;

    if (this.sampleCount === 0) {
      return [];
    }

    const options =
      typeof countOrOptions === "number"
        ? { count: countOrOptions }
        : countOrOptions || {};

    const {
      count,
      duration,
      filter,
      startTime,
      endTime,
      sortOrder = "asc",
    } = options;

    let requestedCount = count || this.sampleCount;

    if (duration) {
      const _cutoffTime = Date.now() - duration;
      requestedCount = this.sampleCount;
    }

    requestedCount = Math.min(requestedCount, this.sampleCount);

    let startIndex;
    if (this.sampleCount < this.config.historySize) {
      startIndex = Math.max(0, this.sampleCount - requestedCount);
    } else {
      startIndex =
        (this.currentIndex - requestedCount + this.config.historySize) %
        this.config.historySize;
    }

    const result = [];
    for (let i = 0; i < requestedCount; i++) {
      const index = (startIndex + i) % this.config.historySize;
      const sample = this.samples[index];

      if (!sample) continue;

      if (startTime && sample.timestamp < startTime) continue;
      if (endTime && sample.timestamp > endTime) continue;
      if (duration && sample.timestamp < Date.now() - duration) continue;

      if (filter && !filter(sample)) continue;

      result.push(sample);
    }

    if (sortOrder === "desc") {
      result.reverse();
    }

    return result;
  }

  getAggregatedMetrics(durationOrWindow) {
    const _startTime = Date.now();

    let duration;
    if (typeof durationOrWindow === "string") {
      duration =
        (this.config.aggregationWindows[durationOrWindow] || 300) * 1000;
    } else {
      duration = durationOrWindow;
    }

    const cacheKey = `agg_${duration}`;
    const cached = this.cache.aggregated.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cache.cacheTTL) {
      this.performance.cacheHits++;
      return cached.data;
    }

    this.performance.cacheMisses++;

    if (this.sampleCount === 0) {
      return null;
    }

    try {
      const samples = duration
        ? this.getHistory({ duration })
        : this.getHistory();

      if (samples.length === 0) {
        return null;
      }

      const values = {
        lag: {
          min: [],
          max: [],
          mean: [],
          stddev: [],
          p50: [],
          p90: [],
          p95: [],
          p99: [],
          p999: [],
        },
        elu: {
          utilization: [],
          active: [],
          idle: [],
        },
        memory: {
          heapUsed: [],
          heapTotal: [],
          rss: [],
          external: [],
        },
        cpu: {
          user: [],
          system: [],
          total: [],
        },
        requests: {
          count: [],
          totalTime: [],
          avgTime: [],
        },
        handles: {
          active: [],
          requests: [],
          total: [],
        },
      };

      samples.forEach((sample) => {
        if (sample.lag) {
          values.lag.min.push(sample.lag.min);
          values.lag.max.push(sample.lag.max);
          values.lag.mean.push(sample.lag.mean);
          values.lag.stddev.push(sample.lag.stddev || 0);
          values.lag.p50.push(sample.lag.p50);
          values.lag.p90.push(sample.lag.p90 || 0);
          values.lag.p95.push(sample.lag.p95);
          values.lag.p99.push(sample.lag.p99);
          values.lag.p999.push(sample.lag.p999 || 0);
        }

        if (sample.elu) {
          values.elu.utilization.push(sample.elu.utilization);
          values.elu.active.push(sample.elu.active);
          values.elu.idle.push(sample.elu.idle);
        }

        if (sample.memory) {
          values.memory.heapUsed.push(sample.memory.heapUsed || 0);
          values.memory.heapTotal.push(sample.memory.heapTotal || 0);
          values.memory.rss.push(sample.memory.rss || 0);
          values.memory.external.push(sample.memory.external || 0);
        }

        if (sample.cpu) {
          values.cpu.user.push(sample.cpu.user || 0);
          values.cpu.system.push(sample.cpu.system || 0);
          values.cpu.total.push(sample.cpu.total || 0);
        }

        if (sample.requests) {
          values.requests.count.push(sample.requests.count || 0);
          values.requests.totalTime.push(sample.requests.totalTime || 0);
          values.requests.avgTime.push(sample.requests.avgTime || 0);
        }

        if (sample.handles) {
          values.handles.active.push(sample.handles.active || 0);
          values.handles.requests.push(sample.handles.requests || 0);
          values.handles.total.push(sample.handles.total || 0);
        }
      });

      const result = {
        timeWindow: {
          start: samples[0].timestamp,
          end: samples[samples.length - 1].timestamp,
          duration: samples[samples.length - 1].timestamp - samples[0].timestamp,
          sampleCount: samples.length,
        },
        lag: {
          min: this._calculateComprehensiveStats(values.lag.min),
          max: this._calculateComprehensiveStats(values.lag.max),
          mean: this._calculateComprehensiveStats(values.lag.mean),
          p50: this._calculateComprehensiveStats(values.lag.p50),
          p95: this._calculateComprehensiveStats(values.lag.p95),
          p99: this._calculateComprehensiveStats(values.lag.p99),
        },
        elu: {
          utilization: this._calculateComprehensiveStats(values.elu.utilization),
          active: this._calculateComprehensiveStats(values.elu.active),
          idle: this._calculateComprehensiveStats(values.elu.idle),
        },
        memory: values.memory.heapUsed.length > 0 ? {
          heapUsed: this._calculateComprehensiveStats(values.memory.heapUsed),
          heapTotal: this._calculateComprehensiveStats(values.memory.heapTotal),
          rss: this._calculateComprehensiveStats(values.memory.rss),
        } : null,
        requests: values.requests.count.length > 0 ? {
          count: this._calculateComprehensiveStats(values.requests.count),
          avgTime: this._calculateComprehensiveStats(values.requests.avgTime),
        } : null,
      };

      this.cache.aggregated.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error("MetricsCollector: Error calculating aggregated metrics", error);
      return null;
    }
  }

  _calculateComprehensiveStats(values) {
    if (!values || values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: this._percentile(sorted, 50),
    };
  }

  getTimeSeries(metric, count) {
    const samples = this.getHistory(count);

    if (samples.length === 0) {
      return [];
    }

    switch (metric) {
      case "lag":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          min: s.lag.min,
          max: s.lag.max,
          mean: s.lag.mean,
          p50: s.lag.p50,
          p95: s.lag.p95,
          p99: s.lag.p99,
        }));

      case "elu":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          utilization: s.elu.utilization,
          active: s.elu.active,
          idle: s.elu.idle,
        }));

      case "requests":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          count: s.requests?.count || 0,
          avgTime: s.requests?.avgTime || 0,
        }));

      default:
        return [];
    }
  }

  exportJSON(count, options = {}) {
    const { compress = false } = options;

    try {
      const samples = this.getHistory(count);

      const data = {
        exported: Date.now(),
        sampleCount: samples.length,
        samples: compress ? samples.map((s) => this._compressSample(s)) : samples,
        stats: this.getStats(),
      };

      const json = JSON.stringify(data, null, compress ? 0 : 2);

      return json;
    } catch (error) {
      console.error("MetricsCollector: Export failed", error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  importJSON(json, options = {}) {
    const { append = false, _validate = true } = options;

    try {
      const data = JSON.parse(json);
      const samples = data.samples || data;

      if (!Array.isArray(samples)) {
        throw new Error("Invalid format: expected array of samples");
      }

      if (!append) {
        this.reset();
      }

      let imported = 0;
      let failed = 0;

      samples.forEach((sample) => {
        const expandedSample = this._expandSample(sample);

        if (this.addSample(expandedSample)) {
          imported++;
        } else {
          failed++;
        }
      });

      this.emit("import-complete", {
        imported,
        failed,
        total: samples.length,
        timestamp: Date.now(),
      });

      return { imported, failed };
    } catch (error) {
      console.error("MetricsCollector: Import failed", error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  reset(keepStats = false) {
    this.samples = new Array(this.config.historySize);
    this.currentIndex = 0;
    this.sampleCount = 0;

    if (!keepStats) {
      this.totalSamples = 0;
      this.stats = {
        firstSampleTime: null,
        lastSampleTime: null,
        droppedSamples: 0,
        validationErrors: 0,
        memoryWarnings: 0,
      };
    }

    this._invalidateCache();

    this.emit("reset", {
      keepStats,
      timestamp: Date.now(),
    });
  }

  getStats() {
    const memoryUsage = this._estimateMemoryUsage();

    return {
      historySize: this.config.historySize,
      sampleCount: this.sampleCount,
      totalSamples: this.totalSamples,
      currentIndex: this.currentIndex,
      memoryUsage: memoryUsage.formatted,
      memoryUsageBytes: memoryUsage.bytes,
      memoryLimit: this.config.maxMemoryMB * 1024 * 1024,
      memoryUtilization:
        (memoryUsage.bytes / (this.config.maxMemoryMB * 1024 * 1024)) * 100,
      firstSampleTime: this.stats.firstSampleTime,
      lastSampleTime: this.stats.lastSampleTime,
      timeSpan:
        this.stats.lastSampleTime && this.stats.firstSampleTime
          ? this.stats.lastSampleTime - this.stats.firstSampleTime
          : 0,
      droppedSamples: this.stats.droppedSamples,
      validationErrors: this.stats.validationErrors,
      memoryWarnings: this.stats.memoryWarnings,
      cacheHitRate:
        this.performance.cacheHits + this.performance.cacheMisses > 0
          ? (
              (this.performance.cacheHits /
                (this.performance.cacheHits + this.performance.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "N/A",
      queriesExecuted: this.performance.queriesExecuted,
    };
  }

  _validateSample(sample) {
    const errors = [];

    if (!sample || typeof sample !== "object") {
      errors.push("sample must be an object");
      return { valid: false, errors };
    }

    if (!sample.timestamp || typeof sample.timestamp !== "number") {
      errors.push("timestamp must be a number");
    }

    if (sample.lag) {
      if (typeof sample.lag.min !== "number") errors.push("lag.min must be a number");
      if (typeof sample.lag.max !== "number") errors.push("lag.max must be a number");
      if (typeof sample.lag.mean !== "number") errors.push("lag.mean must be a number");
      if (typeof sample.lag.p50 !== "number") errors.push("lag.p50 must be a number");
      if (typeof sample.lag.p95 !== "number") errors.push("lag.p95 must be a number");
      if (typeof sample.lag.p99 !== "number") errors.push("lag.p99 must be a number");
    }

    if (sample.elu) {
      if (typeof sample.elu !== "object") {
        errors.push("elu must be an object");
      } else {
        if (typeof sample.elu.utilization !== "number")
          errors.push("elu.utilization must be a number");
        if (typeof sample.elu.active !== "number")
          errors.push("elu.active must be a number");
        if (typeof sample.elu.idle !== "number")
          errors.push("elu.idle must be a number");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  _compressSample(sample) {
    return {
      t: sample.timestamp,
      l: {
        mi: sample.lag.min,
        mx: sample.lag.max,
        me: sample.lag.mean,
        p50: sample.lag.p50,
        p95: sample.lag.p95,
        p99: sample.lag.p99,
      },
      e: {
        u: sample.elu.utilization,
        a: sample.elu.active,
        i: sample.elu.idle,
      },
    };
  }

  _expandSample(sample) {
    if (sample.t) {
      return {
        timestamp: sample.t,
        lag: {
          min: sample.l.mi,
          max: sample.l.mx,
          mean: sample.l.me || sample.l.mean,
          p50: sample.l.p50,
          p95: sample.l.p95,
          p99: sample.l.p99,
        },
        elu: {
          utilization: sample.e.u || sample.e.utilization,
          active: sample.e.a || sample.e.active,
          idle: sample.e.i || sample.e.idle,
        },
      };
    }
    return sample;
  }

  _percentile(sortedValues, percentile) {
    if (!sortedValues || sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  _estimateMemoryUsage() {
    const bytesPerSample = 500;
    const samplesBytes = this.sampleCount * bytesPerSample;
    const cacheBytes = this.cache.aggregated.size * 1000;
    const totalBytes = samplesBytes + cacheBytes;

    return {
      bytes: totalBytes,
      formatted: this._formatBytes(totalBytes),
    };
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  _shouldTriggerCleanup() {
    const memory = this._estimateMemoryUsage();
    return memory.bytes > this.config.maxMemoryMB * 1024 * 1024 * 0.9;
  }

  _performCleanup() {
    this.cache.aggregated.clear();
    this.stats.memoryWarnings++;
  }

  _invalidateCache() {
    this.cache.latest = null;
    this.cache.aggregated.clear();
  }

  _trackPerformance(operation, duration) {
    if (operation === "addSample") {
      this.performance.addSampleDuration.push(duration);
      if (this.performance.addSampleDuration.length > 1000) {
        this.performance.addSampleDuration.shift();
      }
    }
  }

  _startAutoCleanup() {
    // Don't start cleanup if historySize is 0 or cleanup is disabled
    if (this.config.historySize === 0 || this.config.cleanupInterval <= 0) {
      return;
    }

    this._cleanupTimer = setInterval(() => {
      if (this._shouldTriggerCleanup()) {
        this._performCleanup();
      }
    }, this.config.cleanupInterval);

    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  _stopAutoCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  destroy() {
    this._stopAutoCleanup();
    this.reset();
    this.removeAllListeners();

    this.emit("destroyed", { timestamp: Date.now() });
  }
}

module.exports = MetricsCollector;