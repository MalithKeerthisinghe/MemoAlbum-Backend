const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendAlbumInviteEmail } = require('../utils/mailer');

const router = express.Router();

// ── Photographer: create album ────────────────────────────────────────────────
router.post('/', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  const { title, description, images, pages, coverPage, price } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!price || isNaN(price) || price <= 0) {
    return res.status(400).json({ error: 'price must be a positive number' });
  }

  const shareToken = crypto.randomBytes(24).toString('hex');
  const viewToken = crypto.randomBytes(24).toString('hex');

  const result = await db.collection('albums').insertOne({
    photographer_id: new ObjectId(req.user.id),
    title,
    description: description || '',
    images: images || [],
    pages: pages || [],
    coverPage: coverPage || null,
    price: parseFloat(price),
    coupleAccess: [],
    shareToken,
    viewToken,
    shareEnabled: false,
    created_at: new Date(),
    updated_at: new Date(),
  });

  res.status(201).json({
    success: true,
    message: 'Album created',
    albumId: result.insertedId,
    shareToken,
  });
});

// ── Photographer: get own albums ──────────────────────────────────────────────
router.get('/my', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  const albums = await db.collection('albums')
    .find({ photographer_id: new ObjectId(req.user.id) })
    .sort({ created_at: -1 })
    .toArray();
  res.json({ success: true, albums });
});

// ── Photographer: get single album ────────────────────────────────────────────
router.get('/my/:id', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const album = await db.collection('albums').findOne({
    _id: new ObjectId(req.params.id),
    photographer_id: new ObjectId(req.user.id),
  });
  if (!album) return res.status(404).json({ error: 'Album not found' });
  res.json({ success: true, album });
});

// ── Photographer: update album ────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const { title, description, images, pages, coverPage, price } = req.body;
  const updateData = { updated_at: new Date() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (images !== undefined) updateData.images = images;
  if (pages !== undefined) updateData.pages = pages;
  if (coverPage !== undefined) updateData.coverPage = coverPage;
  if (price !== undefined) updateData.price = parseFloat(price);

  const result = await db.collection('albums').updateOne(
    { _id: new ObjectId(req.params.id), photographer_id: new ObjectId(req.user.id) },
    { $set: updateData }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Album not found' });
  res.json({ success: true, message: 'Album updated' });
});

// ── Photographer: delete album ────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  await db.collection('payments').deleteMany({ album_id: new ObjectId(req.params.id) });
  const result = await db.collection('albums').deleteOne({
    _id: new ObjectId(req.params.id),
    photographer_id: new ObjectId(req.user.id),
  });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Album not found' });
  res.json({ success: true, message: 'Album deleted' });
});

// ── Photographer: send album invite link to customers ─────────────────────────
// Body: { customers: [ { name, email }, { name, email } ] }
router.post('/:id/invite', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ error: 'customers must be a non-empty array of { name, email }' });
  }

  const album = await db.collection('albums').findOne({
    _id: new ObjectId(req.params.id),
    photographer_id: new ObjectId(req.user.id),
  });
  if (!album) return res.status(404).json({ error: 'Album not found' });

  const photographer = await db.collection('users').findOne(
    { _id: new ObjectId(req.user.id) },
    { projection: { name: 1 } }
  );

  const emailErrors = [];
  const invited = [];

  for (const customer of customers) {
    if (!customer.name || !customer.email) continue;

    // Build register URL with album token embedded
    const registerUrl = `${process.env.FRONTEND_URL}/register?token=${album.shareToken}&email=${encodeURIComponent(customer.email)}&name=${encodeURIComponent(customer.name)}`;

    // Save to coupleAccess if not already there
    const alreadyAdded = (album.coupleAccess || []).find(a => a.email === customer.email);
    if (!alreadyAdded) {
      await db.collection('albums').updateOne(
        { _id: album._id },
        {
          $push: {
            coupleAccess: {
              name: customer.name,
              email: customer.email,
              invitedAt: new Date(),
              hasPaid: false,
            },
          },
        }
      );
    }

    try {
      await sendAlbumInviteEmail({
        toEmail: customer.email,
        customerName: customer.name,
        albumTitle: album.title,
        photographerName: photographer ? photographer.name : 'Your photographer',
        registerUrl,
      });
      invited.push(customer.email);
    } catch (err) {
      console.error(`Email failed for ${customer.email}:`, err.message);
      emailErrors.push(customer.email);
    }
  }

  res.json({
    success: true,
    message: 'Invites sent',
    invited,
    emailErrors: emailErrors.length ? emailErrors : undefined,
  });
});

