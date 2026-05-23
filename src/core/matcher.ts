import { universalTagForPrimitive } from './tags.js';
import type { Asn1Field, Asn1SchemaModule, Asn1Type, Diagnostic, EvidenceItem, MatchResult, MatchedPath, TlvNode } from './types.js';

interface MatchState {
  schema: Asn1SchemaModule;
  evidence: EvidenceItem[];
  diagnostics: Diagnostic[];
  ambiguities: string[];
  matchedPaths: MatchedPath[];
}

interface ChildMatchOutcome {
  nextIndex: number;
  score: number;
}

export function matchType(node: TlvNode, type: Asn1Type, schema: Asn1SchemaModule, schemaPath: string, nodePath = '$'): MatchResult {
  const state: MatchState = { schema, evidence: [], diagnostics: [], ambiguities: [], matchedPaths: [] };
  const score = matchTypeInternal(node, type, state, schemaPath, nodePath);
  return {
    score,
    possible: score > 0,
    evidence: state.evidence,
    diagnostics: state.diagnostics,
    ambiguities: state.ambiguities,
    matchedPaths: state.matchedPaths
  };
}

function matchTypeInternal(node: TlvNode, type: Asn1Type, state: MatchState, schemaPath: string, nodePath: string): number {
  if (type.kind === 'defined') {
    const resolved = resolveDefinedType(state.schema, type.typeName);
    if (!resolved) {
      addDiagnostic(state, 'warning', schemaPath, `Defined type ${type.typeName} is not available in module ${state.schema.name}.`);
      return 0.15;
    }
    return matchTypeInternal(node, resolved, state, `${schemaPath}.${type.typeName}`, nodePath);
  }

  if (type.kind === 'tagged') return matchTagged(node, type, state, schemaPath, nodePath);
  if (type.kind === 'sequence') return matchSequence(node, type.fields, state, schemaPath, nodePath, 16, 'SEQUENCE');
  if (type.kind === 'set') return matchSet(node, type.fields, state, schemaPath, nodePath);
  if (type.kind === 'choice') return matchChoice(node, type.alternatives, state, schemaPath, nodePath);
  if (type.kind === 'sequenceOf') return matchCollection(node, type.elementType, state, schemaPath, nodePath, 16, 'SEQUENCE OF');
  if (type.kind === 'setOf') return matchCollection(node, type.elementType, state, schemaPath, nodePath, 17, 'SET OF');
  return matchPrimitive(node, type.kind, state, schemaPath, nodePath);
}

function matchPrimitive(node: TlvNode, kind: string, state: MatchState, schemaPath: string, nodePath: string): number {
  const expectedTag = universalTagForPrimitive(kind);
  if (expectedTag === undefined) {
    addDiagnostic(state, 'warning', schemaPath, `Primitive type ${kind} is not supported by the current matcher.`);
    return 0.2;
  }
  if (node.tagClass !== 'universal' || node.tagNumber !== expectedTag) {
    addDiagnostic(state, 'error', nodePath, `Expected ${kind}, found ${describeFound(node)}.`);
    return 0;
  }
  if (kind === 'objectIdentifier' && node.oid) {
    addEvidence(state, nodePath, `Node matches objectIdentifier with value ${node.oid}.`);
  } else {
    addEvidence(state, nodePath, `Node matches ${kind}.`);
  }
  addMatchedPath(state, nodePath, schemaPath);
  return node.constructed ? 0.7 : 1;
}

function matchTagged(node: TlvNode, type: Extract<Asn1Type, { kind: 'tagged' }>, state: MatchState, schemaPath: string, nodePath: string): number {
  if (node.tagClass !== 'context' || node.tagNumber !== type.tag.number) {
    addDiagnostic(state, 'error', nodePath, `Expected context-specific tag [${type.tag.number}], found ${describeFound(node)}.`);
    return 0;
  }
  addEvidence(state, nodePath, `Context-specific tag [${type.tag.number}] matches ${type.tag.mode} tagging.`);
  addMatchedPath(state, nodePath, schemaPath);
  if (type.tag.mode === 'explicit') {
    const child = node.children?.[0];
    if (!child) {
      addDiagnostic(state, 'error', nodePath, 'Expected explicitly tagged content, but the node has no child.');
      return 0.45;
    }
    return 0.25 + 0.75 * matchTypeInternal(child, type.type, state, `${schemaPath}.[${type.tag.number}]`, `${nodePath}.0`);
  }
  return Math.max(0.65, matchTypeInternal({ ...node, tagClass: 'universal' }, type.type, state, schemaPath, nodePath) * 0.8);
}

