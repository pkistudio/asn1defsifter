# ASN.1 Definition Candidate Resolver Idea

## Summary

This document describes an idea for a new project: a module that receives DER, BER, PEM, HEX, or parsed ASN.1 TLV fragments and returns ranked ASN.1 definition/type candidates instead of trying to identify one globally unique ASN.1 definition.

The core idea is not to build a magic detector that can uniquely identify any ASN.1 structure in the world from DER bytes alone. DER does not contain field names, type names, module names, or schema comments, so that goal is not realistic. Instead, this module should act as a deterministic candidate generator that extracts structural features from ASN.1 data and returns possible ASN.1 type definitions with scores, evidence, and remaining ambiguity.

An AI agent or higher-level orchestration layer can then call this module repeatedly for different parts of a DER document, compare the candidate lists, consider OID relationships and nested structures, and produce one or more final ASN.1 definition hypotheses.

## Problem

Existing tools often fall into two categories:

- DER/TLV viewers that decode binary ASN.1 into tag/length/value trees.
- ASN.1 builders that generate DER from a known ASN.1 schema and instance data.

PkiStudioJS belongs mainly to the first category. It can parse DER, BER, PEM, headerless base64, and HEX input into a TLV tree, display values, inspect OIDs, and re-encode edited nodes.

ASN.1 Instance Builder belongs mainly to the second category. It parses a practical subset of ASN.1 definitions, validates instance JSON, and generates DER.

A missing middle layer is a tool that helps answer this question:

> Given this DER fragment and a corpus of ASN.1 definitions, which ASN.1 types could plausibly describe it?

The answer should usually be a ranked candidate list, not a single definitive result.

## Why DER Alone Is Not Enough

DER preserves ASN.1 tag, length, and encoded value information, but it does not preserve many semantic details from the ASN.1 definition.

For example, this DER structure:

```text
30 03 02 01 01
```

can be decoded as:

```text
SEQUENCE {
  INTEGER 1
}
```

But DER alone cannot tell whether the original ASN.1 definition was:

```asn1
Person ::= SEQUENCE {
  age INTEGER
}
```

or:

```asn1
VersionedObject ::= SEQUENCE {
  version INTEGER
}
```

or many other structurally equivalent definitions.

Therefore the module should expose uncertainty as a first-class result.

## Proposed Module Role

The module should be a candidate resolver:

```text
DER fragment / TLV node
  +
ASN.1 definition corpus
  +
optional context
  ↓
ranked ASN.1 type candidates
  +
evidence
  +
diagnostics
  +
ambiguities
```

It should be deterministic and explainable. It should not depend on an AI model for basic parsing or scoring.

The AI layer, if used, should be responsible for orchestration:

- selecting interesting fragments,
- calling the resolver recursively,
- comparing candidate sets,
- using OIDs and surrounding context,
- merging partial hypotheses,
- explaining the final conclusion.

## Relationship To Existing PkiStudio Projects

### PkiStudioJS

PkiStudioJS should remain the low-level ASN.1 binary parser, serializer, viewer, and DER re-encoder.

Relevant capabilities:

- Parse DER/BER/PEM/base64/HEX into ASN.1 nodes.
- Decode primitive values and OIDs.
- Detect encapsulated DER inside BIT STRING and OCTET STRING where possible.
- Re-encode node trees back to DER.

The new resolver can use PkiStudioJS as its binary/TLV foundation.

### ASN.1 Instance Builder

ASN.1 Instance Builder should remain the schema-aware builder and validator.

Relevant capabilities:

- Parse ASN.1 definitions into a schema model.
- Validate instance JSON against a schema type.
- Build DER from schema + instance.
- Provide known schema examples and PKI-oriented fixtures.

The new resolver can reuse or depend on the schema model and ASN.1 definition parser from ASN.1 Instance Builder.

### New Project

The new project should sit between the two:

```text
PkiStudioJS
  DER/TLV parsing and encoding

ASN.1 Instance Builder
  ASN.1 definition parsing and DER construction

New resolver project
  DER/TLV fragment -> ASN.1 definition/type candidate list

AI or workbench layer
  multi-fragment analysis, hypothesis merging, annotated tree output
```

## Core Concepts

### Feature Extraction

For each DER/TLV fragment, extract features such as:

