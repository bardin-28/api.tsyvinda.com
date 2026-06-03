# Plan: react-email Templating + Resend Welcome Email (no JIRA)

## Goal

Introduce `react-email` as a server-side HTML templating engine (no React frontend, no bundler) and wire a `sendWelcomeEmail` flow that renders a `WelcomeEmail` template to an HTML string and delivers it through the already-installed Resend SDK. Styling lives in a dedicated styles module (no Tailwind). Add a local preview server script on port 3001.

---

## Requirements

_List of provided requirements from customer_

- **Templating engine** — Use `react-email` purely as a templating engine on the Node.js/TypeScript backend; React is not otherwise used and no frontend bundler may be introduced.
- **Install packages** — Add `react`, `react-dom`, `@react-email/components`, `@react-email/render` (production) plus `@types/react`, `@types/react-dom`, and the `react-email` CLI (dev). `resend` is already a dependency.
- **tsconfig** — Enable `.tsx` compilation by adding a JSX setting to `compilerOptions`.
- **Template** — A `WelcomeEmail` component using built-in `@react-email/components`, accepting a `username` prop.
- **No Tailwind** — Do not use the `Tailwind` wrapper; styling provided via a separate styles file.
- **Service** — A `sendWelcomeEmail` function that imports the template, renders it to a raw HTML string, and sends it via the Resend SDK using the API key from environment config.
- **Preview script** — A dev script launching the local email preview server on port 3001 pointing at the templates directory.

---

## Architectural decisions

_Provide list of planned decisions with short description_

- **Templates directory `src/emails/`, not root `emails/`** — `tsconfig.json` has `rootDir: "src"` + `include: ["src"]`. A root-level `emails/` folder makes `tsc` fail with `File is not under rootDir 'src'`, breaking `npm run build`. Templates therefore live in `src/emails/` and the CLI is pointed there via `--dir src/emails`.
- **Styling via `styles.ts` style objects, not a literal `.css` file** — Without a bundler, `import './x.css'` does not resolve under `tsx`/`tsc`. react-email's delivery model is inlined styles anyway (email clients strip external/`<head>` CSS — Gmail drops `<head><style>`). The closest no-bundler, no-Tailwind equivalent is a dedicated `src/emails/welcome-email.styles.ts` module exporting `CSSProperties` objects applied via `style={}` props. This keeps styling in its own file and renders to inline styles that survive email clients.
- **JSX setting `"jsx": "react-jsx"`** — Automatic runtime, so `.tsx` files need no `import React`. Compatible with the existing `module: "commonjs"` + `esModuleInterop: true`.
- **Reuse existing `EmailService`** — `src/modules/auth/services/email.service.ts` already constructs the Resend client, handles the `apiKey === 'test'` mock path, reads `config.email.from`, logs, and throws `HttpError(502, 'EMAIL_SEND_FAILED', ...)`. Add `sendWelcomeEmail` as a method there instead of creating a second `email.service.ts` (which would duplicate the Resend client and config wiring). No new top-level `src/services/` directory is created — the project uses per-module services.
- **API key from config, not raw `process.env`** — `RESEND_API_KEY` and `EMAIL_FROM` are already zod-validated in `src/shared/app.config.ts` and exposed as `config.email.resendApiKey` / `config.email.from`. The service uses those (fail-fast-on-boot contract), not `process.env` directly.
- **`render()` is async** — `@react-email/render` `render()` returns `Promise<string>`. The element is built with `createElement(WelcomeEmail, { username })` because `email.service.ts` is a `.ts` file (no JSX). A second `render(..., { plainText: true })` call produces the text fallback.
- **`appUrl` is a template prop, not a config import** — `WelcomeEmail` accepts an optional `appUrl` (default `https://tsyvinda.com`); the service injects `config.frontendHost[0]` (parsed from `FRONTEND_HOST`). Keeping the template decoupled from `app.config` means the `email dev` preview server does not load/validate the full env (DATABASE_URL, JWT secret, etc.) just to render a template.
- **No DB / migration / entity changes** — Pure email feature; no persistence touched.

---

## Implementation Checklist

### ☑ Phase 1 — Dependencies & TypeScript config

- **Step 1** — Install production packages: `npm i react react-dom @react-email/components @react-email/render` (do NOT reinstall `resend`, already present).
- **Step 2** — Install dev packages: `npm i -D @types/react @types/react-dom react-email`.
- **Step 3** — Add `"jsx": "react-jsx"` to `compilerOptions` in `tsconfig.json` (surgical edit, preserve all other options).
- **Step 4** — Run `npm run typecheck` to confirm the config change compiles cleanly before any `.tsx` exists.

### ☑ Phase 2 — Email template + styles module

- **Step 1** — Create `src/emails/welcome-email.styles.ts` exporting typed `CSSProperties` objects: `main`, `container`, `heading`, `paragraph`, `button`. No Tailwind, no class names.
- **Step 2** — Create `src/emails/WelcomeEmail.tsx` using `Html, Head, Preview, Body, Container, Heading, Text, Button` from `@react-email/components`. Props interface `{ username: string }`. Apply styles via `style={styles.x}`. Provide named + default export. No `Tailwind` wrapper.

### ☑ Phase 3 — Service integration

- **Step 1** — In `src/modules/auth/services/email.service.ts`, add imports: `render` from `@react-email/render`, `createElement` from `react`, `WelcomeEmail` from `../../../emails/WelcomeEmail`.
- **Step 2** — Add `async sendWelcomeEmail({ to, username }: { to: string; username: string }): Promise<void>` to the `EmailService` class: render `html` and `text` (plainText), short-circuit the mock path when `this.client` is null (debug log), otherwise `this.client.emails.send({ from: config.email.from, to, subject, html, text })` and throw `HttpError(502, 'EMAIL_SEND_FAILED', ...)` on `error`.

### ☑ Phase 4 — Preview server script

- **Step 1** — Add `"email:dev": "email dev --dir src/emails --port 3001"` to `package.json` `scripts` (surgical edit).

### ☑ Phase 5 — Tests

- **Step 1** — Add a `sendWelcomeEmail` test (extend `src/modules/auth/services/email.service.test.ts` if it exists, else create it): mock the Resend client, assert rendered HTML contains `username`, assert `emails.send` called with correct `from`/`subject`/`to`, and assert the `apiKey === 'test'` mock path sends nothing without throwing.
- **Step 2** — Run `npm run typecheck && npm test`; both must be green.

### ☑ Phase 6 — Report

- **Step 1** — Write `reports/welcome-email.md` summarizing files added/changed, decisions, deviations from the original request, and test results.

---

## Important Notes

- **Literal `.css` file not used — by necessity.** No-bundler + no-Tailwind means external CSS cannot be inlined reliably for email. The dedicated `welcome-email.styles.ts` styles module is the honest equivalent ("separate styles file") and renders to inline styles. If a real `.css` artifact is mandatory, the only no-bundler route is reading it at runtime via `fs.readFileSync` into a `<Head><style>` block, which Gmail and others strip — not recommended.
- **`resend` already installed** (`package.json`, `^6.12.3`). Only the React runtime, types, and `react-email` CLI are new. Per project rule, new deps were surfaced for confirmation; the user explicitly requested them.
- **Templates must stay under `src/`** to satisfy `rootDir: "src"`; do not create a root `emails/` folder.
- **Env already wired** — `RESEND_API_KEY` and `EMAIL_FROM` exist in `src/shared/app.config.ts`; no `.env.example` change needed unless new keys are introduced (none planned).
- **No new module scaffolded** — the welcome email reuses the existing `auth` module's `EmailService`.
