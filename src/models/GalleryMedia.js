import mongoose from 'mongoose';

const galleryMediaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GalleryFolder',
      default: null,
    },
    title: String,
    url: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['photo', 'video'],
      default: 'photo',
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('GalleryMedia', galleryMediaSchema);
