import { parseInputToTlvNodes } from '../adapters/pkistudiojs.js';
import { createPkiComponentCorpus } from '../corpus/pki-components.js';
import { findAsn1Candidates } from '../core/candidates.js';
import { identifyAsn1Document } from '../core/document.js';
import { extractDerFeatures } from '../core/features.js';
import type { CandidateReport, CandidateReportOptions } from '../core/types.js';

export async function createCandidateReport(input: unknown, options: CandidateReportOptions = {}): Promise<CandidateReport> {
  const schemaCorpus = options.schemaCorpus ?? createPkiComponentCorpus();
  const maxResults = options.maxResults ?? 10;
  const nodes = await parseInputToTlvNodes(input, options.parseOptions);

  return {
    roots: nodes.map((node, index) => {
      const candidates = findAsn1Candidates(node, { schemaCorpus, maxResults });
      return {
        index,
        ...(options.includeNodes ? { node } : {}),
        features: extractDerFeatures(node),
        candidates,
        hypotheses: identifyAsn1Document(node, { schemaCorpus, maxResults })
      };
    })
  };
}