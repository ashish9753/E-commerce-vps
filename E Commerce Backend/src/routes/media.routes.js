import { Router } from "express";
import {
  createMedia, getActiveMedia, getAllMedia, updateMedia, deleteMedia,
} from "../controllers/media.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";

const router = Router();

// Public — the storefront "Highlights" strip above the footer.
router.get("/active", getActiveMedia);

// Staff CRUD (links only — no file upload).
router.use(protect, authorize("admin", "employee"));
router.get("/",             requirePermission("media"),       getAllMedia);
router.post("/",            requirePermission("media.write"), createMedia);
router.patch("/:mediaId",   requirePermission("media.write"), updateMedia);
router.delete("/:mediaId",  requirePermission("media.write"), deleteMedia);

export default router;
