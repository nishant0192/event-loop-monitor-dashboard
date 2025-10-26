/**
 * EventLoopMonitor Tests
 */

// FIXED: Use CommonJS instead of ES modules
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const EventLoopMonitor = require('../src/core/EventLoopMonitor');
const { sleep } = require('./setup');

describe('EventLoopMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new EventLoopMonitor({
      sampleInterval: 50,
      historySize: 10,
    });
  });

  afterEach(() => {
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
  });

  describe('Constructor', () => {
    test('should create monitor with default options', () => {
      const defaultMonitor = new EventLoopMonitor();
      expect(defaultMonitor).toBeInstanceOf(EventLoopMonitor);
      expect(defaultMonitor.options.sampleInterval).toBe(100);
      expect(defaultMonitor.options.historySize).toBe(300);
    });

    test('should create monitor with custom options', () => {
      expect(monitor.options.sampleInterval).toBe(50);
      expect(monitor.options.historySize).toBe(10);
    });

    test('should initialize with monitoring disabled', () => {
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('start() and stop()', () => {
    test('should start monitoring', async () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);
      
      // Wait for at least one sample
      await sleep(100);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      expect(metrics.lag).toBeDefined();
      expect(metrics.elu).toBeDefined();
    });

    test('should not start twice', () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);
      
      // Try starting again
      monitor.start();
      expect(monitor.isActive()).toBe(true);
    });

    test('should stop monitoring', async () => {
      monitor.start();
      await sleep(100);
      
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });

    test('should handle stop when not started', () => {
      expect(() => monitor.stop()).not.toThrow();
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('getCurrentMetrics()', () => {
    test('should return null when not monitoring', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeNull();
    });

    test('should return metrics when monitoring', async () => {
      monitor.start();
      await sleep(150); // Wait for samples
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      expect(metrics.timestamp).toBeGreaterThan(0);
      
      // Lag metrics
      expect(metrics.lag).toBeDefined();
      expect(metrics.lag.min).toBeGreaterThanOrEqual(0);
      expect(metrics.lag.max).toBeGreaterThanOrEqual(metrics.lag.min);
      expect(metrics.lag.mean).toBeGreaterThanOrEqual(0);
      expect(metrics.lag.p50).toBeGreaterThanOrEqual(0);
      expect(metrics.lag.p95).toBeGreaterThanOrEqual(0);
      expect(metrics.lag.p99).toBeGreaterThanOrEqual(0);
      
      // ELU metrics
      expect(metrics.elu).toBeDefined();
      expect(metrics.elu.utilization).toBeGreaterThanOrEqual(0);
      expect(metrics.elu.utilization).toBeLessThanOrEqual(1);
      expect(metrics.elu.active).toBeGreaterThanOrEqual(0);
      expect(metrics.elu.idle).toBeGreaterThanOrEqual(0);
      
      // Memory metrics
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(metrics.memory.heapTotal).toBeGreaterThan(0);
      expect(metrics.memory.rss).toBeGreaterThan(0);
    });

    test('should update metrics over time', async () => {
      monitor.start();
      await sleep(100);
      
      const metrics1 = monitor.getCurrentMetrics();
      const timestamp1 = metrics1.timestamp;
      
      await sleep(100);
      
      const metrics2 = monitor.getCurrentMetrics();
      const timestamp2 = metrics2.timestamp;
      
      expect(timestamp2).toBeGreaterThan(timestamp1);
    });
  });

  describe('getMetrics()', () => {
    test('should return complete metrics object', async () => {
      monitor.start();
      await sleep(150);
      
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.current).toBeTruthy();
      expect(metrics.history).toBeInstanceOf(Array);
      expect(metrics.isMonitoring).toBe(true);
    });
  });

  describe('getHistory()', () => {
    test('should return empty array when no samples', () => {
      const history = monitor.getHistory();
      expect(history).toEqual([]);
    });

    test('should return historical samples', async () => {
      monitor.start();
      await sleep(200); // Wait for multiple samples
      
      const history = monitor.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeDefined();
    });

    test('should limit history by count', async () => {
      monitor.start();
      await sleep(200);
      
      const history = monitor.getHistory(2);
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getHealth()', () => {
    test('should return health status', async () => {
      monitor.start();
      await sleep(150);
      
      const health = monitor.getHealth();
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|critical|unknown/);
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(health.message).toBeDefined();
      expect(health.issues).toBeInstanceOf(Array);
    });

    test('should return unknown status when not monitoring', () => {
      const health = monitor.getHealth();
      expect(health.status).toBe('unknown');
    });

    test('should detect healthy event loop', async () => {
      monitor.start();
      await sleep(150);
      
      const health = monitor.getHealth();
      // Under normal conditions, should be healthy
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.score).toBeGreaterThan(50);
    });

    test('should accept custom thresholds', async () => {
      monitor.start();
      await sleep(150);
      
      const health = monitor.getHealth({
        lagWarning: 1,  // Very strict
        lagCritical: 2,
        eluWarning: 0.1,
        eluCritical: 0.2,
      });
      
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });

  describe('trackRequest()', () => {
    test('should track request duration', async () => {
      monitor.start();
      await sleep(100);
      
      const before = monitor.getCurrentMetrics();
      const beforeCount = before ? before.requests.count : 0;
      
      monitor.trackRequest(50);
      
      await sleep(100);
      
      const after = monitor.getCurrentMetrics();
      expect(after.requests.count).toBeGreaterThan(beforeCount);
    });

    test('should handle multiple requests', async () => {
      monitor.start();
      await sleep(100);
      
      monitor.trackRequest(10);
      monitor.trackRequest(20);
      monitor.trackRequest(30);
      
      await sleep(100);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.requests.count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('reset()', () => {
    test('should reset all metrics', async () => {
      monitor.start();
      await sleep(150);
      
      expect(monitor.getHistory().length).toBeGreaterThan(0);
      
      monitor.reset();
      
      expect(monitor.getHistory().length).toBe(0);
    });
  });

  describe('getConfig()', () => {
    test('should return configuration', () => {
      const config = monitor.getConfig();
      expect(config).toBeDefined();
      expect(config.sampleInterval).toBe(50);
      expect(config.historySize).toBe(10);
      expect(config.isMonitoring).toBe(false);
    });

    test('should reflect monitoring state', async () => {
      monitor.start();
      const config = monitor.getConfig();
      expect(config.isMonitoring).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        monitor.start();
        await sleep(50);
        monitor.stop();
      }
      
      expect(monitor.isActive()).toBe(false);
    });

    test('should handle getting metrics immediately after start', () => {
      monitor.start();
      const metrics = monitor.getCurrentMetrics();
      // Might be null if no sample yet, that's okay
      expect(metrics === null || typeof metrics === 'object').toBe(true);
    });

    test('should handle very short sample intervals', async () => {
      const fastMonitor = new EventLoopMonitor({ sampleInterval: 10 });
      fastMonitor.start();
      await sleep(100);
      
      const metrics = fastMonitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      
      fastMonitor.stop();
    });
  });

  describe('Memory Management', () => {
    test('should respect history size limit', async () => {
      const smallMonitor = new EventLoopMonitor({
        sampleInterval: 20,
        historySize: 5,
      });
      
      smallMonitor.start();
      await sleep(300); // Collect many samples
      
      const history = smallMonitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
      
      smallMonitor.stop();
    });
  });

  describe('Integration', () => {
    test('should work with CPU-intensive task', async () => {
      monitor.start();
      await sleep(100);
      
      // Simulate CPU-intensive work
      const start = Date.now();
      while (Date.now() - start < 50) {
        Math.sqrt(Math.random());
      }
      
      await sleep(100);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      expect(metrics.lag.max).toBeGreaterThan(0);
    });
  });
});