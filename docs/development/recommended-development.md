---
title: Recommended development setup
last_reviewed: 2026-11-20
---

# Recommended development setup

This page describes the standard setup for n8n development. It assumes a machine with 16 GB RAM or more. For a machine with less RAM, read [Development on a low-spec machine](low-spec-development.md).

## Requirements

- Node.js 24 or newer.
- pnpm 12.4.2. Use the exact version in the `packageManager` field of `package.json`.
- Build tools for native modules. On Windows, install the Visual Studio Build Tools with the "Desktop development with C++" workload.

n8n uses pnpm workspaces. pnpm links the packages in the monorepo automatically.

## Install and build

Run these commands from the repository root:

```bash
pnpm install
pnpm build
```

`pnpm build` builds all packages. The build can take several minutes. Write the output to a file, then inspect the last lines:

```bash
pnpm build > build.log 2>&1
tail -n 20 build.log
```

To check a fresh checkout, run the setup script. It runs install, build, and test in one process, then writes one summary:

```bash
pnpm agent:setup
```

## Run n8n

Start the backend and the editor:

```bash
pnpm dev:be
```

`dev:be` rebuilds `packages/cli` on each change. It serves the editor from the built frontend output (the `dist` folder).

To change the frontend, open a second terminal and run:

```bash
pnpm dev:fe:editor
```

`dev:fe:editor` starts the Vite dev server. It reloads the editor on each change.

To start the backend and the frontend together:

```bash
pnpm dev:all
```

`pnpm dev:fe` starts n8n from the built backend, plus the Vite dev server. `pnpm dev:be` and `pnpm dev:fe:editor` are faster because they reload only one side.

For the AI and LangChain nodes:

```bash
pnpm dev:ai
```

`dev:ai` uses a high turbo concurrency (`--concurrency=150`). It needs a large machine.

Open `http://localhost:5678`.

## Development loop

1. Create a branch from a fresh `master`. Use the branch name from the Linear ticket.
2. Change the code in the package that owns the behavior.
3. Run the tests that cover the change.
4. Format and lint the changed files.
5. Commit, push, and open a draft pull request.

## Verify changes

Run a focused test from the owning package:

```bash
pnpm --filter n8n test src/path/to/file.test.ts --maxWorkers=1
```

Or use the root wrapper:

```bash
pnpm agent:test --filter n8n -- src/path/to/file.test.ts --maxWorkers=1
```

Run a Playwright test:

```bash
pnpm agent:playwright -- <spec-file> --workers=1
```

`pnpm agent:lint --filter <package>` and `pnpm agent:typecheck --filter <package>` check the whole package. They do not reduce CPU or memory use.

For routine commits, run the configured tools on the changed files:

```bash
pnpm exec biome check --write <files>
pnpm exec eslint <files>
```

Use the package's configured tools through `pnpm exec` with explicit file paths. Do not append file paths to `pnpm lint`; package scripts can still check the whole package.

CI runs the full lint, typecheck, and test suites. Report the checks that you ran and the checks that you left to CI.

## Reset a stale build

If a build output or the turbo cache is stale, run:

```bash
pnpm reset
```

`pnpm reset` cleans the build outputs and rebuilds them. It keeps `node_modules` and untracked files.

If the problem continues, run:

```bash
pnpm reset --full
```

`pnpm reset --full` also removes untracked files and reinstalls the dependencies.
