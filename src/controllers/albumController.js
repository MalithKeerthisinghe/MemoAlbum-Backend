import Album from '../models/Album.js';
import User from '../models/User.js';

export const createAlbum = async (req, res) => {
  try {
    const { albumName, weddingDate, accessControl, coverPhoto, description, albumTypes } = req.body;
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    if (!albumName || !weddingDate) {
      return res.status(400).json({
        success: false,
        message: 'Album name and wedding date are required',
      });
    }

    // Verify photographer exists
    const photographer = await User.findById(photographerId);
    if (!photographer) {
      return res.status(404).json({
        success: false,
        message: 'Photographer not found',
      });
    }

    const newAlbum = new Album({
      photographerId,
      albumName,
      weddingDate: new Date(weddingDate),
      accessControl: accessControl || 'private',
      coverPhoto: coverPhoto || '',
      description: description || '',
      albumTypes: albumTypes || ['images'],
      status: 'draft',
      publishProgress: 0,
    });

    await newAlbum.save();

    return res.status(201).json({
      success: true,
      message: 'Album created successfully',
      album: newAlbum,
    });
  } catch (err) {
    console.error('Create Album Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};

export const getAlbums = async (req, res) => {
  try {
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    const albums = await Album.find({ photographerId }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      albums,
    });
  } catch (err) {
    console.error('Get Albums Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const getAlbumById = async (req, res) => {
  try {
    const { id } = req.params;
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    const album = await Album.findOne({ _id: id, photographerId });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    return res.json({
      success: true,
      album,
    });
  } catch (err) {
    console.error('Get Album Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const photographerId = req.user?.id;
    const { albumName, weddingDate, accessControl, coverPhoto, description, albumTypes, status, publishProgress } = req.body;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    const album = await Album.findOne({ _id: id, photographerId });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    if (albumName) album.albumName = albumName;
    if (weddingDate) album.weddingDate = new Date(weddingDate);
    if (accessControl) album.accessControl = accessControl;
    if (coverPhoto) album.coverPhoto = coverPhoto;
    if (description) album.description = description;
    if (albumTypes) album.albumTypes = albumTypes;
    if (status) album.status = status;
    if (publishProgress !== undefined) album.publishProgress = publishProgress;

    await album.save();

    return res.json({
      success: true,
      message: 'Album updated successfully',
      album,
    });
  } catch (err) {
    console.error('Update Album Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const publishAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    const album = await Album.findOne({ _id: id, photographerId });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    album.status = 'published';
    album.publishProgress = 100;
    await album.save();

    return res.json({
      success: true,
      message: 'Album published successfully',
      album,
    });
  } catch (err) {
    console.error('Publish Album Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const deleteAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    const album = await Album.findOneAndDelete({ _id: id, photographerId });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    return res.json({
      success: true,
      message: 'Album deleted successfully',
    });
  } catch (err) {
    console.error('Delete Album Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const sendInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const { emails } = req.body;
    const photographerId = req.user?.id;

    if (!photographerId) {
      return res.status(401).json({
        success: false,
        message: 'Photographer not authenticated',
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email list',
      });
    }

    const album = await Album.findOne({ _id: id, photographerId });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    album.inviteEmail = [...new Set([...album.inviteEmail, ...emails])];
    await album.save();

    return res.json({
      success: true,
      message: 'Invitations sent successfully',
      album,
    });
  } catch (err) {
    console.error('Send Invite Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
