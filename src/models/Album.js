import mongoose from 'mongoose';

const albumSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    albumName: {
      type: String,
      required: true,
    },
    weddingDate: {
      type: Date,
      required: true,
    },
    accessControl: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
    },
    coverPhoto: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    publishProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    albumTypes: [
      {
        type: String,
        enum: ['images', 'videos', 'highlights', 'timeline'],
      },
    ],
    mediaCount: {
      images: { type: Number, default: 0 },
      videos: { type: Number, default: 0 },
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    inviteEmail: {
      type: [String],
      default: [],
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
    templateName: {
      type: String,
      default: '',
    },
    meta: {
      totalPages: Number,
      estimatedTime: String,
      style: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Album', albumSchema);
