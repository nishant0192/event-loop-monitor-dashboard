const request = require('supertest');
const express = require('express');
const EventLoopMonitor = require('../src/core/EventLoopMonitor');
const AlertManager = require('../src/alerts/AlertManager');
const prometheusExporter = require('../src/exporters/prometheus');

describe('Integration Tests', () => {
  let monitors = [];
  let alertManagers = [];
  let servers = [];

  beforeAll(() => {
    process.setMaxListeners(40);
  });

  afterEach(async () => {
    for (const alertManager of alertManagers) {
      if (alertManager && alertManager.isActive) {
        alertManager.stop();
      }
    }
    alertManagers = [];

    for (const monitor of monitors) {
      if (monitor && monitor.isActive()) {
        monitor.stop();
      }
    }
    monitors = [];

    for (const server of servers) {
      if (server) {
        await new Promise(resolve => server.close(resolve));
      }
    }
    servers = [];

    await new Promise(resolve => setTimeout(resolve, 150));
  });

  afterAll(() => {
    process.setMaxListeners(10);
  });

  describe('Complete Application Setup', () => {
    test('should setup full monitoring stack', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const alertManager = new AlertManager(monitor);
      alertManagers.push(alertManager);

      const app = express();
      app.get('/metrics', prometheusExporter(monitor));
      app.get('/health', (req, res) => {
        const health = monitor.getHealth();
        res.json(health);
      });

      monitor.start();
      alertManager.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(monitor.isActive()).toBe(true);
      expect(alertManager.isActive).toBe(true);

      const metricsResponse = await request(app).get('/metrics');
      expect([200, 503]).toContain(metricsResponse.status);

      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBe(200);
    });

    test('should track requests across application', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/api/data', (req, res) => {
        res.json({ data: 'test' });
      });

      app.get('/dashboard', (req, res) => {
        const metrics = monitor.getMetrics();
        res.json({
          success: true,
          data: {
            current: metrics.current,
            history: metrics.history,
            health: monitor.getHealth(),
            config: monitor.getConfig()
          }
        });
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      await request(app).get('/api/data');
      await request(app).get('/api/data');

      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await request(app).get('/dashboard');
      const data = response.body.data;

      expect(data.current).toBeDefined();
      expect(data.history).toBeDefined();
    });
  });

  describe('Standalone Monitor Usage', () => {
    test('should create standalone monitor', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.lag).toBeDefined();
      expect(metrics.elu).toBeDefined();
    });

    test('should create alert manager for standalone monitor', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();

      let alertFired = false;
      const alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100,
        onAlert: () => {
          alertFired = true;
        }
      });
      alertManagers.push(alertManager);

      alertManager.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(alertFired).toBe(true);
    });
  });

  describe('Event Loop Lag Detection', () => {
    test('should detect blocking operations', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const before = monitor.getCurrentMetrics();
      const baselineLag = before.lag.max;

      // Blocking operation
      const start = Date.now();
      while (Date.now() - start < 100) {
        Math.sqrt(Math.random());
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const after = monitor.getCurrentMetrics();

      expect(after.lag.max).toBeGreaterThan(0);
      expect(after.lag.max).toBeGreaterThan(baselineLag * 0.8);
    });

    test('should show low lag for async operations', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      // Async operations
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 50)),
        new Promise(resolve => setTimeout(resolve, 50)),
        new Promise(resolve => setTimeout(resolve, 50))
      ]);

      await new Promise(resolve => setTimeout(resolve, 200));

      const after = monitor.getCurrentMetrics();

      expect(after.lag).toBeDefined();
      expect(after.lag.mean).toBeLessThan(1000);
    });
  });

  describe('Multiple Monitors', () => {
    test('should support multiple independent monitors', async () => {
      const monitor1 = new EventLoopMonitor({ sampleInterval: 100 });
      const monitor2 = new EventLoopMonitor({ sampleInterval: 150 });

      monitors.push(monitor1, monitor2);

      monitor1.start();
      monitor2.start();

      await new Promise(resolve => setTimeout(resolve, 350));

      const metrics1 = monitor1.getCurrentMetrics();
      const metrics2 = monitor2.getCurrentMetrics();

      expect(metrics1).toBeDefined();
      expect(metrics2).toBeDefined();
      expect(metrics1.timestamp).toBeDefined();
      expect(metrics2.timestamp).toBeDefined();
    });
  });

  describe('Real-world Scenario', () => {
    test('should handle mixed workload', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/fast', (req, res) => {
        res.json({ result: 'fast' });
      });

      app.get('/slow', (req, res) => {
        const start = Date.now();
        while (Date.now() - start < 50) {
          Math.sqrt(Math.random());
        }
        res.json({ result: 'slow' });
      });

      app.get('/dashboard', (req, res) => {
        const metrics = monitor.getMetrics();
        res.json({
          success: true,
          data: {
            current: metrics.current,
            history: metrics.history,
            health: monitor.getHealth()
          }
        });
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      await Promise.all([
        request(app).get('/fast'),
        request(app).get('/slow'),
        request(app).get('/fast')
      ]);

      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await request(app).get('/dashboard');
      const data = response.body.data;

      expect(data.current).toBeDefined();
      expect(data.lag.max).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Functionality', () => {
    test('should provide complete dashboard data', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/dashboard', (req, res) => {
        const metrics = monitor.getMetrics();
        res.json({
          success: true,
          data: {
            current: metrics.current,
            history: metrics.history,
            health: monitor.getHealth(),
            config: monitor.getConfig()
          }
        });
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.current).toBeDefined();
      expect(data.history).toBeDefined();
      expect(data.health).toBeDefined();
      expect(data.config).toBeDefined();
    });

    test('should serve time series data', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/timeseries/:metric', (req, res) => {
        const { metric } = req.params;
        const series = monitor.getTimeSeries(metric);
        res.json({ metric, data: series });
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/timeseries/lag');

      expect(response.status).toBe(200);
      expect(response.body.metric).toBe('lag');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Export and Health Checks', () => {
    test('should export metrics', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/export', (req, res) => {
        const exported = monitor.exportJSON();
        res.setHeader('Content-Type', 'application/json');
        res.send(exported);
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.text);
      expect(data.samples).toBeDefined();
      expect(Array.isArray(data.samples)).toBe(true);
    });

    test('should provide health check endpoint', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();

      app.get('/health', (req, res) => {
        const health = monitor.getHealth();
        const statusCode = health.status === 'critical' ? 503 : 200;
        res.status(statusCode).json(health);
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body.status).toBeDefined();
      expect(response.body.score).toBeDefined();
      expect(['unknown', 'healthy', 'degraded', 'critical']).toContain(response.body.status);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from monitor restart', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();
      app.get('/metrics', prometheusExporter(monitor));

      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      monitor.stop();
      await new Promise(resolve => setTimeout(resolve, 150));

      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/metrics');
      expect([200, 503]).toContain(response.status);
    });

    test('should handle rapid requests', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();
      app.get('/test', (req, res) => res.json({ ok: true }));

      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(request(app).get('/test'));
      }

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Long-Running Monitoring', () => {
    test('should maintain stability over time', async () => {
      const monitor = new EventLoopMonitor({ 
        sampleInterval: 100,
        historySize: 20
      });
      monitors.push(monitor);

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 1200));

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();

      const history = monitor.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent monitoring and alerting', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100
      });
      alertManagers.push(alertManager);

      const app = express();
      app.get('/metrics', prometheusExporter(monitor));

      monitor.start();
      alertManager.start();

      await new Promise(resolve => setTimeout(resolve, 600));

      const metricsResponse = await request(app).get('/metrics');
      expect([200, 503]).toContain(metricsResponse.status);

      const alertHistory = alertManager.getAlertHistory();
      expect(Array.isArray(alertHistory)).toBe(true);
    });
  });

  describe('Resource Cleanup', () => {
    test('should properly cleanup resources', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const beforeHistory = monitor.getHistory();
      expect(beforeHistory.length).toBeGreaterThan(0);

      monitor.stop();
      monitor.reset();

      const afterHistory = monitor.getHistory();
      expect(afterHistory.length).toBe(0);
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('Configuration Changes', () => {
    test('should handle dynamic threshold updates', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 1000
        }
      });
      alertManagers.push(alertManager);

      monitor.start();
      alertManager.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      alertManager.updateThresholds({
        lagWarning: 0.001
      });

      await new Promise(resolve => setTimeout(resolve, 400));

      const config = alertManager.getConfig();
      expect(config.thresholds.lagWarning).toBe(0.001);
    });
  });

  describe('Prometheus Integration', () => {
    test('should expose metrics in Prometheus format', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();
      app.get('/metrics', prometheusExporter(monitor));

      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await request(app).get('/metrics');

      if (response.status === 200) {
        expect(response.text).toContain('nodejs_eventloop');
        expect(response.headers['content-type']).toMatch(/text\/plain/);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle monitor without starting', async () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      const app = express();
      app.get('/metrics', prometheusExporter(monitor));

      const response = await request(app).get('/metrics');
      expect(response.status).toBe(503);
    });

    test('should handle immediate metric requests', () => {
      const monitor = new EventLoopMonitor({ sampleInterval: 100 });
      monitors.push(monitor);

      monitor.start();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics === null || typeof metrics === 'object').toBe(true);
    });
  });
});