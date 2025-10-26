/**
 * MetricsCollector - Production-Ready Metrics Collection and Analysis
 *
 * A high-performance, feature-rich metrics collector for Node.js event loop monitoring.
 * Designed for production use with:
 * - Circular buffer with O(1) operations
 * - Advanced statistical analysis
 * - Multiple aggregation windows
 * - Memory-efficient storage
 * - Data validation and error handling
 * - Export/import capabilities
 * - Query interface for flexible data retrieval
 * - Performance monitoring
 *
 * @class
 * @version 2.0.0
 */

const EventEmitter = require("events");

/**
 * MetricsCollector with enhanced production features
 */
class MetricsCollector extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.historySize=300] - Maximum samples to retain (default: 5 min at 100ms intervals)
   * @param {number} [options.maxMemoryMB=50] - Maximum memory usage in MB before auto-cleanup
   * @param {boolean} [options.enableValidation=true] - Validate incoming samples
   * @param {boolean} [options.enableEvents=true] - Emit events on data changes
   * @param {number} [options.cleanupInterval=60000] - Auto-cleanup interval in ms (0 to disable)
   * @param {Object} [options.aggregationWindows] - Custom aggregation windows in seconds
   */
  constructor(options = {}) {
    super();

    // Configuration with defaults
    this.config = {
      historySize: options.historySize || 300,
      maxMemoryMB: options.maxMemoryMB || 50,
      enableValidation: options.enableValidation !== false,
      enableEvents: options.enableEvents !== false,
      cleanupInterval: options.cleanupInterval || 60000,
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
    this.totalSamples = 0; // Total samples ever recorded

    // Cache for frequently accessed data
    this.cache = {
      latest: null,
      aggregated: new Map(),
      stats: new Map(),
      lastCacheTime: 0,
      cacheTTL: 1000, // 1 second cache TTL
    };

    // Performance tracking
    this.performance = {
      addSampleTime: [],
      aggregationTime: [],
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Validation schema
    this.validationSchema = {
      timestamp: { type: "number", required: true },
      lag: { type: "object", required: true },
      elu: { type: "object", required: true },
    };

    // Auto-cleanup timer
    this.cleanupTimer = null;
    if (this.config.cleanupInterval > 0) {
      this._startAutoCleanup();
    }

    // Statistics tracking
    this.stats = {
      firstSampleTime: null,
      lastSampleTime: null,
      droppedSamples: 0,
      validationErrors: 0,
      memoryWarnings: 0,
    };
  }

  /**
   * Add a new sample to the collection with validation and caching
   *
   * @param {Object} sample - Metrics sample
   * @param {number} sample.timestamp - Sample timestamp
   * @param {Object} sample.lag - Event loop lag metrics
   * @param {Object} sample.elu - Event loop utilization metrics
   * @returns {boolean} True if sample was added successfully
   * @throws {Error} If validation fails and strict mode is enabled
   */
  addSample(sample) {
    const startTime = Date.now();

    try {
      // Validate sample if enabled
      if (this.config.enableValidation) {
        const validation = this._validateSample(sample);
        if (!validation.valid) {
          this.stats.validationErrors++;
          this.emit("validation-error", {
            sample,
            errors: validation.errors,
            timestamp: Date.now(),
          });

          // In production, log but don't throw
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
      this.samples[this.currentIndex] = Object.freeze(sample); // Freeze for immutability
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

  /**
   * Get the most recent sample with caching
   *
   * @returns {Object|null} Latest sample or null if no samples
   */
  getLatestSample() {
    // Return from cache if available
    if (this.cache.latest) {
      this.performance.cacheHits++;
      return this.cache.latest;
    }

    this.performance.cacheMisses++;

    if (this.sampleCount === 0) {
      return null;
    }

    // Get the most recently added sample
    const latestIndex =
      this.currentIndex === 0 ? this.sampleCount - 1 : this.currentIndex - 1;

    const latest = this.samples[latestIndex];
    this.cache.latest = latest;

    return latest;
  }

  /**
   * Get historical samples with advanced querying
   *
   * @param {number|Object} countOrOptions - Number of samples or query options
   * @returns {Array} Array of samples in chronological order
   *
   * @example
   * // Get last 60 samples
   * collector.getHistory(60);
   *
   * // Get samples from last 5 minutes
   * collector.getHistory({ duration: 300000 });
   *
   * // Get samples with filtering
   * collector.getHistory({
   *   count: 100,
   *   filter: (sample) => sample.lag.mean > 50
   * });
   */
  getHistory(countOrOptions) {
    this.performance.queriesExecuted++;

    if (this.sampleCount === 0) {
      return [];
    }

    // Parse options
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
      sortOrder = "asc", // 'asc' or 'desc'
    } = options;

    // Determine how many samples to retrieve
    let requestedCount = count || this.sampleCount;

    // Apply duration filter if specified
    if (duration) {
      const cutoffTime = Date.now() - duration;
      requestedCount = this.sampleCount;
    }

    // Ensure we don't exceed available samples
    requestedCount = Math.min(requestedCount, this.sampleCount);

    // Calculate starting position in circular buffer
    let startIndex;
    if (this.sampleCount < this.config.historySize) {
      // Buffer not full yet
      startIndex = Math.max(0, this.sampleCount - requestedCount);
    } else {
      // Buffer full - calculate position
      startIndex =
        (this.currentIndex - requestedCount + this.config.historySize) %
        this.config.historySize;
    }

    // Extract samples
    const result = [];
    for (let i = 0; i < requestedCount; i++) {
      const index = (startIndex + i) % this.config.historySize;
      const sample = this.samples[index];

      if (!sample) continue;

      // Apply time range filters
      if (startTime && sample.timestamp < startTime) continue;
      if (endTime && sample.timestamp > endTime) continue;
      if (duration && sample.timestamp < Date.now() - duration) continue;

      // Apply custom filter
      if (filter && !filter(sample)) continue;

      result.push(sample);
    }

    // Apply sort order
    if (sortOrder === "desc") {
      result.reverse();
    }

    return result;
  }

  /**
   * Get aggregated metrics with intelligent caching
   *
   * @param {number|string} durationOrWindow - Duration in ms or window name ('1m', '5m', etc.)
   * @returns {Object|null} Aggregated metrics
   */
  getAggregatedMetrics(durationOrWindow) {
    const startTime = Date.now();

    // Parse duration
    let duration;
    if (typeof durationOrWindow === "string") {
      duration =
        (this.config.aggregationWindows[durationOrWindow] || 300) * 1000;
    } else {
      duration = durationOrWindow;
    }

    // Check cache
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
      // Get samples within the time window
      const samples = duration
        ? this.getHistory({ duration })
        : this.getHistory();

      if (samples.length === 0) {
        return null;
      }

      // Perform aggregation
      const aggregated = this._performAggregation(samples);

      // Cache result
      this.cache.aggregated.set(cacheKey, {
        data: aggregated,
        timestamp: Date.now(),
      });

      // Track performance
      const execTime = Date.now() - startTime;
      this._trackPerformance("aggregation", execTime);

      return aggregated;
    } catch (error) {
      console.error("MetricsCollector: Aggregation failed", error);
      return null;
    }
  }

  /**
   * Perform comprehensive aggregation on samples
   * @private
   */
  _performAggregation(samples) {
    // Collect all values for aggregation
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

    // Collect values from samples
    samples.forEach((sample) => {
      // Lag metrics
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

      // ELU metrics
      if (sample.elu) {
        values.elu.utilization.push(sample.elu.utilization);
        values.elu.active.push(sample.elu.active);
        values.elu.idle.push(sample.elu.idle);
      }

      // Memory metrics
      if (sample.memory) {
        values.memory.heapUsed.push(sample.memory.heapUsed || 0);
        values.memory.heapTotal.push(sample.memory.heapTotal || 0);
        values.memory.rss.push(sample.memory.rss || 0);
        values.memory.external.push(sample.memory.external || 0);
      }

      // CPU metrics
      if (sample.cpu) {
        values.cpu.user.push(sample.cpu.user || 0);
        values.cpu.system.push(sample.cpu.system || 0);
        values.cpu.total.push(sample.cpu.total || 0);
      }

      // Request metrics
      if (sample.requests) {
        values.requests.count.push(sample.requests.count || 0);
        values.requests.totalTime.push(sample.requests.totalTime || 0);
        values.requests.avgTime.push(sample.requests.avgTime || 0);
      }

      // Handles metrics
      if (sample.handles) {
        values.handles.active.push(sample.handles.active || 0);
        values.handles.requests.push(sample.handles.requests || 0);
        values.handles.total.push(sample.handles.total || 0);
      }
    });

    // Calculate comprehensive statistics
    return {
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
        stddev: this._calculateComprehensiveStats(values.lag.stddev),
        p50: this._calculateComprehensiveStats(values.lag.p50),
        p90: this._calculateComprehensiveStats(values.lag.p90),
        p95: this._calculateComprehensiveStats(values.lag.p95),
        p99: this._calculateComprehensiveStats(values.lag.p99),
        p999: this._calculateComprehensiveStats(values.lag.p999),
      },
      elu: {
        utilization: this._calculateComprehensiveStats(values.elu.utilization),
        active: this._calculateComprehensiveStats(values.elu.active),
        idle: this._calculateComprehensiveStats(values.elu.idle),
      },
      memory: {
        heapUsed: this._calculateComprehensiveStats(values.memory.heapUsed),
        heapTotal: this._calculateComprehensiveStats(values.memory.heapTotal),
        rss: this._calculateComprehensiveStats(values.memory.rss),
        external: this._calculateComprehensiveStats(values.memory.external),
      },
      cpu: {
        user: this._calculateComprehensiveStats(values.cpu.user),
        system: this._calculateComprehensiveStats(values.cpu.system),
        total: this._calculateComprehensiveStats(values.cpu.total),
      },
      requests: {
        totalCount: this._sum(values.requests.count),
        totalTime: this._sum(values.requests.totalTime),
        avgTime: this._mean(values.requests.avgTime),
        rate: (this._sum(values.requests.count) / samples.length) * 10, // Approx req/s
      },
      handles: {
        active: this._calculateComprehensiveStats(values.handles.active),
        requests: this._calculateComprehensiveStats(values.handles.requests),
        total: this._calculateComprehensiveStats(values.handles.total),
      },
    };
  }

  /**
   * Calculate comprehensive statistics including variance and standard deviation
   * @private
   */
  _calculateComprehensiveStats(values) {
    if (!values || values.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p5: 0,
        p25: 0,
        p75: 0,
        p95: 0,
        p99: 0,
        variance: 0,
        stddev: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    const mean = this._mean(values);

    // Calculate variance and standard deviation
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / len;
    const stddev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[len - 1],
      mean,
      median: this._percentile(sorted, 50),
      p5: this._percentile(sorted, 5),
      p25: this._percentile(sorted, 25),
      p75: this._percentile(sorted, 75),
      p95: this._percentile(sorted, 95),
      p99: this._percentile(sorted, 99),
      variance,
      stddev,
      count: len,
    };
  }

  /**
   * Get time series data for specific metrics with resampling
   *
   * @param {string} metric - Metric name ('lag', 'elu', 'memory', 'requests', 'cpu', 'handles')
   * @param {Object} options - Query options
   * @returns {Array} Time series data
   */
  getTimeSeries(metric, options = {}) {
    const { count, duration, resample, fields } = options;

    let samples = this.getHistory({ count, duration });

    // Apply resampling if requested
    if (resample && resample > 1) {
      samples = this._resampleData(samples, resample);
    }

    // Extract time series based on metric type
    switch (metric) {
      case "lag":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          ...(fields
            ? this._selectFields(s.lag, fields)
            : {
                min: s.lag.min,
                max: s.lag.max,
                mean: s.lag.mean,
                p50: s.lag.p50,
                p95: s.lag.p95,
                p99: s.lag.p99,
              }),
        }));

      case "elu":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          ...(fields
            ? this._selectFields(s.elu, fields)
            : {
                utilization: s.elu.utilization * 100,
                active: s.elu.active,
                idle: s.elu.idle,
              }),
        }));

      case "memory":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          ...(fields && s.memory
            ? this._selectFields(s.memory, fields)
            : s.memory
            ? {
                heapUsedMB:
                  s.memory.heapUsedMB ||
                  (s.memory.heapUsed / 1024 / 1024).toFixed(2),
                heapTotalMB:
                  s.memory.heapTotalMB ||
                  (s.memory.heapTotal / 1024 / 1024).toFixed(2),
                rssMB:
                  s.memory.rssMB || (s.memory.rss / 1024 / 1024).toFixed(2),
              }
            : {}),
        }));

      case "cpu":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          ...(fields && s.cpu
            ? this._selectFields(s.cpu, fields)
            : s.cpu
            ? {
                user: s.cpu.user,
                system: s.cpu.system,
                total: s.cpu.total,
              }
            : {}),
        }));

      case "requests":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          count: s.requests ? s.requests.count : 0,
          avgTime: s.requests ? s.requests.avgTime : 0,
          totalTime: s.requests ? s.requests.totalTime : 0,
        }));

      case "handles":
        return samples.map((s) => ({
          timestamp: s.timestamp,
          ...(fields && s.handles
            ? this._selectFields(s.handles, fields)
            : s.handles
            ? {
                active: s.handles.active,
                requests: s.handles.requests,
                total: s.handles.total,
              }
            : {}),
        }));

      default:
        return [];
    }
  }

  /**
   * Get statistical summary for a specific metric
   *
   * @param {string} metric - Metric name
   * @param {Object} options - Query options
   * @returns {Object} Statistical summary
   */
  getMetricSummary(metric, options = {}) {
    const timeSeries = this.getTimeSeries(metric, options);

    if (timeSeries.length === 0) {
      return null;
    }

    // Extract numeric values for statistics
    const fields = Object.keys(timeSeries[0]).filter((k) => k !== "timestamp");
    const summary = { metric, fields: {} };

    fields.forEach((field) => {
      const values = timeSeries
        .map((d) => d[field])
        .filter((v) => typeof v === "number");
      summary.fields[field] = this._calculateComprehensiveStats(values);
    });

    return summary;
  }

  /**
   * Detect anomalies in metrics using statistical methods
   *
   * @param {string} metric - Metric to analyze
   * @param {Object} options - Detection options
   * @returns {Array} Array of detected anomalies
   */
  detectAnomalies(metric, options = {}) {
    const {
      field = "mean",
      threshold = 3, // Standard deviations
      windowSize = 60,
      minSamples = 30,
    } = options;

    const samples = this.getHistory({ count: windowSize });

    if (samples.length < minSamples) {
      return [];
    }

    const values = samples.map((s) => {
      switch (metric) {
        case "lag":
          return s.lag[field];
        case "elu":
          return s.elu[field];
        case "memory":
          return s.memory ? parseFloat(s.memory[field]) : 0;
        case "cpu":
          return s.cpu ? s.cpu[field] : 0;
        default:
          return 0;
      }
    });

    const mean = this._mean(values);
    const stddev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length
    );

    const anomalies = [];
    const lowerBound = mean - threshold * stddev;
    const upperBound = mean + threshold * stddev;

    samples.forEach((sample, index) => {
      const value = values[index];

      if (value < lowerBound || value > upperBound) {
        anomalies.push({
          timestamp: sample.timestamp,
          metric,
          field,
          value,
          mean,
          stddev,
          deviation: Math.abs(value - mean) / stddev,
          type: value < lowerBound ? "low" : "high",
          sample,
        });
      }
    });

    return anomalies;
  }

  /**
   * Calculate moving average for smoothing data
   *
   * @param {string} metric - Metric name
   * @param {Object} options - Options including window size
   * @returns {Array} Smoothed time series
   */
  getMovingAverage(metric, options = {}) {
    const { field = "mean", windowSize = 10, count } = options;
    const timeSeries = this.getTimeSeries(metric, { count });

    if (timeSeries.length < windowSize) {
      return timeSeries;
    }

    const result = [];

    for (let i = windowSize - 1; i < timeSeries.length; i++) {
      const window = timeSeries.slice(i - windowSize + 1, i + 1);
      const values = window
        .map((d) => d[field])
        .filter((v) => typeof v === "number");
      const avg = this._mean(values);

      result.push({
        timestamp: timeSeries[i].timestamp,
        [field]: avg,
        windowSize,
        dataPoints: values.length,
      });
    }

    return result;
  }

  /**
   * Export metrics with compression support
   *
   * @param {Object} options - Export options
   * @returns {string} JSON string of exported data
   */
  exportJSON(options = {}) {
    const {
      count,
      compress = false,
      includeMetadata = true,
      format = "full", // 'full', 'compact', 'minimal'
    } = options;

    try {
      const samples = this.getHistory(count);

      let data = {
        samples,
      };

      if (includeMetadata) {
        data.metadata = {
          version: "2.0.0",
          exportDate: new Date().toISOString(),
          sampleCount: samples.length,
          totalSamples: this.totalSamples,
          config: this.config,
          stats: this.stats,
          performance: this._getPerformanceMetrics(),
        };
      }

      // Apply formatting
      if (format === "compact") {
        data.samples = samples.map((s) => this._compactSample(s));
      } else if (format === "minimal") {
        data.samples = samples.map((s) => ({
          t: s.timestamp,
          l: s.lag.mean,
          e: s.elu.utilization,
        }));
      }

      const json = JSON.stringify(data, null, compress ? 0 : 2);

      return json;
    } catch (error) {
      console.error("MetricsCollector: Export failed", error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Import samples with validation
   *
   * @param {string} json - JSON string of samples
   * @param {Object} options - Import options
   */
  importJSON(json, options = {}) {
    const { append = false, validate = true } = options;

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
        // Expand compact format if needed
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

  /**
   * Reset all stored metrics
   *
   * @param {boolean} keepStats - Whether to keep statistics
   */
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

  /**
   * Get comprehensive statistics about the collector
   *
   * @returns {Object} Collection statistics
   */
  getStats() {
    const memoryUsage = this._estimateMemoryUsage();

    return {
      // Basic info
      historySize: this.config.historySize,
      sampleCount: this.sampleCount,
      totalSamples: this.totalSamples,
      currentIndex: this.currentIndex,

      // Memory
      memoryUsage,
      memoryUsageBytes: memoryUsage.bytes,
      memoryLimit: this.config.maxMemoryMB * 1024 * 1024,
      memoryUtilization:
        (memoryUsage.bytes / (this.config.maxMemoryMB * 1024 * 1024)) * 100,

      // Time range
      firstSampleTime: this.stats.firstSampleTime,
      lastSampleTime: this.stats.lastSampleTime,
      timeSpan:
        this.stats.lastSampleTime && this.stats.firstSampleTime
          ? this.stats.lastSampleTime - this.stats.firstSampleTime
          : 0,

      // Quality metrics
      droppedSamples: this.stats.droppedSamples,
      validationErrors: this.stats.validationErrors,
      memoryWarnings: this.stats.memoryWarnings,

      // Performance
      performance: this._getPerformanceMetrics(),

      // Cache efficiency
      cacheHitRate:
        this.performance.cacheHits + this.performance.cacheMisses > 0
          ? (this.performance.cacheHits /
              (this.performance.cacheHits + this.performance.cacheMisses)) *
            100
          : 0,
    };
  }

  /**
   * Get performance metrics
   * @private
   */
  _getPerformanceMetrics() {
    return {
      avgAddSampleTime: this._mean(this.performance.addSampleTime),
      avgAggregationTime: this._mean(this.performance.aggregationTime),
      queriesExecuted: this.performance.queriesExecuted,
      cacheHits: this.performance.cacheHits,
      cacheMisses: this.performance.cacheMisses,
      cacheHitRate:
        this.performance.cacheHits + this.performance.cacheMisses > 0
          ? (
              (this.performance.cacheHits /
                (this.performance.cacheHits + this.performance.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * Cleanup old data and optimize memory
   *
   * @param {Object} options - Cleanup options
   */
  cleanup(options = {}) {
    const { keepRecent = 100, compress = false } = options;

    const before = this._estimateMemoryUsage();

    if (this.sampleCount > keepRecent) {
      const samples = this.getHistory(keepRecent);
      this.reset(true);
      samples.forEach((sample) => this.addSample(sample));
    }

    // Clear old cache entries
    const now = Date.now();
    for (const [key, value] of this.cache.aggregated.entries()) {
      if (now - value.timestamp > this.cache.cacheTTL * 10) {
        this.cache.aggregated.delete(key);
      }
    }

    // Trim performance arrays
    if (this.performance.addSampleTime.length > 1000) {
      this.performance.addSampleTime =
        this.performance.addSampleTime.slice(-100);
    }
    if (this.performance.aggregationTime.length > 1000) {
      this.performance.aggregationTime =
        this.performance.aggregationTime.slice(-100);
    }

    const after = this._estimateMemoryUsage();

    this.emit("cleanup-complete", {
      before: before.bytes,
      after: after.bytes,
      freed: before.bytes - after.bytes,
      timestamp: Date.now(),
    });

    return {
      before,
      after,
      freed: before.bytes - after.bytes,
    };
  }

  /**
   * Start auto-cleanup timer
   * @private
   */
  _startAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      if (this._shouldTriggerCleanup()) {
        this._performCleanup();
      }
    }, this.config.cleanupInterval);

    // FIXED: Prevent memory leak - unref timer so it doesn't prevent exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    // FIXED: Use once() instead of on() to prevent duplicate listeners
    if (typeof process !== "undefined") {
      process.once("beforeExit", () => this._stopAutoCleanup());
    }
  }

  /**
   * Stop auto-cleanup timer
   * @private
   */
  _stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Check if cleanup should be triggered
   * @private
   */
  _shouldTriggerCleanup() {
    const usage = this._estimateMemoryUsage();
    const limit = this.config.maxMemoryMB * 1024 * 1024;

    return usage.bytes > limit * 0.9; // Trigger at 90% of limit
  }

  /**
   * Perform cleanup
   * @private
   */
  _performCleanup() {
    this.stats.memoryWarnings++;

    this.emit("memory-warning", {
      usage: this._estimateMemoryUsage(),
      limit: this.config.maxMemoryMB,
      timestamp: Date.now(),
    });

    this.cleanup({ keepRecent: Math.floor(this.config.historySize * 0.75) });
  }

  /**
   * Validate sample structure
   * @private
   */
  _validateSample(sample) {
    const errors = [];

    if (!sample || typeof sample !== "object") {
      return { valid: false, errors: ["Sample must be an object"] };
    }

    // Required fields
    if (typeof sample.timestamp !== "number") {
      errors.push("timestamp must be a number");
    }

    if (!sample.lag || typeof sample.lag !== "object") {
      errors.push("lag must be an object");
    } else {
      const requiredLagFields = ["min", "max", "mean", "p50", "p95", "p99"];
      requiredLagFields.forEach((field) => {
        if (typeof sample.lag[field] !== "number") {
          errors.push(`lag.${field} must be a number`);
        }
      });
    }

    if (!sample.elu || typeof sample.elu !== "object") {
      errors.push("elu must be an object");
    } else {
      const requiredEluFields = ["utilization", "active", "idle"];
      requiredEluFields.forEach((field) => {
        if (typeof sample.elu[field] !== "number") {
          errors.push(`elu.${field} must be a number`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Invalidate all caches
   * @private
   */
  _invalidateCache() {
    this.cache.latest = null;
    this.cache.aggregated.clear();
    this.cache.stats.clear();
    this.cache.lastCacheTime = Date.now();
  }

  /**
   * Track performance metrics
   * @private
   */
  _trackPerformance(operation, duration) {
    if (operation === "addSample") {
      this.performance.addSampleTime.push(duration);
      if (this.performance.addSampleTime.length > 1000) {
        this.performance.addSampleTime.shift();
      }
    } else if (operation === "aggregation") {
      this.performance.aggregationTime.push(duration);
      if (this.performance.aggregationTime.length > 1000) {
        this.performance.aggregationTime.shift();
      }
    }
  }

  /**
   * Resample data to reduce granularity
   * @private
   */
  _resampleData(samples, factor) {
    const resampled = [];
    for (let i = 0; i < samples.length; i += factor) {
      resampled.push(samples[i]);
    }
    return resampled;
  }

  /**
   * Select specific fields from object
   * @private
   */
  _selectFields(obj, fields) {
    const result = {};
    fields.forEach((field) => {
      if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
    });
    return result;
  }

  /**
   * Create compact version of sample
   * @private
   */
  _compactSample(sample) {
    return {
      t: sample.timestamp,
      lag: {
        mi: sample.lag.min,
        ma: sample.lag.max,
        me: sample.lag.mean,
        p50: sample.lag.p50,
        p95: sample.lag.p95,
        p99: sample.lag.p99,
      },
      elu: {
        u: sample.elu.utilization,
        a: sample.elu.active,
        i: sample.elu.idle,
      },
    };
  }

  /**
   * Expand compact sample format
   * @private
   */
  _expandSample(sample) {
    if (sample.t) {
      // Compact format
      return {
        timestamp: sample.t,
        lag: {
          min: sample.lag.mi || sample.lag.min,
          max: sample.lag.ma || sample.lag.max,
          mean: sample.lag.me || sample.lag.mean,
          p50: sample.lag.p50,
          p95: sample.lag.p95,
          p99: sample.lag.p99,
        },
        elu: {
          utilization: sample.elu.u || sample.elu.utilization,
          active: sample.elu.a || sample.elu.active,
          idle: sample.elu.i || sample.elu.idle,
        },
      };
    }
    return sample;
  }

  /**
   * Statistical helper methods
   */

  _mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  _sum(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0);
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
    // Estimate memory usage of stored samples
    const bytesPerSample = 500; // Rough estimate
    const samplesBytes = this.sampleCount * bytesPerSample;

    // Add cache memory
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

  /**
   * Destroy the collector and cleanup resources
   */
  destroy() {
    this._stopAutoCleanup();
    this.reset();
    this.removeAllListeners();

    this.emit("destroyed", { timestamp: Date.now() });
  }
}

module.exports = MetricsCollector;
