import * as Minio from "minio";
import { config } from "./env.js";

export const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export const initializeMinio = async () => {
  const bucketName = config.minio.avatarsBucket;
  try {
    console.log(`[MinIO] Checking bucket "${bucketName}"...`);
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log(`[MinIO] Bucket "${bucketName}" created successfully.`);

      // Set read-only policy for public access so avatars can be served directly via Nginx
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
      console.log(`[MinIO] Public read-only policy set for "${bucketName}" bucket.`);
    } else {
      console.log(`[MinIO] Bucket "${bucketName}" already exists.`);
    }
  } catch (err) {
    console.error("[MinIO] Initialization error:", err);
  }
};
