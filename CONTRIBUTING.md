# Contributing to Event Loop Monitor Dashboard

First off, thank you for considering contributing to Event Loop Monitor Dashboard! It's people like you that make this tool better for the Node.js community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Guidelines](#development-guidelines)
- [Submitting Changes](#submitting-changes)
- [Testing](#testing)
- [Style Guide](#style-guide)

## Code of Conduct

This project and everyone participating in it is expected to uphold a respectful and harassment-free environment. By participating, you agree to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git
- Basic understanding of Node.js event loop

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/event-loop-monitor-dashboard.git
   cd event-loop-monitor-dashboard
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/nishant0192/event-loop-monitor-dashboard.git
   ```

## Development Setup

```bash
# Install dependencies
npm install

# Run the example application
npm run example

# Visit the dashboard
# Open http://localhost:3000/event-loop-stats in your browser

# Run linting
npm run lint
```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [issue tracker](https://github.com/nishant0192/event-loop-monitor-dashboard/issues) as you might find out that you don't need to create one.

When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** - Include code snippets, error messages, and screenshots
- **Describe the behavior you observed** and what you expected
- **Include your environment details**:
  - Node.js version (`node --version`)
  - npm version (`npm --version`)
  - Operating system and version
  - Package version

**Bug Report Template:**
```markdown
## Description
A clear description of what the bug is.

## Steps to Reproduce
1. Step 1
2. Step 2
3. ...

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- Node.js version: 
- npm version: 
- OS: 
- Package version: 

## Additional Context
Any other context, screenshots, or code samples.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to most users
- **List some examples** of how it would be used
- **Specify which version** you're using

### Pull Requests

We actively welcome your pull requests! Here's how to contribute code:

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   
2. **Make your changes** following our [development guidelines](#development-guidelines)

3. **Test your changes** thoroughly:
   ```bash
   npm run example
   # Test the dashboard manually
   # Verify Prometheus endpoint
   # Check different scenarios
   ```

4. **Lint your code**:
   ```bash
   npm run lint
   ```

5. **Commit your changes** with clear messages:
   ```bash
   git commit -m "Add feature: description of feature"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** against the `main` branch

## Development Guidelines

### Core Principles

1. **Zero Dependencies**: This package has ZERO runtime dependencies and must stay that way
   - Only use Node.js built-in modules (`perf_hooks`, `fs`, `path`, etc.)
   - Development dependencies are okay (eslint, jest, etc.)

2. **Lightweight**: Keep overhead minimal (<5%)
   - Optimize for performance
   - Use efficient data structures (circular buffers, etc.)
   - Minimize memory allocations

3. **Simple API**: Maintain the "stupidly simple to use" philosophy
   - One-line setup should always work
   - Sensible defaults for everything
   - Advanced features optional

### Directory Structure

```
src/
├── index.js              # Main entry point
├── index.d.ts            # TypeScript definitions
├── core/                 # Core monitoring logic
│   ├── EventLoopMonitor.js
│   └── MetricsCollector.js
├── middleware/           # Express integration
│   └── express.js
├── dashboard/            # Dashboard UI
│   ├── routes.js
│   ├── api.js
│   └── dashboard.html
├── exporters/            # Metric exporters
│   └── prometheus.js
└── alerts/               # Alert system
    └── AlertManager.js
```

### Code Style

#### JavaScript Style

- **ES6+ syntax**: Use modern JavaScript features
- **No semicolons**: Follow the existing style (ASI)
- **2 spaces**: For indentation
- **Single quotes**: For strings (unless template literals)
- **Descriptive names**: Variables and functions should be self-documenting

**Example:**
```javascript
function calculateEventLoopLag(histogram) {
  const mean = histogram.mean / 1e6  // Convert nanoseconds to milliseconds
  const p95 = histogram.percentile(95) / 1e6
  
  return {
    mean,
    p95,
    isHealthy: mean < 50
  }
}
```

#### JSDoc Comments

All public functions should have JSDoc comments:

```javascript
/**
 * Monitor the event loop for performance issues
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.sampleInterval - Sampling interval in ms
 * @returns {EventLoopMonitor} Monitor instance
 * 
 * @example
 * const monitor = createMonitor({ sampleInterval: 100 })
 * monitor.start()
 */
function createMonitor(options) {
  // Implementation
}
```

#### Error Handling

- Always validate user inputs
- Provide helpful error messages
- Use try-catch for async operations
- Log errors with context

```javascript
try {
  monitor.start()
} catch (error) {
  console.error('EventLoopMonitor: Failed to start monitoring:', error.message)
  throw new Error(`Monitor start failed: ${error.message}`)
}
```

### TypeScript Definitions

When adding new features, update `src/index.d.ts`:

```typescript
/**
 * New feature description
 */
export function newFeature(param: string): Promise<void>
```

### Performance Considerations

1. **Avoid synchronous operations** in hot paths
2. **Reuse objects** instead of creating new ones
3. **Use circular buffers** for history (already implemented)
4. **Cache calculations** when possible
5. **Profile your changes** - ensure <5% overhead

### Areas We'd Love Help With

#### High Priority
- ✅ **Test Coverage**: Add Jest tests for all modules
- ✅ **CI/CD**: GitHub Actions for automated testing
- ✅ **Documentation**: More examples and use cases
- ✅ **Browser Dashboard**: Improve UI/UX

#### Medium Priority
- 🔄 **WebSocket Support**: Real-time dashboard updates
- 🔄 **Grafana Dashboards**: Pre-built templates
- 🔄 **Memory Profiling**: Detect memory leaks
- 🔄 **Cluster Support**: Better multi-worker monitoring

#### Future Ideas
- 📊 **Data Persistence**: SQLite/PostgreSQL storage
- 📱 **Mobile App**: Monitor on-the-go
- 🔌 **Framework Adapters**: Fastify, Koa, Hapi
- 🎨 **Themes**: Dark mode, custom colors

## Testing

### Manual Testing

1. **Basic functionality**:
   ```bash
   npm run example
   # Visit http://localhost:3000/event-loop-stats
   # Verify dashboard loads and displays metrics
   ```

2. **Test endpoints**:
   ```bash
   curl http://localhost:3000/api/test
   curl http://localhost:3000/api/cpu    # Should show lag spike
   curl http://localhost:3000/metrics    # Prometheus format
   ```

3. **Load testing**:
   ```bash
   node examples/load-test.js
   # Watch dashboard during load
   ```

### Automated Tests (Coming Soon)

We're building out the test suite. Contributions welcome!

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

**Test files go in**: `test/` directory
- `test/EventLoopMonitor.test.js`
- `test/MetricsCollector.test.js`
- `test/middleware.test.js`

## Submitting Changes

### Commit Messages

Write clear, concise commit messages:

**Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: add WebSocket support for real-time updates

Implements WebSocket server to push metrics to dashboard
in real-time, eliminating need for polling.

Closes #42
```

```
fix: prevent memory leak in circular buffer

The buffer wasn't properly clearing old references,
causing memory to grow over time.

Fixes #38
```

### Pull Request Checklist

Before submitting your PR, ensure:

- [ ] Code follows the style guide
- [ ] JSDoc comments added for new functions
- [ ] TypeScript definitions updated (if applicable)
- [ ] Examples work correctly (`npm run example`)
- [ ] Linting passes (`npm run lint`)
- [ ] No console warnings or errors
- [ ] README updated (if adding features)
- [ ] Performance impact verified (<5% overhead)
- [ ] Zero dependencies maintained

### Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How have you tested this?

## Checklist
- [ ] Code follows style guide
- [ ] Comments added
- [ ] Tests pass
- [ ] Docs updated

## Screenshots (if applicable)
Add screenshots for UI changes.
```

## Style Guide

### Naming Conventions

- **Classes**: PascalCase (`EventLoopMonitor`)
- **Functions**: camelCase (`getMetrics`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_HISTORY_SIZE`)
- **Private methods**: Prefix with underscore (`_calculateStats`)

### File Organization

Each file should:
1. Have a header comment explaining its purpose
2. Group related functions together
3. Export public API at the bottom
4. Keep private helpers at the top or bottom

```javascript
/**
 * Event Loop Monitor - Core monitoring class
 * 
 * @module core/EventLoopMonitor
 */

// Private helpers
function _calculateLag(histogram) {
  // ...
}

// Main class
class EventLoopMonitor {
  // ...
}

// Exports
module.exports = EventLoopMonitor
```

### Comments

- **Do**: Explain WHY, not WHAT
- **Don't**: State the obvious
- **Do**: Document edge cases and gotchas
- **Do**: Add examples for complex logic

```javascript
// ❌ Bad
// Increment counter
counter++

// ✅ Good
// Track request even if monitoring fails to ensure accurate metrics
counter++

// ✅ Good
// Convert from nanoseconds to milliseconds for consistency with Node.js conventions
const lagMs = histogram.mean / 1e6
```

## Questions?

- **General questions**: [Open a discussion](https://github.com/nishant0192/event-loop-monitor-dashboard/discussions)
- **Bug reports**: [Open an issue](https://github.com/nishant0192/event-loop-monitor-dashboard/issues)
- **Security issues**: Email nishantgolakiya2001@gmail.com directly

## Recognition

All contributors will be:
- Listed in the README.md
- Credited in release notes
- Part of a growing community solving Node.js observability challenges

Thank you for contributing! 🎉

---

**Remember**: The goal is to create the best event loop monitoring tool for Node.js - simple, lightweight, and powerful. Every contribution moves us closer to that goal.