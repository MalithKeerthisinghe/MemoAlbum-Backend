import mongoose from 'mongoose';

const curateMediaSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
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
  },
  { _id: false }
);

const curateSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pageSlug: {
      type: String,
      default: 'photographer-admin/curate',
      index: true,
    },
    albumName: {
      type: String,
      required: true,
      trim: true,
    },
    weddingDate: {
      type: Date,
      default: null,
    },
    accessControl: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    coverPhoto: {
      type: String,
      default: '',
    },
    coverPhotoName: {
      type: String,
      default: '',
    },
    mediaItems: {
      type: [curateMediaSchema],
      default: [],
    },
    selectedTemplate: {
      type: String,
      default: 'template-1',
    },
    status: {
      type: String,
      enum: ['save_draft', 'saved', 'draft', 'published'],
      default: 'save_draft',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

curateSchema.index({ photographerId: 1, pageSlug: 1 }, { unique: true });

export default mongoose.model('Curate', curateSchema);
