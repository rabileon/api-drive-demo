import express from 'express';
import { getAuth, listFilesInFolder, getPreview, syncData } from '../controllers/cloud.js';
const router = express.Router();


router.get('/auth/login', getAuth)

router.get('/files/:folderId', listFilesInFolder)

// router.get('/google/redirect', getRedirect)


// router.get('/search', getSearchItems)

router.get('/preview/:id', getPreview)

// router.get('/allfiles/:folderId', getFolderAllItems)

// router.get('/getCountFilesFolder/:folderId', getCountFilesFolder)

router.post('/syncData/:folderId', syncData)

export default router;