function matchSequence(node: TlvNode, fields: Asn1Field[], state: MatchState, schemaPath: string, nodePath: string, expectedTag: number, label: string): number {
  if (node.tagClass !== 'universal' || node.tagNumber !== expectedTag || !node.constructed) {
    addDiagnostic(state, 'error', nodePath, `Expected ${label}, found ${describeFound(node)}.`);
    return 0;
  }

  const children = node.children ?? [];
  let childIndex = 0;
  let totalScore = 0;
  let scoreSlots = 0;
  addEvidence(state, nodePath, `Root node matches ${label}.`);
  addMatchedPath(state, nodePath, schemaPath);

  for (const field of fields) {
    const child = children[childIndex];
    if (!child) {
      if (field.optional || field.defaultValue !== undefined) {
        addEvidence(state, nodePath, `Field ${field.name} is absent and allowed by OPTIONAL or DEFAULT.`);
        totalScore += 0.75;
        scoreSlots += 1;
        continue;
      }
      addDiagnostic(state, 'error', `${schemaPath}.${field.name}`, `Required field ${field.name} is missing.`);
      scoreSlots += 1;
      continue;
    }

    const outcome = matchField(children, childIndex, field, state, schemaPath, nodePath);
    if (outcome.score === 0 && (field.optional || field.defaultValue !== undefined)) {
      addEvidence(state, `${schemaPath}.${field.name}`, `Field ${field.name} may be omitted.`);
      totalScore += 0.65;
      scoreSlots += 1;
      continue;
    }
    totalScore += outcome.score;
    scoreSlots += 1;
    childIndex = outcome.nextIndex;
  }

  if (childIndex < children.length) {
    addDiagnostic(state, 'warning', nodePath, `${children.length - childIndex} unexpected child node(s) remain after matching ${label}.`);
  }

  const fieldScore = scoreSlots === 0 ? 0.85 : totalScore / scoreSlots;
  const completenessPenalty = childIndex < children.length ? 0.85 : 1;
  return (0.25 + 0.75 * fieldScore) * completenessPenalty;
}

function matchField(children: TlvNode[], childIndex: number, field: Asn1Field, state: MatchState, schemaPath: string, nodePath: string): ChildMatchOutcome {
  const child = children[childIndex];
  const fieldSchemaPath = `${schemaPath}.${field.name}`;
  const fieldNodePath = `${nodePath}.${childIndex}`;
  const score = matchTypeInternal(child, field.type, state, fieldSchemaPath, fieldNodePath);
  if (score > 0) {
    addEvidence(state, fieldNodePath, `Field ${field.name} is compatible with the child node.`);
    return { nextIndex: childIndex + 1, score };
  }
  return { nextIndex: childIndex, score };
}

function matchSet(node: TlvNode, fields: Asn1Field[], state: MatchState, schemaPath: string, nodePath: string): number {
  if (node.tagClass !== 'universal' || node.tagNumber !== 17 || !node.constructed) {
    addDiagnostic(state, 'error', nodePath, `Expected SET, found ${describeFound(node)}.`);
    return 0;
  }

  const children = node.children ?? [];
  const unusedChildIndexes = new Set(children.map((_child, index) => index));
  let totalScore = 0;
  let scoreSlots = 0;
  addEvidence(state, nodePath, 'Root node matches SET.');
  addMatchedPath(state, nodePath, schemaPath);

  for (const field of fields) {
    let bestMatch: { childIndex: number; branchState: MatchState; score: number } | undefined;
    for (const childIndex of unusedChildIndexes) {
      const branchState = createBranchState(state.schema);
      const score = matchTypeInternal(children[childIndex], field.type, branchState, `${schemaPath}.${field.name}`, `${nodePath}.${childIndex}`);
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { childIndex, branchState, score };
      }
    }

    if (bestMatch) {
      unusedChildIndexes.delete(bestMatch.childIndex);
      mergeBranchState(state, bestMatch.branchState);
      addEvidence(state, `${nodePath}.${bestMatch.childIndex}`, `SET field ${field.name} is compatible with this child node.`);
      totalScore += bestMatch.score;
      scoreSlots += 1;
      continue;
    }

    if (field.optional || field.defaultValue !== undefined) {
      addEvidence(state, nodePath, `SET field ${field.name} is absent and allowed by OPTIONAL or DEFAULT.`);
      totalScore += 0.75;
      scoreSlots += 1;
      continue;
    }

    addDiagnostic(state, 'error', `${schemaPath}.${field.name}`, `Required SET field ${field.name} is missing.`);
    scoreSlots += 1;
  }

  if (unusedChildIndexes.size > 0) {
    addDiagnostic(state, 'warning', nodePath, `${unusedChildIndexes.size} unexpected child node(s) remain after matching SET.`);
  }

  const fieldScore = scoreSlots === 0 ? 0.85 : totalScore / scoreSlots;
  const completenessPenalty = unusedChildIndexes.size > 0 ? 0.85 : 1;
  return (0.25 + 0.75 * fieldScore) * completenessPenalty;
}

