import type { Asn1SchemaModule, SchemaCandidateTarget, SchemaCorpus, SchemaCorpusInput } from './types.js';

export function createSchemaCorpus(input: SchemaCorpusInput): SchemaCorpus {
  if (Array.isArray(input)) return { modules: input };
  if ('modules' in input) return input;
  return { modules: [input] };
}

export function listSchemaTargets(corpusInput: SchemaCorpusInput): SchemaCandidateTarget[] {
  const corpus = createSchemaCorpus(corpusInput);
  return corpus.modules.flatMap((module: Asn1SchemaModule) => module.types.map((definition) => ({ module, definition })));
}