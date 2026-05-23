import type { TlvNode } from './types.js';

const universalTagNames = new Map<number, string>([
  [1, 'BOOLEAN'],
  [2, 'INTEGER'],
  [3, 'BIT STRING'],
  [4, 'OCTET STRING'],
  [5, 'NULL'],
  [6, 'OBJECT IDENTIFIER'],
  [12, 'UTF8String'],
  [16, 'SEQUENCE'],
  [17, 'SET'],
  [19, 'PrintableString'],
  [22, 'IA5String'],
  [23, 'UTCTime'],
  [24, 'GeneralizedTime']
]);

export function getNodeTagName(node: TlvNode): string {
  if (node.tagName) return node.tagName;
  if (node.tagClass === 'universal') return universalTagNames.get(node.tagNumber) ?? `UNIVERSAL ${node.tagNumber}`;
  return `${node.tagClass.toUpperCase()} ${node.tagNumber}`;
}

export function describeNodeTag(node: TlvNode): string {
  return `${node.tagClass}:${node.tagNumber}:${node.constructed ? 'constructed' : 'primitive'}`;
}

export function universalTagForPrimitive(kind: string): number | undefined {
  switch (kind) {
    case 'boolean':
      return 1;
    case 'integer':
    case 'enumerated':
      return kind === 'integer' ? 2 : 10;
    case 'bitString':
      return 3;
    case 'octetString':
      return 4;
    case 'null':
      return 5;
    case 'objectIdentifier':
      return 6;
    case 'utf8String':
      return 12;
    case 'printableString':
      return 19;
    case 'ia5String':
      return 22;
    case 'utcTime':
      return 23;
    case 'generalizedTime':
      return 24;
    default:
      return undefined;
  }
}