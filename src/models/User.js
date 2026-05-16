import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  phone: String,
  address: String,
  password: String,
  bio: String,
  profilePic: String,
  subscriptionPlan: String,
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
  status: {
    type: String,
    default: "active"
  }
}, {
  timestamps: true
});

export default mongoose.model("User", userSchema);