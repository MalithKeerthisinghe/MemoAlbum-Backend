import Album from '../models/Album.js';
import ClientInvite from '../models/ClientInvite.js';
import Curate from '../models/Curate.js';
import User from '../models/User.js';
import { sendAlbumInviteEmail } from '../utils/mailer.js';

const getPhotographerId = (req) => req.user?.id || req.user?._id;

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

    const { albumId, clientEmails } = req.body;
    const normalizedEmails = normalizeEmails(Array.isArray(clientEmails) ? clientEmails : []);

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

    const photographer = await User.findById(photographerId).select('name email');
    const photographerName = photographer?.name || 'MemoAlbum Photographer';
    const registerUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;

    let successCount = 0;
    let failureCount = 0;

    for (const email of normalizedEmails) {
      try {
        await sendAlbumInviteEmail({
          toEmail: email,
          customerName: getCustomerName(email),
          albumTitle: selectedAlbum.albumName,
          photographerName,
          registerUrl,
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
      emailSummary: { successCount, failureCount },
    });
  } catch (error) {
    console.error('Create Client Invite Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
