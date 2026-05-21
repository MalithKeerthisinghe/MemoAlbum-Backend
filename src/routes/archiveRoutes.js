import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createArchive, listArchives } from '../controllers/archiveController.js';

const router = express.Router();

router.use(protect);
router.get('/', listArchives);
router.post('/', createArchive);

export default router;
