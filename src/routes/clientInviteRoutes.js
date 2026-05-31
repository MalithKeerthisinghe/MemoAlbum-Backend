import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createClientInvite, listAssignedInviteAlbums, listClientInvites, uploadAssignedAlbumMedia } from '../controllers/clientInviteController.js';

const router = express.Router();

router.use(protect);
router.get('/', listClientInvites);
router.get('/assigned-albums', listAssignedInviteAlbums);
router.post('/', createClientInvite);
router.post('/:albumId/media', uploadAssignedAlbumMedia);

export default router;
