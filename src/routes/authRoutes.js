import express from "express";
import { adminLogin, getCurrentUser, login, logout, updateCurrentUser, changePassword } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/admin/login", adminLogin);
router.post("/login", login);
router.post("/logout", protect, logout);
router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateCurrentUser);
router.patch('/change-password', protect, changePassword);

export default router;