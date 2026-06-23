import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const mimeTypeToExtension = (mimeType = '') => {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4':       'mp4',
    'video/quicktime': 'mov',
    'video/webm':      'webm',
    'video/ogg':       'ogv',
  };
  return map[mimeType.toLowerCase()] || mimeType.split('/').pop() || 'bin';
};

export const uploadBase64ToS3 = async (dataUrl, s3Key, mimeType) => {
  const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    },
  });

  await upload.done();

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};

export const deleteFromS3 = async (fileUrl) => {
  try {
    if (!fileUrl) return;
    const bucketBase = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    if (!fileUrl.startsWith(bucketBase)) return;
    const key = fileUrl.replace(bucketBase, '');
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    }));
    console.log(`Deleted from S3: ${key}`);
  } catch (err) {
    console.error('S3 delete error:', err);
  }
};