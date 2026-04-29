const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendPhotographerWelcomeEmail } = require('../utils/mailer');
const crypto = require('crypto');

const router = express.Router();

// All admin routes require superadmin role
router.use(authenticate, requireRole('superadmin'));

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const db = getDb();
  const [
    totalPhotographers,
    activePhotographers,
    disabledPhotographers,
    pendingPhotographers,
    totalCustomers,
    totalAlbums,
    totalPayments,
    pendingPayments,
  ] = await Promise.all([
    db.collection('users').countDocuments({ role: 'photographer' }),
    db.collection('users').countDocuments({ role: 'photographer', status: 'active' }),
    db.collection('users').countDocuments({ role: 'photographer', status: 'disabled' }),
    db.collection('users').countDocuments({ role: 'photographer', status: 'pending' }),
    db.collection('users').countDocuments({ role: 'customer' }),
    db.collection('albums').countDocuments(),
    db.collection('payments').countDocuments({ status: 'completed' }),
    db.collection('payments').countDocuments({ status: 'pending' }),
  ]);

  res.json({
    success: true,
    stats: {
      photographers: { total: totalPhotographers, active: activePhotographers, disabled: disabledPhotographers, pending: pendingPhotographers },
      customers: { total: totalCustomers },
      albums: { total: totalAlbums },
      payments: { total: totalPayments, pending: pendingPayments },
    },
  });
});

// ── Create photographer (admin only) ─────────────────────────────────────────
// POST /api/admin/photographers
router.post('/photographers', async (req, res) => {
  const db = getDb();
  const { name, email, phone, bio } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const existing = await db.collection('users').findOne({ email });
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  // Auto-generate a random password
  const plainPassword = crypto.randomBytes(6).toString('hex');
  const hashed = await bcrypt.hash(plainPassword, 10);

  const result = await db.collection('users').insertOne({
    name,
    email,
    password: hashed,
    phone: phone || '',
    bio: bio || '',
    profilePic: '',
    role: 'photographer',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
    createdByAdmin: true,
  });

  // Send welcome email with credentials
  try {
    await sendPhotographerWelcomeEmail({
      toEmail: email,
      name,
      password: plainPassword,
    });
  } catch (emailErr) {
    console.error('Welcome email failed:', emailErr.message);
  }

  res.status(201).json({
    success: true,
    message: 'Photographer created and welcome email sent',
    photographerId: result.insertedId,
  });
});