- tag class,
- tag number,
- constructed/primitive bit,
- child count,
- child tag sequence,
- primitive value kind,
- OID values,
- OID position,
- string/time/integer characteristics,
- explicit or implicit tagging patterns,
- OPTIONAL/DEFAULT-compatible shape,
- nested DER inside BIT STRING or OCTET STRING,
- common PKI patterns such as AlgorithmIdentifier, Extension, Name, ContentInfo, SubjectPublicKeyInfo, and RSAPublicKey.

### Candidate Matching

Given a schema corpus, compare a fragment against candidate ASN.1 types.

Matching should consider:

- exact tag compatibility,
- constructed vs primitive compatibility,
- SEQUENCE and SET field layout,
- OPTIONAL and DEFAULT fields,
- CHOICE alternatives,
- EXPLICIT and IMPLICIT tagging,
- SEQUENCE OF and SET OF item compatibility,
- known OID-driven open types,
- nested DER expectations,
- constraints that can be checked from encoded values.

### Evidence

Each candidate should include human-readable evidence, not just a score.

Example:

```json
{
  "typeName": "SubjectPublicKeyInfo",
  "moduleName": "PKIX1Explicit88",
  "score": 0.93,
  "confidence": "high",
  "evidence": [
    "Root node is a SEQUENCE with two children",
    "First child matches AlgorithmIdentifier",
    "Second child is a BIT STRING",
    "Algorithm OID is 1.2.840.10045.2.1"
  ],
  "ambiguities": [
    "The public key BIT STRING format depends on algorithm parameters"
  ]
}
```

### Diagnostics

Diagnostics should explain why candidates failed or partially matched.

Examples:

- expected `SEQUENCE`, found `SET`,
- required field missing,
- unexpected extra child,
- explicit tag present but schema expects implicit tag,
- OID does not match expected open type,
- OCTET STRING content could not be decoded as the expected nested type.

## AI Agent Workflow

An AI agent can use the module as a tool in a broader analysis loop.

Possible workflow:

1. Parse the input with PkiStudioJS.
2. Generate a TLV tree.
3. Run candidate matching on the root node.
4. Extract OID-bearing nodes and resolve known OIDs.
5. Detect encapsulated DER inside BIT STRING and OCTET STRING nodes.
6. Run candidate matching on important subtrees.
7. Compare local candidates with root-level candidates.
8. Use OID relationships to infer open types.
9. Re-run matching with stronger context.
10. Produce final hypotheses with scores and evidence.

Example reasoning:

```text
The root node matches ContentInfo.
The contentType OID is signedData.
The [0] EXPLICIT content decodes successfully as SignedData.
SignedData.encapContentInfo.eContentType is id-data.
The certificates field contains nodes that match Certificate.
Therefore the strongest whole-document hypothesis is CMS ContentInfo carrying SignedData.
```

This division of labor is important: the resolver provides repeatable candidate lists, while the AI agent provides strategy and hypothesis merging.

## Proposed API Sketch

### Parse And Extract Features

```ts
const document = parseInput(input);
const features = extractDerFeatures(document.nodes[0]);
```

### Find Candidates For One Fragment

```ts
const candidates = findAsn1Candidates(document.nodes[0], {
  schemaCorpus,
  maxResults: 20
});
```

### Include Context

```ts
const candidates = findAsn1Candidates(node, {
  schemaCorpus,
  context: {
    parentType: 'Certificate',
    fieldPath: 'tbsCertificate.subjectPublicKeyInfo',
    knownOids: {
      algorithm: '1.2.840.10045.2.1'
    }
  }
});
```

### Identify Whole Documents

```ts
const result = identifyAsn1Document(input, {
  schemaCorpus,
  profiles: ['x509', 'pkcs8', 'pkcs10', 'cms'],
  maxHypotheses: 5
});
```

### Result Shape

```ts
type Candidate = {
  typeName: string;
  moduleName?: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  diagnostics: Diagnostic[];
  ambiguities: string[];
  matchedPaths: MatchedPath[];
};

type DocumentHypothesis = {
  rootType: string;
  moduleName?: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  diagnostics: Diagnostic[];
  annotatedTree: AnnotatedNode[];
  alternatives: Candidate[];
};
```

## Annotated Tree Output

The module or a higher-level workbench can produce an ASN.1-definition-aware tree.

Example:

```json
{
  "id": "1.2.3",
  "tagName": "INTEGER",
  "asn1Type": "CertificateSerialNumber",
  "fieldName": "serialNumber",
  "schemaPath": "Certificate.tbsCertificate.serialNumber",
  "value": "123456",
  "start": 42,
  "end": 48,
  "children": []
}
```

This would allow a UI to connect:

