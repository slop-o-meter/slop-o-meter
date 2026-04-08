## Repo overview

- Yarn workspaces monorepo with two packages:
  - `packages/app/` — Hono SSR app served via AWS Lambda + CloudFront
  - `packages/infra/` — AWS CDK stack (Lambda, CloudFront, S3, SQS)
- S3 for project data storage, SQS for async measurement jobs, Docker Lambda
  with git for repo cloning and measurement.

## Tooling & conventions

- **Package manager:** Yarn (Berry) via Corepack. PnP is **not** used. **Never**
  use `npx` — always use `yarn` to run scripts and dependencies.
- Follow existing patterns; keep changes focused and consistent with surrounding
  code.
- **Never** use abbreviations for variable names, aside from common
  abbreviations (e.g., `i` for loop variables) and acronyms (e.g., `url`).
- **Always use braces** for `if`/`else`/`for`/`while` blocks, even single-line
  bodies.

## Components

- **Single responsibility:** each component does one thing. If a component needs
  a non-trivial sub-element, extract it into its own component with its own
  `.styles.ts` file.
- **Own directory:** every component lives in `src/components/<ComponentName>/`
  with its `.tsx` and `.styles.ts` side by side. Never inline large style blocks
  or SVGs into a parent component.
- **Compose, don't bloat:** build complex UI by composing small, focused
  components — not by growing a single file.

## Testing

Follow the existing patterns and styling conventions when writing tests. In
particular, always use comments `// Setup mocks` (optional), `// Setup SUT`
(optional), `// Exercise`, and `// Verify` to visually separate the "phases" of
a test.

## NPM scripts

- `yarn dev`: starts the local dev server
- `yarn test`: runs tests
- `yarn check-types`: type-checks the app
- `yarn fix-formatting`: run this after you're done making some changes
- `yarn build`: builds the app for deployment
- `yarn deploy:production`: builds and deploys via CDK

Always run the checks before committing. They **should** pass, but if some fails
and it's not trivial to fix, you can leave it failing and commit anyway.
