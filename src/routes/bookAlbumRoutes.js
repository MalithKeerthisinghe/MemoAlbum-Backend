import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createBookAlbum,
  getBookAlbum,
  updateSlotAssignment,
  saveBookAlbum,
  listBookAlbums,
} from '../controllers/bookAlbumController.js';

const router = express.Router();

router.use(protect);

router.post('/', createBookAlbum);
router.get('/', listBookAlbums);
router.get('/:bookAlbumId', getBookAlbum);
router.patch('/:bookAlbumId/slot', updateSlotAssignment);
router.patch('/:bookAlbumId', saveBookAlbum);

export default router;
