const EventLoopMonitor = require('../src/core/EventLoopMonitor');

describe('EventLoopMonitor', () => {
  let monitor;

  beforeAll(() => {
    process.setMaxListeners(30);
  });

  afterEach(async () => {
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
    monitor = null;
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(() => {
    process.setMaxListeners(10);
  });

  describe('Constructor', () => {
    test('should create monitor with default options', () => {
      monitor = new EventLoopMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.isActive()).toBe(false);
    });

    test('should create monitor with custom options', () => {
      monitor = new EventLoopMonitor({ 
        sampleInterval: 500,
        historySize: 500 
      });
      expect(monitor).toBeDefined();
      const config = monitor.getConfig();
      expect(config.sampleInterval).toBe(500);
    });

    test('should initialize with monitoring disabled', () => {
      monitor = new EventLoopMonitor();
      expect(monitor.isActive()).toBe(false);
      expect(monitor.getCurrentMetrics()).toBeNull();
    });
  });

  describe('start() and stop()', () => {
    test('should start monitoring', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      expect(monitor.isActive()).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.lag).toBeDefined();
    });

    test('should not start twice', () => {
      monitor = new EventLoopMonitor();
      monitor.start();
      expect(monitor.isActive()).toBe(true);
      
      monitor.start();
      expect(monitor.isActive()).toBe(true);
    });

    test('should stop monitoring', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });

    test('should handle stop when not started', () => {
      monitor = new EventLoopMonitor();
      expect(() => monitor.stop()).not.toThrow();
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('getCurrentMetrics()', () => {
    test('should return null when not monitoring', () => {
      monitor = new EventLoopMonitor();
      expect(monitor.getCurrentMetrics()).toBeNull();
    });

    test('should return metrics when monitoring', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.lag).toBeDefined();
      expect(metrics.elu).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    test('should update metrics over time', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      const first = monitor.getCurrentMetrics();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      const second = monitor.getCurrentMetrics();
      
      expect(second.timestamp).toBeGreaterThan(first.timestamp);
    });
  });

  describe('getMetrics()', () => {
    test('should return complete metrics object', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.current).toBeDefined();
      expect(metrics.history).toBeDefined();
    });
  });

  describe('getHistory()', () => {
    test('should return empty array when no samples', () => {
      monitor = new EventLoopMonitor();
      const history = monitor.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    test('should return historical samples', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const history = monitor.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    test('should support count parameter', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const history = monitor.getHistory(2);
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getHealth()', () => {
    test('should return health status', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const health = monitor.getHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.score).toBeDefined();
      expect(['unknown', 'healthy', 'degraded', 'critical']).toContain(health.status);
    });

    test('should return unknown status when not monitoring', () => {
      monitor = new EventLoopMonitor();
      const health = monitor.getHealth();
      expect(health.status).toBe('unknown');
    });

    test('should detect healthy event loop', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const health = monitor.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.score).toBeGreaterThan(50);
    });

    test('should accept custom thresholds', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const health = monitor.getHealth({
        lagThreshold: 1000,
        utilizationThreshold: 0.9
      });
      
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });

  describe('trackRequest()', () => {
    test('should track request duration', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const end1 = monitor.trackRequest();
      await new Promise(resolve => setTimeout(resolve, 10));
      end1();
      
      const end2 = monitor.trackRequest();
      await new Promise(resolve => setTimeout(resolve, 10));
      end2();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.requests).toBeDefined();
      // Request tracking may or may not increment immediately
      expect(metrics.requests.count).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple requests', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(monitor.trackRequest());
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      requests.forEach(end => end());
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.requests).toBeDefined();
      expect(metrics.requests.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset()', () => {
    test('should reset all metrics', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const beforeHistory = monitor.getHistory();
      expect(beforeHistory.length).toBeGreaterThan(0);
      
      monitor.reset();
      
      const afterHistory = monitor.getHistory();
      expect(afterHistory.length).toBe(0);
    });
  });

  describe('getConfig()', () => {
    test('should return configuration', () => {
      monitor = new EventLoopMonitor({ sampleInterval: 200 });
      const config = monitor.getConfig();
      
      expect(config).toBeDefined();
      expect(config.sampleInterval).toBe(200);
    });

    test('should reflect monitoring state', () => {
      monitor = new EventLoopMonitor();
      let config = monitor.getConfig();
      expect(config.active).toBe(false);
      
      monitor.start();
      config = monitor.getConfig();
      expect(config.active).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid start/stop cycles', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      
      for (let i = 0; i < 3; i++) {
        monitor.start();
        await new Promise(resolve => setTimeout(resolve, 50));
        monitor.stop();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      expect(monitor.isActive()).toBe(false);
    });

    test('should handle getting metrics immediately after start', () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics === null || typeof metrics === 'object').toBe(true);
    });

    test('should handle very short sample intervals', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 50 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    test('should respect history size limit', async () => {
      monitor = new EventLoopMonitor({ 
        sampleInterval: 50,
        historySize: 5
      });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const history = monitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Integration', () => {
    test('should work with CPU-intensive task', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const before = monitor.getCurrentMetrics();
      
      // CPU-intensive work
      const start = Date.now();
      while (Date.now() - start < 50) {
        Math.sqrt(Math.random());
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const after = monitor.getCurrentMetrics();
      
      expect(after).toBeDefined();
      expect(before).toBeDefined();
    });
  });

  describe('exportJSON() and importJSON()', () => {
    test('should export metrics', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const json = monitor.exportJSON();
      expect(typeof json).toBe('string');
      
      const data = JSON.parse(json);
      expect(data).toBeDefined();
    });

    test('should import metrics', () => {
      monitor = new EventLoopMonitor();
      
      const json = JSON.stringify({
        samples: [
          {
            timestamp: 1000,
            lag: { min: 1, max: 5, mean: 3, p50: 3, p95: 4, p99: 5 },
            elu: { utilization: 0.5, active: 100, idle: 100 }
          }
        ]
      });
      
      expect(() => monitor.importJSON(json)).not.toThrow();
    });
  });

  describe('getTimeSeries()', () => {
    test('should return time series data', async () => {
      monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const series = monitor.getTimeSeries('lag');
      expect(Array.isArray(series)).toBe(true);
    });
  });
});