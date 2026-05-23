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
      const score = clampScore(applySemanticCandidateConstraints(node, module.name, definition.name, result.score));
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

function applySemanticCandidateConstraints(node: TlvNode, moduleName: string, typeName: string, score: number): number {
  if (moduleName === 'PkiComponents' && typeName === 'RSAPublicKey' && !isRfc8017RsaPublicKey(node)) return 0;
  return score;
}

function isRfc8017RsaPublicKey(node: TlvNode): boolean {
  const children = node.children ?? [];
  return node.tagClass === 'universal'
    && node.tagNumber === 16
    && node.constructed
    && children.length === 2
    && children.every(isPositiveDerInteger);
}

function isPositiveDerInteger(node: TlvNode): boolean {
  if (node.tagClass !== 'universal' || node.tagNumber !== 2 || node.constructed) return false;
  if (!node.valueBytes || node.valueBytes.length === 0) return true;
  return (node.valueBytes[0] & 0x80) === 0 && node.valueBytes.some((byte) => byte !== 0);
}