import { describe, expect, it } from 'vitest';
import { createCandidateReport } from '../src/core';

describe('createCandidateReport', () => {
  it('creates an agent-friendly report from DER hex input', async () => {
    const report = await createCandidateReport('300d06092a864886f70d01010b0500', {
      parseOptions: { format: 'hex' },
      maxResults: 3
    });

    expect(report.roots).toHaveLength(1);
    expect(report.roots[0].features).toMatchObject({
      tagName: 'SEQUENCE',
      oidValues: ['1.2.840.113549.1.1.11'],
      oidNames: ['SHA256 with RSA Encryption']
    });
    expect(report.roots[0].candidates[0]).toMatchObject({
      typeName: 'AlgorithmIdentifier',
      confidence: 'high'
    });
    expect(report.roots[0].hypotheses[0]).toMatchObject({
      rootType: 'AlgorithmIdentifier',
      confidence: 'high'
    });
    expect(report.roots[0].node).toBeUndefined();
  });
});