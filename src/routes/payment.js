const express = require('express');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendPaymentConfirmationEmail } = require('../utils/mailer');

const router = express.Router();

// POST /api/payments/initiate
// Customer initiates payment for an album
router.post('/initiate', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();
  const { shareToken } = req.body;

  if (!shareToken) return res.status(400).json({ error: 'shareToken is required' });

  const album = await db.collection('albums').findOne({ shareToken });
  if (!album) return res.status(404).json({ error: 'Album not found' });

  // Check this customer was invited
  const access = (album.coupleAccess || []).find(a => a.email === req.user.email);
  if (!access) return res.status(403).json({ error: 'You do not have access to this album' });

  // Check not already paid
  if (access.hasPaid) {
    return res.status(400).json({ error: 'You have already paid for this album' });
  }

  // Check for existing pending payment
  const existingPayment = await db.collection('payments').findOne({
    album_id: album._id,
    customer_id: new ObjectId(req.user.id),
    status: 'pending',
  });
  if (existingPayment) {
    return res.json({
      success: true,
      message: 'Payment already initiated',
      paymentId: existingPayment._id,
      amount: album.price,
    });
  }

  // Create payment record
  const result = await db.collection('payments').insertOne({
    album_id: album._id,
    customer_id: new ObjectId(req.user.id),
    photographer_id: album.photographer_id,
    amount: album.price,
    status: 'pending',
    method: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.json({
    success: true,
    message: 'Payment initiated',
    paymentId: result.insertedId,
    amount: album.price,
    albumTitle: album.title,
  });
});

// POST /api/payments/confirm
// Mark payment as complete (integrate your real payment gateway here)
// For now this is a manual confirm endpoint
router.post('/confirm', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();
  const { paymentId, method } = req.body;

  if (!paymentId || !ObjectId.isValid(paymentId)) {
    return res.status(400).json({ error: 'valid paymentId is required' });
  }

  const payment = await db.collection('payments').findOne({
    _id: new ObjectId(paymentId),
    customer_id: new ObjectId(req.user.id),
    status: 'pending',
  });
  if (!payment) return res.status(404).json({ error: 'Payment not found or already completed' });

  // Mark payment complete
  await db.collection('payments').updateOne(
    { _id: new ObjectId(paymentId) },
    { $set: { status: 'completed', method: method || 'card', paidAt: new Date(), updatedAt: new Date() } }
  );

  // Mark customer as paid in album coupleAccess
  await db.collection('albums').updateOne(
    { _id: payment.album_id, 'coupleAccess.email': req.user.email },
    { $set: { 'coupleAccess.$.hasPaid': true, 'coupleAccess.$.paidAt': new Date() } }
  );

  // Get album for email
  const album = await db.collection('albums').findOne({ _id: payment.album_id });
  const viewUrl = `${process.env.FRONTEND_URL}/album/view/${album.shareToken}`;

  // Send confirmation email
  try {
    await sendPaymentConfirmationEmail({
      toEmail: req.user.email,
      customerName: req.user.name,
      albumTitle: album.title,
      viewUrl,
    });
  } catch (err) {
    console.error('Payment confirmation email failed:', err.message);
  }

  res.json({
    success: true,
    message: 'Payment confirmed. You can now view your album.',
    shareToken: album.shareToken,
    viewUrl,
  });
});

// GET /api/payments/my
// Customer sees their payment history
router.get('/my', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();
  const payments = await db.collection('payments').aggregate([
    { $match: { customer_id: new ObjectId(req.user.id) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' },
    },
    { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        amount: 1, status: 1, method: 1, createdAt: 1, paidAt: 1,
        'album.title': 1, 'album.shareToken': 1,
      },
    },
  ]).toArray();

  res.json({ success: true, payments });
});

// GET /api/payments/status/:shareToken
// Customer checks payment status for a specific album
router.get('/status/:shareToken', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();

  const album = await db.collection('albums').findOne({ shareToken: req.params.shareToken });
  if (!album) return res.status(404).json({ error: 'Album not found' });

  const payment = await db.collection('payments').findOne({
    album_id: album._id,
    customer_id: new ObjectId(req.user.id),
  });

  const access = (album.coupleAccess || []).find(a => a.email === req.user.email);

  res.json({
    success: true,
    hasPaid: access ? access.hasPaid : false,
    payment: payment || null,
    price: album.price,
  });
});

module.exports = router;