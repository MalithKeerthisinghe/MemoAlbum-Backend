import express from 'express';
import {
  createAlbum,
  getAlbums,
  getAlbumById,
  updateAlbum,
  publishAlbum,
  deleteAlbum,
  sendInvite,
} from '../controllers/albumController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Album CRUD operations
router.post('/', createAlbum);
router.get('/', getAlbums);
router.get('/:id', getAlbumById);
router.put('/:id', updateAlbum);
router.delete('/:id', deleteAlbum);

// Album specific operations
router.post('/:id/publish', publishAlbum);
router.post('/:id/invite', sendInvite);

export default router;
