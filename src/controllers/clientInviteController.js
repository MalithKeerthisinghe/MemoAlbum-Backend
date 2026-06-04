import crypto from 'crypto';
import Album from '../models/Album.js';
import ClientInvite from '../models/ClientInvite.js';
import CoupleProfile from '../models/CoupleProfile.js';
import Curate from '../models/Curate.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { sendUserInvitationEmail } from '../utils/mailer.js';

const getPhotographerId = (req) => req.user?.id || req.user?._id;

const generateRandomPassword = (length = 12) => {
  return crypto.randomBytes(Math.max(length, 16)).toString('base64url').slice(0, length);
};

const normalizeEmails = (emails = []) =>
  [...new Set(emails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];

const getCustomerName = (email) => {
  const prefix = String(email || '').split('@')[0] || 'Client';
  return prefix
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Client';
};

export const listClientInvites = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const invites = await ClientInvite.find({ photographerId }).sort({ createdAt: -1 });

    const albumIds = invites
      .map((invite) => invite.albumId?.toString?.())
      .filter(Boolean);

    const [albums, curates] = await Promise.all([
      Album.find({ _id: { $in: albumIds }, photographerId }).select('albumName weddingDate accessControl status coverPhoto'),
      Curate.find({ _id: { $in: albumIds }, photographerId }).select('albumName weddingDate accessControl status coverPhoto'),
    ]);

    const albumMap = new Map([
      ...albums.map((item) => [item._id.toString(), item]),
      ...curates.map((item) => [item._id.toString(), item]),
    ]);

    const hydratedInvites = invites.map((invite) => {
      const key = invite.albumId?.toString?.() || '';
      const albumDoc = albumMap.get(key);
      return {
        ...invite.toObject(),
        albumId: albumDoc || key,
      };
    });

    return res.json({ success: true, invites: hydratedInvites });
  } catch (error) {
    console.error('List Client Invites Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const createClientInvite = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { albumId, clientEmails, password: requestedPassword } = req.body;
    const normalizedEmails = normalizeEmails(Array.isArray(clientEmails) ? clientEmails : []);
    const invitationPassword = String(requestedPassword || '').trim() || generateRandomPassword(12);

    if (!albumId) {
      return res.status(400).json({ success: false, message: 'Album is required' });
    }

    if (normalizedEmails.length < 2) {
      return res.status(400).json({ success: false, message: 'Two client emails are required' });
    }

    const [album, curateAlbum] = await Promise.all([
      Album.findOne({ _id: albumId, photographerId }),
      Curate.findOne({ _id: albumId, photographerId }),
    ]);

    const selectedAlbum = album || curateAlbum;
    if (!selectedAlbum) {
      return res.status(404).json({ success: false, message: 'Album not found for this photographer' });
    }

    const coupleRole = await Role.findOne({ roleName: { $regex: /^couple$/i } }).select('_id roleName');
    const hashedPassword = await bcrypt.hash(invitationPassword, 10);
    const photographer = await User.findById(photographerId).select('name email');
    const photographerName = photographer?.name || 'MemoAlbum Photographer';
    
    const primaryEmail = normalizedEmails[0];
    const partnerEmail = normalizedEmails[1];

    // Create or update TWO separate user records
    const createdUsers = [];

    for (const currentEmail of normalizedEmails) {
      const otherEmail = currentEmail === primaryEmail ? partnerEmail : primaryEmail;
      
      const upsertPayload = {
        name: getCustomerName(currentEmail),
        email: currentEmail,
        password: hashedPassword,
        partnerEmail: otherEmail,
        createdBy: photographerId,
        createdByEmail: photographer?.email || '',
        roleId: coupleRole?._id || undefined,
        invitationStatus: 'sent',
        status: 'active',
      };

      let user = await User.findOne({ email: currentEmail });
      if (user) {
        Object.assign(user, upsertPayload);
        await user.save();
      } else {
        user = await User.create(upsertPayload);
      }
      createdUsers.push(user);

      // Create separate couple profile for each user
      let coupleProfile = await CoupleProfile.findOne({ userId: user._id });
      if (coupleProfile) {
        coupleProfile.primaryEmail = currentEmail;
        coupleProfile.partnerEmail = otherEmail;
        coupleProfile.status = 'active';
        await coupleProfile.save();
      } else {
        await CoupleProfile.create({
          userId: user._id,
          primaryEmail: currentEmail,
          partnerEmail: otherEmail,
          status: 'active',
        });
      }
    }


    // Send emails to both primary and partner emails
    let successCount = 0;
    let failureCount = 0;

    for (const email of normalizedEmails) {
      try {
        await sendUserInvitationEmail({
          toEmail: email,
          name: getCustomerName(email),
          roleName: 'couple',
          password: invitationPassword,
          partnerEmail: email === primaryEmail ? partnerEmail : primaryEmail,
        });
        successCount += 1;
      } catch (emailError) {
        failureCount += 1;
        console.error('Failed sending invite email:', emailError.message);
      }
    }


    const inviteDoc = await ClientInvite.create({
      albumId,
      photographerId,
      clientEmails: normalizedEmails,
      paymentStatus: 'pending',
      inviteStatus: successCount > 0 ? 'sent' : 'draft',
      emailStatus: failureCount === 0 ? 'sent' : successCount > 0 ? 'partial' : 'failed',
      sentAt: successCount > 0 ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      message: 'Client invitation saved and emails sent',
      invite: inviteDoc,
      generatedPassword: invitationPassword,
      users: createdUsers.map((userDoc) => ({
        id: userDoc._id,
        email: userDoc.email,
        partnerEmail: userDoc.partnerEmail,
        roleId: userDoc.roleId,
      })),
      emailSummary: { successCount, failureCount },
    });
  } catch (error) {
    console.error('Create Client Invite Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const listAssignedInviteAlbums = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(userId).select('email partnerEmail');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const emails = normalizeEmails([user.email, user.partnerEmail, req.user?.email]);
    if (emails.length === 0) {
      return res.json({ success: true, albums: [] });
    }

    const invites = await ClientInvite.find({ clientEmails: { $in: emails } }).sort({ createdAt: -1 });

    const albumIds = [...new Set(invites.map((invite) => invite.albumId?.toString?.()).filter(Boolean))];
    if (albumIds.length === 0) {
      return res.json({ success: true, albums: [] });
    }

    const [albums, curates] = await Promise.all([
      Album.find({ _id: { $in: albumIds } }).select('albumName weddingDate coverPhoto mediaCount createdAt photographerId description status'),
      Curate.find({ _id: { $in: albumIds } }).select('albumName weddingDate coverPhoto coverPhotoName mediaItems createdAt photographerId status'),
    ]);

    const albumMap = new Map();

    albums.forEach((item) => {
      albumMap.set(item._id.toString(), {
        id: item._id,
        kind: 'album',
        name: item.albumName || 'Album',
        coverImage: item.coverPhoto || '',
        photoCount: Number(item.mediaCount?.images || 0),
        date: item.weddingDate || item.createdAt,
        description: item.description || '',
        mediaItems: [],
      });
    });

    curates.forEach((item) => {
      albumMap.set(item._id.toString(), {
        id: item._id,
        kind: 'curate',
        name: item.albumName || 'Album',
        coverImage: item.coverPhoto || '',
        photoCount: Array.isArray(item.mediaItems) ? item.mediaItems.length : 0,
        date: item.weddingDate || item.createdAt,
        description: '',
        coverPhotoName: item.coverPhotoName || '',
        mediaItems: Array.isArray(item.mediaItems)
          ? item.mediaItems.map((mediaItem) => ({
              id: mediaItem.id,
              order: mediaItem.order,
              fileName: mediaItem.fileName,
              fileType: mediaItem.fileType,
              dataUrl: mediaItem.dataUrl,
              mediaKind: mediaItem.mediaKind,
            }))
          : [],
      });
    });

    const orderedAlbums = [];
    const seen = new Set();

    invites.forEach((invite) => {
      const key = invite.albumId?.toString?.();
      if (!key || seen.has(key)) return;
      const record = albumMap.get(key);
      if (!record) return;
      seen.add(key);
      orderedAlbums.push(record);
    });

    return res.json({ success: true, albums: orderedAlbums });
  } catch (error) {
    console.error('List Assigned Invite Albums Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const uploadAssignedAlbumMedia = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authorized' });

    const { albumId } = req.params;
    if (!albumId) return res.status(400).json({ success: false, message: 'Album id required' });

    const user = await User.findById(userId).select('email partnerEmail');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const emails = normalizeEmails([user.email, user.partnerEmail, req.user?.email]);
    if (emails.length === 0) return res.status(403).json({ success: false, message: 'Not allowed' });

    const invite = await ClientInvite.findOne({ albumId, clientEmails: { $in: emails } });
    if (!invite) return res.status(403).json({ success: false, message: 'No invite for this album' });

    // Accept either single item fields or an array `items` in body
    const itemsPayload = Array.isArray(req.body.items) ? req.body.items : [req.body];

    const added = [];

    // Prefer Curate documents for storing mediaItems
    const curate = await Curate.findById(albumId);
    if (!curate) {
      return res.status(400).json({ success: false, message: 'Album does not support media uploads' });
    }

    for (const it of itemsPayload) {
      const id = it.id || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const order = (curate.mediaItems?.length || 0) + added.length + 1;
      const fileType = it.fileType || it.type || '';
      const mediaKind = it.mediaKind || (fileType?.startsWith?.('video') ? 'video' : 'image');
      const next = {
        id,
        order,
        fileName: it.fileName || it.file_name || '',
        fileType,
        fileSize: Number(it.fileSize) || 0,
        dataUrl: it.url || it.dataUrl || '',
        mediaKind,
      };

      curate.mediaItems = curate.mediaItems || [];
      curate.mediaItems.push(next);
      added.push(next);
    }

    await curate.save();

    return res.json({ success: true, message: 'Media uploaded', curate, added });
  } catch (error) {
    console.error('Upload Assigned Album Media Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
