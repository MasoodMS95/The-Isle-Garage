import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
let client: S3Client | undefined;
function storage() {
  if (!process.env.S3_BUCKET)
    throw new Error('Private image storage is not configured');
  return (client ||= new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  }));
}
export function objectFiles() {
  return {
    async put(
      key: string,
      bytes: Uint8Array,
      options: { httpMetadata: { contentType: string } },
    ) {
      await storage().send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: options.httpMetadata.contentType,
        }),
      );
    },
    async get(key: string) {
      try {
        const result = await storage().send(
          new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
        );
        if (!result.Body) return null;
        const body = result.Body;
        return {
          httpMetadata: { contentType: result.ContentType },
          get body() {
            return body.transformToWebStream();
          },
          arrayBuffer: async () => {
            const bytes = await body.transformToByteArray();
            return bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer;
          },
        };
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode: number } }).$metadata
            ?.httpStatusCode === 404
        )
          return null;
        throw error;
      }
    },
  };
}
