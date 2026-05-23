import pkistudioCore from '@pkistudio/pkistudiojs/core';
import oidResolver from '@pkistudio/pkistudiojs/oid-resolver';
import type { TlvNode, TlvTagClass } from '../core/types.js';

interface PkiStudioLikeNode {
  id?: string;
  tagClass?: string | number;
  className?: string;
  tagNumber?: number;
  tag?: number;
  tagName?: string;
  constructed?: boolean;
  isConstructed?: boolean;
  valueBytes?: Uint8Array | number[];
  contentBytes?: Uint8Array | number[];
  bytes?: Uint8Array | number[];
  value?: unknown;
  oid?: string;
  oidValue?: string;
  children?: PkiStudioLikeNode[];
  start?: number;
  end?: number;
}

interface PkiStudioParseResult {
  nodes?: PkiStudioLikeNode[];
}

export async function parseInputToTlvNodes(input: unknown, options?: Record<string, unknown>): Promise<TlvNode[]> {
  const parsed = pkistudioCore.parseInput(input, options) as PkiStudioParseResult;
  return (parsed.nodes ?? []).map(pkistudioNodeToTlvNode);
}

export function pkistudioNodeToTlvNode(node: PkiStudioLikeNode): TlvNode {
  const oid = node.oid ?? node.oidValue ?? decodeOidFromNode(node);
  return {
    id: node.id,
    tagClass: normalizeTagClass(node.tagClass ?? node.className),
    tagNumber: node.tagNumber ?? node.tag ?? 0,
    constructed: node.constructed ?? node.isConstructed ?? Boolean(node.children?.length),
    tagName: node.tagName,
    valueBytes: normalizeBytes(node.valueBytes ?? node.contentBytes),
    encodedBytes: normalizeBytes(node.bytes),
    value: node.value,
    oid,
    oidName: oid ? resolveOidName(oid) : undefined,
    children: node.children?.map(pkistudioNodeToTlvNode),
    start: node.start,
    end: node.end
  };
}

function normalizeTagClass(value: string | number | undefined): TlvTagClass {
  if (value === 0 || value === 'universal' || value === 'UNIVERSAL') return 'universal';
  if (value === 1 || value === 'application' || value === 'APPLICATION') return 'application';
  if (value === 2 || value === 'context' || value === 'context-specific' || value === 'CONTEXT') return 'context';
  if (value === 3 || value === 'private' || value === 'PRIVATE') return 'private';
  return 'universal';
}

function normalizeBytes(value: Uint8Array | number[] | undefined): Uint8Array | undefined {
  if (!value) return undefined;
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function decodeOidFromNode(node: PkiStudioLikeNode): string | undefined {
  if ((node.tagNumber ?? node.tag) !== 6) return undefined;
  const bytes = normalizeBytes(node.valueBytes ?? node.contentBytes);
  if (!bytes || bytes.length === 0) return undefined;
  return pkistudioCore.decodeOid(bytes);
}

function resolveOidName(oid: string): string | undefined {
  return oidResolver.resolve(oid) || undefined;
}