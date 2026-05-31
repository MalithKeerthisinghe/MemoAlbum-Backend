import mongoose from 'mongoose';

const favoritePhotoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'albumRef',
      required: true,
      index: true,
    },
    albumRef: {
      type: String,
      enum: ['Album', 'Curate'],
      default: 'Curate',
    },
    albumName: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      default: '',
    },
    mediaKind: {
      type: String,
      enum: ['image', 'video', 'other'],
      default: 'image',
    },
    sourceType: {
      type: String,
      enum: ['album', 'upload'],
      default: 'album',
    },
  },
  { timestamps: true }
);

favoritePhotoSchema.index({ userId: 1, albumId: 1, url: 1 }, { unique: true });

export default mongoose.model('FavoritePhoto', favoritePhotoSchema);
