---
name: new-module
description: Scaffold a new feature module under src/modules/<name>/ following the project's routes/controller/(service/entity) pattern. Wires the router into src/app.ts and adds an @openapi JSDoc block. Triggers on "/new-module <name>", "scaffold module <name>", "create a new module".
---

# new-module

Create a new feature module at `src/modules/<name>/` that matches the existing pattern (see `src/modules/health/` for the canonical example).

## Inputs

- `<name>`: kebab-case, singular noun (e.g. `user`, `auth-token`). Module dir name, file prefix, and default mount path all derive from this.
- Ask the user: does this module need an **entity** (DB-backed) and/or a **service** (logic beyond a one-liner)? Default: routes + controller only.

## Steps

1. **Confirm the name doesn't collide.** `ls src/modules/` — if `<name>/` exists, ask before proceeding.

2. **Create `src/modules/<name>/<name>.controller.ts`** — one handler stub:
   ```ts
   import { Request, Response } from 'express';

   export async function list<Name>(_req: Request, res: Response): Promise<void> {
     res.json({ items: [] });
   }
   ```
   Replace `<Name>` with PascalCase of `<name>`.

3. **Create `src/modules/<name>/<name>.routes.ts`** — `Router` with the swagger JSDoc block above the route (must be on this file; that's where the swagger glob looks):
   ```ts
   import { Router } from 'express';
   import { list<Name> } from './<name>.controller';

   /**
    * @openapi
    * /<name>:
    *   get:
    *     summary: List <name>
    *     tags: [<Name>]
    *     responses:
    *       200:
    *         description: OK
    */
   const router = Router();
   router.get('/', list<Name>);

   export default router;
   ```

4. **If user said "entity"**: create `src/modules/<name>/<name>.entity.ts` with a TypeORM `@Entity()` class — id (uuid or int), createdAt, updatedAt. Remind the user: in dev `synchronize: true` auto-applies; in prod they'll need a migration.

5. **If user said "service"**: create `src/modules/<name>/<name>.service.ts` exporting plain functions or a class — controller imports from it. No DI framework in this repo, just plain modules.

6. **Wire into `src/app.ts`**: add the import alongside `healthRouter` and `app.use('/<name>', <name>Router);` next to the other `app.use` mounts. Match the existing ordering (imports grouped at top, mounts grouped near the bottom).

7. **Add a smoke test** at `src/modules/<name>/<name>.test.ts` (Vitest, project rule is tests for new features). Minimum: import the controller and assert it returns the shape — supertest is fine if the user wants HTTP-level, but it's not a dependency, so add it only if asked.

8. **Run `npm run typecheck && npm run lint && npm test`** and report results. Fix surface issues; flag anything deeper.

## Don'ts

- Don't add a service/entity the user didn't ask for.
- Don't put swagger JSDoc on the controller — it won't be picked up.
- Don't install new dependencies (supertest, etc.) without asking.