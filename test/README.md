# Test Suite Documentation

Complete test suite for event-loop-monitor-dashboard package.

## Overview

This test suite provides comprehensive coverage of:
- Core monitoring functionality (EventLoopMonitor)
- Metrics collection and aggregation (MetricsCollector)
- Express middleware integration
- Alert management
- Prometheus exporter
- Full integration scenarios

## Test Structure

```
test/
├── setup.js                    # Jest configuration and utilities
├── EventLoopMonitor.test.js    # Core monitor tests
├── MetricsCollector.test.js    # Metrics collection tests
├── express.test.js             # Express middleware tests
├── AlertManager.test.js        # Alert system tests
├── prometheus.test.js          # Prometheus exporter tests
└── integration.test.js         # End-to-end tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Verbose Output
```bash
npm run test:verbose
```

### Single Test File
```bash
npm test -- EventLoopMonitor.test.js
```

### Single Test Suite
```bash
npm test -- --testNamePattern="EventLoopMonitor"
```

### Single Test Case
```bash
npm test -- --testNamePattern="should start monitoring"
```

## Test Coverage Goals

| Module | Target Coverage |
|--------|----------------|
| Core | 85% |
| Middleware | 80% |
| Exporters | 75% |
| Overall | 80% |

## Test Categories

### Unit Tests
Test individual functions and classes in isolation.

**Files:**
- `EventLoopMonitor.test.js` - 40+ tests
- `MetricsCollector.test.js` - 35+ tests

**Coverage:**
- Constructor initialization
- Public API methods
- Edge cases and error handling
- State management

### Integration Tests
Test components working together.

**Files:**
- `express.test.js` - 25+ tests
- `integration.test.js` - 15+ tests

**Coverage:**
- Express middleware integration
- Dashboard serving
- API endpoints
- Request tracking
- Multi-component scenarios

### Functional Tests
Test specific features end-to-end.

**Files:**
- `AlertManager.test.js` - 20+ tests
- `prometheus.test.js` - 20+ tests

**Coverage:**
- Alert triggering and resolution
- Prometheus metric formatting
- Health checks
- Time series data

## Key Test Scenarios

### 1. Basic Monitoring
```javascript
test('should start monitoring', async () => {
  monitor.start();
  expect(monitor.isActive()).toBe(true);
  
  await sleep(100);
  
  const metrics = monitor.getCurrentMetrics();
  expect(metrics).toBeTruthy();
});
```

### 2. Event Loop Lag Detection
```javascript
test('should detect blocking operations', async () => {
  monitor.start();
  await sleep(100);
  
  // Block event loop
  const start = Date.now();
  while (Date.now() - start < 100) {
    Math.sqrt(Math.random());
  }
  
  await sleep(100);
  const metrics = monitor.getCurrentMetrics();
  expect(metrics.lag.max).toBeGreaterThan(50);
});
```

### 3. Express Integration
```javascript
test('should serve dashboard', async () => {
  app.use(eventLoopMonitor());
  server = app.listen(0);
  
  const response = await request(app)
    .get('/event-loop-stats/');
  
  expect(response.status).toBe(200);
  expect(response.type).toMatch(/html/);
});
```

### 4. Alert System
```javascript
test('should trigger alerts', async () => {
  const alerts = [];
  alertManager = new AlertManager(monitor, {
    onAlert: (alert) => alerts.push(alert)
  });
  
  monitor.start();
  alertManager.start();
  
  // Trigger high lag...
  // Check alerts...
});
```

### 5. Prometheus Export
```javascript
test('should export metrics in Prometheus format', async () => {
  const response = await request(app).get('/metrics');
  
  expect(response.status).toBe(200);
  expect(response.text).toContain('nodejs_eventloop_lag_seconds');
  expect(response.text).toMatch(/# HELP/);
  expect(response.text).toMatch(/# TYPE/);
});
```

## Test Utilities

### Global Utilities (from setup.js)

**sleep(ms)**
```javascript
await sleep(100); // Wait 100ms
```

**waitFor(condition, timeout, interval)**
```javascript
await waitFor(
  () => monitor.isActive(),
  5000,
  100
);
```

### Mock Data Helpers

**createMockSample()**
```javascript
const sample = createMockSample(Date.now(), {
  lagMean: 10,
  eluUtilization: 0.5
});
```

## Common Test Patterns

### 1. Setup and Teardown
```javascript
let monitor;

beforeEach(() => {
  monitor = new EventLoopMonitor();
});

afterEach(() => {
  if (monitor && monitor.isActive()) {
    monitor.stop();
  }
});
```

### 2. Async Operations
```javascript
test('should handle async operation', async () => {
  monitor.start();
  await sleep(100);
  
  const metrics = monitor.getCurrentMetrics();
  expect(metrics).toBeTruthy();
});
```

### 3. HTTP Testing
```javascript
const response = await request(app)
  .get('/endpoint')
  .expect(200)
  .expect('Content-Type', /json/);

expect(response.body.data).toBeDefined();
```

### 4. Error Testing
```javascript
test('should throw on invalid input', () => {
  expect(() => {
    new EventLoopMonitor({ sampleInterval: -1 });
  }).toThrow();
});
```

## Debugging Tests

### Enable Console Output
Comment out console mocks in `setup.js`:
```javascript
// global.console = { ...console, log: jest.fn() };
```

### Increase Timeout
For slow tests:
```javascript
test('slow test', async () => {
  // Test code
}, 30000); // 30 second timeout
```

### Run Single Test
```bash
npm test -- --testNamePattern="specific test name"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [14.x, 16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm ci
    - run: npm test
    - run: npm run lint
```

## Coverage Reports

### View HTML Report
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### Coverage Thresholds
Configured in `jest.config.js`:
```javascript
coverageThresholds: {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  }
}
```

## Writing New Tests

### Test Checklist
- [ ] Test happy path
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Test with invalid inputs
- [ ] Test async behavior
- [ ] Clean up resources (stop monitors, close servers)
- [ ] Use descriptive test names
- [ ] Add comments for complex logic

### Test Template
```javascript
describe('ModuleName', () => {
  let module;

  beforeEach(() => {
    module = new Module();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName()', () => {
    test('should do expected behavior', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = module.methodName(input);
      
      // Assert
      expect(result).toBe(expected);
    });

    test('should handle error case', () => {
      expect(() => {
        module.methodName(invalid);
      }).toThrow();
    });
  });
});
```

## Known Issues & Workarounds

### Timing-Dependent Tests
Some tests rely on actual event loop lag, which can vary:

```javascript
// Use flexible assertions
expect(metrics.lag.max).toBeGreaterThan(0);
// Instead of:
// expect(metrics.lag.max).toBe(50);
```

### Async Cleanup
Always clean up async resources:

```javascript
afterEach(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});
```

### Port Conflicts
Use dynamic ports for test servers:

```javascript
server = app.listen(0); // Random available port
```

## Performance Testing

### Load Testing
See `examples/load-test.js` for load testing scenarios.

### Memory Leak Detection
```bash
npm test -- --detectLeaks
```

## Contributing Tests

When adding features, add corresponding tests:

1. **Add test file** if new module
2. **Add test cases** for new functionality
3. **Update this README** if new patterns
4. **Ensure coverage** meets thresholds
5. **Document edge cases** in comments

## Questions?

- Check existing tests for examples
- See `examples/` for usage patterns
- Open an issue for test infrastructure questions

---

**Total Tests**: 150+  
**Test Coverage**: 80%+  
**Test Execution Time**: ~15 seconds  
**Maintained**: Yes