- DER hex ranges,
- TLV nodes,
- ASN.1 definition fields,
- decoded instance JSON paths,
- diagnostics.

## Standalone Viewer App

Although the package should remain usable as a headless resolver library, the project should also include a small standalone viewer app so the module can be exercised and demonstrated without embedding it into another PkiStudio surface first.

The viewer is a development and verification surface, not the primary runtime contract. The resolver core should remain UI-independent, browser-first, and reusable by PkiStudioJS, VS Code extensions, or other workbench layers.

### Layout

The app should use a three-pane layout:

- left pane: input loading and DER hex display,
- right pane: candidate tree view,
- bottom pane: API log output.

The left and right panes should each have a main content area and a lower notification area. The bottom pane should behave like the API log area in ASN.1 Instance Builder, showing resolver calls, options, timings, warnings, and errors in chronological order.

### Left Pane

The left pane should provide a `Load` menu with these actions:

- `from File`: load ASN.1 input from a local file,
- `from Clipboard as HEX`: read clipboard text as hexadecimal DER input.

After loading, the left pane content area should show the loaded DER binary as formatted hexadecimal data. The lower notification area should show input-related messages such as load success, parse errors, byte length, detected input format, and clipboard validation errors.

### Right Pane

The right pane content area should show candidate results as a tree view. The top level should represent loaded root TLV nodes or document hypotheses. Child levels should expose subtree candidate reports so users can inspect candidates for nested TLV fragments.

Each tree item should be able to show at least:

- candidate type name and module name,
- score and confidence,
- matched TLV path and schema path,
- evidence, diagnostics, and ambiguity summaries,
- child subtree candidates when available.

The right pane lower notification area should show candidate-resolution messages such as selected candidate details, filtered candidate counts, empty-result notices, and subtree traversal limits.

### Viewer Flow

The first viewer milestone should support this flow:

1. Load DER bytes from a file or clipboard HEX.
2. Parse the input with PkiStudioJS through the adapter.
3. Render the input bytes as formatted hex in the left pane.
4. Run `createPkiCandidateReport()` with subtree reports enabled.
5. Render root and subtree candidates in the right pane tree.
6. Append parse, match, report, warning, and error events to the bottom API log.

### Implementation Boundary

The viewer should consume public APIs from this package instead of reaching into private matcher internals. Any missing data needed by the viewer should be added to the resolver report types first, then rendered by the app.

The app can live inside the same repository for module verification, but it should not make the core resolver depend on UI frameworks, DOM APIs, VS Code APIs, or host-specific file systems.

The package boundary should follow the broader PkiStudio family pattern used by packages such as pvkgadgets and certgadgets:

- `@pkistudio/asn1defsifter` and `@pkistudio/asn1defsifter/core` expose the browser-first resolver API and types.
- Additional focused APIs can be exported from dedicated subpaths when they are reusable outside the app, for example profile or report helpers.
- `@pkistudio/asn1defsifter/app` exposes the standalone viewer initializer and app instance types.
- `@pkistudio/asn1defsifter/styles.css` exposes app styles for hosts that embed the viewer.

The app entry should import styles and DOM-specific code. The core entry should not import app code, CSS, browser file pickers, clipboard APIs, or host integration code.

## Initial Scope

The first version should use a focused schema corpus instead of trying to cover every ASN.1 definition.

Recommended initial profiles:

- X.509 Certificate,
- TBSCertificate,
- X.509 Extension,
- CRL / CertificateList,
- PKCS#10 CertificationRequest,
- SubjectPublicKeyInfo,
- RSAPublicKey,
- PrivateKeyInfo / PKCS#8,
- CMS ContentInfo,
- CMS SignedData,
- OCSP request/response structures.

This is enough to provide high practical value while keeping the matching logic manageable.

## Non-Goals

The initial project should not try to:

- uniquely identify any DER document without a schema corpus,
- scrape the entire internet for ASN.1 definitions,
- rely on an AI model for core parsing correctness,
- guarantee one true answer where multiple ASN.1 types are structurally compatible,
- fully support every ASN.1 feature in the first version.

## Project Name Ideas

### asn1defsifter

`asn1defsifter` is a good candidate. It is short enough, descriptive, and has the right meaning: the module sifts through ASN.1 definitions to find plausible matches.

Pros:

- Clear connection to ASN.1 definitions.
- Suggests candidate filtering rather than absolute identification.
- Shorter than names like `asn1-definition-candidate-resolver`.
- Good npm package shape: `@pkistudio/asn1defsifter`.

Cons:

