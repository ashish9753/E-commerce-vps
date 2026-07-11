import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.utils.js";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(401, "Access token required");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Include sessions so we can confirm this token still maps to a live one.
    const user = await User.findById(decoded._id).select("-password +sessions");
    if (!user) throw new ApiError(401, "User not found");
    if (user.isBlocked) throw new ApiError(403, "Your account has been blocked");

    // Session enforcement. A token is only honoured while its `sid` still
    // matches a session on the account. It stops matching when:
    //   * staff (cap 1) sign in elsewhere → old session cleared,
    //   * a user hits the 5-device cap → their oldest session is evicted,
    //   * the user logged out or reset their password.
    // Staff get the "SESSION_REPLACED" tag the frontend recognises (immediate
    // logout with a message); everyone else gets a plain 401 that flows
    // through the normal refresh-then-logout path.
    const sessionAlive = Array.isArray(user.sessions)
      && user.sessions.some((s) => s.sessionId === decoded.sid);
    if (!sessionAlive) {
      const isStaff = user.role === "admin" || user.role === "employee";
      throw new ApiError(401, isStaff
        ? "SESSION_REPLACED: signed in from another location"
        : "Session expired. Please sign in again.");
    }

    // Strip the sessions before exposing the user — controllers don't need
    // them and we never want refresh tokens leaking into a JSON response.
    user.sessions = undefined;
    req.sessionId = decoded.sid;
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") return next(new ApiError(401, "Invalid token"));
    if (err.name === "TokenExpiredError") return next(new ApiError(401, "Token expired"));
    next(err);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded._id).select("-password +sessions");
      const sessionAlive = user && Array.isArray(user.sessions)
        && user.sessions.some((s) => s.sessionId === decoded.sid);
      if (user && !user.isBlocked && sessionAlive) {
        user.sessions = undefined;
        req.sessionId = decoded.sid;
        req.user = user;
      }
    }
    next();
  } catch {
    next();
  }
};
