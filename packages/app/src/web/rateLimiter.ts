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

    const record = await readRecord(s3Client, bucketName, clientIp);
    const recentTimestamps = record.timestamps.filter(
      (t) => now - t < windowMs,
    );

    if (recentTimestamps.length >= maxRequests) {
      throw new HTTPException(429, { message: "Too many requests" });
    }

    recentTimestamps.push(now);
    await writeRecord(s3Client, bucketName, clientIp, {
      timestamps: recentTimestamps,
    });

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

async function readRecord(
  s3Client: S3Client,
  bucketName: string,
  ip: string,
): Promise<RateLimitRecord> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: `rate-limits/${sanitizeIpForKey(ip)}.json`,
      }),
    );
    const text = await result.Body!.transformToString();
    return JSON.parse(text) as RateLimitRecord;
  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      return { timestamps: [] };
    }
    throw error;
  }
}

async function writeRecord(
  s3Client: S3Client,
  bucketName: string,
  ip: string,
  record: RateLimitRecord,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: `rate-limits/${sanitizeIpForKey(ip)}.json`,
      Body: JSON.stringify(record),
      ContentType: "application/json",
    }),
  );
}
