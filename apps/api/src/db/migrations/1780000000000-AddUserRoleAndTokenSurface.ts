import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRoleAndTokenSurface1780000000000 implements MigrationInterface {
  name = 'AddUserRoleAndTokenSurface1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN')`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN "surface" varchar(16) NOT NULL DEFAULT 'website'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "surface"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
