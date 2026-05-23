import { createPkiComponentCorpus, findAsn1Candidates, parseInputToTlvNodes } from '../dist/index.js';

const input = '300d06092a864886f70d01010b0500';
const [node] = await parseInputToTlvNodes(input, { format: 'hex' });
const candidates = findAsn1Candidates(node, {
  schemaCorpus: createPkiComponentCorpus(),
  maxResults: 5
});

const best = candidates[0];
if (!best || best.typeName !== 'AlgorithmIdentifier') {
  console.error('Smoke check failed: expected AlgorithmIdentifier as the top candidate.');
  console.error(JSON.stringify(candidates, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Best candidate: ${best.moduleName}.${best.typeName}`);
  console.log(`Score: ${best.score}`);
  console.log(`Confidence: ${best.confidence}`);
  console.log('Evidence:');
  for (const item of best.evidence) console.log(`- ${item}`);
}