import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Blog publishing, SEO overrides and categories.
 * Existing posts were always public, so they become `published` with publishedAt = createdAt;
 * new posts default to `draft`.
 */
export class BlogPublishingSeoCategories1780100000000 implements MigrationInterface {
  name = 'BlogPublishingSeoCategories1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "post_status" AS ENUM ('draft', 'published')`);
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN "coverAlt" varchar(300),
        ADD COLUMN "status" "post_status" NOT NULL DEFAULT 'draft',
        ADD COLUMN "publishedAt" timestamptz,
        ADD COLUMN "seoTitle" varchar(200),
        ADD COLUMN "seoDescription" varchar(500),
        ADD COLUMN "ogImageUrl" varchar(1024),
        ADD COLUMN "canonicalUrl" varchar(1024)
    `);
    await queryRunner.query(
      `UPDATE "posts" SET "status" = 'published', "publishedAt" = "createdAt"`,
    );
    await queryRunner.query(
      `CREATE INDEX "posts_status_published_id_idx" ON "posts" ("status", "publishedAt", "id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "post_categories" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "post_categories_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "post_categories_slug_uniq" ON "post_categories" ("slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE "post_category_links" (
        "postId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "position" smallint NOT NULL,
        CONSTRAINT "post_category_links_pk" PRIMARY KEY ("postId", "categoryId"),
        CONSTRAINT "post_category_links_post_fk" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "post_category_links_category_fk" FOREIGN KEY ("categoryId") REFERENCES "post_categories"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "post_category_links_category_idx" ON "post_category_links" ("categoryId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_category_links"`);
    await queryRunner.query(`DROP TABLE "post_categories"`);
    await queryRunner.query(`DROP INDEX "posts_status_published_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "posts"
        DROP COLUMN "canonicalUrl",
        DROP COLUMN "ogImageUrl",
        DROP COLUMN "seoDescription",
        DROP COLUMN "seoTitle",
        DROP COLUMN "publishedAt",
        DROP COLUMN "status",
        DROP COLUMN "coverAlt"
    `);
    await queryRunner.query(`DROP TYPE "post_status"`);
  }
}
