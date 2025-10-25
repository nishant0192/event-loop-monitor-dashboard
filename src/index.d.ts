// Type definitions for event-loop-monitor-dashboard
// Project: https://github.com/nishant0192/event-loop-monitor-dashboard
// Definitions by: Nishant Golakiya <https://github.com/nishant0192>

/// <reference types="node" />

import { RequestHandler } from 'express';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Event loop lag metrics from histogram
 */
export interface LagMetrics {
  /** Minimum lag observed (ms) */
  min: number;
  /** Maximum lag observed (ms) */
  max: number;
  /** Mean/average lag (ms) */
  mean: number;
  /** Standard deviation of lag (ms) */
  stddev: number;
  /** 50th percentile (median) lag (ms) */
  p50: number;
  /** 90th percentile lag (ms) */
  p90: number;
  /** 95th percentile lag (ms) */
  p95: number;
  /** 99th percentile lag (ms) */
  p99: number;
  /** 99.9th percentile lag (ms) */
  p999: number;
}

/**
 * Event loop utilization metrics
 */
export interface ELUMetrics {
  /** Utilization ratio (0 to 1, where 1 = 100%) */
  utilization: number;
  /** Time spent actively processing (ms) */
  active: number;
  /** Time spent idle (ms) */
  idle: number;
}

/**
 * HTTP request tracking metrics
 */
export interface RequestMetrics {
  /** Number of requests in this sample */
  count: number;
  /** Total time spent processing requests (ms) */
  totalTime: number;
  /** Average time per request (ms) */
  avgTime: number;
}

/**
 * Complete metrics sample
 */
export interface MetricsSample {
  /** Timestamp when sample was taken */
  timestamp: number;
  /** Event loop lag metrics */
  lag: LagMetrics;
  /** Event loop utilization metrics */
  elu: ELUMetrics;
  /** Request metrics (if tracked) */
  requests: RequestMetrics;
}

/**
 * Aggregated statistics for a metric
 */
export interface AggregatedStats {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Mean/average value */
  mean: number;
  /** Median value */
  median: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
}

/**
 * Time window information
 */
export interface TimeWindow {
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
  /** Duration in milliseconds */
  duration: number;
  /** Number of samples in window */
  sampleCount: number;
}

/**
 * Aggregated metrics over a time window
 */
export interface AggregatedMetrics {
  /** Time window information */
  timeWindow: TimeWindow;
  /** Aggregated lag statistics */
  lag: {
    min: AggregatedStats;
    max: AggregatedStats;
    mean: AggregatedStats;
    p50: AggregatedStats;
    p95: AggregatedStats;
    p99: AggregatedStats;
  };
  /** Aggregated ELU statistics */
  elu: {
    utilization: AggregatedStats;
    active: AggregatedStats;
    idle: AggregatedStats;
  };
  /** Aggregated request statistics */
  requests: {
    totalCount: number;
    totalTime: number;
    avgTime: number;
  };
}

/**
 * Complete metrics response
 */
export interface Metrics {
  /** Current/latest metrics */
  current: MetricsSample | null;
  /** Historical samples */
  history: MetricsSample[];
  /** Aggregated statistics */
  aggregated: AggregatedMetrics | null;
  /** Whether monitoring is active */
  isMonitoring: boolean;
}

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

/**
 * Health assessment result
 */
export interface HealthResult {
  /** Health status level */
  status: HealthStatus;
  /** Health score (0-100) */
  score: number;
  /** List of issues detected */
  issues: string[];
  /** Human-readable message */
  message: string;
  /** Current metric values */
  metrics: {
    lag: number;
    elu: number;
  };
}

/**
 * Health threshold configuration
 */
export interface HealthThresholds {
  /** Warning threshold for lag (ms) */
  lagWarning?: number;
  /** Critical threshold for lag (ms) */
  lagCritical?: number;
  /** Warning threshold for ELU (0-1) */
  eluWarning?: number;
  /** Critical threshold for ELU (0-1) */
  eluCritical?: number;
}

/**
 * Time series data point for lag
 */
