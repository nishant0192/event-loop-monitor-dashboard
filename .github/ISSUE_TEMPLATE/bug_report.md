---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: nishant0192

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Install package with `npm install event-loop-monitor-dashboard`
2. Add this code '....'
3. Start the server '....'
4. Open dashboard or see error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem (especially dashboard issues).

**Environment (please complete the following information):**
 - OS: [e.g. Ubuntu 22.04, macOS 13, Windows 11]
 - Node.js Version: [e.g. v18.17.0]
 - Package Version: [e.g. 1.0.0]
 - Framework: [e.g. Express 4.18, Fastify 4.0, NestJS 10.0]

**Dashboard Access (if applicable):**
 - Browser: [e.g. Chrome 120, Firefox 121, Safari 17]
 - Accessing via: [e.g. localhost:3000/monitor, reverse proxy]

**Error Logs**
```
Paste any error messages, stack traces, or relevant console logs here
```

**Configuration**
```javascript
// Share your monitor configuration if relevant
const monitor = require('event-loop-monitor-dashboard');
monitor.start({
  // your config here
});
```

**Additional context**
Add any other context about the problem here. For example:
- Does this happen consistently or intermittently?
- Did it work in a previous version?
- Are you running in production, development, or Docker?
- Any specific patterns that trigger the issue?
