import express from 'express';
import axios from 'axios';
import PendingInvite from '../models/PendingInvite.js';
import ClientInvite from '../models/ClientInvite.js';
import PaymentDetail from '../models/PaymentDetail.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const GENIE_APP_ID    = process.env.GENIE_APP_ID;
const GENIE_APP_KEY   = process.env.GENIE_APP_KEY;
const GENIE_API_URL   = 'https://api.geniebiz.lk/public/v2/transactions';
const APP_URL         = process.env.APP_URL;
const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL;

// Generate unique payment reference
const generateReference = () => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `LF-${date}-${random}`;
};

// ─── POST /api/payment/initiate ───────────────────────────────────────────────
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
    // 1. Save PendingInvite
    const pending = await PendingInvite.create({
      albumId,
      clientEmails,
      amount: 10000,
      status: 'pending',
    });

    // 2. Create PaymentDetail record — this creates the paymentdetails collection
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

    // 3. Link paymentDetail back to pending
    await PendingInvite.findByIdAndUpdate(pending._id, {
      orderId: paymentDetail._id,
    });

    // 4. Call Genie API
    // Amount is in CENTS — 10000 LKR = 1000000 cents
    const payload = {
      amount:            1000000,
      currency:          'LKR',
      redirectUrl:       `${NEXT_PUBLIC_URL}/photographer/curator?payment=success&order_id=${pending._id}`,
      webhook:           `${APP_URL}/api/payment/webhook`,
      localId:           pending._id.toString(),
      customerReference: paymentDetail.paymentReference,
      paymentPortalExperience: {
        skipCustomerForm:       true,
        hideTermsAndConditions: false,
      },
    };

    const genieRes = await axios.post(GENIE_API_URL, payload, {
      headers: {
        'Authorization': GENIE_APP_KEY,
        'X-App-Id':      GENIE_APP_ID,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
    });

    const genieData  = genieRes.data;
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

    // 5. Save Genie transaction ID to both records
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

    // 6. Return redirect URL and reference to frontend
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

    // Always respond 200 immediately so Genie does not retry
    res.status(200).json({ received: true });

    if (!localId) return;

    const pending = await PendingInvite.findById(localId);
    if (!pending) return;

    if (state === 'CONFIRMED' && pending.status !== 'paid') {

      const invite = await ClientInvite.create({
        albumId:      pending.albumId,
        clientEmails: pending.clientEmails,
        inviteStatus: 'sent',
        emailStatus:  'queued',
        sentAt:       new Date(),
      });

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

      await PendingInvite.findByIdAndUpdate(localId, {
        status:             'paid',
        genieTransactionId: id,
      });

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
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
  }
});

// ─── GET /api/payment/verify/:orderId ─────────────────────────────────────────
router.get('/verify/:orderId', protect, async (req, res) => {
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
            'Authorization': GENIE_APP_KEY,
            'X-App-Id':      GENIE_APP_ID,
            'Accept':        'application/json',
          },
        }
      );

      const genieState = genieRes.data?.state;

      if (genieState === 'CONFIRMED' && pending.status !== 'paid') {

        const invite = await ClientInvite.create({
          albumId:      pending.albumId,
          clientEmails: pending.clientEmails,
          inviteStatus: 'sent',
          emailStatus:  'queued',
          sentAt:       new Date(),
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

        await PendingInvite.findByIdAndUpdate(req.params.orderId, {
          status: 'paid',
        });

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
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
});

// ─── GET /api/payment/details/stats ──────────────────────────────────────────
router.get('/details/stats', protect, async (req, res) => {
  try {
    const photographerId = req.user._id;

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
      stats: stats || {
        totalPayments: 0, paidPayments: 0,
        pendingPayments: 0, failedPayments: 0, totalRevenue: 0,
      },
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
      photographerId: req.user._id,
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