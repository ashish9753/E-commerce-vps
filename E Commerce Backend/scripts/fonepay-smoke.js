// Fonepay UAT smoke test.
//
// Validates that your Fonepay credentials + signing key actually work against
// the gateway, independent of the rest of the app. Run after filling in the
// FONEPAY_* values in .env:
//
//   node scripts/fonepay-smoke.js
//
// It performs: oAuth login → generate a 1-rupee Intent QR → status check.
// Nothing is charged; the QR is just generated and its status polled once.
import dotenv from "dotenv";
dotenv.config();

import fonepayService, { buildReferenceLabel, isFonepayConfigured } from "../src/services/fonepay.service.js";

const log = (...a) => console.log("[fonepay-smoke]", ...a);

const run = async () => {
  if (!isFonepayConfigured()) {
    log("❌ Not configured. Set FONEPAY_BASE_URL, FONEPAY_USERNAME, FONEPAY_PASSWORD, FONEPAY_TERMINAL_ID and FONEPAY_PRIVATE_KEY in .env first.");
    process.exit(1);
  }
  log("Base URL :", process.env.FONEPAY_BASE_URL);
  log("Terminal :", process.env.FONEPAY_TERMINAL_ID);

  try {
    log("1) Generating a test Intent QR (Rs. 1)…");
    const ref = buildReferenceLabel("FULL");
    const qr = await fonepayService.generateIntentQr({ amount: 1, billId: "SMOKE-TEST", referenceLabel: ref });
    log("   ✅ QR generated. prn =", qr.prn);
    log("   websocket =", qr.websocketUrl || "(none returned)");
    log("   qrString  =", qr.qrString.slice(0, 48) + "…");

    log("2) Checking payment status (expected: pending — nobody has paid)…");
    const status = await fonepayService.getPaymentStatus({ referenceLabel: qr.prn });
    log("   ✅ Status =", status.paymentStatus, "|", status.paymentMessage || "");

    log("🎉 All Fonepay calls succeeded — credentials & signing key are valid.");
    process.exit(0);
  } catch (err) {
    log("❌ Failed:", err.statusCode ? `(${err.statusCode}) ` : "", err.message);
    log("   Tips: verify the RSA private key matches the public key Fonepay holds,");
    log("   that the terminalId is correct, and that the username/password are the oAuth pair.");
    process.exit(1);
  }
};

run();
