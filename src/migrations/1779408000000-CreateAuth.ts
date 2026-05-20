import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuth1779408000000 implements MigrationInterface {
  name = 'CreateAuth1779408000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "firstName" varchar(50) NOT NULL,
        "lastName" varchar(50) NOT NULL,
        "email" varchar(255) NOT NULL,
        "passwordHash" varchar(255),
        "profileImageUrl" varchar(1024),
        "emailVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "users_email_uq" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "providerUserId" varchar(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "user_identities_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "user_identities_provider_uq" ON "user_identities" ("provider", "providerUserId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "email_verifications" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "consumedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "email_verifications_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "email_verifications_token_hash_uq" ON "email_verifications" ("tokenHash")`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "replacedById" uuid,
        "userAgent" varchar(255),
        "ip" varchar(45),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "refresh_tokens_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "refresh_tokens_token_hash_uq" ON "refresh_tokens" ("tokenHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_identities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
