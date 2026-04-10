import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimiterOptions {
  bucketName: string;
  windowMs: number;
  maxRequests: number;
}

interface RateLimitRecord {
  timestamps: number[];
}

export default function rateLimiter({
  bucketName,
  windowMs,
  maxRequests,
}: RateLimiterOptions) {
  const s3Client = new S3Client({});

  return async (context: Context, next: Next) => {
    const clientIp = getClientIp(context);
    const now = Date.now();
    const key = `rate-limits/${sanitizeIpForKey(clientIp)}.json`;

    const { record, etag } = await readRecord(s3Client, bucketName, key);
    const recentTimestamps = record.timestamps.filter(
      (t) => now - t < windowMs,
    );

    if (recentTimestamps.length >= maxRequests) {
      throw new HTTPException(429, { message: "Too many requests" });
    }

    recentTimestamps.push(now);
    const written = await writeRecord(s3Client, bucketName, key, etag, {
      timestamps: recentTimestamps,
    });

    // If the conditional write failed, another concurrent request modified
    // the record first. Reject this request as rate-limited to be safe.
    if (!written) {
      throw new HTTPException(429, { message: "Too many requests" });
    }

    await next();
  };
}

function getClientIp(context: Context): string {
  // CloudFront-Viewer-Address is set by CloudFront itself and cannot be
  // spoofed by the client. Prefer it over X-Forwarded-For, which is trivially
  // spoofable (attackers can prepend arbitrary IPs to bypass rate limiting).
  const viewerAddress = context.req.header("cloudfront-viewer-address");
  if (viewerAddress) {
    // Format is "ip:port" — strip the port
    return viewerAddress.split(":")[0]!.trim();
  }

  // Fallback: use the *last* entry in X-Forwarded-For. CloudFront appends
  // the real client IP, so the rightmost IP is the most trustworthy.
  // Previously this used the *first* entry, which allowed attackers to
  // bypass rate limiting by setting an arbitrary X-Forwarded-For header.
  const forwarded = context.req.header("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1]!.trim();
  }
  return context.req.header("x-real-ip") ?? "unknown";
}

function sanitizeIpForKey(ip: string): string {
  return ip.replace(/[^a-zA-Z0-9.-]/g, "_");
}

interface ReadResult {
  record: RateLimitRecord;
  etag: string | null;
}

async function readRecord(
  s3Client: S3Client,
  bucketName: string,
  key: string,
): Promise<ReadResult> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    const text = await result.Body!.transformToString();
    return {
      record: JSON.parse(text) as RateLimitRecord,
      etag: result.ETag ?? null,
    };
  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      return { record: { timestamps: [] }, etag: null };
    }
    throw error;
  }
}

async function writeRecord(
  s3Client: S3Client,
  bucketName: string,
  key: string,
  etag: string | null,
  record: RateLimitRecord,
): Promise<boolean> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(record),
        ContentType: "application/json",
        // Conditional write: if we read an existing record, only overwrite if
        // it hasn't changed (IfMatch). If the record was new, only create if
        // no one else created it first (IfNoneMatch).
        ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
      }),
    );
    return true;
  } catch (error: any) {
    if (
      error.name === "PreconditionFailed" ||
      error.name === "ConditionalCheckFailed" ||
      error.$metadata?.httpStatusCode === 412
    ) {
      return false;
    }
    throw error;
  }
}
