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

// General login for all users (photographer, couple, client, admin)
export const login = async (req, res) => {
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
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact support.",
      });
    }

    // 4. check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 5. get user role
    const roleName = await resolveUserRoleName(user);

    // 6. generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: roleName || 'client',
        roleId: user.roleId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 7. success response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleName || 'client',
        roleId: user.roleId,
        status: user.status,
      },
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Logout endpoint
export const logout = async (req, res) => {
  try {
    // Logout is handled on the client side by removing tokens
    // This endpoint just validates the token and returns success
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(userId).populate('roleId', 'roleName');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const roleName = user.roleId?.roleName?.toLowerCase?.() || req.user?.role || 'client';

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        profilePic: user.profilePic || '',
        role: roleName,
        status: user.status || 'active',
        settings: {
          profileVisibility: user.settings?.profileVisibility ?? true,
          twoFactorAuth: user.settings?.twoFactorAuth ?? false,
          emailNotifications: user.settings?.emailNotifications ?? true,
          pushNotifications: user.settings?.pushNotifications ?? false,
          shareActivity: user.settings?.shareActivity ?? true,
          newCollectionAlerts: user.settings?.newCollectionAlerts ?? true,
          editorialMonthly: user.settings?.editorialMonthly ?? true,
          partnerCollaborations: user.settings?.partnerCollaborations ?? false,
        },
      },
    });
  } catch (err) {
    console.error('Get Current User Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, email, phone, bio, profilePic, settings } = req.body || {};

    if (typeof name === 'string') user.name = name.trim();
    if (typeof email === 'string' && email.trim()) user.email = email.trim().toLowerCase();
    if (typeof phone === 'string') user.phone = phone.trim();
    if (typeof bio === 'string') user.bio = bio;
    if (typeof profilePic === 'string') user.profilePic = profilePic;

    if (settings && typeof settings === 'object') {
      user.settings = {
        ...(user.settings || {}),
        profileVisibility: typeof settings.profileVisibility === 'boolean' ? settings.profileVisibility : user.settings?.profileVisibility ?? true,
        twoFactorAuth: typeof settings.twoFactorAuth === 'boolean' ? settings.twoFactorAuth : user.settings?.twoFactorAuth ?? false,
        emailNotifications: typeof settings.emailNotifications === 'boolean' ? settings.emailNotifications : user.settings?.emailNotifications ?? true,
        pushNotifications: typeof settings.pushNotifications === 'boolean' ? settings.pushNotifications : user.settings?.pushNotifications ?? false,
        shareActivity: typeof settings.shareActivity === 'boolean' ? settings.shareActivity : user.settings?.shareActivity ?? true,
        newCollectionAlerts: typeof settings.newCollectionAlerts === 'boolean' ? settings.newCollectionAlerts : user.settings?.newCollectionAlerts ?? true,
        editorialMonthly: typeof settings.editorialMonthly === 'boolean' ? settings.editorialMonthly : user.settings?.editorialMonthly ?? true,
        partnerCollaborations: typeof settings.partnerCollaborations === 'boolean' ? settings.partnerCollaborations : user.settings?.partnerCollaborations ?? false,
      };
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        profilePic: user.profilePic || '',
        status: user.status || 'active',
        settings: {
          profileVisibility: user.settings?.profileVisibility ?? true,
          twoFactorAuth: user.settings?.twoFactorAuth ?? false,
          emailNotifications: user.settings?.emailNotifications ?? true,
          pushNotifications: user.settings?.pushNotifications ?? false,
          shareActivity: user.settings?.shareActivity ?? true,
          newCollectionAlerts: user.settings?.newCollectionAlerts ?? true,
          editorialMonthly: user.settings?.editorialMonthly ?? true,
          partnerCollaborations: user.settings?.partnerCollaborations ?? false,
        },
      },
    });
  } catch (err) {
    console.error('Update Current User Error:', err);

    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    return res.status(500).json({ success: false, message: 'Server error' });
  }
};