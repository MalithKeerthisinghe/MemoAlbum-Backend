import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. check empty fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. role check (super admin only)
    if (user.roleId.toString() !== "6a01ee94eeadb31b01cee41a") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin only",
      });
    }

    // 5. generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        roleId: user.roleId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 6. success response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
      },
    });

  } catch (err) {
    console.log("Login Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};