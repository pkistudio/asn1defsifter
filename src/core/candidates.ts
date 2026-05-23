import { listSchemaTargets } from './corpus.js';
import { matchType } from './matcher.js';
import { clampScore, confidenceFromScore } from './scoring.js';
import type { Candidate, CandidateOptions, SchemaCandidateTarget, TlvNode } from './types.js';

export function findAsn1Candidates(node: TlvNode, options: CandidateOptions): Candidate[] {
  const maxResults = options.maxResults ?? 20;
  const minScore = options.minScore ?? Number.MIN_VALUE;
  return listSchemaTargets(options.schemaCorpus)
    .filter((target) => isIncludedTarget(target, options))
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
    .filter((candidate) => candidate.score > 0 && candidate.score >= minScore)
    .sort((left, right) => right.score - left.score || left.typeName.localeCompare(right.typeName))
    .slice(0, maxResults);
}

function isIncludedTarget(target: SchemaCandidateTarget, options: CandidateOptions): boolean {
  const includeTypes = options.includeTypes ? new Set(options.includeTypes) : undefined;
  const excludeTypes = options.excludeTypes ? new Set(options.excludeTypes) : undefined;
  const names = [target.definition.name, `${target.module.name}.${target.definition.name}`];
  if (includeTypes && !names.some((name) => includeTypes.has(name))) return false;
  if (excludeTypes && names.some((name) => excludeTypes.has(name))) return false;
  return true;
}