const request = require('supertest');
const express = require('express');
const EventLoopMonitor = require('../src/core/EventLoopMonitor');
const prometheusExporter = require('../src/exporters/prometheus');

describe('Prometheus Exporter', () => {
  let app;
  let monitor;
  let server;

  beforeAll(() => {
    process.setMaxListeners(30);
  });

  beforeEach(() => {
    monitor = new EventLoopMonitor({ sampleInterval: 100 });
    app = express();
  });

  afterEach(async () => {
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
    monitor = null;
    
    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(() => {
    process.setMaxListeners(10);
  });

  describe('Basic Setup', () => {
    test('should export prometheusExporter function', () => {
      expect(typeof prometheusExporter).toBe('function');
    });

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
    test('should return 503 when monitor not active', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(503);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });

    test('should return metrics when monitor active', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('nodejs_eventloop');
    });

    test('should include event loop lag metrics', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_eventloop_lag');
    });

    test('should include ELU metrics', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_eventloop_utilization');
    });

    test('should include health metrics', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('nodejs_eventloop_health');
    });

    test('should include quantile metrics', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.text).toMatch(/quantile=/);
    });

    test('should have valid metric values', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      const lines = response.text.split('\n');
      const metricLines = lines.filter(line => 
        line && !line.startsWith('#') && line.trim()
      );
      
      metricLines.forEach(line => {
        const parts = line.split(' ');
        if (parts.length >= 2) {
          const value = parseFloat(parts[1]);
          expect(isNaN(value)).toBe(false);
        }
      });
    });

    test('should include timestamps', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      const lines = response.text.split('\n');
      const metricLines = lines.filter(line => 
        line && !line.startsWith('#') && line.trim()
      );
      
      let hasTimestamp = false;
      metricLines.forEach(line => {
        const parts = line.split(' ');
        if (parts.length >= 3) {
          hasTimestamp = true;
        }
      });
      
      expect(hasTimestamp).toBe(true);
    });
  });

  describe('Content Type', () => {
    test('should return correct content type', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });

    test('should include Prometheus version in content type', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.headers['content-type']).toMatch(/version=0\.0\.4/);
    });
  });

  describe('Error Handling', () => {
    test('should handle monitor stop gracefully', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      monitor.stop();
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(503);
    });

    test('should handle no samples yet', async () => {
      const newMonitor = new EventLoopMonitor({ sampleInterval: 100 });
      app.get('/metrics', prometheusExporter(newMonitor));
      
      newMonitor.start();
      
      const response = await request(app).get('/metrics');
      
      expect([200, 503]).toContain(response.status);
      
      newMonitor.stop();
    });
  });

  describe('Metric Format', () => {
    test('should follow Prometheus format conventions', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      const lines = response.text.split('\n');
      
      let hasHelp = false;
      let hasType = false;
      
      lines.forEach(line => {
        if (line.startsWith('# HELP')) hasHelp = true;
        if (line.startsWith('# TYPE')) hasType = true;
      });
      
      expect(hasHelp).toBe(true);
      expect(hasType).toBe(true);
    });

    test('should use correct metric naming', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      const lines = response.text.split('\n');
      const metricLines = lines.filter(line => 
        line && !line.startsWith('#') && line.trim()
      );
      
      metricLines.forEach(line => {
        const metricName = line.split(/\{|\s/)[0];
        if (metricName && metricName.startsWith('nodejs_')) {
          expect(metricName).not.toContain('-');
        }
      });
    });
  });

  describe('Performance', () => {
    test('should respond quickly', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const start = Date.now();
      await request(app).get('/metrics');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });

    test('should handle multiple concurrent requests', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/metrics'));
      }
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
        if (response.status === 200) {
          expect(response.text).toContain('nodejs_eventloop');
        }
      });
    });
  });

  describe('Integration with Express', () => {
    test('should work with other middleware', async () => {
      app.use(express.json());
      app.use((req, res, next) => {
        req.customValue = 'test';
        next();
      });
      
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect([200, 503]).toContain(response.status);
    });

    test('should work with route parameters', async () => {
      app.get('/api/:id', (req, res) => {
        res.json({ id: req.params.id });
      });
      
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      await request(app).get('/api/123');
      await request(app).get('/api/456');
      
      const response = await request(app).get('/metrics');
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Monitor State Changes', () => {
    test('should reflect monitor stop in metrics', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      let response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
      
      monitor.stop();
      
      response = await request(app).get('/metrics');
      expect(response.status).toBe(503);
    });

    test('should handle monitor restart', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      monitor.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
      expect(response.text).toContain('nodejs_eventloop');
    });
  });

  describe('Cache Control', () => {
    test('should include no-cache header', async () => {
      app.get('/metrics', prometheusExporter(monitor));
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const response = await request(app).get('/metrics');
      
      expect(response.headers['cache-control']).toMatch(/no-cache/);
    });
  });

  describe('Without Monitor Instance', () => {
    test('should handle missing monitor parameter', async () => {
      app.get('/metrics', prometheusExporter());
      
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(503);
    });
  });
});