// ── Photographer: revoke customer access ──────────────────────────────────────
router.delete('/:id/access/:email', authenticate, requireRole('photographer'), async (req, res) => {
  const db = getDb();
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  await db.collection('albums').updateOne(
    { _id: new ObjectId(req.params.id), photographer_id: new ObjectId(req.user.id) },
    { $pull: { coupleAccess: { email: req.params.email } } }
  );
  res.json({ success: true, message: `Access revoked for ${req.params.email}` });
});

// ── Customer: view album after payment ───────────────────────────────────────
// Requires auth + payment check
router.get('/view/:shareToken', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();

  const album = await db.collection('albums').findOne({ shareToken: req.params.shareToken });
  if (!album) return res.status(404).json({ error: 'Album not found' });

  // Check this customer has access
  const access = (album.coupleAccess || []).find(a => a.email === req.user.email);
  if (!access) return res.status(403).json({ error: 'You do not have access to this album' });

  // Check payment
  if (!access.hasPaid) {
    return res.status(402).json({
      error: 'Payment required',
      albumId: album._id,
      price: album.price,
      shareToken: album.shareToken,
    });
  }

  // Strip private fields
  const { coupleAccess, shareToken, viewToken, ...publicAlbum } = album;
  res.json({ success: true, album: publicAlbum, viewToken: album.viewToken });
});

// ── Public view-only link — no login required ─────────────────────────────────
// Customers share this with anyone — viewToken is different from shareToken
router.get('/public/:viewToken', async (req, res) => {
  const db = getDb();

  const album = await db.collection('albums').findOne({
    viewToken: req.params.viewToken,
    shareEnabled: true,
  });

  if (!album) return res.status(404).json({ error: 'Album not found or sharing disabled' });

  const { coupleAccess, shareToken, viewToken, price, photographer_id, ...publicAlbum } = album;
  res.json({ success: true, album: publicAlbum });
});

// ── Customer: toggle share link ───────────────────────────────────────────────
router.patch('/toggle-share/:shareToken', authenticate, requireRole('customer'), async (req, res) => {
  const db = getDb();

  const album = await db.collection('albums').findOne({
    shareToken: req.params.shareToken,
    'coupleAccess.email': req.user.email,
  });
  if (!album) return res.status(404).json({ error: 'Album not found or no access' });

  const access = album.coupleAccess.find(a => a.email === req.user.email);
  if (!access || !access.hasPaid) {
    return res.status(403).json({ error: 'You must complete payment before sharing' });
  }

  const newState = !album.shareEnabled;
  await db.collection('albums').updateOne(
    { shareToken: req.params.shareToken },
    { $set: { shareEnabled: newState, updated_at: new Date() } }
  );

  res.json({
    success: true,
    shareEnabled: newState,
    viewLink: newState ? `${process.env.FRONTEND_URL}/album/view/${album.viewToken}` : null,
  });
});

// ── Public: get album info before registering (from invite link) ──────────────
router.get('/preview/:shareToken', async (req, res) => {
  const db = getDb();
  const album = await db.collection('albums').findOne(
    { shareToken: req.params.shareToken },
    { projection: { title: 1, description: 1, price: 1, coverPage: 1 } }
  );
  if (!album) return res.status(404).json({ error: 'Invalid or expired link' });
  res.json({ success: true, album });
});

module.exports = router;