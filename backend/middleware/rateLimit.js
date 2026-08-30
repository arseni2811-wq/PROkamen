function createRateLimit({ windowMs, max, keyGenerator }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = String(keyGenerator(req) || "unknown");
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", retryAfter);

    if (bucket.count > max) {
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        success: false,
        message: "Слишком много попыток. Повторите позже.",
      });
    }

    next();
  };
}

module.exports = { createRateLimit };
