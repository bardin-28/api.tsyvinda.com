# Report: react-email Templating + Resend Welcome Email

## Outcome

Integrated `react-email` as a server-side HTML templating engine (no React frontend, no bundler) and wired a `sendWelcomeEmail` flow that renders a `WelcomeEmail` template to an HTML string and sends it through the existing Resend SDK. Styling lives in a dedicated styles module (no Tailwind). A local preview server runs on port 3001.

All phases complete. `npm run typecheck` clean. `npm test` green: **10 files, 85 tests** (3 new for the welcome email).

---

## Files added

```
src/emails/
  WelcomeEmail.tsx                    react-email template, `username` + optional `appUrl` props
  welcome-email.styles.ts             CSSProperties style objects (no Tailwind, no .css)
src/modules/auth/services/
  email.service.test.ts               Vitest, 3 cases (send / error / mock-path)
```

## Files changed

```
package.json            + react, react-dom, @react-email/components, @react-email/render
                        + dev @types/react, @types/react-dom, react-email
                        + script "email:dev": "email dev --dir src/emails --port 3001"
tsconfig.json           + "jsx": "react-jsx"
.gitignore              + .react-email
src/modules/auth/services/email.service.ts
                        + sendWelcomeEmail() method on existing EmailService
src/modules/posts/routes/update.ts
                        - removed stray pasted JSON blob (pre-existing, broke tsc)
```

---

## Phase summary

| Phase | Description | Status |
|---|---|---|
| 1 | Dependencies + `tsconfig` `jsx` | ☑ |
| 2 | Template + styles module | ☑ |
| 3 | `sendWelcomeEmail` in `EmailService` | ☑ |
| 4 | `email:dev` preview script | ☑ |
| 5 | Tests + `.gitignore` | ☑ |
| 6 | This report | ☑ |

### Phase 1
Installed prod (`react`, `react-dom`, `@react-email/components`, `@react-email/render`) and dev (`@types/react`, `@types/react-dom`, `react-email`) packages. `resend` was already a dependency — not reinstalled. Added `"jsx": "react-jsx"` to `compilerOptions`. Local `npm install` warns `EBADENGINE` (node v24 vs project pin `>=22 <23`) — pre-existing environment mismatch, install succeeded.

### Phase 2
`welcome-email.styles.ts` exports typed `CSSProperties` objects (`main`, `container`, `heading`, `paragraph`, `button`). `WelcomeEmail.tsx` composes `Html/Head/Preview/Body/Container/Heading/Text/Button`, no `Tailwind` wrapper, styles applied via `style={}`. Imported styles as a namespace (`import * as styles`) for per-export typing.

### Phase 3
Added `sendWelcomeEmail({ to, username })` to the existing `EmailService` (no second service / Resend client). Renders `html` and `text` (plainText) via `@react-email/render` `render()` (async). Reuses the `apiKey === 'test'` mock short-circuit, `config.email.from`, and `HttpError(502, 'EMAIL_SEND_FAILED', ...)`.

### Phase 3 follow-up (developer request)
`appUrl` made a template prop (default `https://tsyvinda.com`); service injects `config.frontendHost[0]` from `FRONTEND_HOST`. Template stays decoupled from `app.config` so the preview server does not need the full validated env.

### Phase 4
Added `email:dev` script. `npm run email:dev` serves the preview at `http://localhost:3001` from `src/emails`. Not launched during the build (long-running process).

### Phase 5
Added `email.service.test.ts` (3 cases). Added `.react-email` to `.gitignore` (CLI scratch dir). Full suite + typecheck green.

---

## Decisions & deviations

- **`src/emails/`, not root `emails/`** — `tsconfig` `rootDir: "src"` rejects files outside `src`; a root folder breaks `npm run build`.
- **`styles.ts`, not a literal `.css`** — no-bundler + no-Tailwind means external CSS can't be inlined reliably for email clients. The styles module renders to inline styles, which is the honest equivalent of a separate styles file.
- **Reused `auth` `EmailService`** — avoids a duplicate Resend client and config wiring; no new top-level `src/services/` directory (project uses per-module services).
- **API key from `config`** — `config.email.resendApiKey` / `config.email.from`, not raw `process.env` (fail-fast-on-boot contract).
- **Removed stray JSON in `update.ts`** — pre-existing uncommitted paste (a sample request body) that broke `tsc`; removed with developer approval. Unrelated to this feature.

## Test discoveries

- The `resend` mock must be a `class` — a `vi.fn()` arrow implementation is not `new`-able (`EmailService` does `new Resend(apiKey)`).
- `@react-email/render` plain-text output **uppercases heading text**, so the `text` body contains `JANE` while the HTML contains `Jane`. Assertions account for this.

## Wiring (post-Phase-6)

`sendWelcomeEmail` is invoked from `AuthService.confirmEmail` — fires once, after the account is verified (not at registration, which already sends the verification email). Delivery is best-effort: failure is caught and logged (`logger.error`) so it never fails confirmation, since the account is already verified at that point. `username` = the user's `firstName`. `auth.service.test.ts` updated: `makeEmail()` mock gains `sendWelcomeEmail`, and the confirm-success test asserts it is called with `{ to, username }`.

## Follow-ups (out of scope)

- `react-email` install surfaced deprecation warnings for transitive `@react-email/*` sub-packages; harmless, upstream-owned.
