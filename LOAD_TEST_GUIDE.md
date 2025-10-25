# Production-Like Load Testing Guide

This guide explains how to run comprehensive, production-realistic load tests on your Event Loop Monitor.

## 🎯 What This Tests

The load test simulates realistic production scenarios over ~10 minutes:

- **Normal traffic** (10-50 req/s)
- **Traffic spikes** (100-200 req/s)
- **Mixed operations** (fast, slow, blocking, CPU-intensive)
- **Sustained high load**
- **Recovery periods**
- **Stress conditions**

## 📁 Test Files

- `load-test.js` - Comprehensive load testing script
- `monitor.js` - Real-time terminal dashboard
- `express-app.js` - The demo server (examples/express-app.js)

## 🚀 How to Run

### Step 1: Start the Server

```bash
# In Terminal 1
node examples/express-app.js
```

You should see:
```
✅ Server running on http://localhost:3000
📊 Dashboard: http://localhost:3000/event-loop-stats
```

### Step 2: Open Web Dashboard (Optional but Recommended)

Open in your browser:
```
http://localhost:3000/event-loop-stats/
```

Keep this tab visible to watch real-time metrics during the test.

### Step 3: Start Real-time Terminal Monitor (Optional)

```bash
# In Terminal 2
node monitor.js
```

This displays a live terminal dashboard with:
- Health status
- Event loop lag metrics
- Utilization graphs
- Request rates
- Sparkline charts

### Step 4: Run the Load Test

```bash
# In Terminal 3 (or Terminal 2 if not using monitor)
node load-test.js
```

## 📊 Test Phases

The load test runs through these phases automatically:

| Phase | Duration | Target RPS | Purpose |
|-------|----------|------------|---------|
| Warmup | 30s | 5 | Start monitoring, initialize metrics |
| Baseline | 60s | 10 | Establish normal operation baseline |
| Ramp Up | 30s | 25 | Gradual load increase |
| Peak Hour | 120s | 50 | Sustained high traffic |
| Spike 1 | 15s | 100 | Sudden traffic burst |
| Recovery 1 | 30s | 20 | System recovery observation |
| Sustained High | 120s | 75 | Extended high load period |
| Spike 2 | 20s | 150 | Second major spike |
| Recovery 2 | 30s | 15 | Second recovery period |
| Stress Test | 30s | 200 | Maximum load test |
| Cooldown | 60s | 5 | Return to normal |

**Total Duration:** ~10 minutes

## 🎭 Operation Mix

Each request randomly selects an operation type:

- **70% Fast operations** - Simple JSON responses (~1-2ms)
- **20% Slow operations** - Async I/O simulation (~1000ms, non-blocking)
- **5% Light blocking** - Small CPU operations (~50-100ms block)
- **5% Heavy blocking** - Intensive CPU operations (~200-300ms block)

This simulates realistic production workloads with occasional blocking.

## 📈 What to Watch For

### In the Web Dashboard:

1. **Health Banner** - Watch it change colors:
   - ✅ Green = Healthy
   - ⚠️ Yellow = Degraded
   - 🔴 Red = Critical

2. **Event Loop Lag Chart** - Look for:
   - Baseline around 10-20ms (healthy)
   - Spikes during blocking operations
   - Recovery after spikes

3. **Utilization Chart** - Monitor:
   - Low utilization (0-20%) during normal traffic
   - Spikes to 50-90% during heavy load
   - Sustained high utilization under stress

### In the Terminal Monitor:

- Real-time metrics update every second
- Sparkline charts show trends
- Progress bars indicate severity
- Color coding for quick status assessment

### In the Load Test Output:

- Phase completion status
- Actual vs. target RPS
- Response time percentiles
- Error rates
- Health status per phase

## 🎓 Understanding Results

### Healthy System:

```
Event Loop Lag: 10-30ms mean
Utilization: 0-20%
Health Score: 90-100
P99 Response Time: <100ms
```

### Degraded System:

