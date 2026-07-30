import wordsData from '../data/words.json';
import { analyzePhrase, SyllableAnalysis } from './phonetics';

export interface DictionaryEntry {
  text: string;
  syllables: SyllableAnalysis[];
}

export interface Dictionary {
  entries: DictionaryEntry[];
  indices: Map<number, Map<string, string[]>>;
  syllablesByRhymeTone: Map<string, { onset: string; syllable: string }[]>;
  adjacentPairs: Set<string>;
}

const RHYME_KS = [1, 2, 3, 4];

export function buildDictionary(words: string[]): Dictionary {
  const entries: DictionaryEntry[] = words.map((text) => ({
    text,
    syllables: analyzePhrase(text),
  }));

  const indices = new Map<number, Map<string, string[]>>();
  for (const k of RHYME_KS) {
    const index = new Map<string, string[]>();
    for (const entry of entries) {
      if (entry.syllables.length < k) continue;
      const key = entry.syllables
        .slice(-k)
        .map((s) => s.rhyme)
        .join('|');
      const list = index.get(key);
      if (list) list.push(entry.text);
      else index.set(key, [entry.text]);
    }
    indices.set(k, index);
  }

  const syllablesByRhymeTone = new Map<string, { onset: string; syllable: string }[]>();
  const seenSyllables = new Set<string>();
  const adjacentPairs = new Set<string>();

  for (const entry of entries) {
    for (let i = 0; i < entry.syllables.length; i++) {
      const s = entry.syllables[i];
      const dedupeKey = `${s.onset}|${s.rhyme}|${s.tone}`;
      if (!seenSyllables.has(dedupeKey)) {
        seenSyllables.add(dedupeKey);
        const key = `${s.rhyme}|${s.tone}`;
        const list = syllablesByRhymeTone.get(key);
        const item = { onset: s.onset, syllable: s.original };
        if (list) list.push(item);
        else syllablesByRhymeTone.set(key, [item]);
      }
      if (i < entry.syllables.length - 1) {
        adjacentPairs.add(`${s.original} ${entry.syllables[i + 1].original}`);
      }
    }
  }

  return { entries, indices, syllablesByRhymeTone, adjacentPairs };
}

let cached: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (!cached) {
    cached = buildDictionary(wordsData as string[]);
  }
  return cached;
}
