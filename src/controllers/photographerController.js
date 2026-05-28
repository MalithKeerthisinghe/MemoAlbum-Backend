import User from '../models/User.js';

class PhotographerController {
  static async getUsers(req, res) {
    try {
      // Get photographer ID from authenticated user
      const photographerId = req.user?._id || req.user?.id;
      
      if (!photographerId) {
        return res.status(401).json({
          success: false,
          message: 'Photographer not authenticated',
        });
      }

      // Get all users (for now, photographers can see all users in the system)
      // In a real app, you might filter by clients assigned to this photographer
      const users = await User.find()
        .populate('roleId', 'roleName')
        .sort({ createdAt: -1 });

      const normalizedUsers = users.map((user) => ({
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        role: user.roleId?.roleName || 'client',
        contact: user.phone || '',
        phone: user.phone || '',
        status: user.status === 'active' ? 'Active' : 'Offline',
        avatar: user.profilePic || '',
        bio: user.bio || '',
        partnerEmail: user.partnerEmail || '',
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
      console.error('Get Photographer Users Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error', 
        error: error.message 
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const photographerId = req.user?._id || req.user?.id;
      
      if (!photographerId) {
        return res.status(401).json({
          success: false,
          message: 'Photographer not authenticated',
        });
      }

      const { username, email, businessName, whatsappNo, contactNo, address, bio, profileImage } = req.body;

      // Build update object - only include fields that are provided
      const updateData = {};
      if (username) updateData.name = username;
      if (email) updateData.email = email;
      if (contactNo) updateData.phone = contactNo;
      if (address) updateData.address = address;
      if (bio) updateData.bio = bio;
      if (profileImage) updateData.profilePic = profileImage;

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(
        photographerId,
        updateData,
        { new: true, runValidators: false }
      ).populate('roleId', 'roleName');

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Return normalized user data
      const normalizedUser = {
        id: updatedUser._id,
        username: updatedUser.name || '',
        email: updatedUser.email || '',
        businessName: businessName || '',
        whatsappNo: whatsappNo || '',
        contactNo: updatedUser.phone || '',
        address: updatedUser.address || '',
        bio: updatedUser.bio || '',
        profileImage: updatedUser.profilePic || '',
        profilePic: updatedUser.profilePic || '',
        role: updatedUser.roleId?.roleName || 'photographer',
        status: updatedUser.status,
      };

      return res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        user: normalizedUser 
      });
    } catch (error) {
      console.error('Update Photographer Profile Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating profile', 
        error: error.message 
      });
    }
  }
}

export default PhotographerController;
