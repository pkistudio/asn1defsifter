import { getNodeTagName } from './tags.js';
import type { AnnotatedNode, Candidate, TlvNode } from './types.js';

export function createAnnotatedTree(node: TlvNode, candidate?: Candidate): AnnotatedNode[] {
  return [annotateNode(node, '$', candidate)];
}

function annotateNode(node: TlvNode, path: string, candidate?: Candidate): AnnotatedNode {
  const match = candidate?.matchedPaths.find((matchedPath) => matchedPath.nodePath === path);
  const schemaAnnotation = createSchemaAnnotation(match?.schemaPath, candidate?.typeName);
  return {
    id: node.id,
    tagName: getNodeTagName(node),
    ...schemaAnnotation,
    schemaPath: match?.schemaPath,
    start: node.start,
    end: node.end,
    children: (node.children ?? []).map((child, index) => annotateNode(child, `${path}.${index}`, candidate))
  };
}

function createSchemaAnnotation(schemaPath: string | undefined, rootType: string | undefined): Pick<AnnotatedNode, 'asn1Type' | 'fieldName'> {
  if (!schemaPath) return {};
  const segments = schemaPath
    .split('.')
    .map((segment) => segment.replace(/\[\]$/, ''))
    .filter((segment) => segment.length > 0 && !/^\[\d+\]$/.test(segment));
  const fieldName = [...segments].reverse().find((segment) => /^[a-z]/.test(segment));
  const asn1Type = [...segments]
    .reverse()
    .find((segment) => segment !== fieldName && segment !== rootType && /^[A-Z]/.test(segment)) ?? (segments.length === 1 ? segments[0] : undefined);
  return {
    ...(asn1Type ? { asn1Type } : {}),
    ...(fieldName ? { fieldName } : {})
  };
}