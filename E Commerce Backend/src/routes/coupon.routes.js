import { Router } from "express";
import {
  createCoupon, getAllCoupons, getCouponById,
  updateCoupon, deleteCoupon, validateCoupon, getPublicCoupons,
} from "../controllers/coupon.controller.js";
import { protect, optionalAuth } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { couponLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.get("/public", optionalAuth, getPublicCoupons);
router.post("/validate", protect, couponLimiter, validateCoupon);

router.use(protect, authorize("admin", "employee"));
router.get("/", requirePermission("coupons"), getAllCoupons);
router.post("/", requirePermission("coupons.write"), createCoupon);
router.get("/:couponId", requirePermission("coupons"), getCouponById);
router.patch("/:couponId", requirePermission("coupons.write"), updateCoupon);
router.delete("/:couponId", requirePermission("coupons.write"), deleteCoupon);

export default router;
