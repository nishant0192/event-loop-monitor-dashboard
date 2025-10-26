const MetricsCollector = require('../src/core/MetricsCollector');

// Helper to create valid sample
function createSample(timestamp) {
  return {
    timestamp: timestamp || Date.now(),
    lag: { min: 1, max: 5, mean: 3, p50: 3, p95: 4, p99: 5, stddev: 1 },
    elu: { utilization: 0.5, active: 100, idle: 100 },
    requests: { count: 10, avgTime: 50, totalTime: 500 }
  };
}

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector({ historySize: 10 });
  });

  afterEach(() => {
    if (collector) {
      collector.destroy();
      collector = null;
    }
  });

  describe('Constructor', () => {
    test('should create collector with default options', () => {
      const col = new MetricsCollector();
      expect(col).toBeDefined();
      const stats = col.getStats();
      expect(stats.historySize).toBeGreaterThan(0);
      col.destroy();
    });

    test('should create collector with custom options', () => {
      const col = new MetricsCollector({ historySize: 50 });
      expect(col).toBeDefined();
      expect(col.getStats().historySize).toBe(50);
      col.destroy();
    });
  });

  describe('addSample()', () => {
    test('should add a sample', () => {
      const sample = createSample();
      collector.addSample(sample);
      expect(collector.getStats().sampleCount).toBe(1);
      expect(collector.getLatestSample()).toMatchObject(sample);
    });

    test('should handle multiple samples', () => {
      collector.addSample(createSample(1000));
      collector.addSample(createSample(2000));
      expect(collector.getStats().sampleCount).toBe(2);
    });

    test('should maintain circular buffer', () => {
      // Add more than capacity
      for (let i = 0; i < 15; i++) {
        collector.addSample(createSample(Date.now() + i));
      }
      // Should not exceed historySize
      expect(collector.getStats().sampleCount).toBe(10);
    });

    test('should keep most recent samples', () => {
      for (let i = 0; i < 15; i++) {
        collector.addSample(createSample(1000 + i));
      }
      const history = collector.getHistory();
      expect(history.length).toBe(10);
      // Should have the last 10
      expect(history[history.length - 1].timestamp).toBe(1014);
    });
  });

  describe('getLatestSample()', () => {
    test('should return null when no samples', () => {
      expect(collector.getLatestSample()).toBeNull();
    });

    test('should return latest sample', () => {
      const sample = createSample();
      collector.addSample(sample);
      expect(collector.getLatestSample()).toMatchObject(sample);
    });
  });

  describe('getHistory()', () => {
    test('should return empty array when no samples', () => {
      expect(collector.getHistory()).toEqual([]);
    });

    test('should return all samples in chronological order', () => {
      collector.addSample(createSample(1000));
      collector.addSample(createSample(2000));
      const history = collector.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].timestamp).toBe(1000);
      expect(history[1].timestamp).toBe(2000);
    });

    test('should limit by count parameter', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createSample(1000 + i * 1000));
      }
      const history = collector.getHistory({ count: 3 });
      expect(history.length).toBe(3);
    });

    test('should return most recent samples when limited', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createSample(1000 + i * 1000));
      }
      const history = collector.getHistory({ count: 2 });
      expect(history.length).toBe(2);
      expect(history[0].timestamp).toBe(4000);
      expect(history[1].timestamp).toBe(5000);
    });
  });

  describe('getAggregatedMetrics()', () => {
    test('should return null when no samples', () => {
      expect(collector.getAggregatedMetrics()).toBeNull();
    });

    test('should calculate aggregated metrics', () => {
      collector.addSample(createSample(1000));
      collector.addSample(createSample(2000));
      
      const aggregated = collector.getAggregatedMetrics();
      expect(aggregated).toBeDefined();
      expect(aggregated.lag).toBeDefined();
      expect(aggregated.lag.min).toBeDefined();
      expect(aggregated.lag.max).toBeDefined();
    });

    test('should respect duration parameter', () => {
      const now = Date.now();
      collector.addSample(createSample(now - 10000));
      collector.addSample(createSample(now));
      
      const aggregated = collector.getAggregatedMetrics({ duration: 5000 });
      expect(aggregated).toBeDefined();
    });
  });

  describe('getTimeSeries()', () => {
    test('should return empty array when no samples', () => {
      expect(collector.getTimeSeries('lag')).toEqual([]);
    });

    test('should return lag time series', () => {
      collector.addSample(createSample(1000));
      const series = collector.getTimeSeries('lag');
      expect(series.length).toBe(1);
      expect(series[0].timestamp).toBe(1000);
      expect(series[0].min).toBeDefined();
    });

    test('should return elu time series', () => {
      collector.addSample(createSample(1000));
      const series = collector.getTimeSeries('elu');
      expect(series.length).toBe(1);
      expect(series[0].timestamp).toBe(1000);
      expect(series[0].utilization).toBeDefined();
    });

    test('should return requests time series', () => {
      collector.addSample(createSample(1000));
      const series = collector.getTimeSeries('requests');
      expect(series.length).toBe(1);
      expect(series[0].timestamp).toBe(1000);
    });

    test('should limit by count parameter', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createSample(1000 + i * 1000));
      }
      const series = collector.getTimeSeries('lag', { count: 3 });
      expect(series.length).toBe(3);
    });
  });

  describe('reset()', () => {
    test('should clear all samples', () => {
      for (let i = 0; i < 5; i++) {
        collector.addSample(createSample(Date.now() + i));
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
        collector.addSample(createSample(Date.now() + i));
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
        collector.addSample(createSample(Date.now() + i));
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
        createSample(1000),
        createSample(2000),
        createSample(3000),
      ];
      
      const json = JSON.stringify({ samples });
      
      collector.importJSON(json);
      
      const history = collector.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].timestamp).toBe(1000);
    });

    test('should handle export and import round trip', () => {
      const original = [
        createSample(1000),
        createSample(2000),
      ];
      
      original.forEach(s => collector.addSample(s));
      
      const json = collector.exportJSON();
      
      const newCollector = new MetricsCollector();
      newCollector.importJSON(json);
      
      const imported = newCollector.getHistory();
      expect(imported.length).toBe(2);
      expect(imported[0].timestamp).toBe(1000);
      
      newCollector.destroy();
    });
  });

  describe('Edge Cases', () => {
    test('should handle samples with missing fields gracefully', () => {
      const incompleteSample = {
        timestamp: Date.now(),
        lag: { min: 1, max: 5, mean: 3 }
      };
      
      // Should handle gracefully
      expect(() => {
        collector.addSample(incompleteSample);
      }).not.toThrow();
    });

    test('should handle zero history size', () => {
      const col = new MetricsCollector({ historySize: 0 });
      
      col.addSample(createSample());
      
      // With zero history, nothing is stored
      expect(col.getStats().sampleCount).toBe(0);
      col.destroy();
    });
  });
});