import express from 'express';
import axios from 'axios';
import PendingInvite from '../models/PendingInvite.js';
import ClientInvite from '../models/ClientInvite.js';
import Order from '../models/Order.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const GENIE_MERCHANT_ID = process.env.GENIE_MERCHANT_ID;
const GENIE_API_KEY     = process.env.GENIE_API_KEY;
const GENIE_IPG_URL     = process.env.GENIE_IPG_URL || 'https://ipg.geniebusiness.lk/checkout';
const APP_URL           = process.env.APP_URL;
const NEXT_PUBLIC_URL   = process.env.NEXT_PUBLIC_APP_URL;

// POST /api/payment/initiate
router.post('/initiate', protect, async (req, res) => {
  const { albumId, clientEmails } = req.body;
  const photographerId = req.user._id;

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

    const order = await Order.create({
      pendingInviteId: pending._id,
      albumId,
      photographerId,
      clientEmails,
      amount:        10000,
      currency:      'LKR',
      paymentStatus: 'pending',
      initiatedAt:   new Date(),
    });

    await PendingInvite.findByIdAndUpdate(pending._id, { orderId: order._id });

    const payload = {
      merchant_id: GENIE_MERCHANT_ID,
      api_key:     GENIE_API_KEY,
      amount:      '10000.00',
      currency:    'LKR',
      order_id:    pending._id.toString(),
      return_url:  `${APP_URL}/api/payment/callback`,
      cancel_url:  `${NEXT_PUBLIC_URL}/photographer/curator?payment=cancelled`,
      description: `Album invite for ${albumId}`,
    };

    const genieRes = await axios.post(GENIE_IPG_URL, payload);
    const paymentUrl = genieRes.data?.payment_url;

    if (!paymentUrl) {
      await PendingInvite.findByIdAndDelete(pending._id);
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'failed',
        failedAt:      new Date(),
        failureReason: 'Genie did not return a payment URL',
      });
      return res.status(502).json({
        success: false,
        message: 'Genie did not return a payment URL',
      });
    }

    res.json({ success: true, redirectUrl: paymentUrl });

  } catch (err) {
    console.error('Payment initiate error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
});

// GET /api/payment/callback
router.get('/callback', async (req, res) => {
  const { order_id, status, transaction_id } = req.query;

  if (status === 'SUCCESS' && order_id) {
    try {
      const pending = await PendingInvite.findById(order_id);

      if (!pending) {
        return res.redirect(`${NEXT_PUBLIC_URL}/photographer/curator?payment=failed`);
      }

      if (pending.status === 'paid') {
        return res.redirect(`${NEXT_PUBLIC_URL}/photographer/curator?payment=success`);
      }

      const invite = await ClientInvite.create({
        albumId:      pending.albumId,
        clientEmails: pending.clientEmails,
        inviteStatus: 'sent',
        emailStatus:  'queued',
        sentAt:       new Date(),
      });

      await Order.findOneAndUpdate(
        { pendingInviteId: pending._id },
        {
          paymentStatus:  'paid',
          inviteSent:     true,
          clientInviteId: invite._id,
          transactionId:  transaction_id || null,
          paidAt:         new Date(),
        }
      );

      await PendingInvite.findByIdAndUpdate(order_id, {
        status:        'paid',
        transactionId: transaction_id || null,
      });

      return res.redirect(`${NEXT_PUBLIC_URL}/photographer/curator?payment=success`);

    } catch (err) {
      console.error('Callback error:', err.message);
      return res.redirect(`${NEXT_PUBLIC_URL}/photographer/curator?payment=failed`);
    }
  }

  if (order_id) {
    const isCancelled = status === 'CANCELLED';
    await Promise.all([
      PendingInvite.findByIdAndUpdate(order_id, {
        status: isCancelled ? 'cancelled' : 'failed',
      }).catch(() => {}),
      Order.findOneAndUpdate(
        { pendingInviteId: order_id },
        {
          paymentStatus: isCancelled ? 'cancelled' : 'failed',
          failedAt:      new Date(),
          failureReason: `Genie callback status: ${status}`,
        }
      ).catch(() => {}),
    ]);
  }

  const param = status === 'CANCELLED' ? 'cancelled' : 'failed';
  res.redirect(`${NEXT_PUBLIC_URL}/photographer/curator?payment=${param}`);
});

export default router;