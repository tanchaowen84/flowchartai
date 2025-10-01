# Repository Guidelines

FlowchartAI runs on Next.js 15 with TypeScript and Cloudflare Workers. Follow these conventions when contributing.

## Project Structure & Module Organization
- Core routes, layouts, and server actions are in `src/app`; shared UI lives in `src/components`, with feature logic grouped under `src/actions`, `src/hooks`, `src/lib`, and `src/utils`.
- Database schemas and queries live in `src/db` beside `drizzle.config.ts`; email templates are under `src/mail`.
- Editorial content sits in `content/` and `docs/`; static files belong in `public/` or `src/assets`.
- Automation scripts live in `scripts/`, and platform config stays in root files like `open-next.config.ts`, `wrangler.jsonc`, and `vercel.json`.

## Build, Test, and Development Commands
- `pnpm dev`: Run Next.js locally and watch MDX collections.
- `pnpm build`: Build content collections, then compile the production bundle.
- `pnpm start`: Serve the compiled build for staging checks.
- `pnpm lint` / `pnpm format`: Run Biome checks and fix formatting.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`: Manage Drizzle migrations using the database URL in `.env.local`.
- `pnpm preview` / `pnpm deploy`: Use OpenNext for Cloudflare previews and deploys.

## Coding Style & Naming Conventions
- TypeScript everywhere; add explicit return types on exported helpers.
- Biome enforces 2-space indentation, single quotes, and trailing commas—run `pnpm lint` before pushing.
- Components and hooks use PascalCase (`FlowEditor`, `useFlowchartStore`); functions use camelCase; route folders under `src/app` stay kebab-case.
- Compose UI with Tailwind utilities; reusable design tokens belong in `src/styles`.

## Testing Guidelines
- Place tests as `*.test.ts(x)` or in `__tests__` folders next to the source.
- Prefer Playwright or Testing Library for UI flows; document manual QA steps when automation is missing.
- Run linting plus all affected tests locally before opening a PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in history; add scopes when helpful (`feat(app): add diagram wizard`).
- Reference issues (`Closes #123`) and note new env vars, migrations, or scripts in the PR body.
- PRs need a concise summary, test evidence, and deployment considerations; include before/after imagery for UI changes.

## Environment & Deployment Tips
- Store secrets in `.env.local`; sync production keys to Cloudflare with `wrangler secret put` and refresh bindings via `pnpm cf-typegen`.
- Run `pnpm preview` before `pnpm deploy` to emulate the Worker bundle and verify asset routing.