```
Event Loop Lag: 50-100ms mean
Utilization: 50-80%
Health Score: 50-80
P99 Response Time: 100-500ms
```

### Critical System:

```
Event Loop Lag: >100ms mean
Utilization: >80%
Health Score: <50
P99 Response Time: >500ms
Timeouts occurring
```

## 📊 Sample Output

After completion, you'll see:

```
📊 FINAL STATISTICS
================================================================================

🔢 Request Summary:
   Total:      45,234
   Successful: 44,987 (99.45%)
   Failed:     247 (0.55%)
   Timeouts:   12

⏱️  Response Times:
   Min:    1 ms
   Mean:   45.23 ms
   Median: 12.45 ms
   P95:    156.78 ms
   P99:    287.34 ms
   Max:    1234.56 ms

📋 Phase Summary:

Phase                    Target RPS     Actual RPS     Requests       Health
--------------------------------------------------------------------------------
Warmup                   5              4.98           149            ✅
Baseline                 10             9.95           597            ✅
Ramp Up                  25             24.87          746            ✅
Peak Hour                50             49.76          5971           ⚠️
Spike 1                  100            98.34          1475           🔴
Recovery 1               20             19.89          597            ⚠️
Sustained High Load      75             74.23          8908           ⚠️
Spike 2                  150            147.89         2958           🔴
Recovery 2               15             14.92          448            ✅
Stress Test              200            194.56         5834           🔴
Cooldown                 5              4.97           298            ✅
```

## 🔬 Advanced Testing

### Longer Duration

Edit `load-test.js`:

```javascript
phases: [
  // ... extend duration of phases
  { name: 'Extended Peak', duration: 600, rps: 50 }, // 10 minutes
]
```

### Higher Load

Increase RPS values:

```javascript
{ name: 'Extreme Stress', duration: 60, rps: 500 }
```

### Different Operation Mix

Adjust weights in `load-test.js`:

```javascript
operationMix: {
  fast: 50,      // More balanced
  slow: 30,
  blocking: 10,  // More blocking to test limits
  cpu: 10
}
```

### Custom Endpoints

Add your own endpoints:

```javascript
operations: [
  { name: 'my-api', endpoint: '/my/api/endpoint', weight: 50 },
  // ... other operations
]
```

## 🐛 Troubleshooting

### Connection Refused

Make sure the server is running:
```bash
node examples/express-app.js
```

### High Failure Rate

- Server might be overwhelmed
- Reduce RPS in test phases
- Check server logs for errors

### Monitor Not Updating

- Ensure server URL is correct in scripts
- Check firewall settings
- Verify port 3000 is accessible

### Browser Dashboard Not Loading

- Clear browser cache
- Check browser console for errors
- Visit `/event-loop-stats/` (with trailing slash)

## 📝 Notes

- **Monitor overhead:** The Event Loop Monitor adds <5% overhead
- **System resources:** Ensure your machine can handle 200+ req/s
- **Blocking operations:** Intentionally cause degradation to test monitoring
- **Real production:** In production, tune thresholds based on your baseline

## 🎯 Success Criteria

A successful test should show:

✅ Monitor detects all traffic spikes  
✅ Health status changes appropriately  
✅ Charts show clear lag correlation with blocking ops  
✅ System recovers quickly after stress  
✅ No crashes or memory leaks  
✅ Metrics remain accurate throughout  

## 💡 Tips

1. **Run multiple times** - Get consistent baseline
2. **Compare with APM** - Run alongside DataDog/New Relic to see the difference
3. **Adjust thresholds** - Set warning/critical levels based on your needs
4. **Save results** - Take screenshots of dashboards at peak load
5. **Test recovery** - Verify system returns to healthy after stress

## 🚀 Next Steps

After successful testing:

1. **Deploy to staging** - Test with real application code
2. **Set up alerts** - Configure alert callbacks for your monitoring
3. **Integrate Prometheus** - Export to Grafana for long-term tracking
4. **Document thresholds** - Record your baseline and alert levels
5. **Production rollout** - Deploy with confidence!

---

**Happy Testing! 🎉**