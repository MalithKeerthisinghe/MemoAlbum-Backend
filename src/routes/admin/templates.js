import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';
import { deleteTemplate, getTemplateById, listTemplates, saveTemplate } from '../../controllers/templateController.js';

const router = express.Router();

router.use(protect);

router.get('/', listTemplates);
router.get('/:id', getTemplateById);
router.post('/', saveTemplate);
router.put('/:id', saveTemplate);
router.delete('/:id', deleteTemplate);

export default router;