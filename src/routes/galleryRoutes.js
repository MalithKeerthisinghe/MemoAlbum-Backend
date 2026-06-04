import express from 'express';
import {
  createGalleryFolder,
  getGalleryFolders,
  listGalleryMedia,
  addGalleryMedia,
  toggleGalleryMediaFavorite,
} from '../controllers/galleryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/folders', protect, getGalleryFolders);
router.post('/folders', protect, createGalleryFolder);
router.get('/media', protect, listGalleryMedia);
router.post('/media', protect, addGalleryMedia);
router.patch('/media/:mediaId/favorite', protect, toggleGalleryMediaFavorite);

export default router;
