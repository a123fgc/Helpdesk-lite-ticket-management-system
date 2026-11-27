const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = { error: 'Too many requests, please try again shortly' };

/**
 * Global limiter: protects every endpoint from brute-force bursts while still
 * leaving headroom for normal interactive use (a busy agent page can fire a
 * handful of requests per second).
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/**
 * Stricter limiter for credential endpoints. Keyed by IP so a single account
 * cannot be password-sprayed, and cheap enough that it cannot be used to lock
 * out an entire office (5 attempts / minute / IP).
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: 'Too many authentication attempts, please try again shortly' },
});

module.exports = { globalLimiter, authLimiter };
