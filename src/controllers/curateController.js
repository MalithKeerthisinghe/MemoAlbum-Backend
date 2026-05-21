import Curate from '../models/Curate.js';
import User from '../models/User.js';

const normalizeMediaItems = (mediaItems = []) =>
  mediaItems
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: item.id || `media-${index + 1}`,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      fileName: item.fileName || '',
      fileType: item.fileType || '',
      fileSize: Number(item.fileSize) || 0,
      dataUrl: item.dataUrl || '',
      mediaKind: item.mediaKind || (item.fileType?.startsWith('video') ? 'video' : 'image'),
    }))
    .sort((a, b) => a.order - b.order);

const getPhotographerId = (req) => req.user?.id || req.user?._id;

export const saveCurateDraft = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { albumName, weddingDate, accessControl, coverPhoto, coverPhotoName, mediaItems, progress } = req.body;

    if (!albumName || !weddingDate) {
      return res.status(400).json({
        success: false,
        message: 'Album name and wedding date are required',
      });
    }

    const photographer = await User.findById(photographerId).select('_id roleId email');
    if (!photographer) {
      return res.status(404).json({ success: false, message: 'Photographer not found' });
    }

    const normalizedMediaItems = normalizeMediaItems(Array.isArray(mediaItems) ? mediaItems : []);
    const nextPayload = {
      photographerId,
      pageSlug: 'photographer-admin/curate',
      albumName,
      weddingDate: new Date(weddingDate),
      accessControl: accessControl || 'public',
      coverPhoto: coverPhoto || '',
      coverPhotoName: coverPhotoName || '',
      mediaItems: normalizedMediaItems,
      progress: Number.isFinite(Number(progress)) ? Number(progress) : Math.min(100, normalizedMediaItems.length * 10),
      status: 'draft',
    };

    const savedDraft = await Curate.findOneAndUpdate(
      { photographerId, pageSlug: 'photographer-admin/curate' },
      { $set: nextPayload },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Curate draft saved successfully',
      curate: savedDraft,
    });
  } catch (error) {
    console.error('Save Curate Draft Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const getCurateDraft = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const curate = await Curate.findOne({ photographerId, pageSlug: 'photographer-admin/curate' });

    return res.json({
      success: true,
      curate,
    });
  } catch (error) {
    console.error('Get Curate Draft Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const listCurateDrafts = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const curates = await Curate.find({ photographerId }).sort({ updatedAt: -1 });

    return res.json({
      success: true,
      curates,
    });
  } catch (error) {
    console.error('List Curate Drafts Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const deleteCurateDraft = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const deleted = await Curate.findOneAndDelete({ photographerId, pageSlug: 'photographer-admin/curate' });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Curate draft not found' });
    }

    return res.json({
      success: true,
      message: 'Curate draft deleted successfully',
    });
  } catch (error) {
    console.error('Delete Curate Draft Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
