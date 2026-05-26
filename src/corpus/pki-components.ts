import { pkiComponentDefinition as sharedPkiComponentDefinition } from '@pkistudio/asn1instancebuilder';
import { parseAsn1DefinitionCorpus } from '../adapters/asn1instancebuilder.js';
import type { SchemaCorpus } from '../core/types.js';

export const pkiComponentDefinition = sharedPkiComponentDefinition;

let cachedPkiComponentCorpus: SchemaCorpus | undefined;

export function createPkiComponentCorpus(): SchemaCorpus {
  cachedPkiComponentCorpus ??= parseAsn1DefinitionCorpus(pkiComponentDefinition);
  return cachedPkiComponentCorpus;
}