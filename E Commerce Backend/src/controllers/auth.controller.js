import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.model.js";
import { generateTokenPair, generateSessionId, verifyRefreshToken, getRefreshCookieMaxAge, getMaxSessions } from "../utils/jwt.utils.js";
import { sendEmail, passwordResetEmail } from "../utils/email.utils.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { assertPhone } from "../utils/validators.utils.js";

// Single OAuth2Client used to verify Google ID tokens against our client_id.
// Re-uses Google's public keys cache so we don't refetch JWKS on every request.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleIdToken = async (idToken) => {
  if (!idToken) throw new ApiError(400, "Google ID token is required");
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, "Google sign-in is not configured on the server");
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      throw new ApiError(401, "Google account email is not verified");
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, "Invalid or expired Google token");
  }
};

// Register a freshly-minted session on the user, enforcing the per-role device
// cap. Staff (cap 1) drop every other session, so an old browser/tab loses
// access on its next API call — the classic single-session takeover. Regular
// users keep up to 5 devices; when a 6th signs in the least-recently-used one
// is evicted. Mutates `user.sessions` in place (caller saves).
const registerSession = (user, sessionId, refreshToken, req) => {
  const max = getMaxSessions(user.role);
  let sessions = Array.isArray(user.sessions) ? [...user.sessions] : [];
  if (max <= 1) {
    sessions = []; // single-session roles: clear everything else first
  } else if (sessions.length >= max) {
    // Evict oldest-used sessions until there's room for the new one.
    sessions.sort((a, b) => new Date(a.lastUsedAt) - new Date(b.lastUsedAt));
    sessions = sessions.slice(sessions.length - (max - 1));
  }
  sessions.push({
    sessionId,
    refreshToken,
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    createdAt: new Date(),
    lastUsedAt: new Date(),
  });
  user.sessions = sessions;
};

const issueSessionForUser = async (req, res, user) => {
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked");
  const sessionId = generateSessionId();
  const { accessToken, refreshToken } = generateTokenPair(user._id, user.role, sessionId);
  registerSession(user, sessionId, refreshToken, req);
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.sessions;
  setRefreshCookie(req, res, refreshToken, user.role);
  return { user: userObj, accessToken };
};

const REFRESH_COOKIE = "refreshToken";

// Cookie attributes are derived from the live request, not NODE_ENV, so the
// cookie always matches the connection. Why this matters:
//
//   * Cross-site fetch (frontend on Render, backend on Render — different
//     hostnames) only carries cookies if SameSite=None AND Secure.
//   * Modern browsers reject Secure cookies on plain http:// (except
//     localhost), so we must NOT set Secure on http requests.
//
// `req.secure` works correctly because app.js sets `trust proxy: 1` — the
// flag reads `X-Forwarded-Proto` from Render's edge. If env var slips out of
// sync (no NODE_ENV=production set) cookies still work.
const refreshCookieOptions = (req, role) => {
  const isHttps = !!(req?.secure || process.env.NODE_ENV === "production");
  return {
    httpOnly: true,                          // not readable from JS — XSS-safe
    secure: isHttps,                         // browser will reject otherwise
    sameSite: isHttps ? "none" : "lax",      // None+Secure for cross-site
    maxAge: getRefreshCookieMaxAge(role),
    path: "/api/v1/auth",
  };
};

const setRefreshCookie = (req, res, token, role) => {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(req, role));
};

const clearRefreshCookie = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req, "user"), maxAge: undefined });
};

