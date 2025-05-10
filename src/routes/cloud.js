import express from 'express';
import { getAuth, getFolderAllItems, getFolderItems, getPreview, getRedirect, getSearchItems, saveFilesfromFolder } from '../controllers/cloud.js';
const router = express.Router();


router.get('/auth/google', getAuth)

router.get('/google/redirect', getRedirect)

router.get('/files/:folderId', getFolderItems)

router.get('/search', getSearchItems)

router.get('/preview/:id', getPreview)

router.get('/allfiles/:folderId', getFolderAllItems)


router.post('/saveFolders/:folderId', saveFilesfromFolder)
export default router;