import User from "../models/User.js";
import Role from "../models/Role.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const LEGACY_ADMIN_ROLE_ID = "6a01ee94eeadb31b01cee41a";
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();

const resolveUserRoleName = async (user) => {
  if (!user?.roleId) return null;

  const roleIdValue = user.roleId.toString();

  const roleDoc =
    (await Role.findById(user.roleId).select('roleName roleId').catch(() => null)) ||
    (await Role.findOne({ roleId: roleIdValue }).select('roleName roleId').catch(() => null));

  if (roleDoc?.roleName) {
    return roleDoc.roleName.toLowerCase();
  }

  if (roleIdValue === LEGACY_ADMIN_ROLE_ID) {
    return 'admin';
  }

  return null;
};

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

    if (user.invitationStatus === 'sent') {
      user.invitationStatus = 'accepted';
      await user.save();
    }

    const roleName = await resolveUserRoleName(user);
    const isLegacyAdmin = user.roleId?.toString?.() === LEGACY_ADMIN_ROLE_ID;
    const isDefaultAdminEmail = user.email?.toLowerCase?.() === DEFAULT_ADMIN_EMAIL;

    // 4. role check (admin only)
    if (roleName !== "admin" && !isLegacyAdmin && !isDefaultAdminEmail) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only",
      });
    }

    // 5. generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: roleName ?? (isLegacyAdmin || isDefaultAdminEmail ? "admin" : null),
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
        role: roleName ?? (isLegacyAdmin || isDefaultAdminEmail ? "admin" : null),
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