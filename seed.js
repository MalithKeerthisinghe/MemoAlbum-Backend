import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

const seedAdmin = async () => {
  try {
 
    await mongoose.connect(process.env.MONGODB_URI);
    const existingAdmin = await User.findOne({
      email: "mkavee@gmail.com",
    });

    if (existingAdmin) {
      console.log("⚠️ Admin already exists");
      process.exit(0);
    }
    const hashedPassword = await bcrypt.hash("mkavee123", 10);
    const admin = await User.create({
      name: "Super Admin",
      email: "mkavee@gmail.com",
      phone: "0779456771",
      address: "System",
      password: hashedPassword,
      roleId: "6a25ba8643f54475dc89e4f4",
      status: "active",
    });

     console.log(admin);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedAdmin();