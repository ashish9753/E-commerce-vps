import { Router } from "express";
import { getCodSettings, updateCodSettings, getDeliverySettings, updateDeliverySettings, getPickupSettings, updatePickupSettings } from "../controllers/settings.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();

router.get("/cod", getCodSettings);                              // public — needed at checkout
router.patch("/cod", protect, authorize("admin", "employee"), updateCodSettings);

router.get("/delivery", getDeliverySettings);                    // public — needed at order creation
router.patch("/delivery", protect, authorize("admin", "employee"), updateDeliverySettings);

router.get("/pickup", getPickupSettings);                        // public — needed at checkout
router.patch("/pickup", protect, authorize("admin", "employee"), updatePickupSettings);

export default router;
