import express from "express";
import { adminLogin, login, logout } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/admin/login", adminLogin);
router.post("/login", login);
router.post("/logout", protect, logout);

export default router;