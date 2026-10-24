import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePosts1779500000000 implements MigrationInterface {
  name = 'CreatePosts1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "posts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar(200) NOT NULL,
        "description" varchar(500),
        "htmlContent" text NOT NULL,
        "imageUrl" varchar(1024),
        "authorId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "posts_author_fk" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "posts_created_id_idx" ON "posts" ("createdAt", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "posts_author_id_idx" ON "posts" ("authorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "posts_author_id_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "posts_created_id_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "posts"`);
  }
}
