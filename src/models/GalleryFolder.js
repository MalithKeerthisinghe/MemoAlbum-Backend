import mongoose from 'mongoose';

const galleryImageSchema = new mongoose.Schema(
  {
    url: String,
    title: String,
    isFavorite: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const galleryFolderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'Custom',
    },
    images: [galleryImageSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('GalleryFolder', galleryFolderSchema);
