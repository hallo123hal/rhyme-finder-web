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

export interface DaoCandidate {
  text: string;
  attested: boolean;
  keepsOriginalOnsets: boolean;
}

export interface DaoSearchResult {
  total: number;
  results: DaoCandidate[];
}

export function generateDao(dictionary: Dictionary, word: string): DaoSearchResult {
  const syllables = analyzePhrase(word);
  if (syllables.length < 2) {
    throw new RhymeSearchError('Cần nhập ít nhất 2 âm tiết cho vần đảo.');
  }

  const prefix = syllables.slice(0, -2);
  const [s1, s2] = syllables.slice(-2);

  const pos1Candidates = dictionary.syllablesByRhymeTone.get(`${s2.rhyme}|${s1.tone}`) ?? [];
  const pos2Candidates = dictionary.syllablesByRhymeTone.get(`${s1.rhyme}|${s2.tone}`) ?? [];

  const prefixText = prefix.map((s) => s.original).join(' ');
  const seen = new Set<string>();
  const candidates: (DaoCandidate & { commonness: number })[] = [];
  const freq = (syllable: string) => dictionary.syllableFrequency.get(syllable) ?? 0;

  for (const a of pos1Candidates) {
    for (const b of pos2Candidates) {
      const pairText = `${a.syllable} ${b.syllable}`;
      if (seen.has(pairText)) continue;
      seen.add(pairText);
      candidates.push({
        text: prefixText ? `${prefixText} ${pairText}` : pairText,
        attested: dictionary.adjacentPairs.has(pairText),
        keepsOriginalOnsets: a.onset === s2.onset && b.onset === s1.onset,
        commonness: Math.min(freq(a.syllable), freq(b.syllable)),
      });
    }
  }

  candidates.sort((x, y) => {
    if (x.attested !== y.attested) return x.attested ? -1 : 1;
    if (x.keepsOriginalOnsets !== y.keepsOriginalOnsets) return x.keepsOriginalOnsets ? -1 : 1;
    if (x.commonness !== y.commonness) return y.commonness - x.commonness;
    return x.text.localeCompare(y.text);
  });

  return {
    total: candidates.length,
    results: candidates
      .slice(0, 100)
      .map(({ text, attested, keepsOriginalOnsets }) => ({ text, attested, keepsOriginalOnsets })),
  };
}
