const { randomUUID } = require("crypto");

function requestContext(req, res, next) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? "error" : "info",
        request_id: requestId,
        method: req.method,
        route: req.originalUrl?.split("?")[0] || req.path,
        status: res.statusCode,
        latency_ms: Number(latencyMs.toFixed(2)),
        actor_id: req.user?.user_id || null,
        order_id: req.params?.id || null,
      }),
    );
  });
  next();
}

module.exports = { requestContext };
