import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Curate from '../models/Curate.js';
import Template from '../models/Template.js';
import User from '../models/User.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'curate');

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

const saveDataUrlToDisk = async (item, curateId, req) => {
  const dataUrl = item.dataUrl || '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return item;

  const mimeType = item.fileType || match[1] || 'application/octet-stream';
  const base64Data = match[2];
  const extension = mimeTypeToExtension(mimeType);
  const fileId = item.id || `media-${Date.now()}`;
  const filename = `${fileId}.${extension}`;
  const outputDir = path.join(UPLOADS_DIR, String(curateId));
  const outputPath = path.join(outputDir, filename);

  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'));

  const relativeUrl = `/uploads/curate/${String(curateId)}/${filename}`;
  return {
    ...item,
    dataUrl: getAbsoluteUploadUrl(req, relativeUrl),
    fileType: mimeType,
    fileName: item.fileName || filename,
  };
};

const processMediaItemsForSave = async (mediaItems = [], curateId, req) => {
  if (!Array.isArray(mediaItems)) return [];
  return Promise.all(
    mediaItems.map(async (item, index) => {
      const normalized = {
        id: item.id || `media-${index + 1}`,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
        fileName: item.fileName || '',
        fileType: item.fileType || '',
        fileSize: Number(item.fileSize) || 0,
        dataUrl: item.dataUrl || item.url || item.src || '',
        mediaKind: item.mediaKind || (item.fileType?.startsWith('video') ? 'video' : 'image'),
        caption: item.caption || '',
      };

      if (normalized.dataUrl.startsWith('data:')) {
        return saveDataUrlToDisk(normalized, curateId, req);
      }
      return normalized;
    })
  );
};

const TEMPLATE_SLOT_MAP = {
  'template-1': ['leftHero', 'leftWide', 'leftBottom', 'leftTall', 'rightHero', 'rightBottomMain', 'rightBottomSide'],
  'template-2': ['leftTop', 'leftMain', 'leftBottom', 'leftSide', 'rightTop', 'rightMain', 'rightBottom'],
  'template-3': ['leftMain', 'leftInset', 'leftBottom', 'leftTall', 'rightHero', 'rightInset', 'rightFooter'],
  'template-4': ['leftHero', 'leftInsetA', 'leftInsetB', 'leftBottom', 'rightMain', 'rightBottomA', 'rightBottomB'],
  'template-5': ['leftWide', 'leftCard', 'leftBottom', 'leftTall', 'rightHero', 'rightCard', 'rightBottom'],
};

const DEFAULT_TEMPLATE_ID = 'template-1';

const normalizeCurateStatus = (status) => {
  if (status === 'saved' || status === 'published') return 'saved';
  if (status === 'save_draft' || status === 'draft') return 'save_draft';
  return 'save_draft';
};

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

