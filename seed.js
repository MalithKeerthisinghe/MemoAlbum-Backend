import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

const seedAdmin = async () => {
  try {
 
    await mongoose.connect(process.env.MONGODB_URI);
    const existingAdmin = await User.findOne({
      email: "nethmi@gmail.com",
    });

    if (existingAdmin) {
      console.log("⚠️ Admin already exists");
      process.exit(0);
    }
    const hashedPassword = await bcrypt.hash("nethmi123", 10);
    const admin = await User.create({
      name: "Super Admin",
      email: "nethmi@gmail.com",
      phone: "0777858521",
      address: "System",
      password: hashedPassword,
      roleId: "6a0473dd612d82d9fe664511",
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