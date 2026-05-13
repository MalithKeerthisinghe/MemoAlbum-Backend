import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

await mongoose.connect(process.env.MONGODB_URI);const hashed = await bcrypt.hash("password123", 10);await User.create({
  name: "NETHMI TK",
  email: "nethmitk33@gmail.com",
  phone: "0777858521",
  address: "Walapala Road, Imaduwa",
  password: hashed,
  roleId: "6a01ee94eeadb31b01cee41a",
  status: "active"
});

console.log("DONE");
process.exit();