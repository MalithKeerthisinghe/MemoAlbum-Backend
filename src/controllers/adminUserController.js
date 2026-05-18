 import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Role from '../models/Role.js';

const LEGACY_ADMIN_ROLE_ID = '6a01ee94eeadb31b01cee41a';
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();

const getRequestRole = (req) => {
  const currentRole = req.user?.role?.toLowerCase?.() ?? req.user?.roleName?.toLowerCase?.();
  const isLegacyAdmin = req.user?.roleId?.toString?.() === LEGACY_ADMIN_ROLE_ID;
  const isDefaultAdminEmail = req.user?.email?.toLowerCase?.() === DEFAULT_ADMIN_EMAIL;

  return {
    currentRole,
    isLegacyAdmin,
    isDefaultAdminEmail,
    isAdmin: currentRole === 'admin' || isLegacyAdmin || isDefaultAdminEmail,
  };
};

class AdminUserController {
  static async listUsers(req, res) {
    try {
      const { isAdmin } = getRequestRole(req);

      if (!req.user || !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin users can view users',
        });
      }

      const users = await User.find()
        .populate('roleId', 'roleName')
        .sort({ createdAt: -1 });

      const normalizedUsers = users.map((user) => ({
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        role: user.roleId?.roleName || (user.roleId?.toString?.() === LEGACY_ADMIN_ROLE_ID ? 'admin' : 'client'),
        contact: user.phone || '',
        subscription: user.subscriptionPlan || '',
        status: user.status === 'active' ? 'Active' : 'Offline',
        avatar: user.profilePic || '',
        bio: user.bio || '',
        roleId: user.roleId?._id || user.roleId || null,
        profileImage: user.profilePic || '',
        phoneNumber: user.phone || '',
        isActive: user.status === 'active',
        instagram: user.socials?.instagram || '',
        facebook: user.socials?.facebook || '',
        tiktok: user.socials?.tiktok || '',
        x: user.socials?.x || '',
        youtube: user.socials?.youtube || '',
        linkedin: user.socials?.linkedin || '',
        website: user.socials?.website || '',
      }));

      return res.json({ success: true, users: normalizedUsers });
    } catch (error) {
      console.error('List Users Error:', error);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
 
  static async createOrUpdateUser(req, res) {
    try {
      const { isAdmin } = getRequestRole(req);

       if (!req.user || !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only Admin users can create or update users"
        });
      }
 
      const {
        fullName,
        email,
        password,
        phoneNumber,
        bio,
        role,
        subscriptionPlan,
        instagram,
        facebook,
        tiktok,
        x,
        youtube,
        linkedin,
        website,
        profileImage,
        isActive
      } = req.body;

       const roleDoc = await Role.findOne({ roleName: role?.toLowerCase() });
      if (!roleDoc) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }

      const normalizedEmail = email?.toLowerCase?.();
      let user = await User.findOne({ email: normalizedEmail });

      const socials = {
        instagram: instagram || '',
        facebook: facebook || '',
        tiktok: tiktok || '',
        x: x || '',
        youtube: youtube || '',
        linkedin: linkedin || '',
        website: website || '',
      };

      const status = isActive === false ? 'inactive' : 'active';

      if (user) {
        user.name = fullName || user.name;
        user.phone = phoneNumber || user.phone;
        user.bio = bio || user.bio;
        user.roleId = roleDoc._id;
        user.subscriptionPlan = subscriptionPlan || user.subscriptionPlan;
        user.status = status;
        user.profilePic = profileImage || user.profilePic;
        user.socials = {
          ...(user.socials || {}),
          ...socials,
        };

        await user.save();

        return res.json({
          success: true,
          message: "User updated successfully",
          user
        });
      } else {
         if (!password) {
          return res.status(400).json({ 
            success: false, 
            message: "Password is required for new users" 
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
          name: fullName,
          email: normalizedEmail,
          password: hashedPassword,
          phone: phoneNumber,
          bio,
          roleId: roleDoc._id,
          subscriptionPlan: subscriptionPlan || 'photographer-1-year',
          status,
          profilePic: profileImage,
          socials,
          createdBy: req.user?._id,    
          createdByEmail: req.user?.email || '',
        });

        await newUser.save();

        return res.status(201).json({
          success: true,
          message: "User created successfully",
          user: newUser
        });
      }
    } catch (error) {
      console.error('Admin User Error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({ 
          success: false, 
          message: "Email already exists" 
        });
      }

      res.status(500).json({ 
        success: false, 
        message: "Server error", 
        error: error.message 
      });
    }
  }
}

export default AdminUserController;