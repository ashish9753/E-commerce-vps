// Fonepay "Checkout Intent" gateway client.
//
// Implements the merchant-side of Fonepay's Web Checkout Intent flow
// (Merchant doc v1.9): oAuth login → generate a dynamic Intent QR per order →
// confirm the payment via the Get-Payment-Status API. A live WebSocket push is
// handled separately (services/fonepayWatcher.js); this module is the HTTP
// client every outbound call goes through so signing, auth and error handling
// live in one place.
//
// Required env vars:
//   FONEPAY_BASE_URL      — e.g. https://uat-new-merchant-api.fonepay.com (UAT)
//   FONEPAY_USERNAME       — oAuth username issued by Fonepay
//   FONEPAY_PASSWORD       — oAuth password issued by Fonepay
//   FONEPAY_TERMINAL_ID    — merchant terminal id / PAN (max 16 chars)
//   FONEPAY_PRIVATE_KEY    — client RSA private key (PEM). \n-escaped is fine.
// Optional:
//   FONEPAY_SIGN_ALGO      — signing hash, default "RSA-SHA256"
//   FONEPAY_WS_ENABLED     — "false" to disable the live WebSocket watcher
import crypto from "crypto";
import axios from "axios";
import ApiError from "../utils/ApiError.js";

const REQUEST_TIMEOUT_MS = 20_000;
const TOKEN_SAFETY_WINDOW_MS = 60_000; // refresh a minute before nominal expiry

// Endpoints (relative to FONEPAY_BASE_URL) — per Merchant doc v1.9 §9.
const PATHS = {
  login:    "/api/merchant/merchantDetailsForThirdParty/v2/login",
  banks:    "/api/merchant/third-party/v2/banks/list",
  intentQr: "/api/merchant/third-party/v2/generate-intent-qr",
  status:   "/api/merchant/third-party/v2/thirdPartyDynamicQrGetStatus",
};

const baseUrl    = () => (process.env.FONEPAY_BASE_URL || "").replace(/\/$/, "");
const username   = () => process.env.FONEPAY_USERNAME || "";
const password   = () => process.env.FONEPAY_PASSWORD || "";
const terminalId = () => process.env.FONEPAY_TERMINAL_ID || "";
const signAlgo   = () => process.env.FONEPAY_SIGN_ALGO || "RSA-SHA256";

// PEM keys pasted into a single-line .env value keep their newlines as the
// literal characters "\n"; restore real newlines so Node can parse them.
const privateKey = () => (process.env.FONEPAY_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export const isFonepayConfigured = () =>
  !!(baseUrl() && username() && password() && terminalId() && privateKey());

const assertConfigured = () => {
  if (!isFonepayConfigured()) {
    throw new ApiError(503, "Online payment is not configured. Please contact support.");
  }
};

/**
 * RSA-sign the exact request body string with the client private key and
 * return a base64 signature, as required by every Fonepay third-party call
 * (doc §9.2). The signature must be computed over the SAME bytes that are sent
 * on the wire, so callers pass the already-serialized JSON string.
 */
export const signPayload = (rawBody) => {
  const signer = crypto.createSign(signAlgo());
  signer.update(rawBody, "utf8");
  signer.end();
  return signer.sign(privateKey(), "base64");
};

const normalizeError = (err, label) => {
  if (err instanceof ApiError) return err;
  if (err.response) {
    // Fonepay returns { message, status } on failures.
    const data = err.response.data || {};
    const msg = typeof data.message === "object"
      ? Object.values(data.message).join("; ")
      : data.message || `Fonepay ${label} failed (${err.response.status})`;
    return new ApiError(502, `Fonepay: ${msg}`);
  }
  if (err.code === "ECONNABORTED") return new ApiError(504, "Fonepay request timed out");
  return new ApiError(502, `Fonepay error: ${err.message || "unknown"}`);
};

// ── oAuth token cache ───────────────────────────────────────────────────────
// Fonepay tokens are JWTs; we cache one process-wide and refresh on expiry.
let tokenCache = { token: null, expiresAt: 0 };

const decodeJwtExp = (bearer) => {
  try {
    const jwt = bearer.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString("utf8"));
    return payload?.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const login = async () => {
  const body = { username: username(), password: password() };
  const raw = JSON.stringify(body);
  try {
    const { data } = await axios.post(`${baseUrl()}${PATHS.login}`, raw, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        // Basic auth of username:password alongside the RSA signature (doc §9.1).
        Authorization: `Basic ${Buffer.from(`${username()}:${password()}`).toString("base64")}`,
        Signature: signPayload(raw),
      },
    });
    const accessToken = data?.accessToken;
    if (!accessToken) throw new ApiError(502, "Fonepay login returned no access token");
    // accessToken already includes the leading "Bearer ".
    const exp = decodeJwtExp(accessToken);
    tokenCache = {
      token: accessToken,
      // Fall back to a conservative 10-minute TTL if the JWT has no exp.
      expiresAt: (exp || Date.now() + 10 * 60_000) - TOKEN_SAFETY_WINDOW_MS,
    };
    return accessToken;
  } catch (err) {
    throw normalizeError(err, "login");
  }
};

