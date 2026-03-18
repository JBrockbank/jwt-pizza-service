// metrics.js
const config = require('./config');
const os = require('os');
const fetch = require('node-fetch'); // ensure node-fetch is installed

// ------------------------
// In-memory metric storage
// ------------------------
const requests = {};

let authSuccess = 0;
let authFail = 0;
const activeUsers = new Set();

let pizzasSold = 0;
let pizzaFailures = 0;
let revenue = 0;
let pizzaLatencies = [];

// ------------------------
// Middleware: track requests
// ------------------------
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

// ------------------------
// Auth tracking
// ------------------------
function trackAuth(success, userId) {
  if (success) {
    authSuccess++;
    if (userId) activeUsers.add(userId);
  } else {
    authFail++;
  }
}

// ------------------------
// Pizza tracking
// ------------------------
function pizzaPurchase(success, latencyMs, price) {
  if (success) {
    pizzasSold++;
    revenue += price;
  } else {
    pizzaFailures++;
  }
  pizzaLatencies.push(latencyMs);
}

// ------------------------
// System metrics
// ------------------------
function getCpuUsage() {
  return (os.loadavg()[0] / os.cpus().length) * 100;
}

function getMemoryUsage() {
  const used = os.totalmem() - os.freemem();
  return (used / os.totalmem()) * 100;
}

// ------------------------
// Metric builder
// ------------------------
function createMetric(name, value, attributes = {}) {
  attributes = { ...attributes, source: config.metrics.source };

  return {
    name,
    unit: '1',
    sum: {
      dataPoints: [
        {
          asDouble: value,
          timeUnixNano: Date.now() * 1_000_000,
          attributes: Object.entries(attributes).map(([k, v]) => ({
            key: k,
            value: { stringValue: String(v) },
          })),
        },
      ],
      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
      isMonotonic: true,
    },
  };
}

// ------------------------
// Send metrics to Grafana
// ------------------------
function sendMetrics() {
  const metrics = [];

  // Requests per endpoint
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests_total', requests[endpoint], { endpoint }));
  });

  // Auth
  metrics.push(createMetric('auth_success_total', authSuccess));
  metrics.push(createMetric('auth_failure_total', authFail));

  // Active users
  metrics.push(createMetric('active_users', activeUsers.size));

  // Pizza metrics
  const avgPizzaLatency =
    pizzaLatencies.length > 0
      ? pizzaLatencies.reduce((a, b) => a + b, 0) / pizzaLatencies.length
      : 0;

  metrics.push(createMetric('pizzas_sold_total', pizzasSold));
  metrics.push(createMetric('pizza_failures_total', pizzaFailures));
  metrics.push(createMetric('pizza_revenue_total', revenue));
  metrics.push({
    name: 'pizza_latency_ms_avg',
    unit: 'ms',
    gauge: {
      dataPoints: [
        {
          asDouble: avgPizzaLatency,
          timeUnixNano: Date.now() * 1_000_000,
          attributes: [{ key: 'source', value: { stringValue: config.metrics.source } }],
        },
      ],
    },
  });

  // System metrics
  metrics.push(createMetric('cpu_percent', getCpuUsage()));
  metrics.push(createMetric('memory_percent', getMemoryUsage()));

  // Build OTLP payload
  const body = { resourceMetrics: [{ scopeMetrics: [{ metrics }] }] };

  fetch(config.metrics.endpointUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error('Metrics error:', err));

  // Reset pizza latencies after reporting
  pizzaLatencies.length = 0;
}

// ------------------------
// Periodic reporting every 10s
// ------------------------
setInterval(sendMetrics, 10000);

// ------------------------
// Exports
// ------------------------
module.exports = {
  requestTracker,
  trackAuth,
  pizzaPurchase,
};