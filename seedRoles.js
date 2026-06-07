import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Role from "./src/models/Role.js";

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const roles = [
      { roleId: "role_admin", roleName: "admin" },
      { roleId: "role_photographer", roleName: "photographer" },
      { roleId: "role_couple", roleName: "couple" },
      { roleId: "role_client", roleName: "client" },
    ];

    for (const role of roles) {
      const existing = await Role.findOne({ roleName: role.roleName });
      if (existing) {
        console.log(`⚠️ Role already exists: ${role.roleName}`);
      } else {
        await Role.create(role);
        console.log(`✅ Role created: ${role.roleName}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedRoles();