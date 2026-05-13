import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
  roleId: {
    type: String,
    unique: true,
    required: true
  },
  roleName: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model("Role", roleSchema);