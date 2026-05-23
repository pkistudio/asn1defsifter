import { parseAsn1Definition } from '@pkistudio/asn1instancebuilder';
import { createSchemaCorpus } from '../core/corpus.js';
import type { SchemaCorpus } from '../core/types.js';

export function parseAsn1DefinitionCorpus(sources: string | string[]): SchemaCorpus {
  const sourceList = Array.isArray(sources) ? sources : [sources];
  return createSchemaCorpus(sourceList.map((source) => parseAsn1Definition(source)));
}