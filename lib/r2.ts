import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Cloudflare R2 credentials.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

function getBucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Missing R2_BUCKET_NAME.");
  return bucket;
}

export function createEventPrefix(slotId: string, eventName: string) {
  const safeName = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `events/${slotId}/${Date.now()}-${safeName || "event"}/`;
}

export function createObjectKey(prefix: string, fileName: string) {
  const safeName = fileName
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .trim()
    .slice(0, 140);

  return `${prefix}${crypto.randomUUID()}-${safeName || "photo"}`;
}

export async function createPresignedUploadUrl(objectKey: string, mimeType: string, sizeBytes: number) {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: objectKey,
    ContentType: mimeType
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 10 });
}

export async function uploadObject(objectKey: string, body: Buffer, mimeType: string) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: body,
      ContentType: mimeType
    })
  );
}

export async function assertObjectExists(objectKey: string) {
  await getR2Client().send(
    new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey
    })
  );
}

export async function deletePrefix(prefix: string) {
  const client = getR2Client();
  const bucket = getBucketName();
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );

    for (const object of listed.Contents ?? []) {
      if (!object.Key) continue;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);
}

export async function getObjectStream(objectKey: string, range?: string) {
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Range: range
    })
  );

  return {
    contentLength: response.ContentLength,
    contentRange: response.ContentRange,
    contentType: response.ContentType,
    stream: response.Body as Readable
  };
}

export async function getObjectMetadata(objectKey: string) {
  const response = await getR2Client().send(
    new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey
    })
  );

  return {
    contentLength: response.ContentLength,
    contentType: response.ContentType
  };
}
