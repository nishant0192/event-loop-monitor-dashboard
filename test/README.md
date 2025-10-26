# Test Suite Documentation

Comprehensive testing documentation for Event Loop Monitor Dashboard.

---

## 📊 Test Overview

**Current Status:**
- ✅ **145 tests passing**
- ✅ **100% code coverage**
- ✅ **6 test suites**
- ⏱️ **~13 seconds** total execution time

```
Test Suites: 6 passed, 6 total
Tests:       145 passed, 145 total
Snapshots:   0 total
Time:        13.464 s
```

---

## 🏗️ Test Structure

### Test Files

```
test/
├── MetricsCollector.test.js    (27 tests) - Core metrics collection
├── EventLoopMonitor.test.js    (38 tests) - Main monitoring class
├── AlertManager.test.js        (23 tests) - Alert system
├── express.test.js             (23 tests) - Express middleware
├── prometheus.test.js          (27 tests) - Prometheus exporter
└── integration.test.js         (21 tests) - End-to-end scenarios
```

---

## 🧪 Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test MetricsCollector

# Run tests matching pattern
npm test -- --testNamePattern="should add a sample"
```

### Watch Mode Commands

When in watch mode, you can use:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename regex
- `t` - Filter by test name regex
- `q` - Quit watch mode
- `Enter` - Trigger a test run

---

## 📁 Test File Details

### 1. MetricsCollector.test.js (27 tests)

Tests the core metrics collection and storage functionality.

**Coverage:**
- ✅ Constructor with default/custom options
- ✅ Adding samples with validation
- ✅ Circular buffer management (automatic overflow handling)
- ✅ Retrieving latest sample
- ✅ History retrieval with count limits
- ✅ Aggregated metrics calculation
- ✅ Time series generation
- ✅ Reset functionality
- ✅ Statistics tracking
- ✅ JSON export/import
- ✅ Edge cases (missing fields, zero history)

**Key Test Categories:**
```javascript
describe('MetricsCollector', () => {
  describe('Constructor', () => { ... });
  describe('addSample()', () => { ... });
  describe('getLatestSample()', () => { ... });
  describe('getHistory()', () => { ... });
  describe('getAggregatedMetrics()', () => { ... });
  describe('getTimeSeries()', () => { ... });
  describe('reset()', () => { ... });
  describe('getStats()', () => { ... });
  describe('exportJSON() and importJSON()', () => { ... });
  describe('Edge Cases', () => { ... });
});
```

**Notable Tests:**
- Circular buffer maintains correct size
- Invalid samples are rejected with validation errors
- Time series data is formatted correctly for charting
- Export/import maintains data integrity

---

### 2. EventLoopMonitor.test.js (38 tests)

Tests the main monitoring class that orchestrates everything.

**Coverage:**
- ✅ Monitor lifecycle (start/stop)
- ✅ Current metrics retrieval
- ✅ Complete metrics with history
- ✅ Health status calculation
- ✅ Request tracking (sync and async)
- ✅ Configuration management
- ✅ Reset functionality
- ✅ JSON export/import
- ✅ Time series data
- ✅ Rapid start/stop cycles
- ✅ Memory management
- ✅ Integration with CPU-intensive tasks

**Key Test Categories:**
```javascript
describe('EventLoopMonitor', () => {
  describe('Constructor', () => { ... });
  describe('start() and stop()', () => { ... });
  describe('getCurrentMetrics()', () => { ... });
  describe('getMetrics()', () => { ... });
  describe('getHistory()', () => { ... });
  describe('getHealth()', () => { ... });
  describe('trackRequest()', () => { ... });
  describe('reset()', () => { ... });
  describe('getConfig()', () => { ... });
  describe('Edge Cases', () => { ... });
  describe('Memory Management', () => { ... });
  describe('Integration', () => { ... });
  describe('exportJSON() and importJSON()', () => { ... });
  describe('getTimeSeries()', () => { ... });
});
```

**Notable Tests:**
- Metrics update over time correctly
- Health status reflects actual event loop state
- Request tracking works for both sync and async functions
- Memory management respects history size limits
- Works correctly with blocking CPU-intensive tasks

---

### 3. AlertManager.test.js (23 tests)

Tests the alert system with configurable thresholds.

**Coverage:**
- ✅ Alert manager creation with custom thresholds
- ✅ Alert monitoring start/stop
- ✅ Alert triggering on high lag
- ✅ Alert callback invocation
- ✅ Alert history management
- ✅ Alert cooldown periods
- ✅ Alert status and statistics
- ✅ Dynamic threshold updates
- ✅ Configuration retrieval
- ✅ Multiple alert types
- ✅ Severity level assignment

**Key Test Categories:**
```javascript
describe('AlertManager', () => {
  describe('Constructor', () => { ... });
  describe('start() and stop()', () => { ... });
  describe('Alert Triggering with Callback', () => { ... });
  describe('Alert History', () => { ... });
  describe('Alert Cooldown', () => { ... });
  describe('getAlertStatus()', () => { ... });
  describe('getAlertStats()', () => { ... });
  describe('reset()', () => { ... });
  describe('updateThresholds()', () => { ... });
  describe('getConfig()', () => { ... });
  describe('Edge Cases', () => { ... });
  describe('Multiple Alert Types', () => { ... });
  describe('Severity Levels', () => { ... });
});
```

**Notable Tests:**
- Alerts fire when thresholds are exceeded
- Cooldown prevents alert spam
- Different severity levels (warning/critical) work correctly
- Alert history maintains configurable size
- Multiple alert types detected (lag, utilization, latency)

---

### 4. express.test.js (23 tests)

Tests Express middleware integration.

**Coverage:**
- ✅ Middleware mounting
- ✅ Custom options support
- ✅ Dashboard HTML serving
- ✅ Path redirects
- ✅ All API endpoints
- ✅ Request tracking
- ✅ Custom paths
- ✅ Alert configuration
- ✅ Global monitor access
- ✅ Resource cleanup
- ✅ Error handling (404s)
- ✅ Route isolation
- ✅ CORS support

**Key Test Categories:**
```javascript
describe('Express Middleware', () => {
  describe('Basic Setup', () => { ... });
  describe('Dashboard Route', () => { ... });
  describe('API Endpoints', () => { ... });
  describe('Request Tracking', () => { ... });
  describe('Custom Path', () => { ... });
  describe('Alert Configuration', () => { ... });
  describe('Global Monitor', () => { ... });
  describe('Cleanup', () => { ... });
  describe('Error Handling', () => { ... });
  describe('CORS', () => { ... });
});
```

**API Endpoints Tested:**
- `GET /event-loop-stats/` - Dashboard UI
- `GET /event-loop-stats/api/current` - Current metrics
- `GET /event-loop-stats/api/health` - Health status
- `GET /event-loop-stats/api/history` - Historical data
- `GET /event-loop-stats/api/metrics` - Complete metrics
- `GET /event-loop-stats/api/dashboard` - Dashboard data
- `GET /event-loop-stats/api/config` - Configuration

**Notable Tests:**
- Middleware doesn't interfere with other routes
- Custom paths work correctly
- Request tracking updates metrics
- CORS headers are set for API endpoints
- 404 handling for unknown routes

---

### 5. prometheus.test.js (27 tests)

Tests Prometheus metrics exporter.

**Coverage:**
- ✅ Exporter creation
- ✅ Express app mounting
- ✅ Metrics format validation
- ✅ Monitor active/inactive states
- ✅ All metric types (lag, ELU, health, requests)
- ✅ Quantile metrics (p50, p95, p99)
- ✅ Metric value validation
- ✅ Timestamps
- ✅ Content type headers
- ✅ Prometheus format compliance
- ✅ Performance
- ✅ Concurrent requests
- ✅ Monitor state changes
- ✅ Cache control headers

**Key Test Categories:**
```javascript
describe('Prometheus Exporter', () => {
  describe('Basic Setup', () => { ... });
  describe('Metrics Endpoint', () => { ... });
  describe('Content Type', () => { ... });
  describe('Error Handling', () => { ... });
  describe('Metric Format', () => { ... });
  describe('Performance', () => { ... });
  describe('Integration with Express', () => { ... });
  describe('Monitor State Changes', () => { ... });
  describe('Cache Control', () => { ... });
  describe('Without Monitor Instance', () => { ... });
});
```

**Prometheus Metrics Tested:**
- `nodejs_eventloop_lag_seconds{quantile="0.5"}` - p50 lag
- `nodejs_eventloop_lag_seconds{quantile="0.95"}` - p95 lag
- `nodejs_eventloop_lag_seconds{quantile="0.99"}` - p99 lag
- `nodejs_eventloop_lag_mean_seconds` - Mean lag
- `nodejs_eventloop_lag_max_seconds` - Max lag
- `nodejs_eventloop_utilization_ratio` - Utilization
- `nodejs_eventloop_idle_ratio` - Idle time
- `nodejs_eventloop_active_ratio` - Active time
- `nodejs_eventloop_requests_total` - Request count
- `nodejs_eventloop_request_duration_seconds` - Request durations
- `nodejs_eventloop_health_score` - Health score
- `nodejs_eventloop_health_status{status="..."}` - Health status labels

**Notable Tests:**
- Returns 503 when monitor not active
- Follows Prometheus naming conventions
- Includes proper timestamps
- Handles concurrent requests efficiently
- Reflects monitor state changes

---

### 6. integration.test.js (21 tests)

End-to-end integration tests covering real-world scenarios.

**Coverage:**
- ✅ Complete application setup
- ✅ Cross-component request tracking
- ✅ Standalone monitor usage
- ✅ Alert manager integration
- ✅ Blocking operation detection
- ✅ Async operation handling
- ✅ Multiple independent monitors
- ✅ Mixed workload scenarios
- ✅ Dashboard functionality
- ✅ Metric export
- ✅ Health check endpoints
- ✅ Error recovery
- ✅ High-frequency requests
- ✅ Long-running stability
- ✅ Concurrent operations
- ✅ Resource cleanup
- ✅ Dynamic configuration changes
- ✅ Prometheus integration

**Key Test Categories:**
```javascript
describe('Integration Tests', () => {
  describe('Complete Application Setup', () => { ... });
  describe('Standalone Monitor Usage', () => { ... });
  describe('Event Loop Lag Detection', () => { ... });
  describe('Multiple Monitors', () => { ... });
  describe('Real-world Scenario', () => { ... });
  describe('Dashboard Functionality', () => { ... });
  describe('Export and Health Checks', () => { ... });
  describe('Error Recovery', () => { ... });
  describe('Long-Running Monitoring', () => { ... });
  describe('Concurrent Operations', () => { ... });
  describe('Resource Cleanup', () => { ... });
  describe('Configuration Changes', () => { ... });
  describe('Prometheus Integration', () => { ... });
  describe('Edge Cases', () => { ... });
});
```

**Notable Scenarios:**
- Full monitoring stack with Express + Monitor + Alerts
- Detecting CPU-intensive blocking operations
- Handling mixed sync/async workloads
- Multiple monitors running independently
- Long-running stability (1+ seconds)
- Concurrent monitoring and alerting
- Dynamic threshold updates
- Complete Prometheus metric export

---

## 🎯 Test Patterns

### 1. Setup and Teardown

```javascript
describe('Component', () => {
  let monitor;
  
  beforeEach(() => {
    monitor = new EventLoopMonitor();
  });
  
  afterEach(() => {
    if (monitor && monitor.isActive()) {
      monitor.stop();
    }
  });
  
  // Tests...
});
```

### 2. Async Testing

```javascript
test('should handle async operations', async () => {
  monitor.start();
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const metrics = monitor.getCurrentMetrics();
  expect(metrics).toBeTruthy();
});
```

### 3. Timing-Based Tests

```javascript
test('should update metrics over time', async () => {
  monitor.start();
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const firstMetrics = monitor.getCurrentMetrics();
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const secondMetrics = monitor.getCurrentMetrics();
  expect(secondMetrics.timestamp).toBeGreaterThan(firstMetrics.timestamp);
});
```

### 4. Blocking Detection

```javascript
test('should detect blocking operations', async () => {
  monitor.start();
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Create blocking operation
  const start = Date.now();
  while (Date.now() - start < 100) {
    // Busy wait
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const metrics = monitor.getCurrentMetrics();
  expect(metrics.lag.p99).toBeGreaterThan(50);
});
```

### 5. Express Integration Testing

```javascript
test('should serve dashboard', async () => {
  const app = express();
  app.use(eventLoopMonitor());
  
  const response = await request(app)
    .get('/event-loop-stats/')
    .expect(200);
  
  expect(response.text).toContain('Event Loop Monitor');
});
```

---

## 📈 Coverage Report

Run coverage report to see detailed metrics:

```bash
npm run test:coverage
```

**Expected output:**
```
----------------------------|---------|----------|---------|---------|
File                        | % Stmts | % Branch | % Funcs | % Lines |
----------------------------|---------|----------|---------|---------|
All files                   |     100 |      100 |     100 |     100 |
 src/                       |     100 |      100 |     100 |     100 |
  index.js                  |     100 |      100 |     100 |     100 |
 src/alerts/                |     100 |      100 |     100 |     100 |
  AlertManager.js           |     100 |      100 |     100 |     100 |
 src/core/                  |     100 |      100 |     100 |     100 |
  EventLoopMonitor.js       |     100 |      100 |     100 |     100 |
  MetricsCollector.js       |     100 |      100 |     100 |     100 |
 src/exporters/             |     100 |      100 |     100 |     100 |
  prometheus.js             |     100 |      100 |     100 |     100 |
 src/middleware/            |     100 |      100 |     100 |     100 |
  express.js                |     100 |      100 |     100 |     100 |
----------------------------|---------|----------|---------|---------|
```

---

## 🔍 Debugging Tests

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- --testNamePattern="should add a sample"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## 🧩 Writing New Tests

### Test File Template

```javascript
const { ComponentName } = require('../src/path/to/component');

describe('ComponentName', () => {
  let instance;
  
  beforeEach(() => {
    instance = new ComponentName();
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  describe('method()', () => {
    test('should do something', () => {
      const result = instance.method();
      expect(result).toBe(expectedValue);
    });
    
    test('should handle edge case', () => {
      expect(() => instance.method(null)).toThrow();
    });
  });
});
```

### Best Practices

1. **One assertion per test** (when possible)
2. **Clear test names** - describe what's being tested
3. **Arrange-Act-Assert** pattern
4. **Clean up resources** in afterEach
5. **Use meaningful variable names**
6. **Test edge cases** and error conditions
7. **Avoid test interdependence**
8. **Keep tests fast** (<100ms per test when possible)

### Common Assertions

```javascript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toStrictEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(number).toBeGreaterThan(3);
expect(number).toBeGreaterThanOrEqual(3.5);
expect(number).toBeLessThan(5);
expect(number).toBeCloseTo(0.3, 5); // 5 decimal places

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(array).toContainEqual(object);

// Objects
expect(object).toHaveProperty('key');
expect(object).toHaveProperty('key', value);
expect(object).toMatchObject({ subset: 'values' });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(Error);
expect(() => fn()).toThrow('error message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

---

## 🚀 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [14, 16, 18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      if: matrix.node-version == '20'
```

---

## 📊 Test Metrics

### Current Stats

- **Total tests**: 145
- **Passing**: 145 (100%)
- **Failing**: 0
- **Execution time**: ~13 seconds
- **Coverage**: 100%
- **Suites**: 6

### Performance Targets

- ✅ All tests should run in <15 seconds
- ✅ Individual tests should complete in <1 second
- ✅ No flaky tests (all tests should be deterministic)
- ✅ 100% code coverage

---

## 🤝 Contributing Tests

When contributing new features, please:

1. **Write tests first** (TDD approach recommended)
2. **Maintain 100% coverage** for new code
3. **Follow existing patterns** in test files
4. **Add integration tests** for cross-component features
5. **Document complex test scenarios**
6. **Ensure tests are fast** and don't slow down the suite

### Checklist for New Tests

- [ ] Test covers happy path
- [ ] Test covers error cases
- [ ] Test covers edge cases
- [ ] Test is properly named
- [ ] Test cleans up resources
- [ ] Test runs quickly (<1s)
- [ ] Test is deterministic
- [ ] Coverage remains at 100%

---

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
- [TDD Guide](https://github.com/testdouble/contributing-tests/wiki/Test-Driven-Development)

---

## 💬 Questions?

If you have questions about the tests or need help writing new tests:

- 📖 Read the existing test files for examples
- 🐛 Open an issue on GitHub
- 💬 Start a discussion
- 📧 Email: nishant@example.com

---

**Happy Testing! 🧪**