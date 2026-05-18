import express from 'express';
import AdminUserController from '../../controllers/adminUserController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, AdminUserController.listUsers);
router.post('/', protect, AdminUserController.createOrUpdateUser);

export default router;