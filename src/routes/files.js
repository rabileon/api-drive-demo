import express from 'express';
import { getFiles } from '../controllers/files';
const router = express.Router();

router.get('/files', getFiles)