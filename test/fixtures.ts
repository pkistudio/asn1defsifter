import type { TlvNode } from '../src/core';

export function sequence(children: TlvNode[]): TlvNode {
  return { tagClass: 'universal', tagNumber: 16, constructed: true, tagName: 'SEQUENCE', children };
}

export function set(children: TlvNode[]): TlvNode {
  return { tagClass: 'universal', tagNumber: 17, constructed: true, tagName: 'SET', children };
}

export function context(tagNumber: number, children: TlvNode[] = [], constructed = true): TlvNode {
  return { tagClass: 'context', tagNumber, constructed, children };
}

export function integer(): TlvNode {
  return { tagClass: 'universal', tagNumber: 2, constructed: false, tagName: 'INTEGER', valueBytes: new Uint8Array([1]) };
}

export function oid(value: string): TlvNode {
  return { tagClass: 'universal', tagNumber: 6, constructed: false, tagName: 'OBJECT IDENTIFIER', oid: value };
}

export function nullNode(): TlvNode {
  return { tagClass: 'universal', tagNumber: 5, constructed: false, tagName: 'NULL', valueBytes: new Uint8Array() };
}

export function bitString(): TlvNode {
  return { tagClass: 'universal', tagNumber: 3, constructed: false, tagName: 'BIT STRING', valueBytes: new Uint8Array([0]) };
}

export function octetString(): TlvNode {
  return { tagClass: 'universal', tagNumber: 4, constructed: false, tagName: 'OCTET STRING', valueBytes: new Uint8Array([0]) };
}

export function utf8String(value: string): TlvNode {
  return { tagClass: 'universal', tagNumber: 12, constructed: false, tagName: 'UTF8String', value };
}