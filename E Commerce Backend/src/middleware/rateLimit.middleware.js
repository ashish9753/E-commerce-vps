import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

// All limits are PER-IP. `app.set('trust proxy', 1)` in app.js makes that read
// the real client IP from Render's edge instead of the proxy's.
//
// Limits are deliberately generous: a real user fumbling a password or letting
// the browser retry autofill must never hit them — only scripted abuse should.

const handler = (_req, _res, next) =>
  next(new ApiError(429, "Too many requests. Please wait a moment and try again."));

const make = (windowMs, max, opts = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
    ...opts,
  });

// Password guessing and email enumeration: login, forgot/reset password.
export const sensitiveLimiter = make(15 * 60 * 1000, 20);

// Signup-style endpoints. Slightly more lenient — legitimate users retry the
// Google flow or fix a typo'd email.
export const signupLimiter = make(60 * 60 * 1000, 30);

// Token refresh fires in the background whenever an access token expires, so
// this needs a far higher ceiling than the others.
export const refreshLimiter = make(15 * 60 * 1000, 300);

// Blanket limit for the whole API. High enough that normal browsing (a product
// page fans out to several calls) never trips it.
export const apiLimiter = make(15 * 60 * 1000, 1000, {
  skip: (req) => req.method === "OPTIONS",
});

// Writes that cost money or send mail: orders, uploads, support tickets.
export const writeLimiter = make(15 * 60 * 1000, 100);

// Coupon-code guessing. Keyed per user, not per IP — the routes that use this
// all sit behind `protect`, so req.user is always set, and a shared office IP
// shouldn't spend one budget between everybody.
export const couponLimiter = make(15 * 60 * 1000, 30, {
  keyGenerator: (req) => String(req.user?._id || req.ip),
});
