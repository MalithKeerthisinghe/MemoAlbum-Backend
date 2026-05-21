import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  deleteCurateDraft,
  getCurateDraft,
  listCurateDrafts,
  saveCurateDraft,
} from '../controllers/curateController.js';

const router = express.Router();

router.use(protect);

router.post('/', saveCurateDraft);
router.get('/', listCurateDrafts);
router.get('/current', getCurateDraft);
router.delete('/current', deleteCurateDraft);

export default router;
