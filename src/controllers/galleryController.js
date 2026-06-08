import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import CoupleProfile from '../models/CoupleProfile.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'gallery');

const mimeTypeToExtension = (mimeType = '') => {
  const map = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/webm': 'webm', 'video/ogg': 'ogv',
  };
  return map[mimeType.toLowerCase()] || mimeType.split('/').pop() || 'bin';
};
// Get Gallery Summary + All Media Counts (UI එකට ඕනේ)
export const getGallerySummary = async (req, res) => {
  try {
    const profile = await CoupleProfile.findOne({ userId: req.user._id })
      .select('allMedia allPhotos allVideos galleryFolders');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    const summary = {
      all: profile.allMedia?.length || 0,
      photos: profile.allPhotos?.length || 0,
      videos: profile.allVideos?.length || 0,
      totalFolders: profile.galleryFolders?.length || 0,
    };

    return res.status(200).json({
      success: true,
      counts: summary,
      // Optional: ඔබට ඕන නම් සම්පූර්ණ data ටත් එකතු කරන්න
      allMedia: profile.allMedia || [],
      allPhotos: profile.allPhotos || [],
      allVideos: profile.allVideos || []
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAbsoluteUploadUrl = (req, relativeUrl) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${relativeUrl}`;
};

const saveDataUrlToDisk = async (item, req, userId, folderId = 'general') => {
  const dataUrl = item.dataUrl || '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return item;

  const mimeType = item.fileType || match[1] || 'application/octet-stream';
  const base64Data = match[2];
  const extension = mimeTypeToExtension(mimeType);
  const fileId = item.id || `gallery-${Date.now()}`;
  const filename = `${fileId}.${extension}`;

  const outputDir = path.join(UPLOADS_DIR, String(userId), String(folderId));
  const outputPath = path.join(outputDir, filename);

  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'));

  const relativeUrl = `/uploads/gallery/${String(userId)}/${String(folderId)}/${filename}`;
  
  return {
    ...item,
    url: getAbsoluteUploadUrl(req, relativeUrl),
    fileType: mimeType,
    fileName: item.fileName || filename,
  };
};

// ====================== MAIN UPLOAD FUNCTION ======================
// ====================== MAIN UPLOAD FUNCTION (UPDATED) ======================
export const addGalleryMedia = async (req, res) => {
  const itemsPayload = Array.isArray(req.body.items) ? req.body.items : [req.body];

  if (!itemsPayload.length) {
    return res.status(400).json({ success: false, message: 'No media provided.' });
  }

  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) return res.status(404).json({ success: false, message: 'Profile not found.' });

  // Ensure "Gallery" folder exists
  let galleryFolder = profile.galleryFolders.find(f => 
    f.name?.toLowerCase() === 'gallery' || f.category === 'All Media'
  );

  if (!galleryFolder) {
    galleryFolder = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Gallery',
      category: 'All Media',
      createdAt: new Date(),
      images: [],
    };
    profile.galleryFolders.unshift(galleryFolder);
  }

  const createdItems = [];

  for (const item of itemsPayload) {
    if (!item.dataUrl) continue;

    const saved = await saveDataUrlToDisk(
      item,
      req,
      req.user._id,
      'Gallery'
    );

    const mediaItem = {
      id: new mongoose.Types.ObjectId().toString(),
      title: item.title || item.fileName || 'Uploaded Media',
      url: saved.url,
      mediaType: item.mediaType || (item.fileType?.startsWith('video') ? 'video' : 'photo'),
      isFavorite: false,
      uploadedAt: new Date(),
      uploadPath: `/uploads/gallery/${req.user._id}/Gallery`,
      uploadedBy: 'couple-profile',
    };

    // Avoid duplicates
    if (!galleryFolder.images.some(img => img.url === saved.url)) {
      galleryFolder.images.unshift(mediaItem);
      createdItems.push(mediaItem);
    }
  }

  // === NEW: Maintain top-level "allMedia" / "allPhotos" / "allVideos" aggregation ===
  if (!profile.allMedia) {
    profile.allMedia = [];           // Array of all media across folders
  }
  if (!profile.allPhotos) {
    profile.allPhotos = [];          // Only photos
  }
  if (!profile.allVideos) {
    profile.allVideos = [];          // Only videos
  }

  // Add newly created items to top-level arrays
  for (const item of createdItems) {
    // Add to allMedia (everything)
    if (!profile.allMedia.some(m => m.url === item.url)) {
      profile.allMedia.unshift(item);
    }

    // Add to allPhotos (photos only)
    if (item.mediaType === 'photo' && !profile.allPhotos.some(m => m.url === item.url)) {
      profile.allPhotos.unshift(item);
    }

    // Add to allVideos (videos only)
    if (item.mediaType === 'video' && !profile.allVideos.some(m => m.url === item.url)) {
      profile.allVideos.unshift(item);
    }
  }

  await profile.save();

  // Return updated counts for frontend
  const totalAll = profile.allMedia?.length || 0;
  const totalPhotos = profile.allPhotos?.length || 0;
  const totalVideos = profile.allVideos?.length || 0;

  return res.status(201).json({
    success: true,
    message: `${createdItems.length} file(s) uploaded successfully`,
    data: createdItems.length === 1 ? createdItems[0] : createdItems,
    counts: {
      all: totalAll,
      photos: totalPhotos,
      videos: totalVideos
    }
  });
};

// Get all gallery folders
export const getGalleryFolders = async (req, res) => {
  try {
    const profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    const folders = profile?.galleryFolders || [];
    return res.status(200).json({ success: true, count: folders.length, data: folders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create a new gallery folder
export const createGalleryFolder = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    const newFolder = {
      id: new mongoose.Types.ObjectId().toString(),
      name: name.trim(),
      category: category || 'Custom',
      createdAt: new Date(),
      images: [],
    };

    profile.galleryFolders.unshift(newFolder);
    await profile.save();

    return res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: newFolder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List all gallery media (all photos and videos)
export const listGalleryMedia = async (req, res) => {
  try {
    const profile = await CoupleProfile.findOne({ userId: req.user._id })
      .select('allMedia');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    return res.status(200).json({
      success: true,
      count: profile.allMedia?.length || 0,
      data: profile.allMedia || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a media item from all galleries and arrays
export const deleteGalleryMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    // Remove from all top-level arrays
    profile.allMedia = profile.allMedia?.filter(m => String(m.id) !== mediaId) || [];
    profile.allPhotos = profile.allPhotos?.filter(m => String(m.id) !== mediaId) || [];
    profile.allVideos = profile.allVideos?.filter(m => String(m.id) !== mediaId) || [];

    // Remove from all folders
    profile.galleryFolders.forEach(folder => {
      folder.images = folder.images?.filter(m => String(m.id) !== mediaId) || [];
    });

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Toggle favorite status for a media item
export const toggleGalleryMediaFavorite = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    // Update in allMedia
    const allMediaItem = profile.allMedia?.find(m => String(m.id) === mediaId);
    if (allMediaItem) {
      allMediaItem.isFavorite = !allMediaItem.isFavorite;
    }

    // Update in allPhotos
    const allPhotosItem = profile.allPhotos?.find(m => String(m.id) === mediaId);
    if (allPhotosItem) {
      allPhotosItem.isFavorite = !allPhotosItem.isFavorite;
    }

    // Update in allVideos
    const allVideosItem = profile.allVideos?.find(m => String(m.id) === mediaId);
    if (allVideosItem) {
      allVideosItem.isFavorite = !allVideosItem.isFavorite;
    }

    // Update in folders
    profile.galleryFolders.forEach(folder => {
      const folderItem = folder.images?.find(m => String(m.id) === mediaId);
      if (folderItem) {
        folderItem.isFavorite = !folderItem.isFavorite;
      }
    });

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Favorite status updated',
      isFavorite: allMediaItem?.isFavorite || false,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};