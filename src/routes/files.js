import express from 'express';
import { getFiles, extractGenres, getGenres } from '../controllers/files.js';
const router = express.Router();

router.get('/', getFiles)

router.post('/extractGenres', extractGenres)

router.get('/getGenres', getGenres)

export default router;