/**
 * Alert Manager
 * 
 * Monitors event loop health and triggers alerts when thresholds are breached
 * Tracks alert state to prevent alert fatigue
 * 
 * @module alerts/AlertManager
 */

/**
 * AlertManager - Manages threshold-based alerting for event loop metrics
 * 
 * @class
 */
class AlertManager {
  /**
   * @param {EventLoopMonitor} monitor - Monitor instance to attach to
   * @param {Object} [options] - Configuration options
   * @param {Object} [options.thresholds] - Alert thresholds
   * @param {number} [options.thresholds.lagWarning=50] - Warning lag threshold (ms)
   * @param {number} [options.thresholds.lagCritical=100] - Critical lag threshold (ms)
   * @param {number} [options.thresholds.eluWarning=0.7] - Warning ELU threshold (0-1)
   * @param {number} [options.thresholds.eluCritical=0.9] - Critical ELU threshold (0-1)
   * @param {Function} [options.onAlert] - Alert callback function
   * @param {number} [options.checkInterval=1000] - Check interval in milliseconds
   * @param {number} [options.cooldown=30000] - Cooldown period between duplicate alerts (ms)
   */
  constructor(monitor, options = {}) {
    if (!monitor) {
      throw new Error('AlertManager requires a monitor instance');
    }

    this.monitor = monitor;

    // Default thresholds
    this.thresholds = {
      lagWarning: 50,      // 50ms lag is concerning
      lagCritical: 100,    // 100ms lag is critical
      eluWarning: 0.7,     // 70% utilization is concerning
      eluCritical: 0.9,    // 90% utilization is critical
      ...options.thresholds
    };

    // Alert callback
    this.onAlert = options.onAlert || null;

    // Check interval (how often to check metrics)
    this.checkInterval = options.checkInterval || 1000; // 1 second

    // Cooldown period (prevent alert spam)
    this.cooldown = options.cooldown || 30000; // 30 seconds

    // Alert state tracking
    this.alertState = {
      lag: {
        level: null,           // null, 'warning', 'critical'
        lastTriggered: null,   // timestamp
        count: 0               // number of times triggered
      },
      elu: {
        level: null,
        lastTriggered: null,
        count: 0
      }
    };

    // Alert history (for analysis)
    this.alertHistory = [];
    this.maxHistorySize = 100;

    // Monitoring state
    this.isActive = false;
    this.checkTimer = null;
  }

  /**
   * Start alert monitoring
   */
  start() {
    if (this.isActive) {
      return; // Already started
    }

    if (!this.monitor.isActive()) {
      throw new Error('Cannot start AlertManager: monitor is not active');
    }

    this.isActive = true;
    this._scheduleCheck();
  }

  /**
   * Stop alert monitoring
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    // Clear any active alerts
    this._clearAlertState();
  }

  /**
   * Schedule the next check
   * @private
   */
  _scheduleCheck() {
    if (!this.isActive) {
      return;
    }

    this.checkTimer = setTimeout(() => {
      this._performCheck();
      this._scheduleCheck();
    }, this.checkInterval);
  }

  /**
   * Perform health check and trigger alerts if needed
   * @private
   */
  _performCheck() {
    if (!this.monitor.isActive()) {
      return;
    }

    const current = this.monitor.getCurrentMetrics();
    if (!current) {
      return; // No metrics available yet
    }

    const now = Date.now();

    // Check lag thresholds
    this._checkLagThresholds(current.lag, now);

    // Check ELU thresholds
    this._checkEluThresholds(current.elu, now);
  }

  /**
   * Check lag thresholds and trigger alerts
   * @private
   */
  _checkLagThresholds(lag, now) {
    const lagMean = lag.mean;
    let newLevel = null;

    // Determine alert level
    if (lagMean >= this.thresholds.lagCritical) {
      newLevel = 'critical';
    } else if (lagMean >= this.thresholds.lagWarning) {
      newLevel = 'warning';
    }

    // Check if alert state changed or cooldown expired
    const currentLevel = this.alertState.lag.level;
    const lastTriggered = this.alertState.lag.lastTriggered;
    const cooldownExpired = !lastTriggered || (now - lastTriggered) >= this.cooldown;

    if (newLevel && (newLevel !== currentLevel || cooldownExpired)) {
      // Trigger alert
      this._triggerAlert('lag', newLevel, {
        value: lagMean,
        threshold: newLevel === 'critical' ? this.thresholds.lagCritical : this.thresholds.lagWarning,
        unit: 'ms',
        details: {
          p50: lag.p50,
          p95: lag.p95,
          p99: lag.p99,
          max: lag.max
        }
      });

      // Update state
      this.alertState.lag.level = newLevel;
      this.alertState.lag.lastTriggered = now;
      this.alertState.lag.count++;
    } else if (!newLevel && currentLevel) {
      // Alert resolved
      this._resolveAlert('lag', currentLevel, lagMean);
      this.alertState.lag.level = null;
    }
  }

