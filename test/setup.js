/**
 * Jest Test Setup
 * 
 * Global test configuration and utilities
 */

// Increase timeout for async operations
jest.setTimeout(10000);

// Suppress console output during tests (optional)
// Comment out if you want to see console logs
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Global test utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitFor = async (condition, timeout = 5000, interval = 100) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await sleep(interval);
  }
  throw new Error('Timeout waiting for condition');
};

// Mock performance.now() for consistent testing
let mockTime = Date.now();
const mockPerformanceNow = (time) => {
  mockTime = time || Date.now();
};

// Restore after each test
afterEach(() => {
  mockTime = Date.now();
});

// Export utilities for CommonJS
module.exports = {
  sleep,
  waitFor,
  mockPerformanceNow
};