// ── List all photographers ────────────────────────────────────────────────────
router.get('/photographers', async (req, res) => {
  const db = getDb();
  const { status, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { role: 'photographer' };
  if (status && status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await db.collection('users').countDocuments(filter);
  const photographers = await db.collection('users')
    .find(filter, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  // Attach album count for each
  const enriched = await Promise.all(
    photographers.map(async (p) => {
      const albumCount = await db.collection('albums').countDocuments({ photographer_id: p._id });
      return { ...p, albumCount };
    })
  );

  res.json({
    success: true,
    photographers: enriched,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ── Get single photographer with full details ─────────────────────────────────
router.get('/photographers/:id', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const photographer = await db.collection('users').findOne(
    { _id: new ObjectId(req.params.id), role: 'photographer' },
    { projection: { password: 0 } }
  );
  if (!photographer) return res.status(404).json({ error: 'Photographer not found' });

  const albums = await db.collection('albums')
    .find({ photographer_id: new ObjectId(req.params.id) })
    .sort({ created_at: -1 })
    .toArray();

  const totalCustomers = albums.reduce(
    (sum, a) => sum + (a.coupleAccess ? a.coupleAccess.length : 0), 0
  );

  res.json({
    success: true,
    photographer,
    albums,
    stats: {
      totalAlbums: albums.length,
      totalCustomersGivenAccess: totalCustomers,
    },
  });
});

// ── Update photographer details ───────────────────────────────────────────────
router.put('/photographers/:id', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name, phone, bio, email } = req.body;
  const updateData = { updatedAt: new Date() };
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (bio) updateData.bio = bio;

  if (email) {
    const existing = await db.collection('users').findOne({
      email, _id: { $ne: new ObjectId(req.params.id) },
    });
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    updateData.email = email;
  }

  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(req.params.id), role: 'photographer' },
    { $set: updateData }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Photographer not found' });

  res.json({ success: true, message: 'Photographer updated' });
});

// ── Enable or disable photographer ───────────────────────────────────────────
router.patch('/photographers/:id/status', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const { status } = req.body;
  if (!['active', 'disabled', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be active, disabled or pending' });
  }

  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(req.params.id), role: 'photographer' },
    { $set: { status, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Photographer not found' });

  res.json({ success: true, message: `Photographer ${status}` });
});

// ── Reset photographer password ───────────────────────────────────────────────
router.post('/photographers/:id/reset-password', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(req.params.id), role: 'photographer' },
    { $set: { password: hashed, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Photographer not found' });

  res.json({ success: true, message: 'Password reset successfully' });
});

// ── Delete photographer and all their data ────────────────────────────────────
router.delete('/photographers/:id', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const photographer = await db.collection('users').findOne({
    _id: new ObjectId(req.params.id), role: 'photographer',
  });
  if (!photographer) return res.status(404).json({ error: 'Photographer not found' });

  const albums = await db.collection('albums')
    .find({ photographer_id: new ObjectId(req.params.id) })
    .toArray();

  const albumIds = albums.map(a => a._id);

  // Delete payments for their albums
  if (albumIds.length > 0) {
    await db.collection('payments').deleteMany({ album_id: { $in: albumIds } });
  }

  // Delete albums
  await db.collection('albums').deleteMany({ photographer_id: new ObjectId(req.params.id) });

  // Delete photographer user
  await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

  res.json({ success: true, message: 'Photographer and all their data deleted', albumsDeleted: albums.length });
});

// ── List all customers ────────────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  const db = getDb();
  const { search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { role: 'customer' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await db.collection('users').countDocuments(filter);
  const customers = await db.collection('users')
    .find(filter, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  res.json({
    success: true,
    customers,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ── List all albums ───────────────────────────────────────────────────────────
router.get('/albums', async (req, res) => {
  const db = getDb();
  const { search, photographerId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (photographerId && ObjectId.isValid(photographerId)) {
    filter.photographer_id = new ObjectId(photographerId);
  }
  if (search) filter.title = { $regex: search, $options: 'i' };

  const total = await db.collection('albums').countDocuments(filter);
  const albums = await db.collection('albums').aggregate([
    { $match: filter },
    { $sort: { created_at: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'photographer_id',
        foreignField: '_id',
        as: 'photographer',
      },
    },
    { $unwind: { path: '$photographer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1, description: 1, shareEnabled: 1, created_at: 1,
        accessCount: { $size: { $ifNull: ['$coupleAccess', []] } },
        'photographer._id': 1, 'photographer.name': 1, 'photographer.email': 1,
      },
    },
  ]).toArray();

  res.json({
    success: true,
    albums,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ── Delete any album ──────────────────────────────────────────────────────────
router.delete('/albums/:id', async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  await db.collection('payments').deleteMany({ album_id: new ObjectId(req.params.id) });
  const result = await db.collection('albums').deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Album not found' });
  res.json({ success: true, message: 'Album deleted' });
});

// ── List all payments ─────────────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await db.collection('payments').countDocuments();
  const payments = await db.collection('payments').aggregate([
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: { from: 'users', localField: 'customer_id', foreignField: '_id', as: 'customer' },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' },
    },
    { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        amount: 1, status: 1, method: 1, createdAt: 1,
        'customer.name': 1, 'customer.email': 1,
        'album.title': 1,
      },
    },
  ]).toArray();

  res.json({
    success: true,
    payments,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

module.exports = router;