import express from 'express';
import PhotographerController from '../controllers/photographerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/public-users', PhotographerController.getPublicPhotographers);
router.get('/users', protect, PhotographerController.getUsers);
router.post('/update-profile', protect, PhotographerController.updateProfile);

export default router;
