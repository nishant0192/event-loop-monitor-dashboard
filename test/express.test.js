/**
 * Express Middleware Tests
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const express = require('express');
const request = require('supertest');
const { eventLoopMonitor, getGlobalMonitor, cleanup } = require('../src/middleware/express');
const { sleep } = require('./setup.js');

describe('Express Middleware', () => {
  let app;
  let server;

  beforeEach(() => {
    app = express();
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    cleanup();
  });

  describe('Basic Setup', () => {
    test('should mount middleware', () => {
      expect(() => {
        app.use(eventLoopMonitor());
      }).not.toThrow();
    });

    test('should accept custom options', () => {
      expect(() => {
        app.use(eventLoopMonitor({
          path: '/custom-path',
          sampleInterval: 50,
          historySize: 100,
        }));
      }).not.toThrow();
    });
  });

  describe('Dashboard Route', () => {
    beforeEach(() => {
      app.use(eventLoopMonitor({ path: '/event-loop-stats' }));
      server = app.listen(0);
    });

    test('should serve dashboard HTML', async () => {
      const response = await request(app).get('/event-loop-stats/');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
      expect(response.text).toContain('Event Loop Monitor');
    });

    test('should redirect path without trailing slash', async () => {
      const response = await request(app).get('/event-loop-stats');
      
      expect(response.status).toBe(301);
      expect(response.headers.location).toContain('/event-loop-stats/');
    });
  });

  describe('API Endpoints', () => {
    beforeEach(() => {
      app.use(eventLoopMonitor());
      app.get('/test', (req, res) => res.send('OK'));
      server = app.listen(0);
    });

    test('should serve current metrics', async () => {
      // Wait for some samples
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/current');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/json/);
      expect(response.body.status).toBe('ok');
      expect(response.body.data).toBeDefined();
    });

    test('should serve health status', async () => {
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toMatch(/healthy|degraded|critical|unknown/);
    });

    test('should serve metrics history', async () => {
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/history');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should serve complete metrics', async () => {
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.current).toBeDefined();
      expect(response.body.data.history).toBeDefined();
    });

    test('should serve dashboard data', async () => {
      await sleep(200);
      
      const response = await request(app).get('/event-loop-stats/api/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('should serve config', async () => {
      const response = await request(app).get('/event-loop-stats/api/config');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.sampleInterval).toBeDefined();
    });
  });

  describe('Request Tracking', () => {
    beforeEach(() => {
      app.use(eventLoopMonitor());
      app.get('/test', (req, res) => res.send('OK'));
      server = app.listen(0);
    });

    test('should track requests', async () => {
      await sleep(100);
      
      // Make some requests
      await request(app).get('/test');
      await request(app).get('/test');
      await request(app).get('/test');
      
      await sleep(100);
      
      const response = await request(app).get('/event-loop-stats/api/current');
      const metrics = response.body.data;
      
      // Should have tracked requests (might be more than 3 due to monitoring requests)
      expect(metrics.requests.count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Custom Path', () => {
    beforeEach(() => {
      app.use(eventLoopMonitor({ path: '/custom-monitor' }));
      server = app.listen(0);
    });

    test('should serve dashboard at custom path', async () => {
      const response = await request(app).get('/custom-monitor/');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
    });

    test('should serve API at custom path', async () => {
      await sleep(200);
      
      const response = await request(app).get('/custom-monitor/api/current');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Alert Configuration', () => {
    test('should accept alert configuration', (done) => {
      const alerts = [];
      
      app.use(eventLoopMonitor({
        thresholds: {
          lagWarning: 50,
          lagCritical: 100,
        },
        onAlert: (alert) => {
          alerts.push(alert);
        },
      }));
      
      server = app.listen(0, () => {
        // Alert manager should be configured
        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });

  describe('Global Monitor', () => {
    test('should provide access to global monitor', () => {
      app.use(eventLoopMonitor());
      
      const monitor = getGlobalMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.isActive()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', async () => {
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      await sleep(100);
      
      const monitor = getGlobalMonitor();
      expect(monitor.isActive()).toBe(true);
      
      cleanup();
      
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown routes', async () => {
      app.use(eventLoopMonitor());
      server = app.listen(0);
      
      const response = await request(app).get('/event-loop-stats/api/unknown');
      
      expect(response.status).toBe(404);
    });

    test('should not interfere with other routes', async () => {
      app.use(eventLoopMonitor());
      app.get('/test', (req, res) => res.send('OK'));
      server = app.listen(0);
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });
  });

  describe('CORS', () => {
    beforeEach(() => {
      app.use(eventLoopMonitor());
      server = app.listen(0);
    });

    test('should allow CORS for API endpoints', async () => {
      await sleep(100);
      
      const response = await request(app).get('/event-loop-stats/api/current');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});