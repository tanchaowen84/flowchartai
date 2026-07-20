# Repository Guidelines

FlowchartAI runs on Next.js 15 with TypeScript and deploys to Vercel. Follow these conventions when contributing.

## Project Structure & Module Organization
- Core routes, layouts, and server actions are in `src/app`; shared UI lives in `src/components`, with feature logic grouped under `src/actions`, `src/hooks`, `src/lib`, and `src/utils`.
- Database schemas and queries live in `src/db` beside `drizzle.config.ts`; email templates are under `src/mail`.
- Editorial content sits in `content/` and `docs/`; static files belong in `public/` or `src/assets`.
- Automation scripts live in `scripts/`, and Vercel platform config stays in `vercel.json`.

## Build, Test, and Development Commands
- `pnpm dev`: Run Next.js locally and watch MDX collections.
- `pnpm build`: Build content collections, then compile the production bundle.
- `pnpm start`: Serve the compiled build for staging checks.
- `pnpm lint` / `pnpm format`: Run Biome checks and fix formatting.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`: Manage Drizzle migrations using the database URL in `.env.local`.
- `pnpm build` / `pnpm start`: Build and run the same Next.js application deployed to Vercel.

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
- Store local secrets in `.env.local` and production secrets in Vercel project settings.
- Cloudflare remains responsible for DNS plus R2/CDN assets; application deployments run on Vercel.
