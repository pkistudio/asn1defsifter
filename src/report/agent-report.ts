import { parseInputToTlvNodes } from '../adapters/pkistudiojs.js';
import { createPkiComponentCorpus } from '../corpus/pki-components.js';
import { findAsn1Candidates } from '../core/candidates.js';
import { identifyAsn1Document } from '../core/document.js';
import { extractDerFeatures } from '../core/features.js';
import type { Candidate, CandidateReport, CandidateReportSummary, Diagnostic, DiagnosticSeverity, TlvNode, CandidateReportOptions } from '../core/types.js';

export async function createCandidateReport(input: unknown, options: CandidateReportOptions = {}): Promise<CandidateReport> {
  const nodes = await parseInputToTlvNodes(input, options.parseOptions);
  return createCandidateReportFromNodes(nodes, options);
}

export function createCandidateReportFromNodes(nodes: TlvNode | TlvNode[], options: CandidateReportOptions = {}): CandidateReport {
  const schemaCorpus = options.schemaCorpus ?? createPkiComponentCorpus();
  const maxResults = options.maxResults ?? 10;
  const rootNodes = Array.isArray(nodes) ? nodes : [nodes];
  return {
    roots: rootNodes.map((node, index) => {
      const candidates = findAsn1Candidates(node, { schemaCorpus, maxResults });
      const diagnostics = uniqueDiagnostics(candidates.flatMap((candidate) => candidate.diagnostics));
      const ambiguities = [...new Set(candidates.flatMap((candidate) => candidate.ambiguities))];
      return {
        index,
        ...(options.includeNodes ? { node } : {}),
        features: extractDerFeatures(node),
        summary: createSummary(candidates, diagnostics, ambiguities),
        candidates,
        hypotheses: identifyAsn1Document(node, { schemaCorpus, maxResults }),
        diagnostics,
        ambiguities
      };
    })
  };
}

function createSummary(candidates: Candidate[], diagnostics: Diagnostic[], ambiguities: string[]): CandidateReportSummary {
  const bestCandidate = candidates[0]
    ? {
        typeName: candidates[0].typeName,
        moduleName: candidates[0].moduleName,
        score: candidates[0].score,
        confidence: candidates[0].confidence
      }
    : undefined;
  return {
    candidateCount: candidates.length,
    ...(bestCandidate ? { bestCandidate } : {}),
    diagnosticCounts: countDiagnostics(diagnostics),
    ambiguityCount: ambiguities.length
  };
}

function countDiagnostics(diagnostics: Diagnostic[]): Record<DiagnosticSeverity, number> {
  return diagnostics.reduce<Record<DiagnosticSeverity, number>>(
    (counts, diagnostic) => ({ ...counts, [diagnostic.severity]: counts[diagnostic.severity] + 1 }),
    { info: 0, warning: 0, error: 0 }
  );
}

function uniqueDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.severity}\u0000${diagnostic.path}\u0000${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}