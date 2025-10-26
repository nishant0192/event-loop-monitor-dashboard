/**
 * MetricsCollector Tests
 */

const MetricsCollector = require('../src/core/MetricsCollector');
const { describe, test, expect, beforeEach } = require('@jest/globals');

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector({
      historySize: 10,
    });
  });

  describe('Constructor', () => {
    test('should create collector with default options', () => {
      const defaultCollector = new MetricsCollector();
      expect(defaultCollector).toBeInstanceOf(MetricsCollector);
    });

    test('should create collector with custom options', () => {
      expect(collector).toBeInstanceOf(MetricsCollector);
    });
  });

  describe('addSample()', () => {
    test('should add a sample', () => {
      const sample = createMockSample();
      collector.addSample(sample);
      
      const latest = collector.getLatestSample();
      expect(latest).toBeTruthy();
      expect(latest.timestamp).toBe(sample.timestamp);
    });

    test('should handle multiple samples', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const history = collector.getHistory();
      expect(history.length).toBe(5);
    });

    test('should maintain circular buffer', () => {
      // Add more samples than history size
      for (let i = 0; i < 15; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const history = collector.getHistory();
      expect(history.length).toBe(10); // Should be limited to historySize
    });

    test('should keep most recent samples', () => {
      const timestamps = [];
      for (let i = 0; i < 15; i++) {
        const timestamp = Date.now() + i * 1000;
        timestamps.push(timestamp);
        collector.addSample(createMockSample(timestamp));
      }
      
      const history = collector.getHistory();
      const historyTimestamps = history.map(s => s.timestamp);
      
      // Should have last 10 timestamps
      expect(historyTimestamps).toEqual(timestamps.slice(-10));
    });
  });

  describe('getLatestSample()', () => {
    test('should return null when no samples', () => {
      const latest = collector.getLatestSample();
      expect(latest).toBeNull();
    });

    test('should return latest sample', () => {
      const sample1 = createMockSample(1000);
      const sample2 = createMockSample(2000);
      
      collector.addSample(sample1);
      collector.addSample(sample2);
      
      const latest = collector.getLatestSample();
      expect(latest.timestamp).toBe(2000);
    });
  });

  describe('getHistory()', () => {
    test('should return empty array when no samples', () => {
      const history = collector.getHistory();
      expect(history).toEqual([]);
    });

    test('should return all samples in chronological order', () => {
      const timestamps = [1000, 2000, 3000];
      timestamps.forEach(ts => {
        collector.addSample(createMockSample(ts));
      });
      
      const history = collector.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].timestamp).toBe(1000);
      expect(history[2].timestamp).toBe(3000);
    });

    test('should limit by count parameter', () => {
      for (let i = 0; i < 10; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const history = collector.getHistory(5);
      expect(history.length).toBe(5);
    });

    test('should return most recent samples when limited', () => {
      const timestamps = [];
      for (let i = 0; i < 10; i++) {
        const ts = 1000 + i * 100;
        timestamps.push(ts);
        collector.addSample(createMockSample(ts));
      }
      
      const history = collector.getHistory(3);
      expect(history.length).toBe(3);
      expect(history[0].timestamp).toBe(1700); // Last 3
      expect(history[2].timestamp).toBe(1900);
    });
  });

  describe('getAggregatedMetrics()', () => {
    test('should return null when no samples', () => {
      const aggregated = collector.getAggregatedMetrics();
      expect(aggregated).toBeNull();
    });

    test('should calculate aggregated metrics', () => {
      // Add samples with known values
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i, {
          lagMean: 10 + i,
          eluUtilization: 0.5,
        }));
      }
      
      const aggregated = collector.getAggregatedMetrics();
      expect(aggregated).toBeTruthy();
      expect(aggregated.lag).toBeDefined();
      expect(aggregated.lag.mean).toBeDefined();
      expect(aggregated.elu).toBeDefined();
      expect(aggregated.elu.utilization).toBeDefined();
    });

    test('should respect duration parameter', () => {
      const now = Date.now();
      
      // Add old sample
      collector.addSample(createMockSample(now - 10000));
      
      // Add recent samples
      collector.addSample(createMockSample(now - 100));
      collector.addSample(createMockSample(now));
      
      // Only get metrics from last second
      const aggregated = collector.getAggregatedMetrics(1000);
      expect(aggregated).toBeTruthy();
    });
  });

  describe('getTimeSeries()', () => {
    test('should return empty array when no samples', () => {
      const timeSeries = collector.getTimeSeries('lag');
      expect(timeSeries).toEqual([]);
    });

    test('should return lag time series', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const timeSeries = collector.getTimeSeries('lag');
      expect(timeSeries.length).toBe(5);
      expect(timeSeries[0].timestamp).toBeDefined();
      expect(timeSeries[0].mean).toBeDefined();
      expect(timeSeries[0].p95).toBeDefined();
    });

    test('should return elu time series', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const timeSeries = collector.getTimeSeries('elu');
      expect(timeSeries.length).toBe(5);
      expect(timeSeries[0].timestamp).toBeDefined();
      expect(timeSeries[0].utilization).toBeDefined();
    });

    test('should return requests time series', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i, {
          requestCount: i + 1,
          requestAvgTime: 100,
        }));
      }
      
      const timeSeries = collector.getTimeSeries('requests');
      expect(timeSeries.length).toBe(5);
      expect(timeSeries[0].timestamp).toBeDefined();
      expect(timeSeries[0].count).toBeDefined();
    });

    test('should limit by count parameter', () => {
      for (let i = 0; i < 10; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const timeSeries = collector.getTimeSeries('lag', { count: 5 });
      expect(timeSeries.length).toBe(5);
    });
  });

  describe('reset()', () => {
    test('should clear all samples', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      expect(collector.getHistory().length).toBe(5);
      
      collector.reset();
      
      expect(collector.getHistory().length).toBe(0);
      expect(collector.getLatestSample()).toBeNull();
    });
  });

  describe('getStats()', () => {
    test('should return collection statistics', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const stats = collector.getStats();
      expect(stats).toBeDefined();
      expect(stats.historySize).toBe(10);
      expect(stats.sampleCount).toBe(5);
      expect(stats.memoryUsage).toBeDefined();
    });
  });

  describe('exportJSON() and importJSON()', () => {
    test('should export samples as JSON', () => {
      for (let i = 0; i < 3; i++) {
        collector.addSample(createMockSample(Date.now() + i));
      }
      
      const json = collector.exportJSON();
      expect(json).toBeTruthy();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.samples).toBeDefined();
      expect(parsed.samples.length).toBe(3);
    });

    test('should import samples from JSON', () => {
      const samples = [
        createMockSample(1000),
        createMockSample(2000),
        createMockSample(3000),
      ];
      
      const json = JSON.stringify({ samples });
      
      collector.importJSON(json);
      
      const history = collector.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].timestamp).toBe(1000);
    });

    test('should handle export and import round trip', () => {
      const original = [
        createMockSample(1000),
        createMockSample(2000),
      ];
      
      original.forEach(s => collector.addSample(s));
      
      const json = collector.exportJSON();
      
      const newCollector = new MetricsCollector();
      newCollector.importJSON(json);
      
      const imported = newCollector.getHistory();
      expect(imported.length).toBe(2);
      expect(imported[0].timestamp).toBe(1000);
      expect(imported[1].timestamp).toBe(2000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle samples with missing fields gracefully', () => {
      const incompleteSample = {
        timestamp: Date.now(),
        lag: { mean: 5 },
        // Missing other fields
      };
      
      // Should not throw
      expect(() => collector.addSample(incompleteSample)).not.toThrow();
    });

    test('should handle zero history size', () => {
      const zeroCollector = new MetricsCollector({ historySize: 1 });
      zeroCollector.addSample(createMockSample());
      
      const history = zeroCollector.getHistory();
      expect(history.length).toBeLessThanOrEqual(1);
    });
  });
});

