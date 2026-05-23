import { describe, expect, it } from 'vitest';
import { identifyAsn1Document, parseAsn1DefinitionCorpus } from '../src/core';
import { integer, sequence } from './fixtures';

describe('identifyAsn1Document', () => {
  it('returns hypotheses with an annotated tree', () => {
    const corpus = parseAsn1DefinitionCorpus(`Example DEFINITIONS ::= BEGIN
VersionedObject ::= SEQUENCE { version INTEGER }
END`);
    const hypotheses = identifyAsn1Document(sequence([integer()]), { schemaCorpus: corpus });

    expect(hypotheses[0]).toMatchObject({
      rootType: 'VersionedObject',
      confidence: 'high'
    });
    expect(hypotheses[0].annotatedTree[0].schemaPath).toBe('VersionedObject');
  });

  it('annotates matched fields and defined types', () => {
    const corpus = parseAsn1DefinitionCorpus(`Example DEFINITIONS ::= BEGIN
CertificateSerialNumber ::= INTEGER
Holder ::= SEQUENCE { serialNumber CertificateSerialNumber, version INTEGER }
END`);
    const hypotheses = identifyAsn1Document(sequence([integer(), integer()]), { schemaCorpus: corpus });
    const [serialNumberNode, versionNode] = hypotheses[0].annotatedTree[0].children;

    expect(serialNumberNode).toMatchObject({
      fieldName: 'serialNumber',
      asn1Type: 'CertificateSerialNumber',
      schemaPath: 'Holder.serialNumber.CertificateSerialNumber'
    });
    expect(versionNode).toMatchObject({
      fieldName: 'version',
      schemaPath: 'Holder.version'
    });
    expect(versionNode.asn1Type).toBeUndefined();
  });
});