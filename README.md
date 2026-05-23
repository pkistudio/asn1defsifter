# ASN.1 Definition Sifter

ASN.1 Definition Sifter is an explainable candidate resolver for ASN.1 data. It compares DER/TLV fragments with a corpus of ASN.1 definitions and returns ranked ASN.1 type candidates with scores, evidence, diagnostics, and ambiguity notes.

It does not try to magically identify one globally unique ASN.1 definition from DER bytes alone. DER does not preserve field names, type names, module names, comments, or many other schema-level semantics. This package instead provides deterministic local matches that higher-level tools and AI agents can use when building ASN.1 type hypotheses.

Current version: 0.1.0

## Features

- Neutral TLV node model for resolver core inputs.
- Structural feature extraction for tag class, tag number, constructed state, child tag sequence, OID values, and primitive value kind.
- ASN.1 Schema Model matching through `@pkistudio/asn1instancebuilder` definitions.
- Candidate ranking with numeric scores, confidence labels, evidence, diagnostics, ambiguity notes, and matched node/schema paths.
- PkiStudioJS adapter for parsing supported ASN.1 inputs into resolver-ready TLV nodes.
- Built-in PKI component corpus for common fragments such as `AlgorithmIdentifier`, `SubjectPublicKeyInfo`, `RSAPublicKey`, `DSA-Sig-Value`, `ECDSA-Sig-Value`, `SignatureValue`, EC named-curve parameters, `Certificate`, `CertificationRequest`, `PrivateKeyInfo`, and `ContentInfo`.
- PKI-aware semantic filtering for ambiguous structures, including RFC 8017 `RSAPublicKey` shape checks and signature/public-key context filters for integer-pair signatures.
- Document hypothesis helper with annotated tree output.

## Install

```sh
npm install @pkistudio/asn1defsifter
```

Package exports:

- `@pkistudio/asn1defsifter`: Core API.
- `@pkistudio/asn1defsifter/core`: Core API alias.
- `@pkistudio/asn1defsifter/app`: Standalone viewer app initializer.
- `@pkistudio/asn1defsifter/styles.css`: Standalone viewer styles.

## Core API

```ts
import { createPkiComponentCorpus, findAsn1Candidates, parseInputToTlvNodes } from '@pkistudio/asn1defsifter';

const corpus = createPkiComponentCorpus();

const [node] = await parseInputToTlvNodes('300d06092a864886f70d01010b0500', { format: 'hex' });
const candidates = findAsn1Candidates(node, { schemaCorpus: corpus, maxResults: 5 });

console.log(candidates[0]);
```

Candidate results include:

- `typeName` and optional `moduleName`.
- `score` from `0` to `1`.
- `confidence` as `low`, `medium`, or `high`.
- Human-readable `evidence`.
- `diagnostics` explaining mismatches or weaker matches.
- `ambiguities` for structurally plausible alternatives.
- `matchedPaths` connecting TLV node paths to schema paths.

Use `parseAsn1DefinitionCorpus(source)` when you want to match against your own ASN.1 module definitions instead of the built-in PKI component corpus.

Pass `minScore` when callers should suppress weak candidates and their diagnostics from candidate lists and reports.

Use `includeTypes` and `excludeTypes` to limit candidate matching by type name. Values can be local names such as `SubjectPublicKeyInfo` or qualified names such as `PkiComponents.SubjectPublicKeyInfo`.

For the built-in PKI corpus, `getPkiProfileTypeNames()` provides convenient presets for `x509`, `pkcs10`, `pkcs8`, `cms`, and shared `components` matching:

```ts
import { getPkiProfileTypeNames } from '@pkistudio/asn1defsifter';

const candidates = findAsn1Candidates(node, {
	schemaCorpus: corpus,
	includeTypes: getPkiProfileTypeNames(['x509', 'pkcs8'])
});
```

For PKI-only report generation, `createPkiCandidateReport()` and `createPkiCandidateReportFromNodes()` apply the built-in PKI corpus automatically:

```ts
import { createPkiCandidateReport } from '@pkistudio/asn1defsifter';

const report = await createPkiCandidateReport(input, {
	profiles: ['x509', 'pkcs8'],
	minScore: 0.8
});
```

For agent or workbench integrations, `createCandidateReport()` wraps parsing, feature extraction, candidate ranking, and document hypotheses into one JSON-friendly result:

```ts
import { createCandidateReport } from '@pkistudio/asn1defsifter';

const report = await createCandidateReport('300d06092a864886f70d01010b0500', {
	parseOptions: { format: 'hex' },
	maxResults: 5
});

console.log(report.roots[0].candidates[0]);
```

Use `createCandidateReportFromNodes(nodes)` when a host already has neutral TLV nodes and should not parse the input again.

Each report root includes `summary`, `features`, `candidates`, `hypotheses`, aggregated `diagnostics`, and aggregated `ambiguities`. Hypothesis `annotatedTree` entries include TLV tag names, schema paths, inferred field names, and referenced ASN.1 type names when that information is available from the match.

