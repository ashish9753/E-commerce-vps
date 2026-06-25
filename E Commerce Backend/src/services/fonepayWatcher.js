// Live Fonepay payment watcher.
//
// After a dynamic Intent QR is generated, Fonepay exposes a per-transaction
// WebSocket (doc §9.5) that pushes QR-verification and payment messages. We
// connect server-side so settlement is instant and works even if the customer
// closes their tab. This is purely an optimization — the polling status
// endpoint (controller getFonepayStatus → settleFonepayPayment) is the reliable
// source of truth, so any watcher failure is swallowed.
//
// On *any* completion signal from the socket we don't trust the payload blindly;
// we call settleFonepayPayment, which re-verifies against Fonepay's status API
// before crediting the order.
import { WebSocket } from "ws";

const WATCH_TIMEOUT_MS = 6 * 60_000;  // give up after 6 minutes
const wsEnabled = () => process.env.FONEPAY_WS_ENABLED !== "false";

// Dedupe: at most one live socket per order+purpose.
const active = new Map(); // key `${orderId}:${purpose}` -> { ws, timer }

const keyOf = (orderId, purpose) => `${orderId}:${purpose}`;

const cleanup = (key) => {
  const entry = active.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  try { entry.ws.terminate(); } catch { /* ignore */ }
  active.delete(key);
};

// A WS message indicates the transaction finished (success OR failure). The
// payload nests a JSON-string `transactionStatus`; we only need to know "is
// this terminal?" — the authoritative amount/status comes from the status API.
const looksTerminal = (raw) => {
  try {
    const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    const ts = typeof msg?.transactionStatus === "string"
      ? JSON.parse(msg.transactionStatus)
      : msg?.transactionStatus || msg;
    return ts?.paymentSuccess !== undefined ||
           ts?.success !== undefined ||
           ts?.message != null;
  } catch {
    // Unparseable push — still a hint that *something* happened; trigger a check.
    return true;
  }
};

export const watchFonepayPayment = ({ orderId, purpose, prn, websocketUrl }) => {
  if (!wsEnabled() || !websocketUrl) return;
  const key = keyOf(orderId, purpose);
  if (active.has(key)) return; // already watching

  let ws;
  try {
    ws = new WebSocket(websocketUrl);
  } catch (err) {
    console.warn(`[fonepay-ws] could not open socket for ${prn}: ${err.message}`);
    return;
  }

  const timer = setTimeout(() => cleanup(key), WATCH_TIMEOUT_MS);
  timer.unref?.();
  active.set(key, { ws, timer });

  const settle = async () => {
    try {
      // Lazy import avoids a static import cycle with payment.controller.
      const { settleFonepayPayment } = await import("../controllers/payment.controller.js");
      const result = await settleFonepayPayment(orderId, purpose);
      if (result.status === "SUCCESS" || result.status === "FAILED") cleanup(key);
    } catch (err) {
      console.warn(`[fonepay-ws] settle failed for ${prn}: ${err.message}`);
    }
  };

  ws.on("message", (data) => {
    if (looksTerminal(data?.toString?.() ?? data)) settle();
  });
  ws.on("error", (err) => {
    console.warn(`[fonepay-ws] socket error for ${prn}: ${err.message}`);
    cleanup(key);
  });
  ws.on("close", () => cleanup(key));
};

export const stopAllFonepayWatchers = () => {
  for (const key of active.keys()) cleanup(key);
};
