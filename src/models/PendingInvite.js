import mongoose from 'mongoose';

const pendingInviteSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curate',
      required: true,
    },
    clientEmails: {
      type: [String],
      required: true,
    },
    amount: {
      type: Number,
      default: 10000,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
    },
    transactionId: {
      type: String,
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('PendingInvite', pendingInviteSchema);