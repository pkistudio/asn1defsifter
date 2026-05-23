import { describe, expect, it } from 'vitest';
import { createCandidateReport, createCandidateReportFromNodes, createPkiCandidateReport, createPkiCandidateReportFromNodes } from '../src/core';
import { bitString, integer, nullNode, octetString, oid, sequence } from './fixtures';

describe('createCandidateReport', () => {
  const rsaSubjectPublicKeyInfoHex = '30820222300D06092A864886F70D01010105000382020F003082020A0282020100A73C7E79549FF68DDFC8DF7EC690465085E0ECF7D3751404B02E1B07D53921E557D958604631FAF599AB0D051EA728F35CB89E4CE12D67CA966D81967F4B73B9CC159325E835210EC30EAB8915326327F23F344C460C98721764E4C191B67A0F05A97C93785D7436AFD0880B47D4822622E5D3AC475BF09D4B4ADB07E573D3428360211E90E6495E65FF61A2E2AD49AEAA799FFBB3E99A3BFC01297B58943D0A8BE50C3E8373837A18609BC4EB50CA3897E182A8A7BE51182779C30489C4496A81DF77D272238F16CECDD6A7698BA9321FB1493A12BA1FDFA609617BBD47BAC4F8C99140F03172D134748020924484DCBDAEBD58DAF5B37A868A4DDCFD53371CCFA01BA7554D70C311193DCC9F15C2BE7514761E860D4C29356AD5964FF83C67DAC5D0E3021E0022F2AE87FF0FDB057B284B23F72B905D0717B751DD41026FD10AAD759B0B27B3AA47325ED4F11465A67B3F4F9D5918444862886879328B06AC939D64D2F30D19A8537410EC67A76FA959A98F169875CC9D80881BD084965953368D73B79865680C96FADD88FA9D83D7B34A8B2AFADD70D593909FDC6DD81C2C80A97A61ED053708962DC5BA9EE9F469E3AAC032CD663F11216B7A81948D3338AAB94CBCCC4C31F5FC6D208C746D20FEEDAF2E4654493244B53B43A08A63C487C1FCB52BBE22CD9778996095FD3BA4AFEFDD80A144B92F38BE97E307849B823F0203010001';
  const ecSubjectPublicKeyInfoHex = '3059301306072a8648ce3d020106082a8648ce3d03010703420004537d189afe6155d84942ba19c1a48406a73b4620c9458e2cbae3076c19f19eb24303fbec39be6f3a690b776737a657758b3c7de34942a543093d527cc28d5b3c';

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

    expect(report.roots[0].subtrees).toHaveLength(1);
    expect(report.roots[0].subtrees?.[0]).toMatchObject({
      path: '$.0',
      summary: {
        bestCandidate: {
          typeName: 'AlgorithmIdentifier'
        }
      }
    });
  });

  it('can include empty subtree reports when requested', () => {
    const node = sequence([sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), bitString()]);
    const report = createCandidateReportFromNodes(node, {
      includeSubtrees: true,
      includeEmptySubtrees: true,
      maxSubtreeDepth: 2,
      maxSubtreeReports: 3,
      maxResults: 3
    });

    expect(report.roots[0].subtrees).toHaveLength(3);
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

  it('creates PKI reports with profile presets from input', async () => {
    const report = await createPkiCandidateReport('300d06092a864886f70d01010b0500', {
      parseOptions: { format: 'hex' },
      profiles: 'components',
      maxResults: 3
    });

    expect(report.roots[0].summary.bestCandidate?.typeName).toBe('AlgorithmIdentifier');
    expect(report.roots[0].candidates.map((candidate) => candidate.typeName)).toContain('AlgorithmIdentifier');
  });

  it('creates PKI reports from nodes with profile presets', () => {
    const node = sequence([integer(), sequence([oid('1.2.840.113549.1.1.1'), nullNode()]), octetString()]);
    const report = createPkiCandidateReportFromNodes(node, {
      profiles: 'pkcs8',
      minScore: 0.9,
      maxResults: 5
    });

    expect(report.roots[0].candidates.map((candidate) => candidate.typeName)).toEqual(['PrivateKeyInfo']);
  });

  it('ranks RSA public key content inside SubjectPublicKeyInfo BIT STRING subtrees', async () => {
    const report = await createPkiCandidateReport(rsaSubjectPublicKeyInfoHex, {
      parseOptions: { format: 'hex' },
      includeSubtrees: true,
      maxSubtreeDepth: 4,
      maxSubtreeReports: 100,
      maxResults: 5
    });

    expect(report.roots[0].summary.bestCandidate).toMatchObject({
      typeName: 'SubjectPublicKeyInfo',
      confidence: 'high'
    });
    expect(report.roots[0].subtrees?.find((subtree) => subtree.path === '$.1.0')?.summary.bestCandidate).toMatchObject({
      typeName: 'RSAPublicKey',
      confidence: 'high'
    });
  });

  it('keeps EC SubjectPublicKeyInfo raw public key bytes as an empty BIT STRING subtree', async () => {
    const report = await createPkiCandidateReport(ecSubjectPublicKeyInfoHex, {
      parseOptions: { format: 'hex' },
      includeSubtrees: true,
      includeEmptySubtrees: true,
      maxSubtreeDepth: 4,
      maxSubtreeReports: 100,
      maxResults: 5
    });

    expect(report.roots[0].summary.bestCandidate).toMatchObject({
      typeName: 'SubjectPublicKeyInfo',
      confidence: 'high',
      score: 1
    });
    expect(report.roots[0].subtrees?.find((subtree) => subtree.path === '$.1')).toMatchObject({
      features: {
        tagName: 'BIT STRING',
        valueLength: 66
      },
      candidates: []
    });
  });
});