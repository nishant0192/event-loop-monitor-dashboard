/**
 * Integration Tests
 * 
 * Test the full package working together
 */

const express = require('express');
const request = require('supertest');
const { 
  eventLoopMonitor, 
  prometheusExporter,
  createMonitor,
  createAlertManager,
  EventLoopMonitor 
} = require('../src/index');
const { describe, test, expect, afterEach } = require('@jest/globals');
const { sleep } = require('./setup.js');

describe('Integration Tests', () => {
  let app;
  let server;

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Complete Application Setup', () => {
    test('should setup full monitoring stack', async () => {
      app = express();
      
      // Setup monitoring
      const alerts = [];
      app.use(eventLoopMonitor({
        path: '/monitor',
        sampleInterval: 50,
        thresholds: {
          lagWarning: 50,
          lagCritical: 100,
        },
        onAlert: (alert) => alerts.push(alert),
      }));
      
      // Add Prometheus endpoint
      app.get('/metrics', prometheusExporter());
      
      // Add application routes
      app.get('/api/test', (req, res) => {
        res.json({ ok: true });
      });
      
      app.get('/api/cpu', (req, res) => {
        // CPU intensive
        const start = Date.now();
        while (Date.now() - start < 50) {
          Math.sqrt(Math.random());
        }
        res.json({ ok: true });
      });
      
      server = app.listen(0);
      
      // Wait for monitoring to start
      await sleep(200);
      
      // Test dashboard
      const dashboardResponse = await request(app).get('/monitor/');
      expect(dashboardResponse.status).toBe(200);
      
      // Test API endpoint
      const apiResponse = await request(app).get('/api/test');
      expect(apiResponse.status).toBe(200);
      
      // Test Prometheus
      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.status).toBe(200);
      
      // Test monitoring API
      const monitorResponse = await request(app).get('/monitor/api/current');
      expect(monitorResponse.status).toBe(200);
      expect(monitorResponse.body.data).toBeDefined();
    });

    test('should track requests across application', async () => {
      app = express();
      app.use(eventLoopMonitor());
      
      app.get('/test1', (req, res) => res.send('OK'));
      app.get('/test2', (req, res) => res.send('OK'));
      app.get('/test3', (req, res) => res.send('OK'));
      
      server = app.listen(0);
      await sleep(100);
      
      // Make multiple requests
      await request(app).get('/test1');
      await request(app).get('/test2');
      await request(app).get('/test3');
      
      await sleep(100);
      
      const response = await request(app).get('/event-loop-stats/api/current');
      const metrics = response.body.data;
      
      expect(metrics.requests.count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Standalone Monitor Usage', () => {
    test('should create standalone monitor', async () => {
      const monitor = createMonitor({
        sampleInterval: 50,
        historySize: 20,
      });
      
      expect(monitor).toBeInstanceOf(EventLoopMonitor);
      expect(monitor.isActive()).toBe(false);
      
      monitor.start();
      expect(monitor.isActive()).toBe(true);
      
      await sleep(150);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      expect(metrics.lag).toBeDefined();
      
      monitor.stop();
    });

    test('should create alert manager for standalone monitor', async () => {
      const monitor = createMonitor({ sampleInterval: 50 });
      
      const alerts = [];
      const alertManager = createAlertManager(monitor, {
        thresholds: {
          lagWarning: 30,
          lagCritical: 60,
        },
        onAlert: (alert) => alerts.push(alert),
        checkInterval: 100,
      });
      
      monitor.start();
      alertManager.start();
      
      await sleep(200);
      
      // Create high lag
      const start = Date.now();
      while (Date.now() - start < 70) {
        Math.sqrt(Math.random());
      }
      
      await sleep(200);
      
      // Should have triggered alert (maybe)
      const stats = alertManager.getAlertStats();
      expect(stats).toBeDefined();
      
      alertManager.stop();
      monitor.stop();
    });
  });

  describe('Event Loop Lag Detection', () => {
    test('should detect blocking operations', async () => {
      const monitor = createMonitor({ sampleInterval: 20 });
      monitor.start();
      
      await sleep(100);
      
      // Get baseline
      const before = monitor.getCurrentMetrics();
      const baselineLag = before.lag.mean;
      
      // Block event loop
      const blockStart = Date.now();
      while (Date.now() - blockStart < 100) {
        Math.sqrt(Math.random());
      }
      
      await sleep(150);
      
      // Get metrics after blocking
      const after = monitor.getCurrentMetrics();
      const afterLag = after.lag.mean;
      
      // Lag should have increased (though this is timing-dependent)
      expect(afterLag).toBeGreaterThan(0);
      expect(after.lag.max).toBeGreaterThan(baselineLag);
      
      monitor.stop();
    });

    test('should show low lag for async operations', async () => {
      const monitor = createMonitor({ sampleInterval: 50 });
      monitor.start();
      
      await sleep(100);
      
      // Async operation (doesn't block)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await sleep(100);
      
      const metrics = monitor.getCurrentMetrics();
      
      // Lag should stay reasonable
      expect(metrics.lag.mean).toBeLessThan(50); // Less than 50ms average lag
      
      monitor.stop();
    });
  });

  describe('Multiple Monitors', () => {
    test('should support multiple independent monitors', async () => {
      const monitor1 = createMonitor({ sampleInterval: 50 });
      const monitor2 = createMonitor({ sampleInterval: 100 });
      
      monitor1.start();
      monitor2.start();
      
      await sleep(200);
      
      const metrics1 = monitor1.getCurrentMetrics();
      const metrics2 = monitor2.getCurrentMetrics();
      
      expect(metrics1).toBeTruthy();
      expect(metrics2).toBeTruthy();
      
      // Should have different sample counts
      const history1 = monitor1.getHistory();
      const history2 = monitor2.getHistory();
      
      // Monitor1 should have more samples (faster sampling)
      expect(history1.length).toBeGreaterThan(history2.length);
      
      monitor1.stop();
      monitor2.stop();
    });
  });

  describe('Real-world Scenario', () => {
    test('should handle mixed workload', async () => {
      app = express();
      app.use(eventLoopMonitor({ sampleInterval: 30 }));
      
      // Fast endpoint
      app.get('/fast', (req, res) => {
        res.json({ result: 'fast' });
      });
      
      // Slow async endpoint
      app.get('/slow-async', async (req, res) => {
        await sleep(100);
        res.json({ result: 'slow-async' });
      });
      
      // CPU intensive endpoint
      app.get('/cpu', (req, res) => {
        const start = Date.now();
        let result = 0;
        while (Date.now() - start < 50) {
          result += Math.sqrt(Math.random());
        }
        res.json({ result });
      });
      
      server = app.listen(0);
      await sleep(100);
      
      // Make various requests
      await Promise.all([
        request(app).get('/fast'),
        request(app).get('/fast'),
        request(app).get('/slow-async'),
        request(app).get('/cpu'),
      ]);
      
      await sleep(150);
      
      const response = await request(app).get('/event-loop-stats/api/current');
      const metrics = response.body.data;
      
      expect(metrics.requests.count).toBeGreaterThanOrEqual(4);
      expect(metrics.lag.max).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Functionality', () => {
    test('should provide complete dashboard data', async () => {
      app = express();
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data).toBeDefined();
      
      const data = response.body.data;
      expect(data.current).toBeDefined();
      expect(data.history).toBeDefined();
      expect(data.health).toBeDefined();
      expect(data.config).toBeDefined();
    });

    test('should serve time series data', async () => {
      app = express();
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      await sleep(200);
      
      const lagResponse = await request(app)
        .get('/event-loop-stats/api/timeseries?metric=lag');
      
      expect(lagResponse.status).toBe(200);
      expect(Array.isArray(lagResponse.body.data)).toBe(true);
      
      const eluResponse = await request(app)
        .get('/event-loop-stats/api/timeseries?metric=elu');
      
      expect(eluResponse.status).toBe(200);
      expect(Array.isArray(eluResponse.body.data)).toBe(true);
    });
  });

  describe('Export and Health Checks', () => {
    test('should export metrics', async () => {
      app = express();
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/export');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/json/);
      
      const data = JSON.parse(response.text);
      expect(data.samples).toBeDefined();
      expect(Array.isArray(data.samples)).toBe(true);
    });

    test('should provide health check endpoint', async () => {
      app = express();
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.data.status).toMatch(/healthy|degraded|critical/);
      expect(response.body.data.score).toBeGreaterThanOrEqual(0);
      expect(response.body.data.score).toBeLessThanOrEqual(100);
    });
  });
});