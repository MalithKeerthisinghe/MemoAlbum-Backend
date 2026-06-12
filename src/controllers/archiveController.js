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

export const deleteArchive = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { id } = req.params;
    const archive = await Archive.findOne({ _id: id, photographerId });

    if (!archive) {
      return res.status(404).json({ success: false, message: 'Archive not found' });
    }

    const albumId = archive.albumId?.toString?.();
    if (albumId) {
      await Promise.all([
        Album.updateOne({ _id: albumId, photographerId }, { $set: { status: 'saved' } }),
        Curate.updateOne({ _id: albumId, photographerId }, { $set: { status: 'saved' } }),
      ]);
    }

    await Archive.deleteOne({ _id: id, photographerId });

    return res.json({
      success: true,
      message: 'Archive deleted successfully',
    });
  } catch (error) {
    console.error('Delete Archive Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const renameArchiveFolder = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { folderName } = req.params;
    const { archiveFolderName } = req.body;

    if (!archiveFolderName || !String(archiveFolderName).trim()) {
      return res.status(400).json({ success: false, message: 'Archive folder name is required' });
    }

    const nextFolderName = String(archiveFolderName).trim();
    const result = await Archive.updateMany(
      { photographerId, archiveFolderName: folderName },
      { $set: { archiveFolderName: nextFolderName } }
    );

    return res.json({
      success: true,
      message: 'Archive folder renamed successfully',
      modifiedCount: result.modifiedCount || 0,
      archiveFolderName: nextFolderName,
    });
  } catch (error) {
    console.error('Rename Archive Folder Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const deleteArchiveFolder = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { folderName } = req.params;
    const folderArchives = await Archive.find({ photographerId, archiveFolderName: folderName });
    if (folderArchives.length === 0) {
      return res.status(404).json({ success: false, message: 'Archive folder not found' });
    }

    const albumIds = folderArchives.map((archive) => archive.albumId?.toString?.()).filter(Boolean);
    if (albumIds.length > 0) {
      await Promise.all([
        Album.updateMany({ _id: { $in: albumIds }, photographerId }, { $set: { status: 'saved' } }),
        Curate.updateMany({ _id: { $in: albumIds }, photographerId }, { $set: { status: 'saved' } }),
      ]);
    }

    const deleteResult = await Archive.deleteMany({ photographerId, archiveFolderName: folderName });

    return res.json({
      success: true,
      message: 'Archive folder deleted successfully',
      deletedCount: deleteResult.deletedCount || 0,
    });
  } catch (error) {
    console.error('Delete Archive Folder Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const changeArchiveFolderCover = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const { folderName } = req.params;
    const { coverPhoto } = req.body;

    if (!coverPhoto) {
      return res.status(400).json({ success: false, message: 'Cover photo data is required' });
    }

    const result = await Archive.updateMany(
      { photographerId, archiveFolderName: folderName },
      { $set: { albumCoverPhoto: coverPhoto } }
    );

    return res.json({
      success: true,
      message: 'Archive folder cover updated successfully',
      modifiedCount: result.modifiedCount || 0,
      coverPhoto,
    });
  } catch (error) {
    console.error('Change Archive Folder Cover Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
