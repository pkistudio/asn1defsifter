import { parseInputToTlvNodes } from '../adapters/pkistudiojs.js';
import { createPkiComponentCorpus } from '../corpus/pki-components.js';
import { findAsn1Candidates } from '../core/candidates.js';
import { identifyAsn1Document } from '../core/document.js';
import { extractDerFeatures } from '../core/features.js';
import type { Candidate, CandidateReport, CandidateReportOptions, CandidateReportSubtree, CandidateReportSummary, Diagnostic, DiagnosticSeverity, TlvNode } from '../core/types.js';

export async function createCandidateReport(input: unknown, options: CandidateReportOptions = {}): Promise<CandidateReport> {
  const nodes = await parseInputToTlvNodes(input, options.parseOptions);
  return createCandidateReportFromNodes(nodes, options);
}

export function createCandidateReportFromNodes(nodes: TlvNode | TlvNode[], options: CandidateReportOptions = {}): CandidateReport {
  const schemaCorpus = options.schemaCorpus ?? createPkiComponentCorpus();
  const maxResults = options.maxResults ?? 10;
  const minScore = options.minScore;
  const candidateOptions = {
    schemaCorpus,
    maxResults,
    minScore,
    includeTypes: options.includeTypes,
    excludeTypes: options.excludeTypes
  };
  const rootNodes = Array.isArray(nodes) ? nodes : [nodes];
  return {
    roots: rootNodes.map((node, index) => {
      const matchReport = createNodeMatchReport(node, candidateOptions);
      return {
        index,
        ...(options.includeNodes ? { node } : {}),
        ...matchReport,
        hypotheses: identifyAsn1Document(node, candidateOptions),
        ...(options.includeSubtrees ? { subtrees: createSubtreeReports(node, candidateOptions, options) } : {})
      };
    })
  };
}

function createNodeMatchReport(node: TlvNode, candidateOptions: Parameters<typeof findAsn1Candidates>[1]): Omit<CandidateReportSubtree, 'path' | 'node'> {
  const candidates = findAsn1Candidates(node, candidateOptions);
  const diagnostics = uniqueDiagnostics(candidates.flatMap((candidate) => candidate.diagnostics));
  const ambiguities = [...new Set(candidates.flatMap((candidate) => candidate.ambiguities))];
  return {
    features: extractDerFeatures(node),
    summary: createSummary(candidates, diagnostics, ambiguities),
    candidates,
    diagnostics,
    ambiguities
  };
}

function createSubtreeReports(node: TlvNode, candidateOptions: Parameters<typeof findAsn1Candidates>[1], options: CandidateReportOptions): CandidateReportSubtree[] {
  const maxDepth = options.maxSubtreeDepth ?? 3;
  const maxReports = options.maxSubtreeReports ?? 20;
  const reports: CandidateReportSubtree[] = [];
  visitSubtrees(node, '$', 0, maxDepth, maxReports, reports, (child, path) => {
    const report = {
      path,
      ...(options.includeNodes ? { node: child } : {}),
      ...createNodeMatchReport(child, candidateOptions)
    };
    return options.includeEmptySubtrees || report.candidates.length > 0 ? report : undefined;
  });
  return reports;
}

function visitSubtrees(node: TlvNode, path: string, depth: number, maxDepth: number, maxReports: number, reports: CandidateReportSubtree[], createReport: (node: TlvNode, path: string) => CandidateReportSubtree | undefined): void {
  if (depth >= maxDepth || reports.length >= maxReports) return;
  for (const [index, child] of (node.children ?? []).entries()) {
    if (reports.length >= maxReports) return;
    const childPath = `${path}.${index}`;
    const report = createReport(child, childPath);
    if (report) reports.push(report);
    visitSubtrees(child, childPath, depth + 1, maxDepth, maxReports, reports, createReport);
  }
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