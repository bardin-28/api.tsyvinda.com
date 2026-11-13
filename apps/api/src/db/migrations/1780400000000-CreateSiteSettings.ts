import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Website-wide settings (single row, id = 1). Seeded with indexing on, which is how the live
 * site behaved before this setting existed.
 */
export class CreateSiteSettings1780400000000 implements MigrationInterface {
  name = 'CreateSiteSettings1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_settings" (
        "id" smallint NOT NULL,
        "indexingEnabled" boolean NOT NULL DEFAULT true,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "site_settings_pk" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `INSERT INTO "site_settings" ("id", "indexingEnabled") VALUES (1, true)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "site_settings"`);
  }
}
