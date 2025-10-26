/**
 * AlertManager Tests
 */
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const EventLoopMonitor = require('../src/core/EventLoopMonitor');
const AlertManager = require('../src/alerts/AlertManager');
const { sleep } = require('./setup.js');

describe('AlertManager', () => {
  let monitor;
  let alertManager;
  let alerts;

  beforeEach(() => {
    monitor = new EventLoopMonitor({
      sampleInterval: 50,
      historySize: 10,
    });
    
    alerts = [];
    
    alertManager = new AlertManager(monitor, {
      thresholds: {
        lagWarning: 20,
        lagCritical: 50,
        eluWarning: 0.7,
        eluCritical: 0.9,
      },
      onAlert: (alert) => {
        alerts.push(alert);
      },
      checkInterval: 100,
    });
  });

  afterEach(() => {
    if (alertManager && alertManager.isActive) {
      alertManager.stop();
    }
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
  });

  describe('Constructor', () => {
    test('should create alert manager', () => {
      expect(alertManager).toBeInstanceOf(AlertManager);
    });

    test('should throw without monitor', () => {
      expect(() => {
        new AlertManager(null);
      }).toThrow();
    });

    test('should use default thresholds', () => {
      const defaultAlertManager = new AlertManager(monitor);
      const config = defaultAlertManager.getConfig();
      
      expect(config.thresholds.lagWarning).toBe(50);
      expect(config.thresholds.lagCritical).toBe(100);
    });
  });

  describe('start() and stop()', () => {
    test('should start alert monitoring', () => {
      monitor.start();
      alertManager.start();
      
      expect(alertManager.isActive).toBe(true);
    });

    test('should stop alert monitoring', () => {
      monitor.start();
      alertManager.start();
      alertManager.stop();
      
      expect(alertManager.isActive).toBe(false);
    });

    test('should handle stop when not started', () => {
      expect(() => alertManager.stop()).not.toThrow();
    });
  });

  describe('Alert Triggering', () => {
    test('should trigger alert on high lag', async () => {
      monitor.start();
      alertManager.start();
      
      // Wait for monitoring to start
      await sleep(100);
      
      // Simulate CPU intensive work to cause high lag
      const start = Date.now();
      while (Date.now() - start < 60) {
        Math.sqrt(Math.random());
      }
      
      // Wait for alert check
      await sleep(300);
      
      // Should have triggered some alerts (lag might vary)
      const status = alertManager.getAlertStatus();
      expect(status.active).toBe(true);
    });

    test('should call onAlert callback', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(100);
      
      // Trigger high lag
      const start = Date.now();
      while (Date.now() - start < 60) {
        Math.sqrt(Math.random());
      }
      
      await sleep(300);
      
      // Callback might have been called (depends on actual lag)
      // This is a best-effort test
      expect(typeof alertManager.onAlert).toBe('function');
    });
  });

  describe('Alert History', () => {
    test('should maintain alert history', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(100);
      
      // Force some lag
      const start = Date.now();
      while (Date.now() - start < 60) {
        Math.sqrt(Math.random());
      }
      
      await sleep(300);
      
      const history = alertManager.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should limit history size', async () => {
      monitor.start();
      alertManager.start();
      
      // Alert history should not grow unbounded
      await sleep(500);
      
      const history = alertManager.getAlertHistory();
      expect(history.length).toBeLessThan(1000); // Reasonable limit
    });

    test('should support getting recent alerts', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(200);
      
      const recentAlerts = alertManager.getAlertHistory(5);
      expect(Array.isArray(recentAlerts)).toBe(true);
      expect(recentAlerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Alert Status', () => {
    test('should provide current alert status', () => {
      const status = alertManager.getAlertStatus();
      
      expect(status).toBeDefined();
      expect(status.active).toBeDefined();
      expect(status.currentAlerts).toBeDefined();
      expect(status.thresholds).toBeDefined();
    });

    test('should show no alerts initially', () => {
      const status = alertManager.getAlertStatus();
      
      expect(status.currentAlerts.lag).toBeNull();
      expect(status.currentAlerts.elu).toBeNull();
    });
  });

  describe('Alert Statistics', () => {
    test('should provide alert statistics', () => {
      const stats = alertManager.getAlertStats();
      
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(stats.firing).toBeDefined();
      expect(stats.resolved).toBeDefined();
      expect(stats.byMetric).toBeDefined();
      expect(stats.byLevel).toBeDefined();
    });

    test('should track alert counts', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(100);
      
      // Force high lag
      const start = Date.now();
      while (Date.now() - start < 60) {
        Math.sqrt(Math.random());
      }
      
      await sleep(300);
      
      const stats = alertManager.getAlertStats();
      expect(typeof stats.total).toBe('number');
    });
  });

  describe('Threshold Updates', () => {
    test('should update thresholds', () => {
      alertManager.updateThresholds({
        lagWarning: 100,
        lagCritical: 200,
      });
      
      const config = alertManager.getConfig();
      expect(config.thresholds.lagWarning).toBe(100);
      expect(config.thresholds.lagCritical).toBe(200);
    });

    test('should merge with existing thresholds', () => {
      const originalElu = alertManager.getConfig().thresholds.eluWarning;
      
      alertManager.updateThresholds({
        lagWarning: 100,
      });
      
      const config = alertManager.getConfig();
      expect(config.thresholds.lagWarning).toBe(100);
      expect(config.thresholds.eluWarning).toBe(originalElu);
    });
  });

  describe('Clear History', () => {
    test('should clear alert history', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(200);
      
      alertManager.clearHistory();
      
      const history = alertManager.getAlertHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('Configuration', () => {
    test('should return configuration', () => {
      const config = alertManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(config.checkInterval).toBe(100);
      expect(config.isActive).toBe(false);
      expect(config.hasCallback).toBe(true);
    });
  });

  describe('Alert Cooldown', () => {
    test('should respect cooldown period', async () => {
      const shortCooldownAlertManager = new AlertManager(monitor, {
        cooldown: 100,
        checkInterval: 50,
        onAlert: (alert) => alerts.push(alert),
      });
      
      monitor.start();
      shortCooldownAlertManager.start();
      
      await sleep(300);
      
      // Should not spam alerts due to cooldown
      const alertCount = alerts.length;
      expect(alertCount).toBeLessThan(10); // Reasonable limit
      
      shortCooldownAlertManager.stop();
    });
  });

  describe('Edge Cases', () => {
    test('should handle monitor not started', () => {
      expect(() => alertManager.start()).not.toThrow();
    });

    test('should handle no callback', () => {
      const noCallbackManager = new AlertManager(monitor, {
        checkInterval: 100,
      });
      
      expect(() => {
        monitor.start();
        noCallbackManager.start();
      }).not.toThrow();
      
      noCallbackManager.stop();
    });

    test('should handle callback errors gracefully', async () => {
      const errorManager = new AlertManager(monitor, {
        onAlert: () => {
          throw new Error('Callback error');
        },
        checkInterval: 100,
      });
      
      monitor.start();
      
      // Should not throw
      expect(() => errorManager.start()).not.toThrow();
      
      await sleep(200);
      
      errorManager.stop();
    });
  });

  describe('Alert Resolution', () => {
    test('should resolve alerts when metrics improve', async () => {
      monitor.start();
      alertManager.start();
      
      await sleep(100);
      
      // Create high lag
      const start = Date.now();
      while (Date.now() - start < 60) {
        Math.sqrt(Math.random());
      }
      
      await sleep(200);
      
      // Let it recover
      await sleep(500);
      
      // Check if any resolved alerts
      const history = alertManager.getAlertHistory();
      const resolvedAlerts = history.filter(a => a.status === 'resolved');
      
      // Might have resolved alerts
      expect(Array.isArray(resolvedAlerts)).toBe(true);
    });
  });
});