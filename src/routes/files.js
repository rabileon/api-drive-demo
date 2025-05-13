import express from 'express';
import { getFiles, extractGenres, getGenres, searchFiles } from '../controllers/files.js';
const router = express.Router();

router.get('/', getFiles)

router.post('/extractGenres', extractGenres)

router.get('/getGenres', getGenres)

router.get('/searchFiles', searchFiles)

export default router;