Pass `includeSubtrees: true` to add bounded candidate reports for child TLV nodes. Use `maxSubtreeDepth` and `maxSubtreeReports` to keep report size predictable. Subtree reports omit nodes with no candidates by default; pass `includeEmptySubtrees: true` when exhaustive child-node reporting is needed.

## PKI Matching Notes

The built-in PKI corpus includes RFC 8017 `RSAPublicKey`, `DSA-Sig-Value`, and `ECDSA-Sig-Value` definitions. Because DER shape alone cannot always distinguish structurally compatible `SEQUENCE { INTEGER, INTEGER }` values, the PKI report layer applies extra context rules:

- `RSAPublicKey` is only kept when the candidate node has the RFC 8017 shape: exactly two positive DER INTEGER values, with a plausible modulus and exponent.
- `DSA-Sig-Value` and `ECDSA-Sig-Value` are available for integer-pair signature values.
- `RSAPublicKey` candidates are suppressed below signature BIT STRING contexts, and DSA/ECDSA signature candidates are suppressed below `subjectPublicKey` contexts.

These filters keep the resolver deterministic while reducing common PKI false positives.

## Standalone Viewer

The package includes a small browser viewer for exercising the resolver without embedding it into another PkiStudio surface. It provides a left pane that is an embedded editable PkiStudioJS viewer, a candidate tree pane, a selected candidate details pane with selected bytes, and a bottom API log pane. Use the PkiStudioJS viewer's own `Load` menu to load data; the resolver watches the loaded and edited viewer document and refreshes candidates from it. Terminal BIT STRING or OCTET STRING values with no ASN.1 candidates are shown as HEX-only tree items so raw key material, such as EC public points, remains inspectable without being mislabeled as another ASN.1 type.

The viewer shell uses translucent surfaces and supports light and dark themes. The embedded viewer and candidate panes keep their outer frames visually quiet, while the embedded viewer menu remains framed like the PkiStudio family chrome. Node context menus use an opaque surface so edit, insert, add, delete, send, and copy actions remain readable over the translucent shell. Splitters between the viewer and candidates panes, above selected candidate details, and above the API log let users resize the working areas.

Selected candidate details lay out evidence, diagnostics, ambiguities, matched paths, and selected bytes as content-width sections. Non-byte sections keep their lines unwrapped and expand the application minimum width when needed, while `Selected bytes` can wrap and fills the remaining row width or moves to the next row when the remaining space is too narrow.

The selected candidate header includes a `Copy` action that writes the currently selected item's analysis result as formatted JSON, including candidate scores, evidence, diagnostics, matched paths, and selected bytes. The copied JSON keeps the original source name when the app knows one, and only falls back to `PkiStudioJS viewer` for viewer-loaded data without a supplied name.

The API log records the high-level parse and report operations and then adds one line per root candidate. Candidate log rows include the candidate type, score, confidence, evidence, diagnostic, ambiguity, and matched-path counts, plus representative evidence and diagnostic messages so the ranking work is visible without opening the selected-candidate pane. Embedded viewer edit actions such as edit, insert, add, and delete are also recorded before the changed document is re-read and ranked again.

The embedded viewer uses normal PkiStudioJS editing actions. When the viewer document changes, ASN.1 Definition Sifter re-reads the current DER bytes, refreshes candidates, and records the new report in the API log. Its `Send to` menu can still open selected DER in a separate editable PkiStudioJS viewer tab through `viewer.html`. Closing the embedded viewer clears the candidate and selected-candidate panes.

```ts
import { initAsn1DefinitionSifter } from '@pkistudio/asn1defsifter/app';
import '@pkistudio/asn1defsifter/styles.css';

initAsn1DefinitionSifter({ mount: '#app' });
```

Run the local viewer with:

```sh
npm run dev
```

## Relationship To PkiStudio Projects

PkiStudioJS remains the low-level DER/BER/PEM/base64/HEX parser, serializer, viewer, and DER re-encoder. ASN.1 Instance Builder remains the schema-aware definition parser, validator, and DER builder.

ASN.1 Definition Sifter sits between them:

```text
PkiStudioJS
	DER/TLV parsing and encoding

ASN.1 Instance Builder
	ASN.1 definition parsing and schema model

ASN.1 Definition Sifter
	DER/TLV fragment -> ranked ASN.1 definition candidates
```

## Development

Run local checks with:

```sh
npm run check
npm test
npm run build
npm run smoke
```

The smoke command builds the package and runs a real DER hex fragment through the public API. It should report `PkiComponents.AlgorithmIdentifier` as the best candidate.

The CI workflow runs the same verification set on pushes and pull requests targeting `main`.

For package or release-related changes, also run:

```sh
npm run pack:dry-run
```

Publishing to npm is handled by the `Publish npm package` GitHub Actions workflow. Configure npm trusted publishing for this repository and workflow, create and push a `v<package version>` tag, then let the tag-triggered workflow publish the package, or run the workflow manually with the same tag. The workflow verifies that the tag matches `package.json`, runs the local verification commands, inspects the package contents, and publishes `@pkistudio/asn1defsifter` with npm provenance.

## License

ASN.1 Definition Sifter is licensed under the MIT License. See [LICENSE](LICENSE).
 