  /**
   * Check ELU thresholds and trigger alerts
   * @private
   */
  _checkEluThresholds(elu, now) {
    const eluValue = elu.utilization;
    let newLevel = null;

    // Determine alert level
    if (eluValue >= this.thresholds.eluCritical) {
      newLevel = 'critical';
    } else if (eluValue >= this.thresholds.eluWarning) {
      newLevel = 'warning';
    }

    // Check if alert state changed or cooldown expired
    const currentLevel = this.alertState.elu.level;
    const lastTriggered = this.alertState.elu.lastTriggered;
    const cooldownExpired = !lastTriggered || (now - lastTriggered) >= this.cooldown;

    if (newLevel && (newLevel !== currentLevel || cooldownExpired)) {
      // Trigger alert
      this._triggerAlert('elu', newLevel, {
        value: eluValue * 100, // Convert to percentage
        threshold: (newLevel === 'critical' ? this.thresholds.eluCritical : this.thresholds.eluWarning) * 100,
        unit: '%',
        details: {
          active: elu.active,
          idle: elu.idle
        }
      });

      // Update state
      this.alertState.elu.level = newLevel;
      this.alertState.elu.lastTriggered = now;
      this.alertState.elu.count++;
    } else if (!newLevel && currentLevel) {
      // Alert resolved
      this._resolveAlert('elu', currentLevel, eluValue * 100);
      this.alertState.elu.level = null;
    }
  }

  /**
   * Trigger an alert
   * @private
   */
  _triggerAlert(metric, level, data) {
    const alert = {
      timestamp: Date.now(),
      metric: metric,
      level: level,
      value: data.value,
      threshold: data.threshold,
      unit: data.unit,
      details: data.details,
      message: this._buildAlertMessage(metric, level, data),
      status: 'firing'
    };

    // Add to history
    this._addToHistory(alert);

    // Call user callback
    if (this.onAlert && typeof this.onAlert === 'function') {
      try {
        this.onAlert(alert);
      } catch (error) {
        console.error('AlertManager: Error in onAlert callback:', error);
      }
    }
  }

  /**
   * Resolve an alert
   * @private
   */
  _resolveAlert(metric, level, currentValue) {
    const alert = {
      timestamp: Date.now(),
      metric: metric,
      level: level,
      value: currentValue,
      message: this._buildResolvedMessage(metric, level, currentValue),
      status: 'resolved'
    };

    // Add to history
    this._addToHistory(alert);

    // Call user callback
    if (this.onAlert && typeof this.onAlert === 'function') {
      try {
        this.onAlert(alert);
      } catch (error) {
        console.error('AlertManager: Error in onAlert callback:', error);
      }
    }
  }

  /**
   * Build alert message
   * @private
   */
  _buildAlertMessage(metric, level, data) {
    const metricName = metric === 'lag' ? 'Event Loop Lag' : 'Event Loop Utilization';
    const emoji = level === 'critical' ? '🔴' : '⚠️';
    
    return `${emoji} ${level.toUpperCase()}: ${metricName} is ${data.value.toFixed(2)}${data.unit} (threshold: ${data.threshold}${data.unit})`;
  }

  /**
   * Build resolved message
   * @private
   */
  _buildResolvedMessage(metric, level, currentValue) {
    const metricName = metric === 'lag' ? 'Event Loop Lag' : 'Event Loop Utilization';
    const unit = metric === 'lag' ? 'ms' : '%';
    
    return `✅ RESOLVED: ${metricName} ${level} alert (current: ${currentValue.toFixed(2)}${unit})`;
  }

  /**
   * Add alert to history
   * @private
   */
  _addToHistory(alert) {
    this.alertHistory.push(alert);

    // Trim history if too large
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }
  }

  /**
   * Clear all alert states
   * @private
   */
  _clearAlertState() {
    this.alertState.lag.level = null;
    this.alertState.elu.level = null;
  }

  /**
   * Get current alert status
   * @returns {Object} Current alert state
   */
  getAlertStatus() {
    return {
      active: this.isActive,
      currentAlerts: {
        lag: this.alertState.lag.level,
        elu: this.alertState.elu.level
      },
      alertCounts: {
        lag: this.alertState.lag.count,
        elu: this.alertState.elu.count
      },
      thresholds: this.thresholds
    };
  }

  /**
   * Get alert history
   * @param {number} [count] - Number of recent alerts to retrieve
   * @returns {Array} Array of alerts
   */
  getAlertHistory(count) {
    if (count && count < this.alertHistory.length) {
      return this.alertHistory.slice(-count);
    }
    return [...this.alertHistory];
  }

  /**
   * Get alert statistics
   * @returns {Object} Alert statistics
   */
  getAlertStats() {
    const firingAlerts = this.alertHistory.filter(a => a.status === 'firing');
    const resolvedAlerts = this.alertHistory.filter(a => a.status === 'resolved');

    const lagAlerts = firingAlerts.filter(a => a.metric === 'lag');
    const eluAlerts = firingAlerts.filter(a => a.metric === 'elu');

    const criticalAlerts = firingAlerts.filter(a => a.level === 'critical');
    const warningAlerts = firingAlerts.filter(a => a.level === 'warning');

    return {
      total: this.alertHistory.length,
      firing: firingAlerts.length,
      resolved: resolvedAlerts.length,
      byMetric: {
        lag: lagAlerts.length,
        elu: eluAlerts.length
      },
      byLevel: {
        critical: criticalAlerts.length,
        warning: warningAlerts.length
      },
      current: this.getAlertStatus().currentAlerts
    };
  }

  /**
   * Clear alert history
   */
  clearHistory() {
    this.alertHistory = [];
  }

  /**
   * Update thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
  }

  /**
   * Get configuration
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      thresholds: this.thresholds,
      checkInterval: this.checkInterval,
      cooldown: this.cooldown,
      isActive: this.isActive,
      hasCallback: typeof this.onAlert === 'function'
    };
  }
}

module.exports = AlertManager;