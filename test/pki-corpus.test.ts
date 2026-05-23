import { describe, expect, it } from 'vitest';
import { createPkiComponentCorpus, findAsn1Candidates } from '../src/core';
import { bitString, integer, nullNode, octetString, oid, sequence, set, utf8String } from './fixtures';

describe('createPkiComponentCorpus', () => {
  it('provides reusable PKI component definitions', () => {
    const corpus = createPkiComponentCorpus();
    const typeNames = corpus.modules.flatMap((module) => module.types.map((definition) => definition.name));

    expect(typeNames).toContain('AlgorithmIdentifier');
    expect(typeNames).toContain('SubjectPublicKeyInfo');
    expect(typeNames).toContain('Certificate');
    expect(typeNames).toContain('CertificationRequest');
    expect(typeNames).toContain('PrivateKeyInfo');
    expect(typeNames).toContain('ContentInfo');
  });

  it('matches SubjectPublicKeyInfo from the built-in corpus', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0]).toMatchObject({
      typeName: 'SubjectPublicKeyInfo',
      moduleName: 'PkiComponents',
      confidence: 'high'
    });
  });

  it('matches AttributeTypeAndValue inside Name-related structures', () => {
    const node = sequence([oid('2.5.4.3'), utf8String('Example CA')]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0].typeName).toBe('AttributeTypeAndValue');
    expect(candidates[0].evidence).toContain('Node matches objectIdentifier with value 2.5.4.3.');
  });

  it('matches ContentInfo-like structures', () => {
    const content = { tagClass: 'context' as const, tagNumber: 0, constructed: true, children: [octetString()] };
    const node = sequence([oid('1.2.840.113549.1.7.1'), content]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0].typeName).toBe('ContentInfo');
  });

  it('keeps SET OF containers available for PKI name fragments', () => {
    const node = set([sequence([oid('2.5.4.3'), utf8String('Example CA')])]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0].typeName).toBe('RelativeDistinguishedName');
  });

  it('matches PrivateKeyInfo-like structures', () => {
    const node = sequence([integer(), sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), octetString()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0].typeName).toBe('PrivateKeyInfo');
  });
});