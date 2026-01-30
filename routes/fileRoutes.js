import express from 'express';
import multer from 'multer';
import * as fileController from '../controllers/fileController.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Upload lab report
router.post('/uploadLabReport', upload.single('file'), fileController.uploadLabReport);
router.get('/presign',fileController.getS3PreSignedURL);


export default router;

