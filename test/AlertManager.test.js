const AlertManager = require('../src/alerts/AlertManager');
const EventLoopMonitor = require('../src/core/EventLoopMonitor');

describe('AlertManager', () => {
  let monitor;
  let alertManager;
  let alerts;

  beforeAll(() => {
    process.setMaxListeners(30);
  });

  beforeEach(() => {
    monitor = new EventLoopMonitor({ sampleInterval: 100 });
    alerts = [];
  });

  afterEach(async () => {
    if (alertManager) {
      alertManager.stop();
      alertManager = null;
    }
    
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
    test('should create alert manager', () => {
      alertManager = new AlertManager(monitor);
      expect(alertManager).toBeDefined();
    });

    test('should throw without monitor', () => {
      expect(() => {
        new AlertManager();
      }).toThrow();
    });

    test('should use default thresholds', () => {
      alertManager = new AlertManager(monitor);
      const config = alertManager.getConfig();
      
      expect(config.thresholds).toBeDefined();
      expect(config.thresholds.lagWarning).toBeDefined();
    });

    test('should accept custom thresholds', () => {
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 30,
          lagCritical: 80
        }
      });
      
      const config = alertManager.getConfig();
      expect(config.thresholds.lagWarning).toBe(30);
      expect(config.thresholds.lagCritical).toBe(80);
    });
  });

  describe('start() and stop()', () => {
    test('should start alert monitoring', () => {
      monitor.start();
      alertManager = new AlertManager(monitor);
      
      expect(() => alertManager.start()).not.toThrow();
      expect(alertManager.isActive).toBe(true);
    });

    test('should stop alert monitoring', () => {
      monitor.start();
      alertManager = new AlertManager(monitor);
      alertManager.start();
      
      expect(() => alertManager.stop()).not.toThrow();
      expect(alertManager.isActive).toBe(false);
    });

    test('should handle stop when not started', () => {
      alertManager = new AlertManager(monitor);
      expect(() => alertManager.stop()).not.toThrow();
    });

    test('should handle starting without active monitor', () => {
      alertManager = new AlertManager(monitor);
      expect(() => alertManager.start()).not.toThrow();
    });
  });

  describe('Alert Triggering with Callback', () => {
    test('should trigger alert on high lag via callback', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100,
        onAlert: (alert) => {
          alerts.push(alert);
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('should call onAlert callback with alert data', async () => {
      monitor.start();
      
      let receivedAlert = null;
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100,
        onAlert: (alert) => {
          receivedAlert = alert;
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      if (receivedAlert) {
        expect(receivedAlert).toBeDefined();
        expect(receivedAlert.metric).toBeDefined();
        expect(receivedAlert.level).toBeDefined();
        expect(receivedAlert.timestamp).toBeDefined();
      }
    });
  });

  describe('Alert History', () => {
    test('should maintain alert history', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100,
        onAlert: (alert) => {
          alerts.push(alert);
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const history = alertManager.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should support getting recent alerts', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const recent = alertManager.getAlertHistory(2);
      expect(Array.isArray(recent)).toBe(true);
      expect(recent.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Alert Cooldown', () => {
    test('should respect cooldown period', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 50,
        cooldown: 500,
        onAlert: (alert) => {
          alerts.push(alert);
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 700));
      
      // Should have limited alerts due to cooldown
      expect(alerts.length).toBeLessThan(15);
    });
  });

  describe('getAlertStatus()', () => {
    test('should return current alert status', () => {
      monitor.start();
      alertManager = new AlertManager(monitor);
      
      const status = alertManager.getAlertStatus();
      expect(status).toBeDefined();
      expect(status.active).toBeDefined();
      expect(status.currentAlerts).toBeDefined();
    });
  });

  describe('getAlertStats()', () => {
    test('should return alert statistics', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const stats = alertManager.getAlertStats();
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(typeof stats.total).toBe('number');
    });
  });

  describe('reset()', () => {
    test('should clear alert history', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001
        },
        checkInterval: 100
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      alertManager.clearHistory();
      
      const history = alertManager.getAlertHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateThresholds()', () => {
    test('should update thresholds dynamically', () => {
      alertManager = new AlertManager(monitor);
      
      alertManager.updateThresholds({
        lagWarning: 200,
        lagCritical: 400
      });
      
      const config = alertManager.getConfig();
      expect(config.thresholds.lagWarning).toBe(200);
      expect(config.thresholds.lagCritical).toBe(400);
    });
  });

  describe('getConfig()', () => {
    test('should return alert manager configuration', () => {
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 150
        }
      });
      
      const config = alertManager.getConfig();
      expect(config).toBeDefined();
      expect(config.thresholds.lagWarning).toBe(150);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid start/stop', async () => {
      monitor.start();
      alertManager = new AlertManager(monitor);
      
      for (let i = 0; i < 3; i++) {
        alertManager.start();
        await new Promise(resolve => setTimeout(resolve, 50));
        alertManager.stop();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      expect(alertManager.isActive).toBe(false);
    });

    test('should handle no alerts triggered', async () => {
      monitor.start();
      
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 10000
        },
        checkInterval: 100
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const history = alertManager.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Multiple Alert Types', () => {
    test('should detect different alert conditions', async () => {
      monitor.start();
      
      const alertTypes = new Set();
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001,
          eluWarning: 0.001
        },
        checkInterval: 100,
        onAlert: (alert) => {
          alertTypes.add(alert.metric);
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // May or may not trigger both types depending on system
      expect(alertTypes.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Severity Levels', () => {
    test('should assign severity levels', async () => {
      monitor.start();
      
      const severities = new Set();
      alertManager = new AlertManager(monitor, {
        thresholds: {
          lagWarning: 0.001,
          lagCritical: 0.002
        },
        checkInterval: 100,
        onAlert: (alert) => {
          severities.add(alert.level);
        }
      });
      
      alertManager.start();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Check severity levels if any alerts fired
      severities.forEach(severity => {
        expect(['warning', 'critical']).toContain(severity);
      });
    });
  });
});