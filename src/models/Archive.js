import mongoose from 'mongoose';

const archiveSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    archiveFolderName: {
      type: String,
      required: true,
      trim: true,
    },
    archivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

archiveSchema.index({ albumId: 1, photographerId: 1 }, { unique: true });

export default mongoose.model('Archive', archiveSchema);
