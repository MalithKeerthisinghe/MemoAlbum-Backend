const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Regular Login (Photographer + Customer only) ─────────────────────────────
router.post('/login', async (req, res) => {
  const db = getDb();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await db.collection('users').findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Reject Superadmin from this endpoint
  if (user.role === 'superadmin') {
    return res.status(403).json({ 
      error: 'Please use the admin login portal' 
    });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({ error: 'Your account has been disabled. Contact admin.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date() } }
  );

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    },
  });
});

// ── Super Admin Login ───────────────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  const db = getDb();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await db.collection('users').findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (user.role !== 'superadmin') {
    return res.status(403).json({ 
      error: 'Access denied. This login is for administrators only.' 
    });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({ error: 'Account has been disabled' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date() } }
  );

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }     // Shorter expiry for admin
  );

  res.json({
    message: 'Admin login successful',
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    },
  });
});

// ── Change Password ─────────────────────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const db = getDb();
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  }

  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(newPassword, 10);

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set: { password: hashed, updatedAt: new Date() } }
  );

  res.json({ message: 'Password changed successfully' });
});

// ── Get Current User ────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const db = getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(req.user.id) },
    { projection: { password: 0 } }
  );

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user });
});

module.exports = router;