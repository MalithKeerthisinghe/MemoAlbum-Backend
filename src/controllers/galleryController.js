import mongoose from "mongoose";
import CoupleProfile from "../models/CoupleProfile.js";
import {
  uploadBase64ToS3,
  deleteFromS3,
  mimeTypeToExtension,
} from "../utils/s3Upload.js";

// ─── S3 Upload Helper ────────────────────────────────────────────────────────

const saveMediaItemToS3 = async (item, userId, folderId = "general") => {
  const dataUrl = item.dataUrl || "";
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return item;

  const mimeType = item.fileType || match[1] || "application/octet-stream";
  const extension = mimeTypeToExtension(mimeType);
  const fileId = item.id || `gallery-${Date.now()}`;
  const filename = `${fileId}.${extension}`;
  const s3Key = `gallery/${String(userId)}/${String(folderId)}/${filename}`;
  const s3Url = await uploadBase64ToS3(dataUrl, s3Key, mimeType);

  return {
    ...item,
    url: s3Url,
    fileType: mimeType,
    fileName: item.fileName || filename,
  };
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const getGallerySummary = async (req, res) => {
  try {
    let profile = await CoupleProfile.findOne({ userId: req.user._id }).select(
      "allMedia allPhotos allVideos galleryFolders",
    );

    if (!profile) {
      profile = new CoupleProfile({
        userId: req.user._id,
        allMedia: [],
        allPhotos: [],
        allVideos: [],
        galleryFolders: [],
      });
      await profile.save();
    }

    return res.status(200).json({
      success: true,
      counts: {
        all: profile.allMedia?.length || 0,
        photos: profile.allPhotos?.length || 0,
        videos: profile.allVideos?.length || 0,
        totalFolders: profile.galleryFolders?.length || 0,
      },
      allMedia: profile.allMedia || [],
      allPhotos: profile.allPhotos || [],
      allVideos: profile.allVideos || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const addGalleryMedia = async (req, res) => {
  const itemsPayload = Array.isArray(req.body.items)
    ? req.body.items
    : [req.body];

  if (!itemsPayload.length) {
    return res
      .status(400)
      .json({ success: false, message: "No media provided." });
  }

  let profile = await CoupleProfile.findOne({ userId: req.user._id });
  if (!profile) {
    profile = new CoupleProfile({
      userId: req.user._id,
      allMedia: [],
      allPhotos: [],
      allVideos: [],
      galleryFolders: [],
    });
  }

  const itemsByFolder = {};
  for (const item of itemsPayload) {
    const folderId = item.folderId || "Gallery";
    if (!itemsByFolder[folderId]) itemsByFolder[folderId] = [];
    itemsByFolder[folderId].push(item);
  }

  const createdItems = [];

  for (const [folderId, folderItems] of Object.entries(itemsByFolder)) {
    let targetFolder = profile.galleryFolders.find((f) => f.id === folderId);

    if (!targetFolder) {
      targetFolder = {
        id: folderId,
        name: folderId === "Gallery" ? "Gallery" : folderId,
        category: folderId === "Gallery" ? "All Media" : "Custom",
        createdAt: new Date(),
        images: [],
      };
      profile.galleryFolders.unshift(targetFolder);
    }

    for (const item of folderItems) {
      if (!item.dataUrl) continue;

      // Upload to S3 instead of local disk
      const saved = await saveMediaItemToS3(item, req.user._id, folderId);

      const mediaItem = {
        id: new mongoose.Types.ObjectId().toString(),
        title: item.title || item.fileName || "Uploaded Media",
        url: saved.url,
        mediaType:
          item.mediaType ||
          (item.fileType?.startsWith("video") ? "video" : "photo"),
        isFavorite: false,
        uploadedAt: new Date(),
        uploadedBy: "couple-profile",
      };

      if (!targetFolder.images.some((img) => img.url === saved.url)) {
        targetFolder.images.unshift(mediaItem);
        createdItems.push(mediaItem);
      }
    }
  }

  if (!profile.allMedia) profile.allMedia = [];
  if (!profile.allPhotos) profile.allPhotos = [];
  if (!profile.allVideos) profile.allVideos = [];

  for (const item of createdItems) {
    if (!profile.allMedia.some((m) => m.url === item.url))
      profile.allMedia.unshift(item);
    if (
      item.mediaType === "photo" &&
      !profile.allPhotos.some((m) => m.url === item.url)
    )
      profile.allPhotos.unshift(item);
    if (
      item.mediaType === "video" &&
      !profile.allVideos.some((m) => m.url === item.url)
    )
      profile.allVideos.unshift(item);
  }

  await profile.save();

  return res.status(201).json({
    success: true,
    message: `${createdItems.length} file(s) uploaded successfully`,
    data: createdItems.length === 1 ? createdItems[0] : createdItems,
    counts: {
      all: profile.allMedia?.length || 0,
      photos: profile.allPhotos?.length || 0,
      videos: profile.allVideos?.length || 0,
    },
  });
};

export const getGalleryFolders = async (req, res) => {
  try {
    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new CoupleProfile({
        userId: req.user._id,
        allMedia: [],
        allPhotos: [],
        allVideos: [],
        galleryFolders: [],
      });
      await profile.save();
    }
    return res.status(200).json({
      success: true,
      count: profile.galleryFolders.length,
      data: profile.galleryFolders || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createGalleryFolder = async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Folder name is required." });

    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new CoupleProfile({
        userId: req.user._id,
        allMedia: [],
        allPhotos: [],
        allVideos: [],
        galleryFolders: [],
      });
    }

    const newFolder = {
      id: new mongoose.Types.ObjectId().toString(),
      name: name.trim(),
      category: category || "Custom",
      createdAt: new Date(),
      images: [],
    };

    profile.galleryFolders.unshift(newFolder);
    await profile.save();
    return res
      .status(201)
      .json({
        success: true,
        message: "Folder created successfully",
        data: newFolder,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteGalleryFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    if (!folderId?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Folder ID is required." });

    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found." });

    const folderIndex = profile.galleryFolders.findIndex(
      (f) => f.id === folderId,
    );
    if (folderIndex === -1)
      return res
        .status(404)
        .json({ success: false, message: "Folder not found." });

    const folder = profile.galleryFolders[folderIndex];
    const folderImages = folder.images || [];

    // Delete each file from S3
    for (const img of folderImages) {
      if (img.url) await deleteFromS3(img.url);
    }

    // Remove from top-level arrays
    const folderImageIds = new Set(folderImages.map((img) => img.id));
    profile.allMedia =
      profile.allMedia?.filter((m) => !folderImageIds.has(m.id)) || [];
    profile.allPhotos =
      profile.allPhotos?.filter((m) => !folderImageIds.has(m.id)) || [];
    profile.allVideos =
      profile.allVideos?.filter((m) => !folderImageIds.has(m.id)) || [];

    profile.galleryFolders.splice(folderIndex, 1);
    await profile.save();

    return res
      .status(200)
      .json({ success: true, message: "Folder deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const listGalleryMedia = async (req, res) => {
  try {
    let profile = await CoupleProfile.findOne({ userId: req.user._id }).select(
      "allMedia",
    );
    if (!profile) {
      profile = new CoupleProfile({
        userId: req.user._id,
        allMedia: [],
        allPhotos: [],
        allVideos: [],
        galleryFolders: [],
      });
      await profile.save();
    }
    return res.status(200).json({
      success: true,
      count: profile.allMedia?.length || 0,
      data: profile.allMedia || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteGalleryMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found." });

    // Find the media URL before deleting so we can remove from S3
    const mediaItem = profile.allMedia?.find((m) => String(m.id) === mediaId);
    if (mediaItem?.url) await deleteFromS3(mediaItem.url);

    profile.allMedia =
      profile.allMedia?.filter((m) => String(m.id) !== mediaId) || [];
    profile.allPhotos =
      profile.allPhotos?.filter((m) => String(m.id) !== mediaId) || [];
    profile.allVideos =
      profile.allVideos?.filter((m) => String(m.id) !== mediaId) || [];
    profile.galleryFolders.forEach((folder) => {
      folder.images =
        folder.images?.filter((m) => String(m.id) !== mediaId) || [];
    });

    await profile.save();
    return res
      .status(200)
      .json({ success: true, message: "Media deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const toggleGalleryMediaFavorite = async (req, res) => {
  try {
    const { mediaId } = req.params;

    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found." });

    let newFavoriteStatus = false;
    const toggle = (arr) => {
      const item = arr?.find((m) => String(m.id) === mediaId);
      if (item) {
        item.isFavorite = !item.isFavorite;
        newFavoriteStatus = item.isFavorite;
      }
    };

    toggle(profile.allMedia);
    toggle(profile.allPhotos);
    toggle(profile.allVideos);
    profile.galleryFolders.forEach((folder) => toggle(folder.images));

    await profile.save();
    return res
      .status(200)
      .json({
        success: true,
        message: "Favorite status updated",
        isFavorite: newFavoriteStatus,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const moveGalleryMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { folderId } = req.body;
    if (!folderId)
      return res
        .status(400)
        .json({
          success: false,
          message: "Destination folder ID is required.",
        });

    let profile = await CoupleProfile.findOne({ userId: req.user._id });
    if (!profile)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found." });

    let mediaItem = null;
    let sourceFolder = null;
    for (const folder of profile.galleryFolders) {
      const found = folder.images?.find((m) => String(m.id) === mediaId);
      if (found) {
        mediaItem = found;
        sourceFolder = folder;
        break;
      }
    }

    if (!mediaItem)
      return res
        .status(404)
        .json({ success: false, message: "Media not found." });

    const destinationFolder = profile.galleryFolders.find(
      (f) => String(f.id) === folderId,
    );
    if (!destinationFolder)
      return res
        .status(404)
        .json({ success: false, message: "Destination folder not found." });

    if (sourceFolder)
      sourceFolder.images =
        sourceFolder.images?.filter((m) => String(m.id) !== mediaId) || [];
    if (!destinationFolder.images) destinationFolder.images = [];
    destinationFolder.images.unshift(mediaItem);

    await profile.save();
    return res
      .status(200)
      .json({
        success: true,
        message: "Media moved successfully",
        data: mediaItem,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getGuestGalleryFolder = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    const profile = await CoupleProfile.findOne({ userId });
    if (!profile)
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    const folder = profile.galleryFolders.find(
      (f) =>
        /guest|interactive/i.test(f.name) ||
        /guest|interactive/i.test(f.category),
    );
    return res.status(200).json({ success: true, data: folder });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const addGuestGalleryMedia = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    req.user = { _id: userId };
    return await addGalleryMedia(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
