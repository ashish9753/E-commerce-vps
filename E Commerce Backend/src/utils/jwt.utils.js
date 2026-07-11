import jwt from "jsonwebtoken";
import crypto from "crypto";

const isStaffRole = (role) => role === "admin" || role === "employee";

// Session duration by role:
//   admin / employee → 1 day  (hard cap, single-session enforced — signing in
//                              anywhere else immediately drops the old session)
//   regular user     → 7 days (up to 5 concurrent devices, see getMaxSessions)
export const getRefreshTokenExpiry = (role) => (isStaffRole(role) ? "1d" : "7d");

export const getRefreshCookieMaxAge = (role) =>
  isStaffRole(role)
    ? 1 * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;

// Access-token lifetime is kept in step with the refresh window so a device
// stays signed in for the whole session without a mid-session bounce.
//   admin / employee → 1 day  (matches refresh cap)
//   regular user     → 7 days
//   override via env ACCESS_TOKEN_EXPIRY only if you genuinely want shorter
const accessTokenExpiry = (role) => {
  if (isStaffRole(role)) return "1d";
  return process.env.ACCESS_TOKEN_EXPIRY || "7d";
};

// How many devices/sessions a role may keep signed in at once.
//   admin / employee → 1  (single session; a new login logs the old one out)
//   regular user     → 5  (oldest is evicted when a 6th device signs in)
export const getMaxSessions = (role) => (isStaffRole(role) ? 1 : 5);

export const generateAccessToken = (payload, role) =>
  jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: accessTokenExpiry(role),
  });

export const generateRefreshToken = (payload, role) =>
  jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: getRefreshTokenExpiry(role),
  });

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

// `sid` is included in both tokens and identifies the device session. On every
// authenticated request it must still match one of the sessions stored on the
// user (see auth.middleware) — otherwise the token is treated as revoked
// (single-session takeover for staff, or device-cap eviction / logout).
export const generateSessionId = () => crypto.randomBytes(16).toString("hex");

export const generateTokenPair = (userId, role, sessionId) => {
  const sid = sessionId || generateSessionId();
  const accessToken  = generateAccessToken({ _id: userId, role, sid }, role);
  const refreshToken = generateRefreshToken({ _id: userId, sid }, role);
  return { accessToken, refreshToken, sessionId: sid };
};
