import * as S3Service from '../services/s3Service.js';
import { logFileUpload, logFileUploadError, logSuspiciousFileUpload } from '../services/splunkLogger.js';
import {saveFileNameForFutureUse} from '../models/User.js'
export async function uploadLabReport(req, res) {
  const startTime = Date.now();
  
  try {
    const { userId } = req.body;
    const file = req.file;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Security checks
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      logSuspiciousFileUpload(req, file, 'Invalid file type');
      return res.status(400).json({
        success: false,
        error: 'Only PDF and image files are allowed'
      });
    }

    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      logSuspiciousFileUpload(req, file, 'File too large');
      return res.status(400).json({
        success: false,
        error: 'File size must be less than 10MB'
      });
    }

    // Upload to S3
    const result = await S3Service.uploadFile(file, userId);
    // Save to user
    console.log(result.fileUrl, userId)
    saveFileNameForFutureUse(result.fileName, userId)

    // Log success
    req.uploadDuration = Date.now() - startTime;
    logFileUpload(req, file, result);

    res.json({
      success: true,
      file: {
        fileName: file.originalname,
        fileUrl: result.fileUrl,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logFileUploadError(req, req.file, error);
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file'
    });
  }
}