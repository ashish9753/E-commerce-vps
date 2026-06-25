import { Router } from "express";
import {
  createFonepayQr, getFonepayStatus, getPaymentByOrder, getFonepayBanks,
} from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

// Fonepay Checkout Intent — automatic dynamic-QR payments.
//   POST /payments/fonepay/:orderId/qr      → generate a single-use QR
//   GET  /payments/fonepay/:orderId/status  → live status (settles on success)
router.post("/fonepay/:orderId/qr", createFonepayQr);
router.get("/fonepay/:orderId/status", getFonepayStatus);

// Bank list for the (mobile) intent flow — optional.
router.get("/fonepay/banks", getFonepayBanks);

// Read payment info for an order (owner or staff).
router.get("/order/:orderId", getPaymentByOrder);

export default router;
