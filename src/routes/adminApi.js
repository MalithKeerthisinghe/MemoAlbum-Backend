 import express from 'express';
import adminUserRoutes from './admin/users.js';   

const router = express.Router();

router.use('/users', adminUserRoutes);

export default router;