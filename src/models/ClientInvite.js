import mongoose from 'mongoose';

const clientInviteSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientEmails: {
      type: [String],
      default: [],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'invoice_sent', 'paid', 'failed'],
      default: 'pending',
    },
    inviteStatus: {
      type: String,
      enum: ['draft', 'sent', 'opened', 'accepted'],
      default: 'sent',
    },
    emailStatus: {
      type: String,
      enum: ['queued', 'sent', 'partial', 'failed'],
      default: 'queued',
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

clientInviteSchema.index({ albumId: 1, photographerId: 1 });

export default mongoose.model('ClientInvite', clientInviteSchema);