export const register = async (req, res, next) => {
  try {
    // `role` is intentionally NOT read from the body — it is always "user".
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      throw new ApiError(400, "All fields are required");
    }
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    const phoneDigits = assertPhone(phone);

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new ApiError(409, "Email already registered");

    const user = await User.create({
      name,
      email,
      phone: phoneDigits,
      password,
      role: "user",
    });

    const sessionId = generateSessionId();
    const { accessToken, refreshToken } = generateTokenPair(user._id, user.role, sessionId);
    registerSession(user, sessionId, refreshToken, req);
    await user.save({ validateBeforeSave: false });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.sessions;

    setRefreshCookie(req, res, refreshToken, user.role);
    res.status(201).json(
      new ApiResponse(201, { user: userObj, accessToken }, "Registration successful")
    );
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, "Email and password required");

    const user = await User.findOne({ email }).select("+password +sessions");
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, "User not found");
    }
    if (user.isBlocked) throw new ApiError(403, "Your account has been blocked");

    const sessionId = generateSessionId();
    const { accessToken, refreshToken } = generateTokenPair(user._id, user.role, sessionId);
    registerSession(user, sessionId, refreshToken, req);
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.sessions;

    setRefreshCookie(req, res, refreshToken, user.role);
    res.json(new ApiResponse(200, { user: userObj, accessToken }, "Login successful"));
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    // Only accept the refresh token from the httpOnly cookie — never from a
    // header or request body. That closes the XSS exfiltration path.
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token || typeof token !== "string") throw new ApiError(401, "Refresh token required");

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded._id).select("+sessions");

    // Locate the device session by its sid. A missing session means it was
    // revoked: staff single-session takeover, device-cap eviction, logout, or
    // password reset.
    const idx = Array.isArray(user?.sessions)
      ? user.sessions.findIndex((s) => s.sessionId === decoded.sid)
      : -1;

    // Refresh tokens rotate on every use, so a request must present either the
    // session's CURRENT token or — within a short grace window — the token that
    // was rotated out on the very last refresh. The grace window absorbs the
    // classic rotation race: two tabs (or a retried request) refreshing at
    // nearly the same instant would otherwise leave one holding a just-rotated
    // token and get the whole session wrongly invalidated.
    const ROTATION_GRACE_MS = 60 * 1000;
    const session = idx >= 0 ? user.sessions[idx] : null;
    const matchesCurrent = session && session.refreshToken === token;
    const matchesPrevInGrace = session
      && session.prevRefreshToken === token
      && session.prevRefreshAt
      && Date.now() - new Date(session.prevRefreshAt).getTime() < ROTATION_GRACE_MS;

    if (!user || idx < 0 || (!matchesCurrent && !matchesPrevInGrace)) {
      clearRefreshCookie(req, res);
      const isStaff = user && (user.role === "admin" || user.role === "employee");
      return next(new ApiError(
        401,
        isStaff ? "SESSION_REPLACED: signed in from another location" : "Invalid or expired refresh token",
      ));
    }

    if (matchesCurrent) {
      // Normal path — rotate the token, remembering the old one for the grace
      // window, keeping the same sid so the session continues.
      const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(
        user._id, user.role, decoded.sid,
      );
      session.prevRefreshToken = session.refreshToken;
      session.prevRefreshAt = new Date();
      session.refreshToken = newRefreshToken;
      session.lastUsedAt = new Date();
      user.markModified("sessions");
      await user.save({ validateBeforeSave: false });
      setRefreshCookie(req, res, newRefreshToken, user.role);
      return res.json(new ApiResponse(200, { accessToken }, "Tokens refreshed"));
    }

    // Grace path — a racing duplicate presented the just-rotated token. Don't
    // rotate again (that would cascade); re-issue a fresh access token and
    // re-affirm the current refresh cookie so this request also succeeds.
    const accessToken = generateTokenPair(user._id, user.role, decoded.sid).accessToken;
    setRefreshCookie(req, res, session.refreshToken, user.role);
    res.json(new ApiResponse(200, { accessToken }, "Tokens refreshed"));
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      clearRefreshCookie(req, res);
      return next(new ApiError(401, "Invalid or expired refresh token"));
    }
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Log out just THIS device — pull only the session the current access
    // token belongs to, leaving the user's other devices signed in. `protect`
    // set req.sessionId from the token's sid. If for some reason it's absent
    // (legacy token), fall back to clearing every session.
    if (req.sessionId) {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { sessions: { sessionId: req.sessionId } } },
      );
    } else {
      await User.updateOne({ _id: req.user._id }, { $set: { sessions: [] } });
    }
    clearRefreshCookie(req, res);
    res.json(new ApiResponse(200, null, "Logged out successfully"));
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new ApiError(400, "Email is required");

    // One identical response on every path — a different message, or an error
    // bubbling out of sendEmail, would tell an attacker which emails exist.
    const GENERIC = "If this email is registered, a reset link has been sent";

    const user = await User.findOne({ email });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
      try {
        await sendEmail({ to: user.email, ...passwordResetEmail(user.name, resetUrl) });
      } catch (mailErr) {
        console.error("[forgotPassword] send failed:", mailErr.message);
      }
    }

    res.json(new ApiResponse(200, null, GENERIC));
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) throw new ApiError(400, "New password is required");
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) throw new ApiError(400, "Invalid or expired reset token");

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.sessions = []; // force re-login on every device after a password reset
    await user.save();

    res.json(new ApiResponse(200, null, "Password reset successful. Please log in."));
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json(new ApiResponse(200, { user: req.user }));
  } catch (err) {
    next(err);
  }
};

