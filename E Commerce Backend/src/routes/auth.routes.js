import { Router } from "express";
import {
  register, login, logout, refreshToken,
  forgotPassword, resetPassword, getMe,
  googleAuth, googleRegister,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  sensitiveLimiter, signupLimiter, refreshLimiter,
} from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/register",       signupLimiter,    register);
router.post("/login",          sensitiveLimiter, login);
router.post("/google",         signupLimiter,    googleAuth);
router.post("/google/complete",signupLimiter,    googleRegister);
router.post("/refresh-token",  refreshLimiter,   refreshToken);
router.post("/forgot-password",sensitiveLimiter, forgotPassword);
router.patch("/reset-password/:token", sensitiveLimiter, resetPassword);
router.post("/logout", protect, logout);
router.get("/me",      protect, getMe);

export default router;
