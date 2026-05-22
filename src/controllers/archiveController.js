import Album from '../models/Album.js';
import Archive from '../models/Archive.js';
import Curate from '../models/Curate.js';
import User from '../models/User.js';

const getPhotographerId = (req) => req.user?.id || req.user?._id;

export const listArchives = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const archives = await Archive.find({ photographerId }).sort({ createdAt: -1 });

    const albumIds = archives.map((archive) => archive.albumId?.toString?.()).filter(Boolean);
    const [albums, curates] = await Promise.all([
      Album.find({ _id: { $in: albumIds }, photographerId }).select('albumName coverPhoto status weddingDate'),
      Curate.find({ _id: { $in: albumIds }, photographerId }).select('albumName coverPhoto status weddingDate'),
    ]);

    const albumMap = new Map([
      ...albums.map((item) => [item._id.toString(), item]),
      ...curates.map((item) => [item._id.toString(), item]),
    ]);

    const hydratedArchives = archives.map((archive) => {
      const key = archive.albumId?.toString?.() || '';
      const albumDoc = albumMap.get(key);
      return {
        ...archive.toObject(),
        albumId: albumDoc || key,
      };
    });

    return res.json({ success: true, archives: hydratedArchives });
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

    const [album, curateAlbum] = await Promise.all([
      Album.findOne({ _id: albumId, photographerId }),
      Curate.findOne({ _id: albumId, photographerId }),
    ]);

    const selectedAlbum = album || curateAlbum;
    if (!selectedAlbum) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const photographer = await User.findById(photographerId).select('_id');
    if (!photographer) {
      return res.status(404).json({ success: false, message: 'Photographer not found' });
    }

    if (album) {
      album.status = 'archived';
      await album.save();
    }

    if (curateAlbum) {
      curateAlbum.status = 'saved';
      await curateAlbum.save();
    }

    const archive = await Archive.findOneAndUpdate(
      { albumId, photographerId },
      {
        $set: {
          albumId,
          photographerId,
          archiveFolderName,
          archivedAt: new Date(),
          albumTitle: selectedAlbum.albumName,
          albumCoverPhoto: selectedAlbum.coverPhoto || '',
          albumStatus: 'archived',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

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
