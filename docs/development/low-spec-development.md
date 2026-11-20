---
title: Development on a low-spec machine
last_reviewed: 2026-11-20
---

# Development on a low-spec machine

This page describes how to develop n8n on a machine with 8 GB RAM or less. The standard setup can run out of memory on this class of machine. This page reduces memory use and keeps the machine responsive.

Read [Recommended development setup](recommended-development.md) for the standard workflow.

## Rules

Follow these rules:

- Build one package and its dependencies. Do not build all packages.
- Run one development server at a time.
- Cap the heap of each Node.js process.
- Set the turbo concurrency to 1.
- Use SQLite. Do not start PostgreSQL or Redis containers.
- Do not use Docker, Playwright, or the Dev Container.
- Close browsers before a build or a test run.

## Set the memory limits

Bash:

```bash
export NODE_OPTIONS="--max-old-space-size=2048"
export TURBO_CONCURRENCY=1
```

PowerShell:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=2048"
$env:TURBO_CONCURRENCY="1"
```

Start with 2048 MB. Use 3072 MB if a build fails with a heap error. Keep the value below 75 percent of the physical RAM.

## Check the pnpm version

Run:

```bash
pnpm -v
```

The output must match the `packageManager` field in `package.json`. A different pnpm version can rewrite `pnpm-lock.yaml` and cause an outdated lockfile error. Update pnpm with:

```bash
pnpm self-update <version>
```

## First setup

Install the dependencies:

```bash
pnpm agent:setup install
```

Build the packages with a low memory cap and one turbo worker:

```bash
pnpm agent:setup build --mem 2048 --concurrency 1
```

`agent:setup` writes the logs and a summary to `.agent-setup/`. The defaults are 6144 MB and 4 workers. They are too large for a low-spec machine.

If the build fails, run it again with `--mem 3072`. Do not increase the concurrency.

## Run one side at a time

For backend work:

```bash
pnpm dev:be
```

`dev:be` rebuilds `packages/cli` on each change. It serves the editor from the built frontend output. If you do not need the editor, call the API directly.

For frontend work:

```bash
pnpm dev:fe
```

`dev:fe` starts n8n from the built backend, plus the Vite dev server. It does not watch the backend. This makes it the lightest option for UI changes.

`pnpm dev:fe:editor` starts only the Vite dev server. Use it only when a backend already runs in another process.

## Build only what you need

Build the `n8n` package and its dependencies:

```bash
pnpm exec turbo run build --filter=n8n... --concurrency=1
```

The three dots (`...`) include the dependencies of the package.

Build one package:

```bash
pnpm --filter n8n-nodes-base build
```

Do not run the root `pnpm build`. It builds every package in the monorepo.

## Run a focused test

Run one test file from the owning package:

```bash
pnpm --filter n8n test src/path/to/file.test.ts --maxWorkers=1
```

Or use the root wrapper:

```bash
pnpm agent:test --filter n8n -- src/path/to/file.test.ts --maxWorkers=1
```

Do not run `pnpm test` or `pnpm test:ci`. They start many Vitest workers.

The integration tests that use PostgreSQL and Redis need Docker. Skip them on a low-spec machine.

## Turn off optional services

Set these environment variables:

```bash
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
```

PowerShell:

```powershell
$env:N8N_DIAGNOSTICS_ENABLED="false"
$env:N8N_VERSION_NOTIFICATIONS_ENABLED="false"
```

Do not run the seed scripts (`pnpm seed:preference`, `pnpm seed:account`) on a low-spec machine. They create many workflows.

## Avoid these commands

| Command | Reason |
|---|---|
| `pnpm build` | Builds all packages. |
| `pnpm dev:all` | Runs the backend watcher and the frontend dev server. |
| `pnpm dev:ai` | Uses `--concurrency=150`. |
| `pnpm watch` | Uses `--concurrency=64`. |
| `pnpm test` | Starts the full test suite. |
| `pnpm test:postgres` | Needs a PostgreSQL server. |
| `pnpm agent:setup` (no flags) | Uses 6144 MB, 4 workers, and the full test suite. |
| `pnpm --filter n8n-editor-ui build` | Its script sets `--max-old-space-size=8192`, which can fail on this class of machine. Use the Vite dev server instead. |

## Windows

Set the page file to at least 8 GB. Close browsers and Docker Desktop before a build or a test run.

## If the machine is still out of memory

1. Increase the page file.
2. Set `NODE_OPTIONS` to `--max-old-space-size=3072`.
3. Build one package only.
4. Stop the other development servers.
5. Run `pnpm reset`.
6. Run the full build on a remote machine or in a Codespace.
