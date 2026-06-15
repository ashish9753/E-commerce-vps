import { Router } from "express";
import {
  submitPaymentProof, reviewPayment, getPaymentByOrder,
} from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { uploadPaymentProof } from "../middleware/upload.middleware.js";

const router = Router();

router.use(protect);

// Customer uploads a FonePay payment screenshot for their order
router.post("/proof/:orderId", uploadPaymentProof("screenshot"), submitPaymentProof);
router.get("/order/:orderId", getPaymentByOrder);

// Admin/employee verify (accept/reject) the uploaded screenshot
router.patch("/:orderId/review", authorize("admin", "employee"), reviewPayment);

export default router;
