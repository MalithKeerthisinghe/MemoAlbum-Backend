const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');

const router = express.Router();

// POST /api/customers/register
// Customer registers via invite link
// They arrive with ?token=shareToken&email=x&name=y in the URL
router.post('/register', async (req, res) => {
  const db = getDb();
  const { name, email, password, shareToken } = req.body;

  if (!name || !email || !password || !shareToken) {
    return res.status(400).json({ error: 'name, email, password and shareToken are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  // Verify the shareToken belongs to a real album
  const album = await db.collection('albums').findOne({ shareToken });
  if (!album) return res.status(400).json({ error: 'Invalid invite link' });

  // Check if the email was actually invited
  const invited = (album.coupleAccess || []).find(a => a.email === email);
  if (!invited) {
    return res.status(403).json({ error: 'This email was not invited to this album' });
  }

  // Check if user already exists
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return res.status(400).json({ error: 'Email already registered. Please log in.' });
  }

  const hashed = await bcrypt.hash(password, 10);

  await db.collection('users').insertOne({
    name,
    email,
    password: hashed,
    role: 'customer',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please log in and complete payment to view your album.',
    albumPrice: album.price,
    shareToken,
  });
});

module.exports = router;