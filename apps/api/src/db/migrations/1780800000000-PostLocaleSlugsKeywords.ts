import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-language post addresses and keywords: a language version may have its own URL segment
 * (null = the post's shared slug, so existing URLs keep working) and its own search keywords.
 */
export class PostLocaleSlugsKeywords1780800000000 implements MigrationInterface {
  name = 'PostLocaleSlugsKeywords1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post_translations" ADD "slug" character varying(200)`);
    await queryRunner.query(
      `ALTER TABLE "post_translations" ADD "keywords" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "post_translations_locale_slug_uniq" ON "post_translations" ("locale", "slug") WHERE "slug" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "post_translations_locale_slug_uniq"`);
    await queryRunner.query(`ALTER TABLE "post_translations" DROP COLUMN "keywords"`);
    await queryRunner.query(`ALTER TABLE "post_translations" DROP COLUMN "slug"`);
  }
}
