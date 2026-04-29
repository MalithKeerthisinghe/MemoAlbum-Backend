const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('photographer'));

// GET /api/photographer/profile
router.get('/profile', async (req, res) => {
  const db = getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(req.user.id) },
    { projection: { password: 0 } }
  );
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, photographer: user });
});

// PUT /api/photographer/profile
router.put('/profile', async (req, res) => {
  const db = getDb();
  const { name, phone, bio } = req.body;
  const updateData = { updatedAt: new Date() };
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set: updateData }
  );
  res.json({ success: true, message: 'Profile updated' });
});

// GET /api/photographer/stats
router.get('/stats', async (req, res) => {
  const db = getDb();
  const photographerId = new ObjectId(req.user.id);

  const [totalAlbums, sharedAlbums, totalPayments] = await Promise.all([
    db.collection('albums').countDocuments({ photographer_id: photographerId }),
    db.collection('albums').countDocuments({ photographer_id: photographerId, shareEnabled: true }),
    db.collection('payments').countDocuments({ photographer_id: photographerId, status: 'completed' }),
  ]);

  const albums = await db.collection('albums')
    .find({ photographer_id: photographerId }, { projection: { coupleAccess: 1 } })
    .toArray();

  const totalCustomers = albums.reduce(
    (sum, a) => sum + (a.coupleAccess ? a.coupleAccess.length : 0), 0
  );

  res.json({
    success: true,
    stats: { totalAlbums, sharedAlbums, totalCustomers, totalPayments },
  });
});

module.exports = router;