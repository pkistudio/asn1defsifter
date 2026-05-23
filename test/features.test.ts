import { describe, expect, it } from 'vitest';
import { extractDerFeatures } from '../src/core';
import { integer, oid, sequence } from './fixtures';

describe('extractDerFeatures', () => {
  it('extracts structural tags and nested OID values', () => {
    const features = extractDerFeatures(sequence([oid('1.2.840.113549.1.1.11'), integer()]));

    expect(features).toMatchObject({
      tagClass: 'universal',
      tagNumber: 16,
      constructed: true,
      tagName: 'SEQUENCE',
      childCount: 2,
      oidValues: ['1.2.840.113549.1.1.11']
    });
    expect(features.childTagSequence).toEqual(['universal:6:primitive', 'universal:2:primitive']);
  });
});