// Helper function to create mock samples
function createMockSample(timestamp = Date.now(), overrides = {}) {
  return {
    timestamp,
    lag: {
      min: overrides.lagMin || 1,
      max: overrides.lagMax || 10,
      mean: overrides.lagMean || 5,
      stddev: overrides.lagStddev || 2,
      p50: overrides.lagP50 || 4,
      p90: overrides.lagP90 || 8,
      p95: overrides.lagP95 || 9,
      p99: overrides.lagP99 || 10,
      p999: overrides.lagP999 || 10,
    },
    elu: {
      utilization: overrides.eluUtilization || 0.5,
      active: overrides.eluActive || 50,
      idle: overrides.eluIdle || 50,
    },
    memory: {
      heapUsed: overrides.heapUsed || 50000000,
      heapTotal: overrides.heapTotal || 100000000,
      external: overrides.external || 1000000,
      rss: overrides.rss || 120000000,
      heapUsedMB: overrides.heapUsedMB || '50.00',
      heapTotalMB: overrides.heapTotalMB || '100.00',
      rssMB: overrides.rssMB || '120.00',
    },
    cpu: {
      user: overrides.cpuUser || 100,
      system: overrides.cpuSystem || 50,
      total: overrides.cpuTotal || 150,
    },
    handles: {
      active: overrides.handlesActive || 10,
      requests: overrides.handlesRequests || 5,
      total: overrides.handlesTotal || 15,
    },
    requests: {
      count: overrides.requestCount || 0,
      totalTime: overrides.requestTotalTime || 0,
      avgTime: overrides.requestAvgTime || 0,
    },
  };
}