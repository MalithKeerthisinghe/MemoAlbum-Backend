import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    pendingInviteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingInvite',
      default: null,
    },
    clientInviteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientInvite',
      default: null,
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curate',
      required: true,
    },
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientEmails: {
      type: [String],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 10000,
    },
    currency: {
      type: String,
      default: 'LKR',
    },
    genieOrderId: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    inviteSent: {
      type: Boolean,
      default: false,
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

orderSchema.index({ photographerId: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ albumId: 1 });
orderSchema.index({ transactionId: 1 }, { sparse: true });

export default mongoose.model('Order', orderSchema);