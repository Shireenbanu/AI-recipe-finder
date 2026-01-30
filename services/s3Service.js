// At the top of your main entry file (index.js)
import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//   }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Upload file to S3
export async function uploadFile(file, userId) {
  const fileName = `lab-reports/${userId}/${Date.now()}-${file.originalname}`;
  console.log(BUCKET_NAME)
  console.log("Inside the upload block")

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: {
      userId: userId,
      uploadedAt: new Date().toISOString()
    }
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    return {
      fileName: fileName,
      fileUrl: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
    };
    
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error('Failed to upload file to S3');
  }
  finally{
    const duration = Date.now() - start;
    // 1. Log the individual performance event for Splunk/Terminal
    logPerformance(req, 'S3_UPLOAD', duration, { 
      file_name: file.originalname,
      bucket: BUCKET_NAME,
      file_type: file.mimetype,
      file_size: file.size 
    });
    
    if (req.journey) {
      req.journey.segments.s3_upload_ms = duration;
    }
  }
}

// Generate signed URL (valid for 1 hour)
export async function getSignedFileUrl(fileURL) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileURL
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('S3 Signed URL Error:', error);
    throw new Error('Failed to generate file URL');
  }
}