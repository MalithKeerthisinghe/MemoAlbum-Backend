import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '../db/mongo.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Protect these routes to authenticated users
router.use(authenticate);

// POST /api/admin/users - create a generic user (photographer/client/admin)
router.post('/users', async (req, res) => {
  try {
    const db = getDb();
    const {
      fullName, email, phoneNumber, bio, role, subscriptionPlan, instagram, facebook, tiktok, x, youtube, linkedin, website, profileImage, password,
    } = req.body;

    if (!fullName || !email) return res.status(400).json({ error: 'fullName and email are required' });

    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const plainPassword = password || crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(plainPassword, 10);

    // try to resolve role to one of known strings
    const roleName = (role || 'photographer').toString().toLowerCase();

    const doc = {
      name: fullName,
      email,
      phone: phoneNumber || '',
      address: '',
      password: hashed,
      role: roleName,
      roleId: null,
      status: 'active',
      bio: bio || '',
      subscriptionPlan: subscriptionPlan || null,
      socials: {
        instagram: instagram || '',
        facebook: facebook || '',
        tiktok: tiktok || '',
        x: x || '',
        youtube: youtube || '',
        linkedin: linkedin || '',
        website: website || '',
      },
      profilePic: profileImage || '',
      createdBy: req.user?.id || null,
      createdByEmail: req.user?.email || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('users').insertOne(doc);

    // return the created user without password
    const created = await db.collection('users').findOne({ _id: result.insertedId }, { projection: { password: 0 } });

    return res.status(201).json({ success: true, user: created, password: plainPassword });
  } catch (err) {
    console.error('adminApi POST /users error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
