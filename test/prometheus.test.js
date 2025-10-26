/**
 * Prometheus Exporter Tests
 */

const express = require('express');
const request = require('supertest');
const { prometheusExporter } = require('../../src/exporters/prometheus');
const EventLoopMonitor = require('../../src/core/EventLoopMonitor');
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { sleep } = require('./setup.js');

describe('Prometheus Exporter', () => {
  let app;
  let monitor;
  let server;

  beforeEach(() => {
    app = express();
    monitor = new EventLoopMonitor({
      sampleInterval: 50,
      historySize: 10,
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
  });

  describe('Basic Setup', () => {
    test('should create exporter middleware', () => {
      const middleware = prometheusExporter(monitor);
      expect(typeof middleware).toBe('function');
    });

    test('should mount on Express app', () => {
      expect(() => {
        app.get('/metrics', prometheusExporter(monitor));
      }).not.toThrow();
    });
  });

  describe('Metrics Endpoint', () => {
    beforeEach(() => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
    });

    test('should return 503 when monitor not active', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(503);
      expect(response.type).toMatch(/text\/plain/);
    });

    test('should return metrics when monitor active', async () => {
      monitor.start();
      await sleep(200); // Wait for samples
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/text\/plain/);
      expect(response.headers['content-type']).toContain('version=0.0.4');
    });

    test('should include event loop lag metrics', async () => {
      monitor.start();
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_eventloop_lag_seconds');
      expect(response.text).toContain('TYPE nodejs_eventloop_lag_seconds');
      expect(response.text).toContain('HELP nodejs_eventloop_lag_seconds');
    });

    test('should include event loop utilization metrics', async () => {
      monitor.start();
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_eventloop_utilization');
      expect(response.text).toContain('TYPE nodejs_eventloop_utilization gauge');
    });

    test('should include percentile metrics', async () => {
      monitor.start();
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('quantile="0.5"');
      expect(response.text).toContain('quantile="0.95"');
      expect(response.text).toContain('quantile="0.99"');
    });

    test('should include memory metrics', async () => {
      monitor.start();
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_memory_heap_used_bytes');
      expect(response.text).toContain('nodejs_memory_heap_total_bytes');
    });

    test('should include active handles metrics', async () => {
      monitor.start();
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_active_handles');
    });
  });

  describe('Metric Format', () => {
    beforeEach(() => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
      monitor.start();
    });

    test('should use valid Prometheus format', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      const lines = response.text.split('\n');
      
      // Should have HELP and TYPE declarations
      const helpLines = lines.filter(l => l.startsWith('# HELP'));
      const typeLines = lines.filter(l => l.startsWith('# TYPE'));
      
      expect(helpLines.length).toBeGreaterThan(0);
      expect(typeLines.length).toBeGreaterThan(0);
    });

    test('should have valid metric names', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      // Metric names should match Prometheus naming conventions
      const metricLines = response.text.split('\n')
        .filter(l => !l.startsWith('#') && l.trim());
      
      metricLines.forEach(line => {
        if (line.trim()) {
          // Should have format: metric_name{labels} value timestamp
          expect(line).toMatch(/^[a-z_][a-z0-9_]*(\{.*\})?\s+[\d.e+-]+(\s+\d+)?$/);
        }
      });
    });

    test('should include timestamps', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      // Some metrics should have timestamps
      expect(response.text).toMatch(/\s+\d{13}/); // 13-digit timestamp
    });
  });

  describe('No-Cache Headers', () => {
    beforeEach(() => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
      monitor.start();
    });

    test('should set no-cache headers', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.headers['cache-control']).toBe('no-cache');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
      
      // Don't start monitor - should return 503
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(503);
      expect(response.text).toContain('not active');
    });
  });

  describe('Without Monitor Instance', () => {
    test('should work without explicit monitor', async () => {
      // This tests using global monitor from middleware
      const { eventLoopMonitor } = require('../../src/middleware/express');
      
      app.use(eventLoopMonitor());
      app.get('/metrics', prometheusExporter());
      server = app.listen(0);
      
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Metric Values', () => {
    beforeEach(() => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
      monitor.start();
    });

    test('should have reasonable metric values', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      const lines = response.text.split('\n');
      
      // Find a lag metric line
      const lagLine = lines.find(l => 
        l.startsWith('nodejs_eventloop_lag_seconds') && 
        !l.startsWith('#')
      );
      
      if (lagLine) {
        // Extract value
        const value = parseFloat(lagLine.split(/\s+/)[1]);
        
        // Should be a reasonable lag value (in seconds)
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10); // Less than 10 seconds is reasonable
      }
    });

    test('should have ELU between 0 and 1', async () => {
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      const lines = response.text.split('\n');
      
      const eluLine = lines.find(l => 
        l.startsWith('nodejs_eventloop_utilization') && 
        !l.startsWith('#')
      );
      
      if (eluLine) {
        const value = parseFloat(eluLine.split(/\s+/)[1]);
        
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Integration with Prometheus', () => {
    test('should be scrapable by Prometheus', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      server = app.listen(0);
      monitor.start();
      
      await sleep(200);
      
      const response = await request(app).get('/metrics');
      
      // Check that it matches Prometheus exposition format
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['content-type']).toContain('version=0.0.4');
      
      // Should have required format elements
      expect(response.text).toMatch(/# HELP/);
      expect(response.text).toMatch(/# TYPE/);
      expect(response.text).toMatch(/^[a-z_]/m);
    });
  });
});