export interface LagTimeSeriesPoint {
  timestamp: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Time series data point for ELU
 */
export interface ELUTimeSeriesPoint {
  timestamp: number;
  utilization: number;
  active: number;
  idle: number;
}

/**
 * Time series data point for requests
 */
export interface RequestTimeSeriesPoint {
  timestamp: number;
  count: number;
  avgTime: number;
}

// ============================================================================
// EventLoopMonitor
// ============================================================================

/**
 * Configuration options for EventLoopMonitor
 */
export interface EventLoopMonitorOptions {
  /** Sampling interval in milliseconds (default: 100) */
  sampleInterval?: number;
  /** Number of samples to retain in history (default: 300) */
  historySize?: number;
  /** Histogram resolution for lag measurement (default: 10) */
  resolution?: number;
}

/**
 * Monitor configuration with status
 */
export interface MonitorConfig extends EventLoopMonitorOptions {
  /** Whether monitoring is currently active */
  isMonitoring: boolean;
}

/**
 * Core event loop monitoring class
 */
export class EventLoopMonitor {
  /**
   * Create a new EventLoopMonitor instance
   * @param options Configuration options
   */
  constructor(options?: EventLoopMonitorOptions);

  /**
   * Start monitoring the event loop
   */
  start(): void;

  /**
   * Stop monitoring the event loop
   */
  stop(): void;

  /**
   * Get current metrics snapshot
   * @returns Current metrics or null if not monitoring
   */
  getCurrentMetrics(): MetricsSample | null;

  /**
   * Get all metrics (current + historical + aggregated)
   * @returns Complete metrics
   */
  getMetrics(): Metrics;

  /**
   * Get historical metrics
   * @param count Number of recent samples to retrieve (optional)
   * @returns Array of historical samples
   */
  getHistory(count?: number): MetricsSample[];

  /**
   * Get health status based on current metrics
   * @param thresholds Custom thresholds for health assessment (optional)
   * @returns Health status and score
   */
  getHealth(thresholds?: HealthThresholds): HealthResult;

  /**
   * Track a request (for Express integration)
   * @param duration Request duration in milliseconds
   */
  trackRequest(duration: number): void;

  /**
   * Check if monitoring is active
   * @returns True if monitoring is active
   */
  isActive(): boolean;

  /**
   * Reset all metrics
   */
  reset(): void;

  /**
   * Get configuration options
   * @returns Current configuration
   */
  getConfig(): MonitorConfig;
}

// ============================================================================
// MetricsCollector
// ============================================================================

/**
 * Configuration options for MetricsCollector
 */
export interface MetricsCollectorOptions {
  /** Maximum number of samples to retain (default: 300) */
  historySize?: number;
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  /** Maximum history size */
  historySize: number;
  /** Current number of samples */
  sampleCount: number;
  /** Current buffer index */
  currentIndex: number;
  /** Estimated memory usage */
  memoryUsage: string;
}

/**
 * Metrics collection and aggregation class
 */
export class MetricsCollector {
  /**
   * Create a new MetricsCollector instance
   * @param options Configuration options
   */
  constructor(options?: MetricsCollectorOptions);

  /**
   * Add a new sample to the collection
   * @param sample Metrics sample to add
   */
  addSample(sample: MetricsSample): void;

  /**
   * Get the most recent sample
   * @returns Latest sample or null if no samples
   */
  getLatestSample(): MetricsSample | null;

  /**
   * Get historical samples
   * @param count Number of recent samples to retrieve (optional)
   * @returns Array of samples in chronological order
   */
  getHistory(count?: number): MetricsSample[];

  /**
   * Get aggregated metrics over a time window
   * @param duration Time window in milliseconds (optional, default: all history)
   * @returns Aggregated metrics or null if no samples
   */
  getAggregatedMetrics(duration?: number): AggregatedMetrics | null;

  /**
   * Get time series data for charting
   * @param metric Metric name ('lag', 'elu', or 'requests')
   * @param count Number of recent samples (optional)
   * @returns Time series data array
   */
  getTimeSeries(metric: 'lag', count?: number): LagTimeSeriesPoint[];
  getTimeSeries(metric: 'elu', count?: number): ELUTimeSeriesPoint[];
  getTimeSeries(metric: 'requests', count?: number): RequestTimeSeriesPoint[];

  /**
   * Reset all stored metrics
   */
  reset(): void;

  /**
   * Get collection statistics
   * @returns Collection info
   */
  getStats(): CollectionStats;

