import BookAlbum from '../models/BookAlbum.js';
import Curate from '../models/Curate.js';
import Template from '../models/Template.js';

const getPhotographerId = (req) => req.user?.id || req.user?._id;

const emptySlotAssignment = (slotId, slotLabel) => ({
  slotId,
  slotLabel: slotLabel || slotId,
  mediaId: null,
  mediaOrder: null,
  fileName: '',
  fileType: '',
  fileSize: 0,
  dataUrl: '',
  mediaKind: 'image',
});

const mediaToSlotAssignment = (slot, media) => ({
  slotId: slot.id,
  slotLabel: slot.label || slot.id,
  mediaId: media.id,
  mediaOrder: media.order,
  fileName: media.fileName,
  fileType: media.fileType,
  fileSize: media.fileSize,
  dataUrl: media.dataUrl,
  mediaKind: media.mediaKind,
});

/** Build page layouts from DB template pages/slots and curate media (sequential fill). */
const buildPageLayouts = (mediaItems = [], template) => {
  const sortedMedia = [...mediaItems].sort((a, b) => (a.order || 0) - (b.order || 0));
  let mediaIndex = 0;

  const templatePages =
    Array.isArray(template?.pages) && template.pages.length > 0
      ? template.pages
      : [{ pageNumber: 1, pageLabel: 'Page 1', slots: template?.slots || [] }];

  const pageLayouts = templatePages
    .map((page, index) => {
      const pageNumber = Number.isFinite(Number(page.pageNumber)) ? Number(page.pageNumber) : index + 1;
      const slots = Array.isArray(page.slots) ? page.slots : [];

      const slotAssignments = slots.map((slot) => {
        const media = sortedMedia[mediaIndex];
        mediaIndex += 1;
        if (media) {
          return mediaToSlotAssignment(slot, media);
        }
        return emptySlotAssignment(slot.id, slot.label);
      });

      return { pageNumber, slotAssignments };
    })
    .filter((page) => page.slotAssignments.length > 0);

  if (pageLayouts.length > 0) {
    return pageLayouts;
  }

  return [
    {
      pageNumber: 1,
      slotAssignments: [emptySlotAssignment('slot-1', 'Slot 1')],
    },
  ];
};

