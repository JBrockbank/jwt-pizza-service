// metrics.js
const config = require("./config") || {};
if (!config.metrics) {
  console.log("Metrics config missing - skipping metrics");
  module.exports = { requestTracker, trackAuth, pizzaPurchase };
  return;
}
const os = require("os");
const fetch = require("node-fetch"); // ensure node-fetch is installed

// ------------------------
// In-memory metric storage
// ------------------------
const requests = {};

let authSuccess = 0;
let authFail = 0;
const activeUsers = new Map();
let pizzasSold = 0;
let pizzaFailures = 0;
let revenue = 0;
let pizzaLatencyTotal = 0;
let pizzaLatencyCount = 0;
// ------------------------
// Middleware: track requests
// ------------------------
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;

  const userId = req.user?.id || req.ip;
  activeUsers.set(userId, Date.now());

  next();
}

// ------------------------
// Auth tracking
// ------------------------
function trackAuth(success, userId) {
  if (success) {
    authSuccess++;
    if (userId) activeUsers.set(userId, Date.now());
  } else {
    authFail++;
  }
}

function getActiveUserCount() {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [userId, lastSeen] of activeUsers.entries()) {
    if (now - lastSeen > timeout) {
      activeUsers.delete(userId);
    }
  }

  return activeUsers.size;
}

// ------------------------
// Pizza tracking
// ------------------------
function pizzaPurchase(success, latencyMs, price) {
//   console.log("PIZZA PURCHASE FUNCTION HIT");
  if (success) {
    pizzasSold++;
    revenue += Number(price) || 0;
    // console.log("PIZZA SUCCESS", pizzasSold, revenue);
  } else {
    pizzaFailures++;
  }

  pizzaLatencyTotal += Number(latencyMs) || 0;
  pizzaLatencyCount++;
}

// ------------------------
// System metrics
// ------------------------
function getCpuUsage() {
  const cpus = os.cpus();
  let idle = 0,
    total = 0;

  cpus.forEach((core) => {
    for (let type in core.times) total += core.times[type] || 0;
    idle += core.times.idle || 0;
  });

  if (total === 0) return 0;

  const usage = 100 - (idle / total) * 100;
  return Math.max(0, Math.min(100, usage));
}

function getMemoryUsage() {
  const total = os.totalmem();
  if (!total) return 0;

  const used = total - os.freemem();
  return (used / total) * 100;
}
// ------------------------
// Metric builder
// ------------------------
function createCounterMetric(name, value, attributes = {}) {
  attributes = { ...attributes, source: config.metrics.source };

  return {
    name,
    unit: "1",
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
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: true,
    },
  };
}

function createGaugeMetric(name, value, attributes = {}) {
  attributes = { ...attributes, source: config.metrics.source };

  return {
    name,
    unit: "1",
    gauge: {
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
    metrics.push(
      createCounterMetric("requests_total", requests[endpoint], { endpoint }),
    );
  });

  // Auth
  metrics.push(
    createCounterMetric("auth_success_total", authSuccess, {
      outcome: "success",
    }),
  );
  metrics.push(
    createCounterMetric("auth_failure_total", authFail, { outcome: "failure" }),
  );

  // Active users
  metrics.push(createGaugeMetric("active_users", getActiveUserCount()));

  metrics.push(
    createCounterMetric("pizzas_sold_total", pizzasSold, {
      outcome: "success",
    }),
  );
  metrics.push(
    createCounterMetric("pizza_failures_total", pizzaFailures, {
      outcome: "failure",
    }),
  );
  metrics.push(createCounterMetric("pizza_revenue_total", revenue));
  if (pizzaLatencyCount > 0) {
    const avgPizzaLatency = pizzaLatencyTotal / pizzaLatencyCount;

    metrics.push({
      name: "pizza_latency_ms_avg",
      unit: "ms",
      gauge: {
        dataPoints: [
          {
            asDouble: avgPizzaLatency,
            timeUnixNano: Date.now() * 1_000_000,
            attributes: [
              { key: "source", value: { stringValue: config.metrics.source } },
            ],
          },
        ],
      },
    });
  }

  // System metrics
  metrics.push(createGaugeMetric("cpu_percent", getCpuUsage()));
  metrics.push(createGaugeMetric("memory_percent", getMemoryUsage()));

  // Build OTLP payload
  const body = { resourceMetrics: [{ scopeMetrics: [{ metrics }] }] };

  fetch(config.metrics.endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error("Metrics error:", err));

  // Reset pizza latencies after reporting
  //   pizzaLatencyTotal = 0;
  //   pizzaLatencyCount = 0;

//   console.log("METRICS REPORT", pizzasSold, revenue);
//   console.log(JSON.stringify(metrics, null, 2));
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
