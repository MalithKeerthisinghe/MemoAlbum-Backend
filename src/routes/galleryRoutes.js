import express from 'express';
import {
  createGalleryFolder,
  getGalleryFolders,
  listGalleryMedia,
  addGalleryMedia,
  toggleGalleryMediaFavorite,
  deleteGalleryMedia,
  getGallerySummary,
} from '../controllers/galleryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/folders', protect, getGalleryFolders);
router.post('/folders', protect, createGalleryFolder);
router.get('/media', protect, listGalleryMedia);
router.post('/media', protect, addGalleryMedia);
 router.patch('/media/:mediaId/favorite', protect, toggleGalleryMediaFavorite);
router.delete('/media/:mediaId', protect, deleteGalleryMedia);
router.get('/summary', protect, getGallerySummary);   // protect = ඔබේ auth middleware
export default router;
