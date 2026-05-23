import { getNodeTagName } from './tags.js';
import type { AnnotatedNode, Candidate, TlvNode } from './types.js';

export function createAnnotatedTree(node: TlvNode, candidate?: Candidate): AnnotatedNode[] {
  return [annotateNode(node, '$', candidate)];
}

function annotateNode(node: TlvNode, path: string, candidate?: Candidate): AnnotatedNode {
  const match = candidate?.matchedPaths.find((matchedPath) => matchedPath.nodePath === path);
  return {
    id: node.id,
    tagName: getNodeTagName(node),
    asn1Type: match?.schemaPath.split('.').at(-1),
    schemaPath: match?.schemaPath,
    start: node.start,
    end: node.end,
    children: (node.children ?? []).map((child, index) => annotateNode(child, `${path}.${index}`, candidate))
  };
}