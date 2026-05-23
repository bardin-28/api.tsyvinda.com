import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostSlug1779600000000 implements MigrationInterface {
  name = 'AddPostSlug1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "slug" varchar(200)`);
    await queryRunner.query(`UPDATE "posts" SET "slug" = "id"::text WHERE "slug" IS NULL`);
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "slug" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_uniq" ON "posts" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "posts_slug_uniq"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "slug"`);
  }
}
