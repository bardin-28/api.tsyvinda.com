import { MigrationInterface, QueryRunner } from 'typeorm';

// Repoint stored image URLs from the raw S3 bucket base to the CloudFront CDN
// base. Backend stores full public URLs (built from S3_PUBLIC_URL), and
// S3Service.keyFromUrl() strips that base on delete — so existing rows must be
// rewritten to match the new S3_PUBLIC_URL or deletes/dedup break.
//
// Keep these in sync with helm values-prod.yaml S3_PUBLIC_URL.
const OLD_BASE = 'https://tsyvinda-prod-storage.s3.eu-central-1.amazonaws.com';
const NEW_BASE = 'https://cdn.tsyvinda.com';

export class CloudfrontImageUrls1779900000000 implements MigrationInterface {
  name = 'CloudfrontImageUrls1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, OLD_BASE, NEW_BASE);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, NEW_BASE, OLD_BASE);
  }

  private async rewrite(queryRunner: QueryRunner, from: string, to: string): Promise<void> {
    await queryRunner.query(
      `UPDATE "posts" SET "imageUrl" = REPLACE("imageUrl", $1, $2) WHERE "imageUrl" LIKE $3`,
      [from, to, `${from}%`],
    );
    await queryRunner.query(
      `UPDATE "users" SET "profileImageUrl" = REPLACE("profileImageUrl", $1, $2) WHERE "profileImageUrl" LIKE $3`,
      [from, to, `${from}%`],
    );
  }
}
