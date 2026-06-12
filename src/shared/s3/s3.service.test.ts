import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Service } from './s3.service';

const send = vi.fn().mockResolvedValue({});

// vi.mock is hoisted above the imports above.
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
    destroy = vi.fn();
  },
  PutObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

// vitest env sets S3_BUCKET=test-bucket, S3_PUBLIC_URL=http://localhost:4566/test-bucket.
describe('S3Service', () => {
  beforeEach(() => send.mockClear());

  const service = new S3Service();
  const lastCmd = () => send.mock.calls.at(-1)?.[0];

  it('put uploads and returns the public URL', async () => {
    const url = await service.put('posts/abc.jpg', Buffer.from('x'), 'image/jpeg');
    expect(url).toBe('http://localhost:4566/test-bucket/posts/abc.jpg');
    expect(send).toHaveBeenCalledOnce();
    const cmd = lastCmd();
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'posts/abc.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('keyFromUrl derives the key only for matching base', () => {
    expect(service.keyFromUrl('http://localhost:4566/test-bucket/posts/abc.jpg')).toBe(
      'posts/abc.jpg',
    );
    expect(service.keyFromUrl('https://other.example/x.jpg')).toBeNull();
    expect(service.keyFromUrl(null)).toBeNull();
    expect(service.keyFromUrl(undefined)).toBeNull();
  });

  it('deleteByUrl sends a delete for an owned URL', async () => {
    await service.deleteByUrl('http://localhost:4566/test-bucket/profile/x.png');
    expect(send).toHaveBeenCalledOnce();
    const cmd = lastCmd();
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'test-bucket', Key: 'profile/x.png' });
  });

  it('deleteByUrl is a no-op for a foreign or empty URL', async () => {
    await service.deleteByUrl('https://other.example/x.jpg');
    await service.deleteByUrl(null);
    expect(send).not.toHaveBeenCalled();
  });
});
