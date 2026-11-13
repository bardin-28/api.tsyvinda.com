import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Media library: one row per stored image (uploads from posts, avatars, pages and the Media
 * page). Images content already used are registered on boot by MediaImportService (it knows the
 * storage's public URL), so this only creates the table.
 */
export class CreateMedia1780700000000 implements MigrationInterface {
  name = 'CreateMedia1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "url" character varying(1024) NOT NULL,
        "fileName" character varying(255),
        "mimeType" character varying(100),
        "size" integer,
        "uploadedById" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "media_pk" PRIMARY KEY ("id"),
        CONSTRAINT "media_uploaded_by_fk" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "media_url_uniq" ON "media" ("url")`);
    await queryRunner.query(`CREATE INDEX "media_created_at_idx" ON "media" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media"`);
  }
}
