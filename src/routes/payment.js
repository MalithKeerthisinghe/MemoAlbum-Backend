import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import PendingInvite from '../models/PendingInvite.js';
import ClientInvite from '../models/ClientInvite.js';
import PaymentDetail from '../models/PaymentDetail.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import CoupleProfile from '../models/CoupleProfile.js';
import Curate from '../models/Curate.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  sendUserInvitationEmail,
  sendPhotographerWelcomeEmail,
} from '../utils/mailer.js';

const router = express.Router();

const GENIE_API_URL = 'https://api.geniebiz.lk/public/v2/transactions';

const generateReference = () => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `LF-${date}-${random}`;
};

const generateRandomPassword = (length = 12) => {
  return crypto.randomBytes(Math.max(length, 16)).toString('base64url').slice(0, length);
};

const normalizeEmails = (emails = []) =>
  [...new Set(emails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];

const getCustomerName = (email) => {
  const prefix = String(email || '').split('@')[0] || 'Client';
  return prefix
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Client';
};

// ─── POST /api/payment/initiate ───────────────────────────────────────────────
router.post('/initiate', protect, async (req, res) => {
  const GENIE_SECRET_KEY = process.env.GENIE_SECRET_KEY;
  const GENIE_APP_ID     = process.env.GENIE_APP_ID;

  console.log('Genie credentials check:', {
    appIdExists:    !!GENIE_APP_ID,
    secretKeyExists: !!GENIE_SECRET_KEY,
  });

  const { albumId, clientEmails } = req.body;
  const photographerId = req.user._id || req.user.id;

  if (!albumId || !clientEmails?.length) {
    return res.status(400).json({
      success: false,
      message: 'albumId and clientEmails are required',
    });
  }

  try {
    const pending = await PendingInvite.create({
      albumId,
      clientEmails,
      amount: 10000,
      status: 'pending',
    });

    const paymentDetail = await PaymentDetail.create({
      pendingInviteId:  pending._id,
      albumId,
      photographerId,
      clientEmails,
      amount:           10000,
      currency:         'LKR',
      paymentStatus:    'pending',
      initiatedAt:      new Date(),
      paymentReference: generateReference(),
    });

    await PendingInvite.findByIdAndUpdate(pending._id, {
      orderId: paymentDetail._id,
    });

    const payload = {
      amount:      1000000,
      currency:    'LKR',
      localId:     pending._id.toString(),
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/photographer/curator?payment=success&order_id=${pending._id}`,
      webhook:     `${process.env.APP_URL}/api/payment/webhook`,
    };

    console.log('Sending to Genie:', payload);

    const genieRes = await axios.post(GENIE_API_URL, payload, {
      headers: {
        'Authorization': GENIE_SECRET_KEY,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
    });

    const genieData  = genieRes.data;
    console.log('Genie response:', genieData);

    const paymentUrl = genieData?.url || genieData?.shortUrl;

    if (!paymentUrl) {
      await PendingInvite.findByIdAndDelete(pending._id);
      await PaymentDetail.findByIdAndUpdate(paymentDetail._id, {
        paymentStatus: 'failed',
        failedAt:      new Date(),
        failureReason: 'Genie did not return a payment URL',
      });
      return res.status(502).json({
        success: false,
        message: 'Genie did not return a payment URL',
      });
    }

    await Promise.all([
      PendingInvite.findByIdAndUpdate(pending._id, {
        genieTransactionId: genieData.id,
      }),
      PaymentDetail.findByIdAndUpdate(paymentDetail._id, {
        genieTransactionId: genieData.id,
        genieState:         genieData.state,
        geniePaymentUrl:    paymentUrl,
      }),
    ]);

    res.json({
      success:          true,
      redirectUrl:      paymentUrl,
      paymentReference: paymentDetail.paymentReference,
    });

  } catch (err) {
    console.error('Payment initiate error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
});

// ─── POST /api/payment/webhook ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const { id, state, localId } = req.body;
    console.log('Webhook received:', req.body);

    res.status(200).json({ received: true });

    if (!localId) return;

    const pending = await PendingInvite.findById(localId);
    if (!pending) return;

    if (state === 'CONFIRMED' && pending.status !== 'paid') {

      // ── 1. Generate password for client users ─────────────────────
      const invitationPassword = generateRandomPassword(12);
      const hashedPassword     = await bcrypt.hash(invitationPassword, 10);
      const normalizedEmails   = normalizeEmails(pending.clientEmails);
      const primaryEmail       = normalizedEmails[0];
      const partnerEmail       = normalizedEmails[1];

      // ── 2. Get photographer info ──────────────────────────────────
      const paymentDetail = await PaymentDetail.findOne({ pendingInviteId: pending._id })
        .populate('photographerId', 'name email')
        .populate('albumId', 'albumName');

      const photographer     = paymentDetail?.photographerId;
      const photographerName = photographer?.name || 'Your Photographer';
      const albumName        = paymentDetail?.albumId?.albumName || 'Your Album';
      const paymentRef       = paymentDetail?.paymentReference || '';

      // ── 3. Get couple role ────────────────────────────────────────
      const coupleRole = await Role.findOne({ roleName: { $regex: /^couple$/i } }).select('_id');

      // ── 4. Create/update user accounts for both emails ────────────
      for (const currentEmail of normalizedEmails) {
        const otherEmail = currentEmail === primaryEmail ? partnerEmail : primaryEmail;

        const upsertPayload = {
          name:             getCustomerName(currentEmail),
          email:            currentEmail,
          password:         hashedPassword,
          partnerEmail:     otherEmail,
          createdBy:        photographer?._id,
          createdByEmail:   photographer?.email || '',
          roleId:           coupleRole?._id || undefined,
          invitationStatus: 'sent',
          status:           'active',
        };

        let user = await User.findOne({ email: currentEmail });
        if (user) {
          Object.assign(user, upsertPayload);
          await user.save();
        } else {
          user = await User.create(upsertPayload);
        }

        let coupleProfile = await CoupleProfile.findOne({ userId: user._id });
        if (coupleProfile) {
          coupleProfile.primaryEmail = currentEmail;
          coupleProfile.partnerEmail = otherEmail;
          coupleProfile.status       = 'active';
          await coupleProfile.save();
        } else {
          await CoupleProfile.create({
            userId:       user._id,
            primaryEmail: currentEmail,
            partnerEmail: otherEmail,
            status:       'active',
          });
        }
      }

      // ── 5. Create ClientInvite record ─────────────────────────────
      const invite = await ClientInvite.create({
        albumId:       pending.albumId,
        photographerId: photographer?._id,
        clientEmails:  normalizedEmails,
        inviteStatus:  'sent',
        emailStatus:   'queued',
        sentAt:        new Date(),
      });

      // ── 6. Update PaymentDetail ───────────────────────────────────
      await PaymentDetail.findOneAndUpdate(
        { pendingInviteId: pending._id },
        {
          paymentStatus:      'paid',
          inviteSent:         true,
          clientInviteId:     invite._id,
          genieTransactionId: id,
          genieState:         state,
          paidAt:             new Date(),
        }
      );

      // ── 7. Update PendingInvite ───────────────────────────────────
      await PendingInvite.findByIdAndUpdate(localId, {
        status:             'paid',
        genieTransactionId: id,
      });

      // ── 8. Send invitation emails to both clients ─────────────────
      let emailSuccessCount = 0;
      for (const email of normalizedEmails) {
        try {
          await sendUserInvitationEmail({
            toEmail:      email,
            name:         getCustomerName(email),
            roleName:     'couple',
            password:     invitationPassword,
            partnerEmail: email === primaryEmail ? partnerEmail : primaryEmail,
          });
          emailSuccessCount++;
          console.log(`✅ Invitation email sent to ${email}`);
        } catch (emailErr) {
          console.error(`❌ Failed to send invitation to ${email}:`, emailErr.message);
        }
      }

      // ── 9. Send payment success email to photographer ─────────────
      if (photographer?.email) {
        try {
          const { getTransporter } = await import('../utils/mailer.js');
          // Use nodemailer directly for custom payment success email
          const nodemailer = await import('nodemailer');
          const emailPass  = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

          const transporter = nodemailer.default.createTransport({
            host:       process.env.EMAIL_HOST || 'smtp.gmail.com',
            port:       parseInt(process.env.EMAIL_PORT || '587', 10),
            secure:     false,
            requireTLS: true,
            auth: {
              user: process.env.EMAIL_USER,
              pass: emailPass,
            },
          });

          await transporter.sendMail({
            from:    `"MemoAlbum" <${process.env.EMAIL_USER}>`,
            to:      photographer.email,
            subject: `Payment received — ${albumName}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#333;">
                <h2 style="color:#b10e6b;">Payment Received ✓</h2>
                <p>Hi ${photographerName},</p>
                <p>A client invitation payment has been successfully received for your album.</p>

                <div style="background:#FFF0F7;border:1px solid #f4c0d1;border-radius:8px;padding:20px;margin:20px 0;">
                  <p style="margin:6px 0;"><strong>Album:</strong> ${albumName}</p>
                  <p style="margin:6px 0;"><strong>Client Emails:</strong> ${normalizedEmails.join(', ')}</p>
                  <p style="margin:6px 0;"><strong>Amount:</strong> LKR 10,000.00</p>
                  <p style="margin:6px 0;"><strong>Payment Reference:</strong> <span style="color:#b10e6b;font-family:monospace;">${paymentRef}</span></p>
                  <p style="margin:6px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <p>The client invitation emails have been sent to both email addresses.</p>

                <a href="${process.env.NEXT_PUBLIC_APP_URL}/photographer/curator"
                   style="display:inline-block;margin:16px 0;padding:12px 28px;background:linear-gradient(135deg,#b10e6b,#d23284);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
                  View Invitations
                </a>

                <p style="color:#888;font-size:13px;margin-top:24px;">
                  This is an automated notification from MemoAlbum.
                </p>
              </div>
            `,
          });

          console.log(`✅ Payment success email sent to photographer ${photographer.email}`);
        } catch (emailErr) {
          console.error('❌ Failed to send payment success email to photographer:', emailErr.message);
        }
      }

      console.log(`✅ Webhook CONFIRMED processed — emails sent: ${emailSuccessCount}/${normalizedEmails.length}`);

    } else if (state === 'CANCELLED' || state === 'FAILED') {

      await PaymentDetail.findOneAndUpdate(
        { pendingInviteId: pending._id },
        {
          paymentStatus: state === 'CANCELLED' ? 'cancelled' : 'failed',
          genieState:    state,
          failedAt:      new Date(),
          failureReason: `Genie state: ${state}`,
        }
      );

      await PendingInvite.findByIdAndUpdate(localId, {
        status: state === 'CANCELLED' ? 'cancelled' : 'failed',
      });

      console.log(`Webhook ${state} processed for localId: ${localId}`);
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
  }
});

// ─── GET /api/payment/verify/:orderId ─────────────────────────────────────────
router.get('/verify/:orderId', protect, async (req, res) => {
  const GENIE_SECRET_KEY = process.env.GENIE_SECRET_KEY;

  try {
    const pending = await PendingInvite.findById(req.params.orderId);

    if (!pending) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (pending.status === 'paid') {
      return res.json({ success: true, status: 'paid' });
    }

    if (pending.genieTransactionId) {
      const genieRes = await axios.get(
        `https://api.geniebiz.lk/public/transactions/${pending.genieTransactionId}`,
        {
          headers: {
            'Authorization': GENIE_SECRET_KEY,
            'Accept':        'application/json',
          },
        }
      );

      const genieState = genieRes.data?.state;

      if (genieState === 'CONFIRMED' && pending.status !== 'paid') {
        // Webhook may not have fired — process here as fallback
        const invitationPassword = generateRandomPassword(12);
        const hashedPassword     = await bcrypt.hash(invitationPassword, 10);
        const normalizedEmails   = normalizeEmails(pending.clientEmails);
        const primaryEmail       = normalizedEmails[0];
        const partnerEmail       = normalizedEmails[1];

        const paymentDetail = await PaymentDetail.findOne({ pendingInviteId: pending._id })
          .populate('photographerId', 'name email')
          .populate('albumId', 'albumName');

        const photographer     = paymentDetail?.photographerId;
        const albumName        = paymentDetail?.albumId?.albumName || 'Your Album';
        const paymentRef       = paymentDetail?.paymentReference || '';
        const coupleRole       = await Role.findOne({ roleName: { $regex: /^couple$/i } }).select('_id');

        for (const currentEmail of normalizedEmails) {
          const otherEmail = currentEmail === primaryEmail ? partnerEmail : primaryEmail;
          const upsertPayload = {
            name:             getCustomerName(currentEmail),
            email:            currentEmail,
            password:         hashedPassword,
            partnerEmail:     otherEmail,
            createdBy:        photographer?._id,
            createdByEmail:   photographer?.email || '',
            roleId:           coupleRole?._id || undefined,
            invitationStatus: 'sent',
            status:           'active',
          };
          let user = await User.findOne({ email: currentEmail });
          if (user) { Object.assign(user, upsertPayload); await user.save(); }
          else { user = await User.create(upsertPayload); }

          let coupleProfile = await CoupleProfile.findOne({ userId: user._id });
          if (coupleProfile) {
            coupleProfile.primaryEmail = currentEmail;
            coupleProfile.partnerEmail = otherEmail;
            coupleProfile.status       = 'active';
            await coupleProfile.save();
          } else {
            await CoupleProfile.create({ userId: user._id, primaryEmail: currentEmail, partnerEmail: otherEmail, status: 'active' });
          }
        }

        const invite = await ClientInvite.create({
          albumId:        pending.albumId,
          photographerId: photographer?._id,
          clientEmails:   normalizedEmails,
          inviteStatus:   'sent',
          emailStatus:    'queued',
          sentAt:         new Date(),
        });

        await PaymentDetail.findOneAndUpdate(
          { pendingInviteId: pending._id },
          {
            paymentStatus:  'paid',
            inviteSent:     true,
            clientInviteId: invite._id,
            genieState:     genieState,
            paidAt:         new Date(),
          }
        );

        await PendingInvite.findByIdAndUpdate(req.params.orderId, { status: 'paid' });

        // Send emails
        for (const email of normalizedEmails) {
          try {
            await sendUserInvitationEmail({
              toEmail:      email,
              name:         getCustomerName(email),
              roleName:     'couple',
              password:     invitationPassword,
              partnerEmail: email === primaryEmail ? partnerEmail : primaryEmail,
            });
            console.log(`✅ Invitation email sent to ${email} (via verify)`);
          } catch (emailErr) {
            console.error(`❌ Failed invitation email to ${email}:`, emailErr.message);
          }
        }

        return res.json({ success: true, status: 'paid' });
      }

      return res.json({ success: true, status: pending.status, genieState });
    }

    res.json({ success: true, status: pending.status });

  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// ─── GET /api/payment/details ─────────────────────────────────────────────────
router.get('/details', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { photographerId: req.user._id };
    if (status) filter.paymentStatus = status;

    const [payments, total] = await Promise.all([
      PaymentDetail.find(filter)
        .populate('albumId',        'albumName coverPhoto weddingDate')
        .populate('clientInviteId', 'inviteStatus emailStatus sentAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      PaymentDetail.countDocuments(filter),
    ]);

    res.json({
      success: true,
      payments,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
});

// ─── GET /api/payment/details/stats ──────────────────────────────────────────
router.get('/details/stats', protect, async (req, res) => {
  try {
    const photographerId = req.user._id || req.user.id;

    const [stats] = await PaymentDetail.aggregate([
      { $match: { photographerId } },
      {
        $group: {
          _id:             null,
          totalPayments:   { $sum: 1 },
          paidPayments:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] },    1, 0] } },
          pendingPayments: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
          failedPayments:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] },  1, 0] } },
          totalRevenue:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      stats: stats || { totalPayments: 0, paidPayments: 0, pendingPayments: 0, failedPayments: 0, totalRevenue: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ─── GET /api/payment/details/:id ────────────────────────────────────────────
router.get('/details/:id', protect, async (req, res) => {
  try {
    const payment = await PaymentDetail.findOne({
      _id:            req.params.id,
      photographerId: req.user._id || req.user.id,
    })
      .populate('albumId',         'albumName coverPhoto weddingDate')
      .populate('clientInviteId',  'inviteStatus emailStatus sentAt clientEmails')
      .populate('pendingInviteId', 'status')
      .lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment detail not found' });
    }

    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment detail' });
  }
});

export default router;