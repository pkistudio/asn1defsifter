import { createAnnotatedTree } from './annotated-tree.js';
import { findAsn1Candidates } from './candidates.js';
import type { CandidateOptions, DocumentHypothesis, TlvNode } from './types.js';

export function identifyAsn1Document(node: TlvNode, options: CandidateOptions): DocumentHypothesis[] {
  const candidates = findAsn1Candidates(node, options);
  return candidates.map((candidate) => ({
    rootType: candidate.typeName,
    moduleName: candidate.moduleName,
    score: candidate.score,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    diagnostics: candidate.diagnostics,
    annotatedTree: createAnnotatedTree(node, candidate),
    alternatives: candidates.filter((alternative) => alternative !== candidate)
  }));
}