import { describe, expect, it } from 'vitest';
import { createCandidateReport, createCandidateReportFromNodes } from '../src/core';
import { bitString, nullNode, oid, sequence } from './fixtures';

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
    expect(report.roots[0].summary).toMatchObject({
      candidateCount: 3,
      bestCandidate: {
        typeName: 'AlgorithmIdentifier',
        confidence: 'high'
      },
      diagnosticCounts: {
        info: 0,
        warning: expect.any(Number),
        error: expect.any(Number)
      }
    });
    expect(report.roots[0].hypotheses[0]).toMatchObject({
      rootType: 'AlgorithmIdentifier',
      confidence: 'high'
    });
    expect(report.roots[0].node).toBeUndefined();
  });

  it('creates a report from caller-provided TLV nodes without parsing input', () => {
    const node = sequence([oid('1.2.840.113549.1.1.11'), nullNode()]);
    const report = createCandidateReportFromNodes(node, { maxResults: 3, includeNodes: true });

    expect(report.roots).toHaveLength(1);
    expect(report.roots[0].node).toBe(node);
    expect(report.roots[0].features.oidValues).toEqual(['1.2.840.113549.1.1.11']);
    expect(report.roots[0].candidates[0]).toMatchObject({
      typeName: 'AlgorithmIdentifier',
      confidence: 'high'
    });
    expect(report.roots[0].summary.bestCandidate?.typeName).toBe('AlgorithmIdentifier');
  });

  it('can include bounded candidate reports for subtree nodes', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const report = createCandidateReportFromNodes(node, {
      includeSubtrees: true,
      maxSubtreeDepth: 2,
      maxSubtreeReports: 3,
      maxResults: 3
    });

    expect(report.roots[0].subtrees).toHaveLength(3);
    expect(report.roots[0].subtrees?.[0]).toMatchObject({
      path: '$.0',
      summary: {
        bestCandidate: {
          typeName: 'AlgorithmIdentifier'
        }
      }
    });
    expect(report.roots[0].subtrees?.[1]).toMatchObject({
      path: '$.0.0',
      features: {
        oidValues: ['1.2.840.113549.1.1.1']
      }
    });
  });

  it('applies minimum score filtering to root and subtree candidates', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const report = createCandidateReportFromNodes(node, {
      includeSubtrees: true,
      maxSubtreeDepth: 1,
      maxResults: 10,
      minScore: 0.9
    });

    expect(report.roots[0].candidates.every((candidate) => candidate.score >= 0.9)).toBe(true);
    expect(report.roots[0].subtrees?.[0].candidates.every((candidate) => candidate.score >= 0.9)).toBe(true);
  });

  it('applies type filters to root and subtree reports', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const report = createCandidateReportFromNodes(node, {
      includeSubtrees: true,
      maxSubtreeDepth: 1,
      maxResults: 5,
      minScore: 0.9,
      includeTypes: ['SubjectPublicKeyInfo', 'AlgorithmIdentifier']
    });

    expect(report.roots[0].candidates.map((candidate) => candidate.typeName)).toEqual(['SubjectPublicKeyInfo']);
    expect(report.roots[0].subtrees?.[0].candidates.map((candidate) => candidate.typeName)).toEqual(['AlgorithmIdentifier']);
  });
});