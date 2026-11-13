import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables whose `id` was a random v4 (`gen_random_uuid()`). */
const TABLES = [
  'users',
  'user_identities',
  'email_verifications',
  'refresh_tokens',
  'password_resets',
  'posts',
] as const;

/**
 * New rows get time-ordered UUID v7 ids from Postgres 18's `uuidv7()`. Existing v4 ids stay as
 * they are: rewriting primary keys would mean rewriting every foreign key that points at them,
 * and both versions are valid UUIDs. (post_categories is created with the v7 default already.)
 */
export class UuidV7Defaults1780200000000 implements MigrationInterface {
  name = 'UuidV7Defaults1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT uuidv7()`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
    }
  }
}
