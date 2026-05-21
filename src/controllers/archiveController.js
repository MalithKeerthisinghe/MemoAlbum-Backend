import Album from '../models/Album.js';
import Archive from '../models/Archive.js';
import User from '../models/User.js';

const getPhotographerId = (req) => req.user?.id || req.user?._id;

export const listArchives = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const archives = await Archive.find({ photographerId })
      .populate('albumId', 'albumName coverPhoto status weddingDate')
      .sort({ createdAt: -1 });

    return res.json({ success: true, archives });
  } catch (error) {
    console.error('List Archives Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const createArchive = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { albumId, archiveFolderName } = req.body;
    if (!albumId || !archiveFolderName) {
      return res.status(400).json({ success: false, message: 'Album and archive folder name are required' });
    }

    const album = await Album.findOne({ _id: albumId, photographerId });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const photographer = await User.findById(photographerId).select('_id');
    if (!photographer) {
      return res.status(404).json({ success: false, message: 'Photographer not found' });
    }

    album.status = 'archived';
    await album.save();

    const archive = await Archive.findOneAndUpdate(
      { albumId, photographerId },
      {
        $set: {
          albumId,
          photographerId,
          archiveFolderName,
          archivedAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('albumId', 'albumName coverPhoto status weddingDate');

    return res.status(201).json({
      success: true,
      message: 'Album archived successfully',
      archive,
    });
  } catch (error) {
    console.error('Create Archive Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
