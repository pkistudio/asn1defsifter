import { describe, expect, it } from 'vitest';
import { findAsn1Candidates, parseAsn1DefinitionCorpus } from '../src/core';
import { bitString, nullNode, oid, sequence, set, utf8String } from './fixtures';

const corpus = parseAsn1DefinitionCorpus(`PkiComponents DEFINITIONS EXPLICIT TAGS ::= BEGIN
AlgorithmIdentifier ::= SEQUENCE {
  algorithm OBJECT IDENTIFIER,
  parameters NULL OPTIONAL
}
SubjectPublicKeyInfo ::= SEQUENCE {
  algorithm AlgorithmIdentifier,
  subjectPublicKey BIT STRING
}
Person ::= SEQUENCE {
  name UTF8String
}
END`);

const setCorpus = parseAsn1DefinitionCorpus(`SetExample DEFINITIONS ::= BEGIN
AttributeTypeAndValue ::= SET {
  value UTF8String,
  type OBJECT IDENTIFIER
}
END`);

describe('findAsn1Candidates', () => {
  it('ranks compatible ASN.1 type definitions with evidence', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: corpus });

    expect(candidates[0]).toMatchObject({
      typeName: 'SubjectPublicKeyInfo',
      moduleName: 'PkiComponents',
      confidence: 'high'
    });
    expect(candidates[0].score).toBeGreaterThan(0.8);
    expect(candidates[0].evidence.some((message) => message.includes('SEQUENCE'))).toBe(true);
  });

  it('keeps structurally weaker candidates below stronger matches', () => {
    const node = sequence([utf8String('Alice')]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: corpus });

    expect(candidates[0].typeName).toBe('Person');
    expect(candidates.find((candidate) => candidate.typeName === 'SubjectPublicKeyInfo')?.score ?? 0).toBeLessThan(candidates[0].score);
  });

  it('can filter weak candidates with a minimum score', () => {
    const node = sequence([utf8String('Alice')]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: corpus, minScore: 0.9 });

    expect(candidates.map((candidate) => candidate.typeName)).toEqual(['Person']);
  });

  it('can include and exclude candidate types by local or qualified name', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const included = findAsn1Candidates(node, { schemaCorpus: corpus, includeTypes: ['PkiComponents.SubjectPublicKeyInfo'] });
    const excluded = findAsn1Candidates(node, { schemaCorpus: corpus, excludeTypes: ['SubjectPublicKeyInfo'] });

    expect(included.map((candidate) => candidate.typeName)).toEqual(['SubjectPublicKeyInfo']);
    expect(excluded.map((candidate) => candidate.typeName)).not.toContain('SubjectPublicKeyInfo');
  });

  it('matches SET fields without requiring schema order', () => {
    const node = set([oid('2.5.4.3'), utf8String('Example CA')]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: setCorpus });

    expect(candidates[0]).toMatchObject({
      typeName: 'AttributeTypeAndValue',
      confidence: 'high'
    });
    expect(candidates[0].evidence).toContain('Node matches objectIdentifier with value 2.5.4.3.');
  });
});