function matchChoice(node: TlvNode, alternatives: Asn1Field[], state: MatchState, schemaPath: string, nodePath: string): number {
  const scored = alternatives
    .map((alternative) => {
      const branchState: MatchState = { schema: state.schema, evidence: [], diagnostics: [], ambiguities: [], matchedPaths: [] };
      const score = matchTypeInternal(node, alternative.type, branchState, `${schemaPath}.${alternative.name}`, nodePath);
      return { alternative, branchState, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score === 0) {
    addDiagnostic(state, 'error', nodePath, `No CHOICE alternative matched ${schemaPath}.`);
    return 0;
  }
  state.evidence.push(...best.branchState.evidence);
  state.diagnostics.push(...best.branchState.diagnostics.filter((diagnostic) => diagnostic.severity !== 'error'));
  state.ambiguities.push(...best.branchState.ambiguities);
  state.matchedPaths.push(...best.branchState.matchedPaths);
  addEvidence(state, nodePath, `CHOICE alternative ${best.alternative.name} is the strongest match.`);

  const tied = scored.filter((item) => item !== best && Math.abs(item.score - best.score) < 0.05 && item.score > 0);
  if (tied.length > 0) {
    state.ambiguities.push(`CHOICE ${schemaPath} has similarly scored alternatives: ${tied.map((item) => item.alternative.name).join(', ')}.`);
  }
  return best.score;
}

function matchCollection(node: TlvNode, elementType: Asn1Type, state: MatchState, schemaPath: string, nodePath: string, expectedTag: number, label: string): number {
  if (node.tagClass !== 'universal' || node.tagNumber !== expectedTag || !node.constructed) {
    addDiagnostic(state, 'error', nodePath, `Expected ${label}, found ${describeFound(node)}.`);
    return 0;
  }
  const children = node.children ?? [];
  addEvidence(state, nodePath, `Node matches ${label} container.`);
  addMatchedPath(state, nodePath, schemaPath);
  if (children.length === 0) return 0.85;
  const childScores = children.map((child, index) => matchTypeInternal(child, elementType, state, `${schemaPath}[]`, `${nodePath}.${index}`));
  return childScores.reduce((sum, score) => sum + score, 0) / childScores.length;
}

function resolveDefinedType(schema: Asn1SchemaModule, typeName: string): Asn1Type | undefined {
  return schema.types.find((definition) => definition.name === typeName)?.type;
}

function addEvidence(state: MatchState, path: string, message: string): void {
  state.evidence.push({ path, message });
}

function addDiagnostic(state: MatchState, severity: Diagnostic['severity'], path: string, message: string): void {
  state.diagnostics.push({ severity, path, message });
}

function addMatchedPath(state: MatchState, nodePath: string, schemaPath: string): void {
  state.matchedPaths.push({ nodePath, schemaPath });
}

function createBranchState(schema: Asn1SchemaModule): MatchState {
  return { schema, evidence: [], diagnostics: [], ambiguities: [], matchedPaths: [] };
}

function mergeBranchState(state: MatchState, branchState: MatchState): void {
  state.evidence.push(...branchState.evidence);
  state.diagnostics.push(...branchState.diagnostics.filter((diagnostic) => diagnostic.severity !== 'error'));
  state.ambiguities.push(...branchState.ambiguities);
  state.matchedPaths.push(...branchState.matchedPaths);
}

function describeFound(node: TlvNode): string {
  return `${node.tagClass} tag ${node.tagNumber}`;
}