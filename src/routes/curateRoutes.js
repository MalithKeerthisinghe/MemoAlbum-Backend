import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  deleteCurateDraft,
  getCurateDraft,
  getCurateTemplatePreview,
  listCurateDrafts,
  listCurateTemplates,
  saveCurateDraft,
} from '../controllers/curateController.js';

const router = express.Router();

router.use(protect);

router.post('/', saveCurateDraft);
router.get('/', listCurateDrafts);
router.get('/templates', listCurateTemplates);
router.get('/current', getCurateDraft);
router.get('/current/template-preview', getCurateTemplatePreview);
router.delete('/current', deleteCurateDraft);

export default router;
