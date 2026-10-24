import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { config } from '../app.config';

// Wraps the S3 client for image uploads. Targets MiniStack locally (via
// S3_ENDPOINT) and real AWS S3 in prod (endpoint omitted → SDK default chain /
// EC2 IAM role). Stores objects under bucket keys; the public URL is built from
// S3_PUBLIC_URL so reads don't depend on the endpoint.
@Injectable()
export class S3Service implements OnApplicationShutdown {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket = config.s3.bucket;
  private readonly publicBase = config.s3.publicUrl.replace(/\/+$/, '');

  constructor() {
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      // MiniStack rejects the SDK's default CRC64NVME request checksum; only
      // compute one when the operation requires it (harmless against real AWS).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials:
        config.s3.accessKeyId && config.s3.secretAccessKey
          ? { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }
          : undefined,
    });
  }

  // Uploads a buffer under `key` and returns its public URL.
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `${this.publicBase}/${key}`;
  }

  // Deletes the object referenced by a stored public URL. No-op when the URL is
  // empty or not under this bucket's public base. Best-effort (logs on failure).
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`delete failed for ${key}: ${String(err)}`);
    }
  }

  // Maps a stored public URL back to its object key. Returns null when the URL
  // doesn't belong to this bucket's public base.
  keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }
}