- `def` may be slightly ambiguous, though understandable for developers.
- The word `sifter` is less common than `matcher` or `finder`.

Overall, `asn1defsifter` is a strong name.

### Other Name Candidates

- `asn1sift`  
  Shorter and punchier than `asn1defsifter`. Good if the project may sift structures, OIDs, and definitions, not only definitions.

- `asn1defmatch`  
  Very direct. It says exactly what the module does: match DER fragments against ASN.1 definitions.

- `asn1typist`  
  Short and memorable. Suggests assigning ASN.1 types to DER data, though it may sound like a person who types text.

- `asn1probe`  
  Good for a tool that probes DER fragments and reports likely structures. Slightly less specific to definitions.

- `asn1hint`  
  Friendly and short. Emphasizes that the output is a hint/candidate list, not a definitive answer.

- `asn1lens`  
  Good if the project becomes a schema-aware viewing layer. Less clear for candidate generation alone.

- `dersift`  
  Very short and focused on DER. Less ASN.1-specific in name, but nice for a fragment analysis tool.

- `dertype`  
  Short and practical. Suggests inferring the type of DER data. Could be confused with TypeScript type definitions.

- `asn1rank`  
  Emphasizes ranked candidates. Clear for the scoring part, but less natural as a product name.

- `asn1match`  
  Simple and clear. May be too generic, but it is easy to remember.

## Recommended Name

Recommended short list:

1. `asn1defsifter`
2. `asn1sift`
3. `asn1defmatch`
4. `asn1probe`
5. `asn1hint`

Best overall choice:

```text
asn1defsifter
```

Suggested package name:

```text
@pkistudio/asn1defsifter
```

Suggested repository name:

```text
pkistudio/asn1defsifter
```

Suggested one-line description:

```text
Rank ASN.1 definition candidates for DER fragments using explainable structural matching.
```

## Possible README Opening

```md
# ASN.1 Def Sifter

ASN.1 Def Sifter is an explainable candidate resolver for ASN.1 data. It parses DER/TLV fragments, compares them with a corpus of ASN.1 definitions, and returns ranked ASN.1 type candidates with evidence, diagnostics, and ambiguity notes.

It does not try to magically identify one unique ASN.1 definition from DER bytes alone. Instead, it helps tools and AI agents build defensible ASN.1 type hypotheses from local fragment matches, OID clues, nested DER, and whole-document consistency.
```

## MVP Plan

1. Accept a PkiStudioJS node tree or DER bytes as input.
2. Extract structural features from a node and its children.
3. Accept a small built-in schema corpus for common PKI structures.
4. Match root-level shapes such as Certificate, CertificationRequest, CertificateList, SubjectPublicKeyInfo, PrivateKeyInfo, ContentInfo, SignedData, AlgorithmIdentifier, and Extension.
5. Return ranked candidates with evidence and diagnostics.
6. Add recursive matching for encapsulated BIT STRING and OCTET STRING values.
7. Add annotated tree generation.
8. Add an agent-friendly JSON report format.
9. Add a standalone viewer app for loading DER input, inspecting hex bytes, viewing candidate trees, and checking API logs.

## Open Design Questions

- Should the package depend directly on PkiStudioJS, or accept a neutral TLV node format?
- Should the schema corpus come from ASN.1 Instance Builder's schema model?
- How much ASN.1 matching should be exact versus heuristic?
- Should OID-driven open type handling live in this package or in a higher-level profile package?
- Should there be separate packages for core matching and PKI profile data?
- What confidence scale should be used: numeric only, labels only, or both?

## Suggested Architecture

```text
src/
  core/
    features.ts
    matcher.ts
    scoring.ts
    diagnostics.ts
  corpus/
    pki.ts
    cms.ts
    pkcs.ts
  profiles/
    x509.ts
    cms.ts
    pkcs8.ts
    pkcs10.ts
  adapters/
    pkistudiojs.ts
    asn1instancebuilder.ts
  report/
    annotated-tree.ts
    agent-report.ts
  app.ts
  main.ts
  styles.css
```

The core should remain reusable and deterministic. Profile packages or corpus modules can grow over time. The standalone app should be exported through a separate app entry point, mirroring the Core API versus app split used by other PkiStudio family packages.

## Final Positioning

This project should be positioned as:

> an explainable ASN.1 definition candidate resolver for DER fragments.

It is not a replacement for PkiStudioJS or ASN.1 Instance Builder. It is a bridge between them, and a useful tool for AI-assisted ASN.1 analysis.
