import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createClientInvite, listClientInvites } from '../controllers/clientInviteController.js';

const router = express.Router();

router.use(protect);
router.get('/', listClientInvites);
router.post('/', createClientInvite);

export default router;
