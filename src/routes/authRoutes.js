import express from "express";
import { adminLogin } from "../controllers/authController.js";

const router = express.Router();

router.post("/admin/login", adminLogin);

export default router;