export const listCurateTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true }).sort({ updatedAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('List Curate Templates Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const buildTemplateSpreads = ({ mediaItems = [], templateId = DEFAULT_TEMPLATE_ID }) => {
  const slots = TEMPLATE_SLOT_MAP[templateId] || TEMPLATE_SLOT_MAP[DEFAULT_TEMPLATE_ID];

  if (!mediaItems.length) {
    return [];
  }

  const spreadCount = Math.max(1, Math.ceil(mediaItems.length / slots.length));
  const spreads = [];

  for (let spreadIndex = 0; spreadIndex < spreadCount; spreadIndex += 1) {
    const slotAssignments = slots.map((slotName, slotIndex) => {
      const mediaIndex = (spreadIndex * slots.length + slotIndex) % mediaItems.length;
      const media = mediaItems[mediaIndex];

      return {
        slot: slotName,
        mediaId: media.id,
        mediaOrder: media.order,
        mediaKind: media.mediaKind,
        fileName: media.fileName,
        fileType: media.fileType,
        fileSize: media.fileSize,
        dataUrl: media.dataUrl,
      };
    });

    spreads.push({
      spreadNumber: spreadIndex + 1,
      pageLeft: spreadIndex * 2 + 1,
      pageRight: spreadIndex * 2 + 2,
      templateId,
      slots: slotAssignments,
    });
  }

  return spreads;
};

export const saveCurateDraft = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const {
      curateId,
      albumName,
      weddingDate,
      accessControl,
      coverPhoto,
      coverPhotoName,
      endPhoto,
      endPhotoName,
      mediaItems,
      mediaTransforms,
      progress,
      selectedAlbumId,
      selectedTemplate,
      status,
    } = req.body;

    if (!albumName || !String(albumName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Album name is required',
      });
    }

    const photographer = await User.findById(photographerId).select('_id roleId email');
    if (!photographer) {
      return res.status(404).json({ success: false, message: 'Photographer not found' });
    }

    const currentDraft = curateId ? null : await Curate.findOne({ photographerId, pageSlug: 'photographer-admin/curate' });
    const nextCurateId = curateId || currentDraft?._id?.toString() || new mongoose.Types.ObjectId().toString();
    const normalizedMediaItems = await processMediaItemsForSave(Array.isArray(mediaItems) ? mediaItems : [], nextCurateId, req);
    const nextPayload = {
      photographerId,
      albumName: String(albumName).trim(),
      weddingDate: weddingDate ? new Date(weddingDate) : null,
      accessControl: accessControl || 'public',
      coverPhoto: coverPhoto || '',
      coverPhotoName: coverPhotoName || '',
      endPhoto: endPhoto || '',
      endPhotoName: endPhotoName || '',
      mediaItems: normalizedMediaItems,
      mediaTransforms: mediaTransforms || {},
      selectedAlbumId: selectedAlbumId || '',
      selectedTemplate: selectedTemplate || DEFAULT_TEMPLATE_ID,
      progress: Number.isFinite(Number(progress)) ? Number(progress) : Math.min(100, normalizedMediaItems.length * 10),
      status: normalizeCurateStatus(status),
    };

    let savedDraft;

    if (curateId) {
      savedDraft = await Curate.findOneAndUpdate(
        { _id: curateId, photographerId },
        { $set: nextPayload },
        { returnDocument: 'after', runValidators: true }
      );

      if (!savedDraft) {
        return res.status(404).json({ success: false, message: 'Curate album not found' });
      }
    } else {
      if (currentDraft) {
        savedDraft = await Curate.findOneAndUpdate(
          { _id: currentDraft._id, photographerId },
          { $set: nextPayload },
          { returnDocument: 'after', runValidators: true }
        );
      } else {
        savedDraft = await Curate.create({
          ...nextPayload,
          _id: nextCurateId,
          pageSlug: 'photographer-admin/curate',
        });
      }
    }

    return res.status(curateId ? 200 : 201).json({
      success: true,
      message: curateId ? 'Curate album updated' : 'New curate album created',
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

    const curate =
      (await Curate.findOne({ photographerId, pageSlug: 'photographer-admin/curate' })) ||
      (await Curate.findOne({ photographerId }).sort({ updatedAt: -1 }));

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

export const getCurateTemplatePreview = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const curate = await Curate.findOne({ photographerId, pageSlug: 'photographer-admin/curate' });
    if (!curate) {
      return res.status(404).json({ success: false, message: 'Curate draft not found' });
    }

    const templateId = req.query.template?.toString?.() || curate.selectedTemplate || DEFAULT_TEMPLATE_ID;
    const normalizedMediaItems = normalizeMediaItems(curate.mediaItems);
    const spreads = buildTemplateSpreads({ mediaItems: normalizedMediaItems, templateId });

    return res.json({
      success: true,
      templateId,
      totalMedia: normalizedMediaItems.length,
      spreads,
    });
  } catch (error) {
    console.error('Get Curate Template Preview Error:', error);
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

    // Return both saved and draft curates for the photographer
    const curates = await Curate.find({
      photographerId,
      status: { $in: ['saved', 'published', 'save_draft', 'draft'] },
    })
      .sort({ updatedAt: -1 })
      .lean();

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

export const deleteCurateById = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    const { id } = req.params;

    if (!photographerId) {
      return res.status(401).json({ success: false, message: 'Photographer not authenticated' });
    }

    const deleted = await Curate.findOneAndDelete({ _id: id, photographerId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Curate album not found' });
    }

    return res.json({
      success: true,
      message: 'Curate album deleted successfully',
    });
  } catch (error) {
    console.error('Delete Curate By Id Error:', error);
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
