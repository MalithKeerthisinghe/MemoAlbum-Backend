import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { addFavoritePhoto, listFavoritePhotos, removeFavoritePhoto } from '../controllers/favoriteController.js';

const router = express.Router();

router.use(protect);
router.get('/', listFavoritePhotos);
router.post('/', addFavoritePhoto);
router.delete('/:id', removeFavoritePhoto);

export default router;
