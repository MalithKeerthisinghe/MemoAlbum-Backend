// Guest routes implementation (add at the end of the file)
export const getGuestGalleryFolder = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    let profile = await CoupleProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const folder = profile.galleryFolders.find(f => /guest|interactive/i.test(f.name) || /guest|interactive/i.test(f.category));
    return res.status(200).json({ success: true, data: folder });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addGuestGalleryMedia = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    // Mock req.user for the existing addGalleryMedia logic to reuse it
    req.user = { _id: userId };
    
    // We can just call addGalleryMedia
    // But wait, addGalleryMedia expects req.user._id, which we just set.
    return await addGalleryMedia(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
