import mongoose from 'mongoose';

const templateSlotSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      default: '',
    },
    kind: {
      type: String,
      default: 'frame',
    },
    shape: {
      type: String,
      default: 'square',
    },
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 1,
    },
    height: {
      type: Number,
      default: 1,
    },
    emphasis: {
      type: String,
      default: 'default',
    },
  },
  { _id: false }
);

const templatePageSchema = new mongoose.Schema(
  {
    pageNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    pageLabel: {
      type: String,
      default: '',
    },
    presetKey: {
      type: String,
      required: true,
    },
    accent: {
      type: String,
      default: '#9b0044',
    },
    pageColor: {
      type: String,
      default: '#ffffff',
    },
    slots: {
      type: [templateSlotSchema],
      default: [],
    },
  },
  { _id: false }
);

const templateSpecialPageSchema = new mongoose.Schema(
  {
    pageColor: {
      type: String,
      default: '#ffffff',
    },
    slots: {
      type: [templateSlotSchema],
      default: [],
    },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    presetKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    slots: {
      type: [templateSlotSchema],
      default: [],
    },
    pages: {
      type: [templatePageSchema],
      default: [],
    },
    accent: {
      type: String,
      default: '#9b0044',
    },
    pageColor: {
      type: String,
      default: '#ffffff',
    },
    coverDesign: {
      type: templateSpecialPageSchema,
      default: () => ({ pageColor: '#ffffff', slots: [] }),
    },
    endPageDesign: {
      type: templateSpecialPageSchema,
      default: () => ({ pageColor: '#ffffff', slots: [] }),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Template', templateSchema);