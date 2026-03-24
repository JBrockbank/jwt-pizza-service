const fetch = require("node-fetch"); // npm i node-fetch if missing
const config = require("./config.js");

function sanitize(obj) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  // Remove PII/secrets
  if (clone.password) clone.password = "***";
  if (clone.token) clone.token = "***";
  if (clone.authorization) clone.authorization = "***";
  if (clone.email) clone.email = "***";
  if (clone.payment) clone.payment = "***";
  return clone;
}

async function sendToGrafana(stream, event) {
  const ts = Date.now() * 1_000_000; // nanoseconds
  const body = {
    streams: [
      {
        stream: {
          source: config.logging.source,
          type: stream, // http, db, factory, error
        },
        values: [[String(ts), JSON.stringify(event)]],
      },
    ],
  };


  try {
    const res = await fetch(config.logging.endpointUrl, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    });
    if (!res.ok) console.warn("Grafana log push failed:", res.status);
  } catch (e) {
    // Fail silently
  }
}

function log(stream, event) {
  const safeEvent = sanitize(event);
  sendToGrafana(stream, safeEvent);
}

// Express HTTP request logging middleware
httpLogger = (req, res, next) => {
  let responseBody;

  // Override BOTH res.json AND res.send
  const oldJson = res.json;
  const oldSend = res.send;

  res.json = function (body) {
    responseBody = body;
    return oldJson.call(this, body);
  };

  res.send = function (body) {
    responseBody = body;
    return oldSend.call(this, body);
  };

  res.on("finish", () => {
    const logData = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      hasAuthorization: !!req.headers.authorization,
      requestBody: sanitize(JSON.stringify(req.body)), // ← FIXED: just sanitize()
      responseBody: sanitize(JSON.stringify(responseBody)), // ← FIXED: just sanitize()
    };
    log("http", logData); // ← FIXED: direct log() call
  });

  next();
};

// Express error logging middleware
function errorLogger(err, req, res, next) {
  log("error", {
    message: err.message,
    stack: err.stack || "No stack",
    path: req.path,
    method: req.method,
    statusCode: res.statusCode || 500,
  });
  next(err);
}

// DB logging helper
function logDb(query, params, durationMs, success) {
  log("db", {
    query,
    params: sanitize(params),
    durationMs,
    success,
  });
}

// Factory logging helper
function logFactory(requestBody, responseBody, statusCode, success) {
  log("factory", {
    requestBody: sanitize(requestBody),
    responseBody: sanitize(responseBody),
    statusCode,
    success,
  });
}

module.exports = {
  httpLogger,
  errorLogger,
  logDb,
  logFactory,
};
