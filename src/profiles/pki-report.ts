import { createPkiComponentCorpus } from '../corpus/pki-components.js';
import type { CandidateReport, CandidateReportOptions, TlvNode } from '../core/types.js';
import { createCandidateReport, createCandidateReportFromNodes } from '../report/agent-report.js';
import { getPkiProfileTypeNames, type PkiProfileName } from './pki.js';

export interface PkiCandidateReportOptions extends Omit<CandidateReportOptions, 'schemaCorpus' | 'includeTypes'> {
  profiles?: PkiProfileName | PkiProfileName[];
  includeTypes?: string[];
}

export async function createPkiCandidateReport(input: unknown, options: PkiCandidateReportOptions = {}): Promise<CandidateReport> {
  return createCandidateReport(input, resolvePkiReportOptions(options));
}

export function createPkiCandidateReportFromNodes(nodes: TlvNode | TlvNode[], options: PkiCandidateReportOptions = {}): CandidateReport {
  return createCandidateReportFromNodes(nodes, resolvePkiReportOptions(options));
}

function resolvePkiReportOptions(options: PkiCandidateReportOptions): CandidateReportOptions {
  const { profiles, includeTypes, ...rest } = options;
  return {
    ...rest,
    schemaCorpus: createPkiComponentCorpus(),
    includeTypes: mergeTypeNames(profiles, includeTypes)
  };
}

function mergeTypeNames(profiles: PkiCandidateReportOptions['profiles'], includeTypes: string[] | undefined): string[] | undefined {
  const profileTypes = profiles ? getPkiProfileTypeNames(profiles) : [];
  const merged = [...new Set([...profileTypes, ...(includeTypes ?? [])])];
  return merged.length > 0 ? merged : undefined;
}