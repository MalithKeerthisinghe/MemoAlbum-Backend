import mongoose from 'mongoose';

const slotAssignmentSchema = new mongoose.Schema(
  {
    slotId: {
      type: String,
      required: true,
    },
    slotLabel: {
      type: String,
      default: '',
    },
    mediaId: {
      type: String,
      default: null,
    },
    mediaOrder: {
      type: Number,
      default: null,
    },
    fileName: {
      type: String,
      default: '',
    },
    fileType: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    dataUrl: {
      type: String,
      default: '',
    },
    mediaKind: {
      type: String,
      enum: ['image', 'video', 'other'],
      default: 'image',
    },
    cropTransform: {
      zoom: {
        type: Number,
        default: 1,
      },
      x: {
        type: Number,
        default: 0,
      },
      y: {
        type: Number,
        default: 0,
      },
    },
  },
  { _id: false }
);

const pageLayoutSchema = new mongoose.Schema(
  {
    pageNumber: {
      type: Number,
      required: true,
    },
    slotAssignments: [slotAssignmentSchema],
  },
  { _id: false }
);

const bookAlbumSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    curateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curate',
      required: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
    },
    templateName: {
      type: String,
      default: '',
    },
    albumName: {
      type: String,
      default: '',
    },
    albumType: {
      type: String,
      enum: ['Wedding', 'Engagement'],
      default: 'Wedding',
    },
    mainSiteShowStatus: {
      type: Boolean,
      default: false,
    },
    pageLayouts: [pageLayoutSchema],
    totalPages: {
      type: Number,
      default: 1,
    },
    totalSlots: {
      type: Number,
      default: 0,
    },
    filledSlots: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'saved', 'published', 'archived'],
      default: 'draft',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    endPhoto: {
      type: String,
      default: '',
    },
    endPhotoName: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const BookAlbum = mongoose.model('BookAlbum', bookAlbumSchema);

export default BookAlbum;
