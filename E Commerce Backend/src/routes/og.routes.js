import { Router } from "express";
import { productOgPage } from "../controllers/og.controller.js";

// Open Graph preview pages for link sharing. Public, no auth — these are what
// social crawlers fetch (nginx routes crawler user-agents here).
const router = Router();

router.get("/product/:id", productOgPage);

export default router;
