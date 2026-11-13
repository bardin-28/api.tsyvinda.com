import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-language content (English default, Ukrainian). A post's title, text, cover and SEO move
 * to `post_translations` and a category's name to `post_category_translations`, one row per
 * language. Everything that already exists becomes the English version.
 */
export class ContentLocales1780500000000 implements MigrationInterface {
  name = 'ContentLocales1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."content_locale" AS ENUM('en', 'uk')`);

    await queryRunner.query(`
      CREATE TABLE "post_translations" (
        "postId" uuid NOT NULL,
        "locale" "public"."content_locale" NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" character varying(500),
        "htmlContent" text NOT NULL,
        "imageUrl" character varying(1024),
        "coverAlt" character varying(300),
        "seoTitle" character varying(200),
        "seoDescription" character varying(500),
        "ogImageUrl" character varying(1024),
        "canonicalUrl" character varying(1024),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bb6d2f08ca4eee7cbf4eb5a880b" PRIMARY KEY ("postId", "locale")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "post_translations" ADD CONSTRAINT "FK_3126ef698564ac88f6dcceabdf8" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      INSERT INTO "post_translations" ("postId", "locale", "title", "description", "htmlContent",
        "imageUrl", "coverAlt", "seoTitle", "seoDescription", "ogImageUrl", "canonicalUrl",
        "createdAt", "updatedAt")
      SELECT "id", 'en', "title", "description", "htmlContent", "imageUrl", "coverAlt",
        "seoTitle", "seoDescription", "ogImageUrl", "canonicalUrl", "createdAt", "updatedAt"
      FROM "posts"
    `);
    for (const column of [
      'title',
      'description',
      'htmlContent',
      'imageUrl',
      'coverAlt',
      'seoTitle',
      'seoDescription',
      'ogImageUrl',
      'canonicalUrl',
    ]) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "${column}"`);
    }

    await queryRunner.query(`
      CREATE TABLE "post_category_translations" (
        "categoryId" uuid NOT NULL,
        "locale" "public"."content_locale" NOT NULL,
        "name" character varying(100) NOT NULL,
        CONSTRAINT "PK_e268379219132a2ad487ac7489c" PRIMARY KEY ("categoryId", "locale")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "post_category_translations" ADD CONSTRAINT "FK_e271eec4a60d1f876b64ca61428" FOREIGN KEY ("categoryId") REFERENCES "post_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      INSERT INTO "post_category_translations" ("categoryId", "locale", "name")
      SELECT "id", 'en', "name" FROM "post_categories"
    `);
    await queryRunner.query(`ALTER TABLE "post_categories" DROP COLUMN "name"`);
  }

  // Keeps the English version; other languages are lost. A post or category without an English
  // version falls back to its first other language so the NOT NULL columns can be filled.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post_categories" ADD "name" character varying(100)`);
    await queryRunner.query(`
      UPDATE "post_categories" category SET "name" = translation."name"
      FROM (
        SELECT DISTINCT ON ("categoryId") "categoryId", "name" FROM "post_category_translations"
        ORDER BY "categoryId", ("locale" = 'en') DESC, "locale"
      ) translation
      WHERE translation."categoryId" = category."id"
    `);
    await queryRunner.query(`UPDATE "post_categories" SET "name" = "slug" WHERE "name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "post_categories" ALTER COLUMN "name" SET NOT NULL`);
    await queryRunner.query(`DROP TABLE "post_category_translations"`);

    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD "title" character varying(200),
        ADD "description" character varying(500),
        ADD "htmlContent" text,
        ADD "imageUrl" character varying(1024),
        ADD "coverAlt" character varying(300),
        ADD "seoTitle" character varying(200),
        ADD "seoDescription" character varying(500),
        ADD "ogImageUrl" character varying(1024),
        ADD "canonicalUrl" character varying(1024)
    `);
    await queryRunner.query(`
      UPDATE "posts" post SET
        "title" = translation."title",
        "description" = translation."description",
        "htmlContent" = translation."htmlContent",
        "imageUrl" = translation."imageUrl",
        "coverAlt" = translation."coverAlt",
        "seoTitle" = translation."seoTitle",
        "seoDescription" = translation."seoDescription",
        "ogImageUrl" = translation."ogImageUrl",
        "canonicalUrl" = translation."canonicalUrl"
      FROM (
        SELECT DISTINCT ON ("postId") * FROM "post_translations"
        ORDER BY "postId", ("locale" = 'en') DESC, "locale"
      ) translation
      WHERE translation."postId" = post."id"
    `);
    await queryRunner.query(
      `UPDATE "posts" SET "title" = "slug", "htmlContent" = '' WHERE "title" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "title" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "htmlContent" SET NOT NULL`);
    await queryRunner.query(`DROP TABLE "post_translations"`);
    await queryRunner.query(`DROP TYPE "public"."content_locale"`);
  }
}
