import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  partnerEmail: String,
  phone: String,
  address: String,
  password: String,
  bio: String,
  profilePic: String,
  socials: {
    instagram: String,
    facebook: String,
    tiktok: String,
    x: String,
    youtube: String,
    linkedin: String,
    website: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdByEmail: String,
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role"
  },
  invitationStatus: {
    type: String,
    enum: ['sent', 'accepted', 'active'],
    default: 'sent'
  },
  settings: {
    profileVisibility: { type: Boolean, default: true },
    twoFactorAuth: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: false },
    shareActivity: { type: Boolean, default: true },
    newCollectionAlerts: { type: Boolean, default: true },
    editorialMonthly: { type: Boolean, default: true },
    partnerCollaborations: { type: Boolean, default: false },
  },
  status: {
    type: String,
    default: "active"
  }
}, {
  timestamps: true
});

export default mongoose.model("User", userSchema);