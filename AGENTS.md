# Project Guidelines

## Project Overview

ASN.1 Definition Sifter is a browser-first TypeScript library that ranks ASN.1 definition candidates for DER/TLV fragments. The package is published as `@pkistudio/asn1defsifter`.

Key files:

- `src/core.ts`: public core API barrel for feature extraction, candidate matching, reports, and adapters.
- `src/core/`: UI-independent TLV feature extraction, schema corpus handling, matching, scoring, diagnostics, and annotated tree types.
- `src/adapters/`: host-neutral adapters for PkiStudioJS parsing and ASN.1 Instance Builder schema parsing.
- `test/`: Vitest coverage for feature extraction, matching, scoring, and adapter contracts.
- `docs/asn1defsifter.md`: product and design notes.

## Development Commands

Run these before handing normal code changes back:

```sh
npm run check
npm test
npm run build
npm run smoke
```

For package or release-related changes, also run:

```sh
npm run pack:dry-run
```

When checking published package state, use the scoped package name:

```sh
npm view @pkistudio/asn1defsifter version --json
```

## Architecture Notes

- Keep the package browser-first and host-neutral. VS Code-specific file access, dialogs, persistence, and Webview lifecycle belong outside this package.
- Keep reusable resolver behavior under `src/core/`; keep dependency-specific conversions under `src/adapters/`.
- Preserve deterministic, explainable matching. The core resolver must not depend on an AI model for parsing, scoring, or correctness.
- Prefer neutral TLV input at core boundaries. PkiStudioJS integration should remain an adapter layer.
- Prefer ASN.1 Instance Builder's schema model and parser instead of duplicating ASN.1 definition parsing in this repository.
- Treat uncertainty as a first-class result through evidence, diagnostics, ambiguities, and ranked alternatives.

## Coding Conventions

- Follow the pkistudio TypeScript style: two-space indentation, semicolons, explicit exported types, and narrow helpers near their call sites.
- Keep all documentation, comments intended for commit messages, package metadata, and public API examples in English.
- Keep changes focused and avoid broad formatting churn.
- Prefer structured ASN.1, TLV, and schema helpers over ad hoc byte or string manipulation.
- Do not introduce Node-only runtime dependencies into code that is shipped to the browser.
- Use `@pkistudio/asn1defsifter` in npm install, import, and test examples.
- Update README or docs when public API behavior, package exports, profile behavior, or release workflow expectations change.
- For version bumps, keep at least `package.json`, `package-lock.json`, and the README current version synchronized.

## GitHub And Release Notes

- Prefer `gh` for GitHub issue, PR, tag, and release operations when available.
- CI runs `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run smoke`, and `npm run pack:dry-run` on pushes and pull requests targeting `main`.
- Do not merge PRs unless the user explicitly asks to proceed.
- npm publication targets `@pkistudio/asn1defsifter` and requires explicit user approval.
- Public repository preparation should keep README, package metadata, license, and package exports ready for external users.