/**
 * MetricsCollector - Manages historical metrics data and provides aggregation
 * 
 * Responsibilities:
 * - Store metrics samples in a circular buffer
 * - Calculate aggregated statistics over time windows
 * - Provide efficient data retrieval
 * 
 * @class
 */
class MetricsCollector {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.historySize=300] - Maximum number of samples to retain
   */
  constructor(options = {}) {
    this.historySize = options.historySize || 300;
    
    // Circular buffer for storing samples
    this.samples = [];
    this.currentIndex = 0;
    this.sampleCount = 0;
  }

  /**
   * Add a new sample to the collection
   * Uses circular buffer to maintain fixed size
   * 
   * @param {Object} sample - Metrics sample
   */
  addSample(sample) {
    // Add to circular buffer
    this.samples[this.currentIndex] = sample;
    this.currentIndex = (this.currentIndex + 1) % this.historySize;
    
    // Track total samples (up to historySize)
    if (this.sampleCount < this.historySize) {
      this.sampleCount++;
    }
  }

  /**
   * Get the most recent sample
   * 
   * @returns {Object|null} Latest sample or null if no samples
   */
  getLatestSample() {
    if (this.sampleCount === 0) {
      return null;
    }

    // Get the previous index (most recently added)
    const latestIndex = this.currentIndex === 0 
      ? this.sampleCount - 1 
      : this.currentIndex - 1;
    
    return this.samples[latestIndex];
  }

  /**
   * Get historical samples
   * Returns samples in chronological order (oldest to newest)
   * 
   * @param {number} [count] - Number of recent samples to retrieve (default: all)
   * @returns {Array} Array of samples
   */
  getHistory(count) {
    if (this.sampleCount === 0) {
      return [];
    }

    const requestedCount = count && count < this.sampleCount ? count : this.sampleCount;
    const result = [];

    // Calculate starting point
    let startIndex;
    if (this.sampleCount < this.historySize) {
      // Buffer not full yet - start from beginning
      startIndex = Math.max(0, this.sampleCount - requestedCount);
    } else {
      // Buffer full - calculate position in circular buffer
      startIndex = (this.currentIndex - requestedCount + this.historySize) % this.historySize;
    }

    // Extract samples in chronological order
    for (let i = 0; i < requestedCount; i++) {
      const index = (startIndex + i) % this.historySize;
      if (this.samples[index]) {
        result.push(this.samples[index]);
      }
    }

    return result;
  }

  /**
   * Get aggregated metrics over a time window
   * 
   * @param {number} [duration] - Time window in milliseconds (default: all history)
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics(duration) {
    if (this.sampleCount === 0) {
      return null;
    }

    // Get samples within the time window
    const samples = duration 
      ? this._getSamplesByDuration(duration)
      : this.getHistory();

    if (samples.length === 0) {
      return null;
    }

    // Aggregate lag metrics
    const lagValues = {
      min: [],
      max: [],
      mean: [],
      p50: [],
      p95: [],
      p99: []
    };

    // Aggregate ELU metrics
    const eluValues = {
      utilization: [],
      active: [],
      idle: []
    };

    // Aggregate request metrics
    const requestValues = {
      count: [],
      totalTime: [],
      avgTime: []
    };

    // Collect values from all samples
    samples.forEach(sample => {
      // Lag metrics
      lagValues.min.push(sample.lag.min);
      lagValues.max.push(sample.lag.max);
      lagValues.mean.push(sample.lag.mean);
      lagValues.p50.push(sample.lag.p50);
      lagValues.p95.push(sample.lag.p95);
      lagValues.p99.push(sample.lag.p99);

      // ELU metrics
      eluValues.utilization.push(sample.elu.utilization);
      eluValues.active.push(sample.elu.active);
      eluValues.idle.push(sample.elu.idle);

      // Request metrics
      if (sample.requests) {
        requestValues.count.push(sample.requests.count);
        requestValues.totalTime.push(sample.requests.totalTime);
        requestValues.avgTime.push(sample.requests.avgTime);
      }
    });

    // Calculate statistics
    return {
      timeWindow: {
        start: samples[0].timestamp,
        end: samples[samples.length - 1].timestamp,
        duration: samples[samples.length - 1].timestamp - samples[0].timestamp,
        sampleCount: samples.length
      },
      lag: {
        min: this._calculateStats(lagValues.min),
        max: this._calculateStats(lagValues.max),
        mean: this._calculateStats(lagValues.mean),
        p50: this._calculateStats(lagValues.p50),
        p95: this._calculateStats(lagValues.p95),
        p99: this._calculateStats(lagValues.p99)
      },
      elu: {
        utilization: this._calculateStats(eluValues.utilization),
        active: this._calculateStats(eluValues.active),
        idle: this._calculateStats(eluValues.idle)
      },
      requests: {
        totalCount: this._sum(requestValues.count),
        totalTime: this._sum(requestValues.totalTime),
        avgTime: this._mean(requestValues.avgTime)
      }
    };
  }

  /**
   * Get samples within a specific duration from now
   * 
   * @param {number} duration - Duration in milliseconds
   * @returns {Array} Samples within the time window
   * @private
   */
  _getSamplesByDuration(duration) {
    const now = Date.now();
    const cutoffTime = now - duration;
    
    return this.getHistory().filter(sample => sample.timestamp >= cutoffTime);
  }

  /**
   * Calculate statistics for an array of values
   * 
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object} Statistics (min, max, mean, median, p95, p99)
   * @private
   */
  _calculateStats(values) {
    if (!values || values.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0],
      max: sorted[len - 1],
      mean: this._mean(values),
      median: this._percentile(sorted, 50),
      p95: this._percentile(sorted, 95),
      p99: this._percentile(sorted, 99)
    };
  }

  /**
   * Calculate mean of an array
   * 
   * @param {Array<number>} values
   * @returns {number} Mean value
   * @private
   */
  _mean(values) {
    if (!values || values.length === 0) {
      return 0;
    }
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate sum of an array
   * 
   * @param {Array<number>} values
   * @returns {number} Sum
   * @private
   */
  _sum(values) {
    if (!values || values.length === 0) {
      return 0;
    }
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Calculate percentile from sorted array
   * 
   * @param {Array<number>} sortedValues - Pre-sorted array
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   * @private
   */
  _percentile(sortedValues, percentile) {
    if (!sortedValues || sortedValues.length === 0) {
      return 0;
    }

    if (sortedValues.length === 1) {
      return sortedValues[0];
    }

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower];
    }

    // Linear interpolation
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Get time series data for charting
   * Returns data in a format suitable for visualization
   * 
   * @param {string} metric - Metric name ('lag' or 'elu')
   * @param {number} [count] - Number of recent samples
   * @returns {Array} Time series data
   */
  getTimeSeries(metric, count) {
    const samples = this.getHistory(count);
    
    if (metric === 'lag') {
      return samples.map(sample => ({
        timestamp: sample.timestamp,
        min: sample.lag.min,
        max: sample.lag.max,
        mean: sample.lag.mean,
        p50: sample.lag.p50,
        p95: sample.lag.p95,
        p99: sample.lag.p99
      }));
    } else if (metric === 'elu') {
      return samples.map(sample => ({
        timestamp: sample.timestamp,
        utilization: sample.elu.utilization * 100, // Convert to percentage
        active: sample.elu.active,
        idle: sample.elu.idle
      }));
    } else if (metric === 'requests') {
      return samples.map(sample => ({
        timestamp: sample.timestamp,
        count: sample.requests ? sample.requests.count : 0,
        avgTime: sample.requests ? sample.requests.avgTime : 0
      }));
    }

    return [];
  }

  /**
   * Reset all stored metrics
   */
  reset() {
    this.samples = [];
    this.currentIndex = 0;
    this.sampleCount = 0;
  }

  /**
   * Get collection statistics
   * 
   * @returns {Object} Collection info
   */
  getStats() {
    return {
      historySize: this.historySize,
      sampleCount: this.sampleCount,
      currentIndex: this.currentIndex,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of stored samples
   * 
   * @returns {string} Human-readable memory size
   * @private
   */
  _estimateMemoryUsage() {
    // Rough estimate: each sample is approximately 500 bytes
    const bytesPerSample = 500;
    const totalBytes = this.sampleCount * bytesPerSample;
    
    if (totalBytes < 1024) {
      return `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      return `${(totalBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  /**
   * Export samples as JSON
   * 
   * @param {number} [count] - Number of samples to export
   * @returns {string} JSON string
   */
  exportJSON(count) {
    const samples = this.getHistory(count);
    return JSON.stringify(samples, null, 2);
  }

  /**
   * Import samples from JSON
   * 
   * @param {string} json - JSON string of samples
   */
  importJSON(json) {
    try {
      const samples = JSON.parse(json);
      if (Array.isArray(samples)) {
        this.reset();
        samples.forEach(sample => this.addSample(sample));
      }
    } catch (error) {
      throw new Error(`Failed to import samples: ${error.message}`);
    }
  }
}

module.exports = MetricsCollector;