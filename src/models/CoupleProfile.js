import mongoose from 'mongoose';

const galleryMediaSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
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
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadPath: String,        // Added for easier deletion later
    uploadedBy: String,
  },
  { _id: false }
);

const galleryFolderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
    images: {
      type: [galleryMediaSchema],
      default: [],
    },
  },
  { _id: false }
);

const coupleProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    primaryEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    partnerEmail: {
      type: String,
      lowercase: true,
    },
    weddingDate: Date,
    bio: String,
    profilePicture: String,
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
      default: 'pending',
    },

    // ====================== GALLERY STRUCTURE ======================
    galleryFolders: {
      type: [galleryFolderSchema],
      default: [],
    },

    // === NEW: Top-level arrays for fast "All / Photos / Videos" access ===
    allMedia: {
      type: [galleryMediaSchema],
      default: [],
    },
    allPhotos: {
      type: [galleryMediaSchema],
      default: [],
    },
    allVideos: {
      type: [galleryMediaSchema],
      default: [],
    },
  },
  { timestamps: true }
);

coupleProfileSchema.index({ userId: 1 });
coupleProfileSchema.index({ primaryEmail: 1 });
 
export default mongoose.model('CoupleProfile', coupleProfileSchema);