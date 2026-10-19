import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const allowed = new Set(['video/mp4','video/webm','video/quicktime','application/pdf','image/png','image/jpeg','text/plain']);
const MAX_BYTES = 5 * 1024 * 1024 * 1024;
const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-160) || 'upload';

export const handler: APIGatewayProxyHandler = async (event) => {
  const origin = event.headers.origin ?? event.headers.Origin;
  if (origin !== process.env.ALLOWED_ORIGIN) return { statusCode: 403, body: JSON.stringify({ message: 'Origin not allowed' }) };
  try {
    const body = JSON.parse(event.body || '{}');
    if (!allowed.has(body.contentType) || !Number.isSafeInteger(body.size) || body.size < 1 || body.size > MAX_BYTES) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Unsupported type or file size' }) };
    }
    const subject = event.requestContext.authorizer?.claims?.sub || 'unknown';
    const key = `uploads/${subject}/${new Date().toISOString().slice(0,10)}/${randomUUID()}-${safeName(body.fileName || '')}`;
    const command = new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, ContentType: body.contentType, ContentLength: body.size, Metadata: { uploadedBy: subject } });
    const url = await getSignedUrl(s3, command, { expiresIn: 900 });
    return { statusCode: 200, headers: { 'content-type':'application/json', 'access-control-allow-origin': process.env.ALLOWED_ORIGIN! }, body: JSON.stringify({ url, key, expiresIn: 900 }) };
  } catch { return { statusCode: 400, body: JSON.stringify({ message: 'Invalid upload request' }) }; }
};
