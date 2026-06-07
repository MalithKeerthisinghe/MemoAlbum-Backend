import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import CoupleProfile from '../models/CoupleProfile.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'gallery');

const mimeTypeToExtension = (mimeType = '') => {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
  };
  return map[mimeType.toLowerCase()] || mimeType.split('/').pop() || 'bin';
};

const getAbsoluteUploadUrl = (req, relativeUrl) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${relativeUrl}`;
};

const saveDataUrlToDisk = async (item, req, userId, folderId) => {
  const dataUrl = item.dataUrl || '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return item;

  const mimeType = item.fileType || match[1] || 'application/octet-stream';
  const base64Data = match[2];
  const extension = mimeTypeToExtension(mimeType);
  const fileId = item.id || `gallery-${Date.now()}`;
  const filename = `${fileId}.${extension}`;
  const outputDir = path.join(UPLOADS_DIR, String(userId), String(folderId || 'general'));
  const outputPath = path.join(outputDir, filename);

  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'));

  const relativeUrl = `/uploads/gallery/${String(userId)}/${String(folderId || 'general')}/${filename}`;
  return {
    ...item,
    url: getAbsoluteUploadUrl(req, relativeUrl),
    fileType: mimeType,
    fileName: item.fileName || filename,
  };
};

export const getGalleryFolders = async (req, res) => {
  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  const folders = profile?.galleryFolders || [];
  return res.status(200).json({ success: true, count: folders.length, data: folders });
};

export const createGalleryFolder = async (req, res) => {
  const { name, category } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Folder name is required.' });
  }

  const primaryEmail = req.user?.email || req.user?.primaryEmail || 'unknown@example.com';
  let profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) {
    profile = await CoupleProfile.create({
      userId: req.user._id,
      primaryEmail,
      partnerEmail: req.user?.partnerEmail || '',
      status: 'active',
      galleryFolders: [],
    });
  }

  const folder = {
    id: new mongoose.Types.ObjectId().toString(),
    name: name.trim(),
    category: category || 'Custom',
    createdAt: new Date(),
    images: [],
  };

  profile.galleryFolders.unshift(folder);
  await profile.save();

  return res.status(201).json({ success: true, data: folder });
};

export const listGalleryMedia = async (req, res) => {
  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  const media = [];

  /*(profile?.galleryFolders || []).forEach((folder) => {
    (folder.images || []).forEach((image) => {
      media.push({
        ...image,
        folderId: folder.id,
        folderName: folder.name,
      });
    });
  });*/

  (profile?.galleryFolders || []).forEach((folder) => {
    (folder.images || []).forEach((image) => {
      const imageObj = image.toObject ? image.toObject() : { ...image };
      media.push({
        ...imageObj,
        folderId: folder.id,
        folderName: folder.name,
      });
    });
  });

  return res.status(200).json({ success: true, count: media.length, data: media });
};

export const addGalleryMedia = async (req, res) => {
  const itemsPayload = Array.isArray(req.body.items) ? req.body.items : [req.body];
  if (!itemsPayload.length) {
    return res.status(400).json({ success: false, message: 'No media provided.' });
  }

  const folderId = req.body.folderId || itemsPayload[0]?.folderId || null;
  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Couple profile not found.' });
  }

  let folder = folderId
    ? profile.galleryFolders.find((f) => f.id === folderId)
    : profile.galleryFolders[0];

  if (!folder) {
    const defaultFolder = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Gallery',
      category: 'All Media',
      createdAt: new Date(),
      images: [],
    };
    profile.galleryFolders.unshift(defaultFolder);
    folder = defaultFolder;
  }

  const createdItems = [];

  for (const item of itemsPayload) {
    const rawUrl = item.url || item.dataUrl || '';
    if (!rawUrl || !rawUrl.trim()) {
      continue;
    }

    let mediaUrl = rawUrl.trim();
    const mediaType =
      item.mediaType === 'video'
        ? 'video'
        : item.mediaType === 'photo'
        ? 'photo'
        : item.fileType?.startsWith('video')
        ? 'video'
        : 'photo';

    const imageItem = {
      id: new mongoose.Types.ObjectId().toString(),
      title: (item.title || item.fileName || '').trim(),
      url: mediaUrl,
      mediaType,
      isFavorite: false,
      uploadedAt: new Date(),
    };

    /*if (mediaUrl.startsWith('data:')) {
      const saved = await saveDataUrlToDisk(
        {
          ...item,
          dataUrl: mediaUrl,
          fileType: item.fileType || '',
          fileName: item.fileName || item.title || '',
        },*/
      if (mediaUrl.startsWith('data:')) {
      const saved = await saveDataUrlToDisk(
        {
          ...item,
          id: imageItem.id,
          dataUrl: mediaUrl,
          fileType: item.fileType || '',
          fileName: item.fileName || item.title || '',
        },
        req,
        req.user._id,
        folderId || 'general'
      );
      imageItem.url = saved.url;
      imageItem.title = saved.fileName || imageItem.title;
    }

    folder.images.unshift(imageItem);
    createdItems.push(imageItem);
  }

  await profile.save();

  if (!createdItems.length) {
    return res.status(400).json({ success: false, message: 'No valid media items were uploaded.' });
  }

  return res.status(201).json({ success: true, data: createdItems.length === 1 ? createdItems[0] : createdItems });
};

export const deleteGalleryMedia = async (req, res) => {
  const { mediaId } = req.params;
  console.log('Deleting media for user:', req.user?._id, 'mediaId:', mediaId);

  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Couple profile not found.' });
  }

  let deletedImage = null;
  /*profile.galleryFolders = profile.galleryFolders.map((folder) => {
    const remainingImages = folder.images?.filter((img) => {
      if (img.id === mediaId) {
        deletedImage = img;
        return false;
      }
      return true;
    }) || [];
    return { ...folder, images: remainingImages };
  }); */

  /*if (!deletedImage) {
    return res.status(404).json({ success: false, message: 'Media item not found.' });
  }

  await profile.save(); */

  profile.galleryFolders = profile.galleryFolders.map((folder) => {
    const remainingImages = folder.images?.filter((img) => {
      if (img.id === mediaId) {
        deletedImage = img;
        return false;
      }
      return true;
    }) || [];
    return { ...folder.toObject(), images: remainingImages };
  });

  if (!deletedImage) {
    return res.status(404).json({ success: false, message: 'Media item not found.' });
  }

  profile.markModified('galleryFolders');
  await profile.save();
  
  return res.status(200).json({ success: true, data: deletedImage });
};

export const toggleGalleryMediaFavorite = async (req, res) => {
  const { mediaId } = req.params;
  console.log('Toggling favorite for user:', req.user?._id, 'mediaId:', mediaId);

  const profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Couple profile not found.' });
  }

  /*let foundImage = null;
  for (const folder of profile.galleryFolders || []) {
    const image = folder.images?.find((img) => img.id === mediaId);
    if (image) {
      image.isFavorite = !image.isFavorite;
      foundImage = image;
      break;
    }
  }*/

  /*if (!foundImage) {
    return res.status(404).json({ success: false, message: 'Media item not found.' });
  }*/

  //await profile.save();

  let foundImage = null;
  for (const folder of profile.galleryFolders || []) {
    const imageIndex = folder.images?.findIndex((img) => img.id === mediaId);
    if (imageIndex !== undefined && imageIndex !== -1) {
      folder.images[imageIndex].isFavorite = !folder.images[imageIndex].isFavorite;
      foundImage = folder.images[imageIndex];
      profile.markModified('galleryFolders');
      break;
    }
  }

  if (!foundImage) {
    return res.status(404).json({ success: false, message: 'Media item not found.' });
  }

  await profile.save();

  return res.status(200).json({ success: true, data: foundImage });
};