/**
 * Step 1 of Google sign-in. Verify the ID token from the client.
 *  - If a user with this email/googleId already exists → log them in directly.
 *  - Otherwise return the verified profile so the frontend can show a
 *    "complete your profile" form. We do NOT create the user here, because
 *    we still need phone/password from them before the account is usable.
 */
export const googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const profile = await verifyGoogleIdToken(idToken);

    // Match by googleId first, then by verified email (handles users who
    // originally signed up with email/password and are now linking Google).
    let user = await User.findOne({
      $or: [{ googleId: profile.googleId }, { email: profile.email }],
    }).select("+sessions");

    if (user) {
      // Link Google if it wasn't linked before. Email coming from Google is
      // verified, so we can mark emailVerified=true on existing accounts too.
      let dirty = false;
      if (!user.googleId) { user.googleId = profile.googleId; dirty = true; }
      if (!user.emailVerified) { user.emailVerified = true; dirty = true; }
      if (!user.profileImage && profile.picture) { user.profileImage = profile.picture; dirty = true; }
      if (dirty) await user.save({ validateBeforeSave: false });

      const session = await issueSessionForUser(req, res, user);
      return res.json(new ApiResponse(200, { ...session, needsRegistration: false }, "Logged in with Google"));
    }

    // New user — frontend will show the completion form. We send back the
    // verified profile (and echo the idToken so the next call can re-verify
    // server-side; we never trust the email coming straight from req.body).
    return res.json(new ApiResponse(200, {
      needsRegistration: true,
      profile: { email: profile.email, name: profile.name, picture: profile.picture },
    }, "Google verified. Please complete your profile."));
  } catch (err) {
    next(err);
  }
};

/**
 * Step 2 of Google sign-in for new users. Re-verifies the idToken so we never
 * trust the email field from req.body, then creates the user with the
 * profile fields they filled in (phone + optional password).
 */
export const googleRegister = async (req, res, next) => {
  try {
    const { idToken, name, phone, password } = req.body;
    const profile = await verifyGoogleIdToken(idToken);

    if (!name || !name.trim()) throw new ApiError(400, "Name is required");
    const phoneDigits = assertPhone(phone);
    if (password && password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    // Guard against the race where a user signed up between googleAuth and
    // googleRegister — fall back to logging them in.
    const existing = await User.findOne({
      $or: [{ googleId: profile.googleId }, { email: profile.email }],
    }).select("+sessions");
    if (existing) {
      if (!existing.googleId) existing.googleId = profile.googleId;
      existing.emailVerified = true;
      const session = await issueSessionForUser(req, res, existing);
      return res.json(new ApiResponse(200, { ...session, needsRegistration: false }, "Logged in with Google"));
    }

    const user = await User.create({
      name: name.trim(),
      email: profile.email,            // verified — comes from the Google token, not the body
      phone: phoneDigits,
      password: password || undefined, // optional; Google-only users can leave it blank
      googleId: profile.googleId,
      emailVerified: true,
      profileImage: profile.picture,
      role: "user",
    });

    const session = await issueSessionForUser(req, res, user);
    res.status(201).json(new ApiResponse(201, { ...session, needsRegistration: false }, "Registration successful"));
  } catch (err) {
    next(err);
  }
};
