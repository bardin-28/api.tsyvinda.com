import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CMS pages: `pages` (draft + version lock), `page_revisions` (published snapshots),
 * `page_slugs` (URL per language, old ones kept for redirects) and `redirects` (set up in the
 * admin panel). Pages are created by the CMS seed.
 */
export class CreateCmsPages1780600000000 implements MigrationInterface {
  name = 'CreateCmsPages1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."page_status" AS ENUM('draft', 'published')`);
    await queryRunner.query(
      `CREATE TYPE "public"."redirect_type" AS ENUM('permanent', 'temporary')`,
    );

    await queryRunner.query(`
      CREATE TABLE "pages" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "key" character varying(50) NOT NULL,
        "draft" jsonb NOT NULL,
        "enabledLocales" "public"."content_locale" array NOT NULL DEFAULT '{en}',
        "status" "public"."page_status" NOT NULL DEFAULT 'draft',
        "version" integer NOT NULL DEFAULT 1,
        "publishedVersion" integer,
        "publishedRevisionId" uuid,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "updatedById" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pages_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "pages_key_uniq" ON "pages" ("key")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "pages_published_revision_uniq" ON "pages" ("publishedRevisionId")`,
    );
    await queryRunner.query(`CREATE INDEX "pages_updated_at_idx" ON "pages" ("updatedAt")`);

    await queryRunner.query(`
      CREATE TABLE "page_revisions" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "pageId" uuid NOT NULL,
        "version" integer NOT NULL,
        "content" jsonb NOT NULL,
        "locales" "public"."content_locale" array NOT NULL,
        "createdById" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "page_revisions_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "page_revisions_page_version_uniq" ON "page_revisions" ("pageId", "version")`,
    );

    await queryRunner.query(`
      CREATE TABLE "page_slugs" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "pageId" uuid NOT NULL,
        "locale" "public"."content_locale" NOT NULL,
        "slug" character varying(100) NOT NULL,
        "scope" character varying(50) NOT NULL DEFAULT '',
        "current" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "page_slugs_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "page_slugs_scope_locale_slug_uniq" ON "page_slugs" ("scope", "locale", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "page_slugs_page_locale_idx" ON "page_slugs" ("pageId", "locale")`,
    );
    // One current segment per page and language (old ones stay for redirects)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "page_slugs_current_uniq" ON "page_slugs" ("pageId", "locale") WHERE "current"`,
    );

    await queryRunner.query(`
      CREATE TABLE "redirects" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "source" character varying(500) NOT NULL,
        "target" character varying(1000) NOT NULL,
        "type" "public"."redirect_type" NOT NULL DEFAULT 'permanent',
        "enabled" boolean NOT NULL DEFAULT true,
        "note" character varying(500),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "redirects_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "redirects_source_uniq" ON "redirects" ("source")`,
    );
    await queryRunner.query(`CREATE INDEX "redirects_target_idx" ON "redirects" ("target")`);

    // Foreign keys (after both page tables exist: pages ↔ page_revisions reference each other)
    const fks: [table: string, name: string, column: string, ref: string, onDelete: string][] = [
      ['pages', 'pages_published_revision_fk', 'publishedRevisionId', 'page_revisions', 'SET NULL'],
      ['pages', 'pages_updated_by_fk', 'updatedById', 'users', 'SET NULL'],
      ['page_revisions', 'page_revisions_page_fk', 'pageId', 'pages', 'CASCADE'],
      ['page_revisions', 'page_revisions_created_by_fk', 'createdById', 'users', 'SET NULL'],
      ['page_slugs', 'page_slugs_page_fk', 'pageId', 'pages', 'CASCADE'],
    ];
    for (const [table, name, column, ref, onDelete] of fks) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${ref}"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "pages_published_revision_fk"`);
    await queryRunner.query(`DROP TABLE "redirects"`);
    await queryRunner.query(`DROP TABLE "page_slugs"`);
    await queryRunner.query(`DROP TABLE "page_revisions"`);
    await queryRunner.query(`DROP TABLE "pages"`);
    await queryRunner.query(`DROP TYPE "public"."redirect_type"`);
    await queryRunner.query(`DROP TYPE "public"."page_status"`);
  }
}
