import Curate from '../models/Curate.js';
import Template from '../models/Template.js';
import User from '../models/User.js';

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
      mediaItems,
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

    const normalizedMediaItems = normalizeMediaItems(Array.isArray(mediaItems) ? mediaItems : []);
    const nextPayload = {
      photographerId,
      albumName: String(albumName).trim(),
      weddingDate: weddingDate ? new Date(weddingDate) : null,
      accessControl: accessControl || 'public',
      coverPhoto: coverPhoto || '',
      coverPhotoName: coverPhotoName || '',
      mediaItems: normalizedMediaItems,
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
        { new: true, runValidators: true }
      );

      if (!savedDraft) {
        return res.status(404).json({ success: false, message: 'Curate album not found' });
      }
    } else {
      const currentDraft = await Curate.findOne({ photographerId, pageSlug: 'photographer-admin/curate' });

      if (currentDraft) {
        savedDraft = await Curate.findOneAndUpdate(
          { _id: currentDraft._id, photographerId },
          { $set: nextPayload },
          { new: true, runValidators: true }
        );
      } else {
        savedDraft = await Curate.create({
          ...nextPayload,
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
