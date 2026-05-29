import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createArchive, deleteArchive, deleteArchiveFolder, listArchives, renameArchiveFolder } from '../controllers/archiveController.js';

const router = express.Router();

router.use(protect);
router.get('/', listArchives);
router.post('/', createArchive);
router.delete('/:id', deleteArchive);
router.patch('/folder/:folderName', renameArchiveFolder);
router.delete('/folder/:folderName', deleteArchiveFolder);

export default router;
