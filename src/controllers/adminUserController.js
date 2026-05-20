 import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { sendResendInvitationEmail, sendUserInvitationEmail } from '../utils/mailer.js';

const LEGACY_ADMIN_ROLE_ID = '6a01ee94eeadb31b01cee41a';
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();

const resolveRoleDoc = async ({ roleId, role }) => {
  const normalizedRoleName = role?.toLowerCase?.() || '';
  const roleIdValue = roleId?.toString?.() || '';

  if (roleIdValue) {
    const byId = await Role.findById(roleIdValue).catch(() => null);
    if (byId) {
      return byId;
    }

    const byLegacyRoleId = await Role.findOne({ roleId: roleIdValue }).catch(() => null);
    if (byLegacyRoleId) {
      return byLegacyRoleId;
    }
  }

  if (normalizedRoleName) {
    return Role.findOne({ roleName: normalizedRoleName }).catch(() => null);
  }

  return null;
};

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
        partnerEmail: user.partnerEmail || '',
        invitationStatus: user.invitationStatus || 'sent',
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
        partnerEmail,
        password,
        phoneNumber,
        bio,
        roleId,
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
        invitationStatus,
        isActive
      } = req.body;

      const roleDoc = await resolveRoleDoc({ roleId, role });
      if (!roleDoc) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }

      const normalizedRoleName = roleDoc.roleName?.toLowerCase?.() || role?.toLowerCase?.() || 'client';

      const normalizedEmail = email?.toLowerCase?.();
      const normalizedPartnerEmail = partnerEmail?.toLowerCase?.()?.trim?.();
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
      const isCoupleRole = roleDoc.roleName?.toLowerCase?.() === 'couple';
      const normalizedInvitationStatus = ['sent', 'accepted', 'active'].includes(invitationStatus) ? invitationStatus : 'sent';

      if (isCoupleRole && !normalizedPartnerEmail) {
        return res.status(400).json({
          success: false,
          message: 'Partner email is required for couple users',
        });
      }

      if (user) {
        user.name = fullName || user.name;
        user.phone = phoneNumber || user.phone;
        user.bio = bio || user.bio;
        user.roleId = roleDoc._id;
        user.subscriptionPlan = subscriptionPlan || user.subscriptionPlan;
        user.status = status;
        user.profilePic = profileImage || user.profilePic;
        user.partnerEmail = isCoupleRole ? normalizedPartnerEmail : '';
        user.invitationStatus = invitationStatus || user.invitationStatus || 'sent';
        if (password?.trim()) {
          user.password = await bcrypt.hash(password, 10);
        }
        user.socials = {
          ...(user.socials || {}),
          ...socials,
        };

        await user.save();

        const updatedUser = await User.findById(user._id).populate('roleId', 'roleName');

        if (password?.trim()) {
          const invitationRecipients = [normalizedEmail, normalizedPartnerEmail].filter(Boolean);
          await Promise.all(invitationRecipients.map((recipientEmail) => sendUserInvitationEmail({
            toEmail: recipientEmail,
            name: fullName || user.name,
            roleName: roleDoc.roleName,
            password,
            partnerEmail: normalizedPartnerEmail,
          }).catch((emailError) => {
            console.error('Invitation email failed:', emailError);
          })));
        }

        return res.json({
          success: true,
          message: "User updated successfully",
          user: updatedUser
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
          partnerEmail: isCoupleRole ? normalizedPartnerEmail : '',
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
          invitationStatus: normalizedInvitationStatus,
        });

        await newUser.save();

        const savedUser = await User.findById(newUser._id).populate('roleId', 'roleName');

        const invitationRecipients = [normalizedEmail, normalizedPartnerEmail].filter(Boolean);
        await Promise.all(invitationRecipients.map((recipientEmail) => sendUserInvitationEmail({
          toEmail: recipientEmail,
          name: fullName,
          roleName: roleDoc.roleName,
          password,
          partnerEmail: normalizedPartnerEmail,
        }).catch((emailError) => {
          console.error('Invitation email failed:', emailError);
        })));

        return res.status(201).json({
          success: true,
          message: "User created successfully",
          user: savedUser
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

  static async deleteUser(req, res) {
    try {
      const { isAdmin } = getRequestRole(req);

      if (!req.user || !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin users can delete users',
        });
      }

      const deletedUser = await User.findByIdAndDelete(req.params.id);

      if (!deletedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.json({
        success: true,
        message: 'User deleted successfully',
        userId: deletedUser._id,
      });
    } catch (error) {
      console.error('Delete User Error:', error);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  static async resendInvitation(req, res) {
    try {
      const { isAdmin } = getRequestRole(req);

      if (!req.user || !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin users can resend invitations',
        });
      }

      const user = await User.findById(req.params.id).populate('roleId', 'roleName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const recipients = [user.email, user.partnerEmail].filter(Boolean);
      await Promise.all(recipients.map(async (recipientEmail) => {
        try {
          await sendResendInvitationEmail({
            toEmail: recipientEmail,
            name: user.name || '',
            roleName: user.roleId?.roleName || 'user',
            partnerEmail: user.partnerEmail || '',
          });
        } catch (emailError) {
          console.error('Resend invitation email failed:', emailError);
        }
      }));

      user.invitationStatus = 'sent';
      await user.save();

      return res.json({
        success: true,
        message: 'Invitation resent successfully',
        user: await User.findById(user._id).populate('roleId', 'roleName'),
      });
    } catch (error) {
      console.error('Resend Invitation Error:', error);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  static async getUserProfile(req, res) {
    try {
      const userId = req.params.id || req.user?.id;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }

      const user = await User.findById(userId).populate('roleId', 'roleName name');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          bio: user.bio,
          profilePic: user.profilePic,
          role: user.roleId?.roleName || 'client',
          status: user.status,
          socials: user.socials || {},
        },
      });
    } catch (error) {
      console.error('Get Profile Error:', error);
      return res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
    }
  }

  static async updateUserProfile(req, res) {
    try {
      const userId = req.params.id || req.user?.id;
      const { name, phone, bio, profilePic } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update allowed fields
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (bio) user.bio = bio;
      if (profilePic) user.profilePic = profilePic;

      await user.save();

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          bio: user.bio,
          profilePic: user.profilePic,
        },
      });
    } catch (error) {
      console.error('Update Profile Error:', error);
      return res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
    }
  }
}

export default AdminUserController;