import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createBookAlbum,
  getBookAlbum,
  updateSlotAssignment,
  saveBookAlbum,
  listBookAlbums,
  listPublicBookAlbums,
} from '../controllers/bookAlbumController.js';

const router = express.Router();

router.get('/public', listPublicBookAlbums);

router.use(protect);

router.post('/', createBookAlbum);
router.get('/', listBookAlbums);
router.get('/:bookAlbumId', getBookAlbum);
router.patch('/:bookAlbumId/slot', updateSlotAssignment);
router.patch('/:bookAlbumId', saveBookAlbum);

export default router;
