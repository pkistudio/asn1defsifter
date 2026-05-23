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
- Built-in PKI component corpus for common fragments such as `AlgorithmIdentifier`, `SubjectPublicKeyInfo`, `Certificate`, `CertificationRequest`, `PrivateKeyInfo`, and `ContentInfo`.
- Document hypothesis helper with annotated tree output.

## Install

```sh
npm install @pkistudio/asn1defsifter
```

Package exports:

- `@pkistudio/asn1defsifter`: Core API.
- `@pkistudio/asn1defsifter/core`: Core API alias.

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

Each report root includes `summary`, `features`, `candidates`, `hypotheses`, aggregated `diagnostics`, and aggregated `ambiguities`.

Pass `includeSubtrees: true` to add bounded candidate reports for child TLV nodes. Use `maxSubtreeDepth` and `maxSubtreeReports` to keep report size predictable.

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

For package or release-related changes, also run:

```sh
npm run pack:dry-run
```

## License

ASN.1 Definition Sifter is licensed under the MIT License. See [LICENSE](LICENSE).
 