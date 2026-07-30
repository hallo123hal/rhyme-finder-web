import { analyzePhrase, TONE_GROUP, SyllableAnalysis } from './phonetics';
import { Dictionary } from './dictionary';

export type PlainMode = 'don' | 'doi' | 'ba' | 'bon';
export type Mode = PlainMode | 'dao';

const MODE_K: Record<PlainMode, number> = { don: 1, doi: 2, ba: 3, bon: 4 };

export interface RhymeSearchResult {
  total: number;
  results: string[];
}

export class RhymeSearchError extends Error {}

function scoreTone(a: SyllableAnalysis, b: SyllableAnalysis): number {
  if (a.tone === b.tone) return 2;
  if (TONE_GROUP[a.tone] === TONE_GROUP[b.tone]) return 1;
  return 0;
}

export function searchRhyme(dictionary: Dictionary, word: string, mode: PlainMode): RhymeSearchResult {
  const k = MODE_K[mode];
  const syllables = analyzePhrase(word);
  if (syllables.length < k) {
    throw new RhymeSearchError(`Cần nhập ít nhất ${k} âm tiết cho chế độ này.`);
  }

  const inputTail = syllables.slice(-k);
  const key = inputTail.map((s) => s.rhyme).join('|');
  const candidates = dictionary.indices.get(k)?.get(key) ?? [];
  const normalizedInput = word.trim().toLowerCase();

  const scored = candidates
    .filter((c) => c.toLowerCase() !== normalizedInput)
    .map((text) => {
      const candTail = analyzePhrase(text).slice(-k);
      const score = candTail.reduce((sum, s, i) => sum + scoreTone(s, inputTail[i]), 0);
      return { text, score };
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.text.localeCompare(b.text)));

  return { total: scored.length, results: scored.slice(0, 200).map((c) => c.text) };
}
