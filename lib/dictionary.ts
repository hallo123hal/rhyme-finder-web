import wordsData from '../data/words.json';
import { analyzePhrase } from './phonetics';

export interface Dictionary {
  indices: Map<number, Map<string, string[]>>;
  syllablesByRhymeTone: Map<string, { onset: string; syllable: string }[]>;
  adjacentPairs: Set<string>;
  syllableFrequency: Map<string, number>;
}

const RHYME_KS = [1, 2, 3, 4];

export function buildDictionary(words: string[]): Dictionary {
  const indices = new Map<number, Map<string, string[]>>();
  for (const k of RHYME_KS) {
    indices.set(k, new Map<string, string[]>());
  }

  const syllablesByRhymeTone = new Map<string, { onset: string; syllable: string }[]>();
  const seenSyllables = new Set<string>();
  const adjacentPairs = new Set<string>();
  const syllableFrequency = new Map<string, number>();

  for (const text of words) {
    const syllables = analyzePhrase(text);

    for (const k of RHYME_KS) {
      if (syllables.length < k) continue;
      const key = syllables
        .slice(-k)
        .map((s) => s.rhyme)
        .join('|');
      const index = indices.get(k)!;
      const list = index.get(key);
      if (list) list.push(text);
      else index.set(key, [text]);
    }

    for (let i = 0; i < syllables.length; i++) {
      const s = syllables[i];
      syllableFrequency.set(s.original, (syllableFrequency.get(s.original) ?? 0) + 1);
      const dedupeKey = `${s.onset}|${s.rhyme}|${s.tone}`;
      if (!seenSyllables.has(dedupeKey)) {
        seenSyllables.add(dedupeKey);
        const key = `${s.rhyme}|${s.tone}`;
        const list = syllablesByRhymeTone.get(key);
        const item = { onset: s.onset, syllable: s.original };
        if (list) list.push(item);
        else syllablesByRhymeTone.set(key, [item]);
      }
      if (i < syllables.length - 1) {
        adjacentPairs.add(`${s.original} ${syllables[i + 1].original}`);
      }
    }
  }

  return { indices, syllablesByRhymeTone, adjacentPairs, syllableFrequency };
}

let cached: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (!cached) {
    cached = buildDictionary(wordsData as string[]);
  }
  return cached;
}
