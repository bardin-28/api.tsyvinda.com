import { MigrationInterface, QueryRunner } from 'typeorm';

/** Admin approval of website accounts was removed; the flag is no longer read or written. */
export class DropUserApprovedByAdmin1780300000000 implements MigrationInterface {
  name = 'DropUserApprovedByAdmin1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "approvedByAdmin"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The original values are gone; restoring the column treats every account as approved.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "approvedByAdmin" boolean NOT NULL DEFAULT true`,
    );
  }
}
