const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'CoupleCanvas API is running' }));

router.use('/auth',         require('./auth'));
router.use('/admin',        require('./admin'));
router.use('/photographer', require('./photographer'));
router.use('/albums',       require('./album'));
router.use('/payments',     require('./payment'));
router.use('/customers',    require('./customer'));
const photographerRoutes = require('./photographer');
 
router.use('/photographer', photographerRoutes);

module.exports = router;