  /**
   * Export samples as JSON
   * @param count Number of samples to export (optional)
   * @returns JSON string
   */
  exportJSON(count?: number): string;

  /**
   * Import samples from JSON
   * @param json JSON string of samples
   */
  importJSON(json: string): void;
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Alert callback function type
 */
export type AlertCallback = (alert: {
  level: 'warning' | 'critical';
  message: string;
  metrics: MetricsSample;
}) => void;

/**
 * Express middleware configuration options
 */
export interface ExpressMiddlewareOptions extends EventLoopMonitorOptions {
  /** Dashboard route path (default: '/event-loop-stats') */
  path?: string;
  /** Alert thresholds */
  thresholds?: HealthThresholds;
  /** Alert callback function */
  onAlert?: AlertCallback;
}

/**
 * Create Express middleware for event loop monitoring
 * @param options Configuration options
 * @returns Express middleware
 */
export function eventLoopMonitor(options?: ExpressMiddlewareOptions): RequestHandler;

/**
 * Alias for eventLoopMonitor
 */
export const monitor: typeof eventLoopMonitor;

/**
 * Alias for eventLoopMonitor
 */
export const middleware: typeof eventLoopMonitor;

// ============================================================================
// Prometheus Exporter
// ============================================================================

/**
 * Create Prometheus metrics exporter
 * @param monitor Optional monitor instance (uses global if not provided)
 * @returns Express middleware for /metrics endpoint
 */
export function prometheusExporter(monitor?: EventLoopMonitor): RequestHandler;

// ============================================================================
// Alert Manager
// ============================================================================

/**
 * Alert manager configuration options
 */
export interface AlertManagerOptions {
  /** Alert thresholds */
  thresholds?: HealthThresholds;
  /** Alert callback function */
  onAlert?: AlertCallback;
  /** Check interval in milliseconds (default: 1000) */
  checkInterval?: number;
}

/**
 * Alert manager class
 */
export class AlertManager {
  /**
   * Create an Alert Manager instance
   * @param monitor Monitor instance to attach to
   * @param options Alert configuration
   */
  constructor(monitor: EventLoopMonitor, options?: AlertManagerOptions);

  /**
   * Start alert monitoring
   */
  start(): void;

  /**
   * Stop alert monitoring
   */
  stop(): void;

  /**
   * Check if alert monitoring is active
   */
  isActive(): boolean;
}

/**
 * Create an Alert Manager instance
 * @param monitor Monitor instance to attach to
 * @param options Alert configuration
 * @returns Alert manager instance
 */
export function createAlertManager(
  monitor: EventLoopMonitor,
  options?: AlertManagerOptions
): AlertManager;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a standalone monitor instance
 * @param options Configuration options
 * @returns Monitor instance
 */
export function createMonitor(options?: EventLoopMonitorOptions): EventLoopMonitor;

/**
 * Get or create the global monitor instance
 * @returns Global monitor instance
 */
export function getGlobalMonitor(): EventLoopMonitor;

/**
 * Quick start helper - creates and starts monitoring with Express
 * @param app Express app instance
 * @param options Configuration options
 * @returns Monitor instance
 */
export function quickStart(
  app: any,
  options?: ExpressMiddlewareOptions
): EventLoopMonitor;

// ============================================================================
// Package Info
// ============================================================================

/**
 * Package version
 */
export const version: string;

/**
 * Low-level core access (advanced users)
 */
export const core: {
  EventLoopMonitor: typeof EventLoopMonitor;
  MetricsCollector: typeof MetricsCollector;
};

// ============================================================================
// Default Export
// ============================================================================

declare const _default: {
  EventLoopMonitor: typeof EventLoopMonitor;
  MetricsCollector: typeof MetricsCollector;
  eventLoopMonitor: typeof eventLoopMonitor;
  prometheusExporter: typeof prometheusExporter;
  createAlertManager: typeof createAlertManager;
  createMonitor: typeof createMonitor;
  getGlobalMonitor: typeof getGlobalMonitor;
  quickStart: typeof quickStart;
  monitor: typeof eventLoopMonitor;
  middleware: typeof eventLoopMonitor;
  version: string;
  core: {
    EventLoopMonitor: typeof EventLoopMonitor;
    MetricsCollector: typeof MetricsCollector;
  };
};

export default _default;