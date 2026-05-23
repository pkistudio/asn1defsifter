import { listSchemaTargets } from './corpus.js';
import { matchType } from './matcher.js';
import { clampScore, confidenceFromScore } from './scoring.js';
import type { Candidate, CandidateOptions, TlvNode } from './types.js';

export function findAsn1Candidates(node: TlvNode, options: CandidateOptions): Candidate[] {
  const maxResults = options.maxResults ?? 20;
  return listSchemaTargets(options.schemaCorpus)
    .map(({ module, definition }) => {
      const result = matchType(node, definition.type, module, definition.name);
      const score = clampScore(result.score);
      return {
        typeName: definition.name,
        moduleName: module.name,
        score,
        confidence: confidenceFromScore(score),
        evidence: result.evidence.map((item) => item.message),
        diagnostics: result.diagnostics,
        ambiguities: result.ambiguities,
        matchedPaths: result.matchedPaths
      } satisfies Candidate;
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.typeName.localeCompare(right.typeName))
    .slice(0, maxResults);
}