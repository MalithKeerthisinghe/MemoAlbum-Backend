import Template from '../models/Template.js';

const isAdminUser = (req) => req.user?.role?.toLowerCase?.() === 'admin';

const normalizeSlots = (slots = []) =>
  slots
    .filter((slot) => slot && typeof slot === 'object')
    .map((slot, index) => ({
      id: slot.id || `slot-${index + 1}`,
      label: slot.label || '',
      kind: slot.kind || 'frame',
      shape: slot.shape || 'square',
      x: Number.isFinite(Number(slot.x)) ? Number(slot.x) : 0,
      y: Number.isFinite(Number(slot.y)) ? Number(slot.y) : 0,
      width: Number.isFinite(Number(slot.width)) ? Number(slot.width) : 1,
      height: Number.isFinite(Number(slot.height)) ? Number(slot.height) : 1,
      emphasis: slot.emphasis || 'default',
    }));

const normalizePages = (pages = []) =>
  pages
    .filter((page) => page && typeof page === 'object')
    .map((page, index) => ({
      pageNumber: Number.isFinite(Number(page.pageNumber)) ? Number(page.pageNumber) : index + 1,
      pageLabel: page.pageLabel || `Page ${Number.isFinite(Number(page.pageNumber)) ? Number(page.pageNumber) : index + 1}`,
      presetKey: page.presetKey || 'mosaic-portrait',
      accent: page.accent || '#9b0044',
      slots: normalizeSlots(Array.isArray(page.slots) ? page.slots : []),
    }))
    .sort((left, right) => left.pageNumber - right.pageNumber);

export const listTemplates = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({ success: false, message: 'Only admin users can view templates' });
    }

    const templates = await Template.find().sort({ updatedAt: -1, createdAt: -1 });

    return res.json({ success: true, templates });
  } catch (error) {
    console.error('List Templates Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({ success: false, message: 'Only admin users can view templates' });
    }

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.json({ success: true, template });
  } catch (error) {
    console.error('Get Template Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const saveTemplate = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({ success: false, message: 'Only admin users can save templates' });
    }

    const templateId = req.params.id || req.body.templateId;
    const { name, presetKey, description, slots, pages, accent, isActive } = req.body;

    if (!name || !presetKey) {
      return res.status(400).json({ success: false, message: 'Template name and preset are required' });
    }

    const payload = {
      name,
      presetKey,
      description: description || '',
      slots: normalizeSlots(Array.isArray(slots) ? slots : []),
      pages: normalizePages(Array.isArray(pages) ? pages : []),
      accent: accent || '#9b0044',
      isActive: isActive !== false,
      updatedBy: req.user?._id || req.user?.id || null,
    };

    let template = null;

    if (templateId) {
      template = await Template.findByIdAndUpdate(templateId, { $set: payload }, { new: true, runValidators: true });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
    } else {
      template = await Template.create({
        ...payload,
        createdBy: req.user?._id || req.user?.id || null,
      });
    }

    return res.status(templateId ? 200 : 201).json({
      success: true,
      message: 'Template saved successfully',
      template,
    });
  } catch (error) {
    console.error('Save Template Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({ success: false, message: 'Only admin users can delete templates' });
    }

    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete Template Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};