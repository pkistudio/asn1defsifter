import { describe, expect, it } from 'vitest';
import { createPkiComponentCorpus, findAsn1Candidates, parseInputToTlvNodes } from '../src/core';

describe('parseInputToTlvNodes', () => {
  it('parses real PkiStudioJS output into resolver-ready TLV nodes', async () => {
    const [node] = await parseInputToTlvNodes('300d06092a864886f70d01010b0500', { format: 'hex' });

    expect(node).toMatchObject({
      tagClass: 'universal',
      tagNumber: 16,
      constructed: true
    });
    expect(node.children?.[0]).toMatchObject({
      tagClass: 'universal',
      tagNumber: 6,
      oid: '1.2.840.113549.1.1.11'
    });

    const candidates = findAsn1Candidates(node, { schemaCorpus: createPkiComponentCorpus(), maxResults: 3 });
    expect(candidates[0].typeName).toBe('AlgorithmIdentifier');
    expect(candidates[0].evidence).toContain('Node matches objectIdentifier with value 1.2.840.113549.1.1.11.');
  });
});