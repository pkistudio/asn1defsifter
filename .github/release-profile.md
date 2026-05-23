# asn1defsifter Release Profile

## Repository

- GitHub repository: `pkistudio/asn1defsifter`
- Product name: `ASN.1 Definition Sifter`
- npm package name: `@pkistudio/asn1defsifter`
- Hosted Pages URL: `https://pkistudio.github.io/asn1defsifter/`
- Documentation path: `docs/`
- ADR path: `docs/adr/`

## Version And Build

- Version files:
  - `package.json`
  - `package-lock.json`
  - `README.md` (`Current version:`)
- Version source: `package.json`
- Install command: `npm ci`
- Build command: `npm run build`
- Verification commands:
  - `npm run check`
  - `npm test`
  - `npm run build`
  - `npm run smoke`
- Package preview command: `npm run pack:dry-run`
- Published package verification:
  - `npm view @pkistudio/asn1defsifter@<version> version dist-tags dist.tarball --json`

## Publishing

- npm publication requires explicit user approval.
- GitHub Release requires explicit user approval.
- Stable published tags should have a GitHub Release marked as latest unless instructed otherwise.
- WordPress post workflow: `.github/workflows/publish-release-to-wordpress.yml`
- WordPress post title pattern: `ASN.1 Definition Sifter <tag> をリリースしました`
- WordPress posting requires the configured repository secrets and release publication event or manual workflow dispatch.

## Pages And Wiki

- Pages workflow: `.github/workflows/pages.yml`
- Pages URL: `https://pkistudio.github.io/asn1defsifter/`
- Pages artifact path: `pages-dist`

## Special Hooks

- Keep the package browser-first and host-neutral.
- Keep documentation and commit messages in English.
- Keep PkiStudioJS and ASN.1 Instance Builder integration in adapters rather than embedding their internals into the core matcher.