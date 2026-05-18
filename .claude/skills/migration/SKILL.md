---
name: migration
description: Create or run a TypeORM migration the project way. Generates against src/migrations/ using the AppDataSource. Triggers on "/migration", "create a migration", "run migrations", "generate migration <name>".
---

# migration

Manage TypeORM migrations for this project. Migrations live at `src/migrations/`. The `AppDataSource` is exported from `src/config/database.ts`.

## Background

- In **dev**, `synchronize: true` is on (see `src/config/database.ts`) — TypeORM auto-applies entity changes at boot, so most dev work needs no migration.
- Migrations matter for **prod**: `synchronize` is off there. Any entity change destined for `.env.production` needs a migration.
- TypeORM CLI is not listed in `package.json` scripts. Run via `tsx` (a devDep already present).

## Generate a migration from entity diff

```bash
npx tsx ./node_modules/typeorm/cli.js migration:generate \
  src/migrations/<Name> \
  -d src/config/database.ts
```

- `<Name>` is PascalCase, descriptive (`AddUserEmailIndex`, not `Migration1`). TypeORM appends a timestamp.
- Requires the database to be reachable with the diff state already auto-synced in dev. If `synchronize` already applied the change locally, generate-from-diff produces an empty migration — in that case, drop and recreate the dev schema first, or write the migration by hand (next section).

## Write a migration by hand

```bash
npx tsx ./node_modules/typeorm/cli.js migration:create src/migrations/<Name>
```

Edit the generated file's `up` / `down` to use `queryRunner.query(...)` or the TypeORM schema builder.

## Run pending migrations

```bash
npx tsx ./node_modules/typeorm/cli.js migration:run -d src/config/database.ts
```

## Revert the last migration

```bash
npx tsx ./node_modules/typeorm/cli.js migration:revert -d src/config/database.ts
```

## Rules

- Don't commit a migration without running it locally and confirming `up` + `down` both succeed.
- Don't modify a migration that's already been merged to `main` — write a new one to fix it.
- The migrations glob in `database.ts` is `src/migrations/**/*.{ts,js}` — keep new files in that path.
- Be careful with `synchronize: true` in dev — it can mask the need for a real migration. When in doubt, test the migration against a fresh database.

## When the user asks for "/migration <name>"

1. Ask if they want **generate from diff** (entity already changed) or **create blank** (writing SQL by hand).
2. Confirm the connection target — local Postgres is the default; never run migrations against prod from this machine.
3. Run the appropriate command. Show the generated file path and read it back to confirm content.