import express from 'express';
import {
  createGalleryFolder,
  deleteGalleryFolder,
  getGalleryFolders,
  listGalleryMedia,
  addGalleryMedia,
  toggleGalleryMediaFavorite,
  deleteGalleryMedia,
  getGallerySummary,
  moveGalleryMedia,
  addGuestGalleryMedia,
  getGuestGalleryFolder,
} from '../controllers/galleryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/folders', protect, getGalleryFolders);
router.post('/folders', protect, createGalleryFolder);
router.delete('/folders/:folderId', protect, deleteGalleryFolder);
router.get('/media', protect, listGalleryMedia);
router.post('/media', protect, addGalleryMedia);
router.patch('/media/:mediaId/favorite', protect, toggleGalleryMediaFavorite);
router.patch('/media/:mediaId', protect, moveGalleryMedia);
router.delete('/media/:mediaId', protect, deleteGalleryMedia);
router.get('/summary', protect, getGallerySummary);

// Public guest routes
router.get('/guest-folders/:userId', getGuestGalleryFolder);
router.post('/guest-media/:userId', addGuestGalleryMedia);

export default router;
