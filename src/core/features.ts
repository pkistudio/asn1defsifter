import { describeNodeTag, getNodeTagName } from './tags.js';
import type { TlvFeatures, TlvNode } from './types.js';

export function extractDerFeatures(node: TlvNode): TlvFeatures {
  const children = node.children ?? [];
  const oidValues = collectOidValues(node);
  const oidNames = collectOidNames(node);
  return {
    tagClass: node.tagClass,
    tagNumber: node.tagNumber,
    constructed: node.constructed,
    tagName: getNodeTagName(node),
    childCount: children.length,
    childTagSequence: children.map(describeNodeTag),
    oidValues,
    oidNames,
    primitiveValueKind: inferPrimitiveValueKind(node),
    valueLength: node.valueBytes?.length
  };
}

function collectOidValues(node: TlvNode): string[] {
  const ownOid = node.oid ? [node.oid] : [];
  const childOids = (node.children ?? []).flatMap(collectOidValues);
  return [...ownOid, ...childOids];
}

function collectOidNames(node: TlvNode): string[] {
  const ownName = node.oidName ? [node.oidName] : [];
  const childNames = (node.children ?? []).flatMap(collectOidNames);
  return [...ownName, ...childNames];
}

function inferPrimitiveValueKind(node: TlvNode): string | undefined {
  if (node.constructed) return undefined;
  if (node.tagClass !== 'universal') return undefined;
  switch (node.tagNumber) {
    case 1:
      return 'boolean';
    case 2:
      return 'integer';
    case 3:
      return 'bitString';
    case 4:
      return 'octetString';
    case 5:
      return 'null';
    case 6:
      return 'objectIdentifier';
    case 10:
      return 'enumerated';
    case 12:
      return 'utf8String';
    case 19:
      return 'printableString';
    case 22:
      return 'ia5String';
    case 23:
      return 'utcTime';
    case 24:
      return 'generalizedTime';
    default:
      return undefined;
  }
}