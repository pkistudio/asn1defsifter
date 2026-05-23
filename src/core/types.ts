import type { Asn1SchemaModule, Asn1TypeDefinition } from '@pkistudio/asn1instancebuilder';

export type TlvTagClass = 'universal' | 'application' | 'context' | 'private';

export type UniversalTagName =
  | 'BOOLEAN'
  | 'INTEGER'
  | 'BIT STRING'
  | 'OCTET STRING'
  | 'NULL'
  | 'OBJECT IDENTIFIER'
  | 'UTF8String'
  | 'SEQUENCE'
  | 'SET'
  | 'PrintableString'
  | 'IA5String'
  | 'UTCTime'
  | 'GeneralizedTime'
  | string;

export interface TlvNode {
  id?: string;
  tagClass: TlvTagClass;
  tagNumber: number;
  constructed: boolean;
  tagName?: UniversalTagName;
  valueBytes?: Uint8Array;
  encodedBytes?: Uint8Array;
  value?: unknown;
  oid?: string;
  oidName?: string;
  children?: TlvNode[];
  start?: number;
  end?: number;
}

export interface TlvFeatures {
  tagClass: TlvTagClass;
  tagNumber: number;
  constructed: boolean;
  tagName: string;
  childCount: number;
  childTagSequence: string[];
  oidValues: string[];
  oidNames: string[];
  primitiveValueKind?: string;
  valueLength?: number;
}

export type CandidateConfidence = 'low' | 'medium' | 'high';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  path: string;
  message: string;
}

export interface EvidenceItem {
  path: string;
  message: string;
}

export interface MatchedPath {
  nodePath: string;
  schemaPath: string;
}

export interface Candidate {
  typeName: string;
  moduleName?: string;
  score: number;
  confidence: CandidateConfidence;
  evidence: string[];
  diagnostics: Diagnostic[];
  ambiguities: string[];
  matchedPaths: MatchedPath[];
}

export interface CandidateOptions {
  schemaCorpus: SchemaCorpusInput;
  maxResults?: number;
  context?: CandidateContext;
}

export interface CandidateContext {
  parentType?: string;
  fieldPath?: string;
  knownOids?: Record<string, string>;
}

export interface SchemaCorpus {
  modules: Asn1SchemaModule[];
}

export type SchemaCorpusInput = SchemaCorpus | Asn1SchemaModule | Asn1SchemaModule[];

export interface SchemaCandidateTarget {
  module: Asn1SchemaModule;
  definition: Asn1TypeDefinition;
}

export interface MatchResult {
  score: number;
  possible: boolean;
  evidence: EvidenceItem[];
  diagnostics: Diagnostic[];
  ambiguities: string[];
  matchedPaths: MatchedPath[];
}

export interface AnnotatedNode {
  id?: string;
  tagName: string;
  asn1Type?: string;
  fieldName?: string;
  schemaPath?: string;
  start?: number;
  end?: number;
  children: AnnotatedNode[];
}

export interface DocumentHypothesis {
  rootType: string;
  moduleName?: string;
  score: number;
  confidence: CandidateConfidence;
  evidence: string[];
  diagnostics: Diagnostic[];
  annotatedTree: AnnotatedNode[];
  alternatives: Candidate[];
}

export interface CandidateReportOptions {
  schemaCorpus?: SchemaCorpusInput;
  maxResults?: number;
  parseOptions?: Record<string, unknown>;
  includeNodes?: boolean;
}

export interface CandidateReportRoot {
  index: number;
  node?: TlvNode;
  features: TlvFeatures;
  summary: CandidateReportSummary;
  candidates: Candidate[];
  hypotheses: DocumentHypothesis[];
  diagnostics: Diagnostic[];
  ambiguities: string[];
}

export interface CandidateReportSummary {
  candidateCount: number;
  bestCandidate?: CandidateReportCandidateSummary;
  diagnosticCounts: Record<DiagnosticSeverity, number>;
  ambiguityCount: number;
}

export interface CandidateReportCandidateSummary {
  typeName: string;
  moduleName?: string;
  score: number;
  confidence: CandidateConfidence;
}

export interface CandidateReport {
  roots: CandidateReportRoot[];
}

export type { Asn1Field, Asn1SchemaModule, Asn1Type, Asn1TypeDefinition } from '@pkistudio/asn1instancebuilder';