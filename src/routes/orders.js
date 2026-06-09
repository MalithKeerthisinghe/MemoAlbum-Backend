import express from 'express';
import Order from '../models/Order.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/orders
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { photographerId: req.user._id };
    if (status) filter.paymentStatus = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('albumId',        'albumName coverPhoto weddingDate')
        .populate('clientInviteId', 'inviteStatus emailStatus sentAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// GET /api/orders/stats/summary  ← must stay above /:id
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const photographerId = req.user._id;

    const [stats] = await Order.aggregate([
      { $match: { photographerId } },
      {
        $group: {
          _id:           null,
          totalOrders:   { $sum: 1 },
          paidOrders:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] },    1, 0] } },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
          failedOrders:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] },  1, 0] } },
          totalRevenue:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      stats: stats || {
        totalOrders: 0, paidOrders: 0,
        pendingOrders: 0, failedOrders: 0, totalRevenue: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id:            req.params.id,
      photographerId: req.user._id,
    })
      .populate('albumId',         'albumName coverPhoto weddingDate')
      .populate('clientInviteId',  'inviteStatus emailStatus sentAt clientEmails')
      .populate('pendingInviteId', 'status')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

export default router;