import express from 'express';
import AdminUserController from '../../controllers/adminUserController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, AdminUserController.listUsers);
router.post('/', protect, AdminUserController.createOrUpdateUser);
router.get('/:id', protect, AdminUserController.getUserProfile);
router.put('/:id', protect, AdminUserController.updateUserProfile);
router.delete('/:id', protect, AdminUserController.deleteUser);
router.post('/:id/resend-invite', protect, AdminUserController.resendInvitation);

export default router;