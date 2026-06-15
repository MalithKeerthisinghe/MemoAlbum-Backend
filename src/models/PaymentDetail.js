import mongoose from "mongoose";

const paymentDetailSchema = new mongoose.Schema(
  {
    pendingInviteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PendingInvite",
      default: null,
    },
    clientInviteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientInvite",
      default: null,
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Curate",
      required: true,
    },
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      default: "LKR",
    },
    genieTransactionId: {
      type: String,
      default: null,
    },
    genieState: {
      type: String,
      default: null,
    },
    geniePaymentUrl: {
      type: String,
      default: null,
    },
    paymentReference: {
      type: String,
      unique: true,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
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
  },
  { timestamps: true },
);

paymentDetailSchema.index({ photographerId: 1, createdAt: -1 });
paymentDetailSchema.index({ paymentStatus: 1 });
paymentDetailSchema.index({ albumId: 1 });
paymentDetailSchema.index({ genieTransactionId: 1 }, { sparse: true });

export default mongoose.model("PaymentDetail", paymentDetailSchema);