export const createBookAlbum = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    const { 
      curateId, 
      templateId, 
      albumType = 'Wedding', 
      mainSiteShowStatus = false, 
      endPhoto = '', 
      endPhotoName = '',
      mediaTransforms = {}
    } = req.body;

    if (!curateId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'curateId and templateId are required',
      });
    }

    // Fetch curate and template details
    const curate = await Curate.findById(curateId);
    const template = await Template.findById(templateId);

    if (!curate) {
      return res.status(404).json({
        success: false,
        message: 'Album not found',
      });
    }

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Normalize media items
    const mediaItems = (curate.mediaItems || [])
      .filter(item => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id || `media-${index + 1}`,
        order: item.order || index + 1,
        fileName: item.fileName || '',
        fileType: item.fileType || '',
        fileSize: item.fileSize || 0,
        dataUrl: item.dataUrl || '',
        mediaKind: item.mediaKind || 'image',
      }))
      .sort((a, b) => a.order - b.order);

    // Build page layouts from template DB structure + curate media
    const pageLayouts = buildPageLayouts(mediaItems, template);

    // Apply media transforms (crop/zoom) to slot assignments
    pageLayouts.forEach((page) => {
      page.slotAssignments.forEach((slot) => {
        if (slot.mediaId && mediaTransforms[slot.mediaId]) {
          slot.cropTransform = {
            zoom: mediaTransforms[slot.mediaId].zoom || 1,
            x: mediaTransforms[slot.mediaId].x || 0,
            y: mediaTransforms[slot.mediaId].y || 0,
          };
        } else if (!slot.cropTransform) {
          slot.cropTransform = { zoom: 1, x: 0, y: 0 };
        }
      });
    });

    const totalSlots = pageLayouts.reduce((sum, page) => sum + page.slotAssignments.length, 0);
    const filledSlots = pageLayouts.reduce((sum, page) => {
      return sum + page.slotAssignments.filter((slot) => slot.mediaId).length;
    }, 0);

    const progress = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    let bookAlbum = await BookAlbum.findOne({ photographerId, curateId });
    let wasCreated = false;

    if (bookAlbum) {
      bookAlbum.templateId = templateId;
      bookAlbum.templateName = template.name;
      bookAlbum.albumName = curate.albumName;
      bookAlbum.albumType = albumType;
      bookAlbum.mainSiteShowStatus = Boolean(mainSiteShowStatus);
      bookAlbum.pageLayouts = pageLayouts;
      bookAlbum.totalPages = pageLayouts.length;
      bookAlbum.totalSlots = totalSlots;
      bookAlbum.filledSlots = filledSlots;
      bookAlbum.progress = progress;
      bookAlbum.status = 'draft';
      bookAlbum.endPhoto = endPhoto;
      bookAlbum.endPhotoName = endPhotoName;
      await bookAlbum.save();
    } else {
      wasCreated = true;
      bookAlbum = new BookAlbum({
        photographerId,
        curateId,
        templateId,
        templateName: template.name,
        albumName: curate.albumName,
        albumType,
        mainSiteShowStatus: Boolean(mainSiteShowStatus),
        pageLayouts,
        totalPages: pageLayouts.length,
        totalSlots,
        filledSlots,
        progress,
        status: 'draft',
        endPhoto,
        endPhotoName,
      });
      await bookAlbum.save();
    }

    return res.status(wasCreated ? 201 : 200).json({
      success: true,
      message: 'Book album saved successfully',
      bookAlbum,
    });
  } catch (error) {
    console.error('Create Book Album Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const getBookAlbum = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    const { bookAlbumId } = req.params;

    const bookAlbum = await BookAlbum.findById(bookAlbumId)
      .populate('curateId', 'albumName mediaItems coverPhoto coverPhotoName weddingDate')
      .populate('templateId', 'name description pages slots');

    if (!bookAlbum) {
      return res.status(404).json({
        success: false,
        message: 'Book album not found',
      });
    }

    if (bookAlbum.photographerId.toString() !== photographerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    return res.json({
      success: true,
      bookAlbum,
    });
  } catch (error) {
    console.error('Get Book Album Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const updateSlotAssignment = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    const { bookAlbumId } = req.params;
    const { pageNumber, slotId, mediaItem } = req.body;

    if (!pageNumber || !slotId) {
      return res.status(400).json({
        success: false,
        message: 'pageNumber and slotId are required',
      });
    }

    const bookAlbum = await BookAlbum.findById(bookAlbumId);

    if (!bookAlbum) {
      return res.status(404).json({
        success: false,
        message: 'Book album not found',
      });
    }

    if (bookAlbum.photographerId.toString() !== photographerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Find the page layout
    const pageLayout = bookAlbum.pageLayouts.find(pl => pl.pageNumber === pageNumber);
    if (!pageLayout) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Find the slot assignment
    const slotAssignment = pageLayout.slotAssignments.find(sa => sa.slotId === slotId);
    if (!slotAssignment) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found',
      });
    }

    // Update slot assignment
    if (mediaItem) {
      slotAssignment.mediaId = mediaItem.id;
      slotAssignment.mediaOrder = mediaItem.order;
      slotAssignment.fileName = mediaItem.fileName;
      slotAssignment.fileType = mediaItem.fileType;
      slotAssignment.fileSize = mediaItem.fileSize;
      slotAssignment.dataUrl = mediaItem.dataUrl;
      slotAssignment.mediaKind = mediaItem.mediaKind;
      // Save crop transform if provided
      if (mediaItem.cropTransform) {
        slotAssignment.cropTransform = {
          zoom: mediaItem.cropTransform.zoom || 1,
          x: mediaItem.cropTransform.x || 0,
          y: mediaItem.cropTransform.y || 0,
        };
      } else {
        slotAssignment.cropTransform = { zoom: 1, x: 0, y: 0 };
      }
    } else {
      // Clear the slot
      slotAssignment.mediaId = null;
      slotAssignment.mediaOrder = null;
      slotAssignment.fileName = '';
      slotAssignment.fileType = '';
      slotAssignment.fileSize = 0;
      slotAssignment.dataUrl = '';
      slotAssignment.mediaKind = 'image';
      slotAssignment.cropTransform = { zoom: 1, x: 0, y: 0 };
    }

    // Recalculate filled slots and progress
    const totalSlots = bookAlbum.pageLayouts.reduce((sum, page) => sum + page.slotAssignments.length, 0);
    const filledSlots = bookAlbum.pageLayouts.reduce((sum, page) => {
      return sum + page.slotAssignments.filter(slot => slot.mediaId).length;
    }, 0);

    bookAlbum.filledSlots = filledSlots;
    bookAlbum.totalSlots = totalSlots;
    bookAlbum.progress = Math.round((filledSlots / totalSlots) * 100);

    await bookAlbum.save();

    return res.json({
      success: true,
      message: 'Slot assignment updated',
      bookAlbum,
    });
  } catch (error) {
    console.error('Update Slot Assignment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const saveBookAlbum = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);
    const { bookAlbumId } = req.params;
    const { status = 'saved', albumType, mainSiteShowStatus, endPhoto, endPhotoName } = req.body;

    const bookAlbum = await BookAlbum.findById(bookAlbumId);

    if (!bookAlbum) {
      return res.status(404).json({
        success: false,
        message: 'Book album not found',
      });
    }

    if (bookAlbum.photographerId.toString() !== photographerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    bookAlbum.status = status;
    if (albumType) {
      bookAlbum.albumType = albumType;
    }
    if (typeof mainSiteShowStatus === 'boolean') {
      bookAlbum.mainSiteShowStatus = mainSiteShowStatus;
    }
    if (endPhoto !== undefined) {
      bookAlbum.endPhoto = endPhoto;
    }
    if (endPhotoName !== undefined) {
      bookAlbum.endPhotoName = endPhotoName;
    }
    await bookAlbum.save();

    return res.json({
      success: true,
      message: 'Book album saved',
      bookAlbum,
    });
  } catch (error) {
    console.error('Save Book Album Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const listBookAlbums = async (req, res) => {
  try {
    const photographerId = getPhotographerId(req);

    const bookAlbums = await BookAlbum.find({ photographerId })
      .populate('curateId', 'albumName')
      .populate('templateId', 'name')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      bookAlbums,
    });
  } catch (error) {
    console.error('List Book Albums Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const listPublicBookAlbums = async (req, res) => {
  try {
    const bookAlbums = await BookAlbum.find({ mainSiteShowStatus: true })
      .populate('curateId', 'albumName mediaItems coverPhoto coverPhotoName weddingDate')
      .populate('templateId', 'name description pages slots accent coverImage')
      .sort({ updatedAt: -1 });

    return res.json({
      success: true,
      bookAlbums,
    });
  } catch (error) {
    console.error('List Public Book Albums Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