const getAccessToken = async ({ force = false } = {}) => {
  assertConfigured();
  if (!force && tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  return login();
};

/**
 * POST a signed JSON body to a third-party endpoint with a valid bearer token,
 * transparently re-authenticating once on a 401 (expired/rotated token).
 */
const signedPost = async (path, body, label) => {
  assertConfigured();
  const raw = JSON.stringify(body);
  const send = async (token) =>
    axios.post(`${baseUrl()}${path}`, raw, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Authorization: token, // already "Bearer <jwt>"
        signature: signPayload(raw),
      },
    });

  try {
    const token = await getAccessToken();
    const { data } = await send(token);
    return data;
  } catch (err) {
    if (err.response?.status === 401) {
      // token expired/rotated — refresh once and retry.
      const token = await getAccessToken({ force: true });
      try {
        const { data } = await send(token);
        return data;
      } catch (retryErr) {
        throw normalizeError(retryErr, label);
      }
    }
    throw normalizeError(err, label);
  }
};

// referenceLabel must be alphanumeric only, max 30 chars, unique per
// transaction (doc §9.4). Build one from a purpose tag + time + randomness.
export const buildReferenceLabel = (purpose = "FULL") => {
  const tag = purpose === "BOOKING" ? "BK" : "FP";
  const time = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex");
  return `${tag}${time}${rand}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
};

export const fonepayService = {
  isConfigured: isFonepayConfigured,
  terminalId,

  /** Available banks for the mobile intent flow (doc §9.3). */
  async getBankList({ mobileNo } = {}) {
    assertConfigured();
    const raw = JSON.stringify({});
    const send = async (token) =>
      axios.get(`${baseUrl()}${PATHS.banks}`, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          paymentMode: "INTENT",
          Authorization: token,
          signature: signPayload(raw),
          ...(mobileNo ? { mobileNo: String(mobileNo) } : {}),
        },
      });
    try {
      const token = await getAccessToken();
      const { data } = await send(token);
      return data?.bankDetails || [];
    } catch (err) {
      if (err.response?.status === 401) {
        const token = await getAccessToken({ force: true });
        const { data } = await send(token);
        return data?.bankDetails || [];
      }
      throw normalizeError(err, "bank list");
    }
  },

  /**
   * Generate a single-use dynamic Intent QR (doc §9.4).
   * Returns { qrString, qrMessage, prn, websocketUrl, terminalId, status, raw }.
   */
  async generateIntentQr({ amount, billId, referenceLabel }) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1 || amt > 9_999_999) {
      throw new ApiError(400, "Payment amount must be between 1 and 9,999,999");
    }
    const data = await signedPost(PATHS.intentQr, {
      amount: parseFloat(amt.toFixed(2)),
      billId: String(billId).slice(0, 60),
      terminalId: terminalId(),
      paymentMode: "QR",
      referenceLabel,
      qrType: "INTENT_QR",
    }, "QR generation");

    const qrString = data?.qrMessage || data?.qrString;
    if (!qrString) throw new ApiError(502, "Fonepay did not return a QR payload");

    return {
      qrString,
      qrMessage: data?.qrMessage || qrString,
      prn: data?.prn || referenceLabel,
      websocketUrl: data?.websocketId || data?.thirdpartyQRWebSocketUrl || "",
      terminalId: terminalId(),
      qrDisplayName: data?.qrDisplayName || "",
      status: data?.status || "Success",
      raw: data,
    };
  },

  /**
   * Check the final status of a QR transaction (doc §9.6).
   * Returns { paymentStatus: "success"|"pending"|"failed", requestedAmount,
   * totalTransactionAmount, fonepayTraceId, paymentMessage, prn, raw }.
   */
  async getPaymentStatus({ referenceLabel }) {
    const data = await signedPost(PATHS.status, {
      terminalId: terminalId(),
      referenceLabel,
    }, "status check");
    return {
      prn: data?.prn || referenceLabel,
      merchantCode: data?.merchantCode,
      paymentStatus: String(data?.paymentStatus || "pending").toLowerCase(),
      fonepayTraceId: data?.fonepayTraceId,
      requestedAmount: data?.requestedAmount,
      totalTransactionAmount: data?.totalTransactionAmount,
      paymentMessage: data?.paymentMessage || "",
      raw: data,
    };
  },
};

export default fonepayService;
