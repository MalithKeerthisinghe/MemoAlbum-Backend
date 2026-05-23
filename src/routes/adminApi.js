 import express from 'express';
import adminUserRoutes from './admin/users.js';   
import adminTemplateRoutes from './admin/templates.js';

const router = express.Router();

router.use('/users', adminUserRoutes);
router.use('/templates', adminTemplateRoutes);

export default router;