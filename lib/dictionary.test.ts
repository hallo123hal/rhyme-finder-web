import { describe, expect, it } from 'vitest';
import { buildDictionary } from './dictionary';

const FIXTURE = ['phải chăng', 'chẳng phai', 'di', 'dời', 'rơi', 'gì', 'yêu', 'chiều'];

describe('buildDictionary', () => {
  it('indexes phrases by the rhyme of their last k syllables', () => {
    const dict = buildDictionary(FIXTURE);
    expect(dict.indices.get(1)?.get('iêu')).toEqual(expect.arrayContaining(['yêu', 'chiều']));
  });

  it('only indexes phrases that have at least k syllables', () => {
    const dict = buildDictionary(['di']);
    expect(dict.indices.get(2)?.size ?? 0).toBe(0);
  });

  it('groups every distinct real syllable by its own rhyme+tone', () => {
    const dict = buildDictionary(FIXTURE);
    const pos1 = dict.syllablesByRhymeTone.get('ơi|ngang');
    expect(pos1).toEqual(expect.arrayContaining([{ onset: 'r', syllable: 'rơi' }]));
    const pos2 = dict.syllablesByRhymeTone.get('i|huyen');
    expect(pos2).toEqual(expect.arrayContaining([{ onset: 'gi', syllable: 'gì' }]));
  });

  it('records adjacent syllable pairs seen in any phrase', () => {
    const dict = buildDictionary(FIXTURE);
    expect(dict.adjacentPairs.has('phải chăng')).toBe(true);
    expect(dict.adjacentPairs.has('chẳng phai')).toBe(true);
    expect(dict.adjacentPairs.has('rơi gì')).toBe(false);
  });
});
