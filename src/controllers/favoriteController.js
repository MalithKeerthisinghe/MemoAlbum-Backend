import FavoritePhoto from '../models/FavoritePhoto.js';
import Curate from '../models/Curate.js';

const getUserId = (req) => req.user?.id || req.user?._id;

export const listFavoritePhotos = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Find Curate docs with mediaItems favorited by this user
    const curates = await Curate.find({ 'mediaItems.favoritedBy': userId }).select('albumName mediaItems');

    const favorites = [];
    for (const curate of curates) {
      const items = (curate.mediaItems || []).filter((m) => Array.isArray(m.favoritedBy) && m.favoritedBy.some((id) => String(id) === String(userId)));
      for (const it of items) {
        favorites.push({
          id: `${curate._id}:${it.id}`,
          albumId: curate._id,
          url: it.dataUrl || '',
          fileName: it.fileName || '',
          mediaKind: it.mediaKind || 'image',
          albumName: curate.albumName || '',
          sourceType: 'curate',
        });
      }
    }

    // Also include legacy FavoritePhoto entries for compatibility
    const legacy = await FavoritePhoto.find({ userId }).sort({ createdAt: -1 });
    for (const f of legacy) {
      favorites.push({ id: f._id, albumId: f.albumId, url: f.url, fileName: f.fileName, mediaKind: f.mediaKind, albumName: f.albumName, sourceType: 'legacy' });
    }

    return res.json({ success: true, favorites });
  } catch (error) {
    console.error('List Favorite Photos Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const addFavoritePhoto = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { albumId, mediaId, url } = req.body || {};

    if (!albumId || (!mediaId && !url)) {
      return res.status(400).json({ success: false, message: 'albumId and mediaId or url are required' });
    }

    const curate = await Curate.findById(albumId);
    if (!curate) return res.status(404).json({ success: false, message: 'Album not found' });

    const mediaItem = (curate.mediaItems || []).find((m) => (mediaId && m.id === mediaId) || (url && (m.dataUrl === url)) );
    if (!mediaItem) return res.status(404).json({ success: false, message: 'Media item not found in album' });

    mediaItem.favoritedBy = mediaItem.favoritedBy || [];
    if (!mediaItem.favoritedBy.some((id) => String(id) === String(userId))) {
      mediaItem.favoritedBy.push(userId);
      await curate.save();
    }

    return res.status(201).json({ success: true, message: 'Favorite saved', favorite: { id: `${curate._id}:${mediaItem.id}`, albumId: curate._id, url: mediaItem.dataUrl } });
  } catch (error) {
    console.error('Add Favorite Photo Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const removeFavoritePhoto = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'id required' });

    // New id format: <curateId>:<mediaId>
    if (id.includes(':')) {
      const [curateId, mediaId] = id.split(':');
      const curate = await Curate.findById(curateId);
      if (!curate) return res.status(404).json({ success: false, message: 'Album not found' });

      const mediaItem = (curate.mediaItems || []).find((m) => m.id === mediaId);
      if (!mediaItem) return res.status(404).json({ success: false, message: 'Media item not found' });

      mediaItem.favoritedBy = (mediaItem.favoritedBy || []).filter((u) => String(u) !== String(userId));
      await curate.save();

      return res.json({ success: true, message: 'Favorite removed' });
    }

    // Fallback to legacy FavoritePhoto delete
    const deleted = await FavoritePhoto.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Favorite not found' });

    return res.json({ success: true, message: 'Favorite removed' });
  } catch (error) {
    console.error('Remove Favorite Photo Error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
