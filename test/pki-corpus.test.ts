import { describe, expect, it } from 'vitest';
import { createPkiComponentCorpus, findAsn1Candidates, getPkiProfileTypeNames, pkiProfileTypeNames } from '../src/core';
import { bitString, context, integer, nullNode, octetString, oid, sequence, set, utf8String } from './fixtures';

describe('createPkiComponentCorpus', () => {
  it('provides reusable PKI component definitions', () => {
    const corpus = createPkiComponentCorpus();
    const typeNames = corpus.modules.flatMap((module) => module.types.map((definition) => definition.name));

    expect(typeNames).toContain('AlgorithmIdentifier');
    expect(typeNames).toContain('SubjectPublicKeyInfo');
    expect(typeNames).toContain('RSAPublicKey');
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

  it('matches EC SubjectPublicKeyInfo with named curve AlgorithmIdentifier parameters', () => {
    const node = sequence([sequence([oid('1.2.840.10045.2.1'), oid('1.2.840.10045.3.1.7')]), bitString()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0]).toMatchObject({
      typeName: 'SubjectPublicKeyInfo',
      moduleName: 'PkiComponents',
      confidence: 'high'
    });
    expect(candidates[0].score).toBe(1);
  });

  it('matches RSAPublicKey from the built-in corpus', () => {
    const node = sequence([integer(), integer()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0]).toMatchObject({
      typeName: 'RSAPublicKey',
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

  it('matches Extension when critical DEFAULT is omitted', () => {
    const node = sequence([oid('2.5.29.14'), octetString()]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0]).toMatchObject({
      typeName: 'Extension',
      moduleName: 'PkiComponents',
      score: 1,
      confidence: 'high'
    });
  });

  it('matches Extensions with child extensions in data order', () => {
    const node = sequence([sequence([oid('2.5.29.14'), octetString()])]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0]).toMatchObject({
      typeName: 'Extensions',
      score: 1,
      confidence: 'high'
    });
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

  it('validates IMPLICIT SET OF content when matching tagged attributes', () => {
    const attributes = context(0, [sequence([oid('1.2.840.113549.1.9.14'), utf8String('extensionRequest')])]);
    const node = sequence([
      integer(),
      sequence([set([sequence([oid('2.5.4.3'), utf8String('Example CA')])])]),
      sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]),
      attributes
    ]);
    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 5 });

    expect(candidates[0].typeName).toBe('CertificationRequestInfo');
    expect(candidates[0].evidence).toContain('Context-specific tag [0] matches implicit tagging.');
    expect(candidates[0].evidence).toContain('Node matches SET OF container.');
  });

  it('provides PKI profile type presets for candidate filters', () => {
    expect(pkiProfileTypeNames.x509).toContain('Certificate');
    expect(pkiProfileTypeNames.x509).toContain('RSAPublicKey');
    expect(pkiProfileTypeNames.pkcs10).toContain('CertificationRequest');
    expect(pkiProfileTypeNames.pkcs8).toContain('PrivateKeyInfo');
    expect(pkiProfileTypeNames.cms).toContain('ContentInfo');

    const merged = getPkiProfileTypeNames(['x509', 'pkcs8']);
    expect(merged).toContain('Certificate');
    expect(merged).toContain('PrivateKeyInfo');
    expect(merged.filter((name) => name === 'AlgorithmIdentifier')).toHaveLength(1);
  });

  it('uses PKI profile presets with candidate filters', () => {
    const node = sequence([integer(), sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), octetString()]);
    const candidates = findAsn1Candidates(node, {
      schemaCorpus: createPkiComponentCorpus(),
      includeTypes: getPkiProfileTypeNames('pkcs8'),
      maxResults: 5
    });

    expect(candidates[0].typeName).toBe('PrivateKeyInfo');
    expect(candidates.map((candidate) => candidate.typeName)).not.toContain('Certificate');
  });
});