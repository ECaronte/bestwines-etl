import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config, log } from "../config.js";

const s3 = new S3Client({ region: config.awsRegion });

export async function putTextToS3(params: {
  bucket: string;
  key: string;
  text: string;
  contentType: string;
}) {
  if (config.dryRun) {
    log("info", "DRY_RUN=1 -> skipping S3 putObject", {
      bucket: params.bucket,
      key: params.key,
      bytes: params.text.length,
    });
    return;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.text,
      ContentType: params.contentType,
      CacheControl: "no-cache",
    }),
  );

  log("info", "Uploaded to S3", {
    bucket: params.bucket,
    key: params.key,
    bytes: params.text.length,
  });
}
