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