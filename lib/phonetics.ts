export type Tone = 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang';

export interface SyllableAnalysis {
  onset: string;
  rhyme: string;
  tone: Tone;
  original: string;
}

const VOWEL_GROUPS: [string, string][] = [
  ['a', 'aàáảãạ'],
  ['ă', 'ăằắẳẵặ'],
  ['â', 'âầấẩẫậ'],
  ['e', 'eèéẻẽẹ'],
  ['ê', 'êềếểễệ'],
  ['i', 'iìíỉĩị'],
  ['o', 'oòóỏõọ'],
  ['ô', 'ôồốổỗộ'],
  ['ơ', 'ơờớởỡợ'],
  ['u', 'uùúủũụ'],
  ['ư', 'ưừứửữự'],
  ['y', 'yỳýỷỹỵ'],
];

const TONES: Tone[] = ['ngang', 'huyen', 'sac', 'hoi', 'nga', 'nang'];

const VOWEL_TONE_MAP = new Map<string, [string, Tone]>();
for (const [base, chars] of VOWEL_GROUPS) {
  for (let i = 0; i < chars.length; i++) {
    VOWEL_TONE_MAP.set(chars[i], [base, TONES[i]]);
  }
}

const ONSETS = [
  'ngh',
  'ng', 'nh', 'th', 'ph', 'ch', 'tr', 'kh', 'gh', 'gi', 'qu',
  'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'x',
];

function stripTone(syllable: string): { deMarked: string; tone: Tone } {
  for (let i = 0; i < syllable.length; i++) {
    const hit = VOWEL_TONE_MAP.get(syllable[i]);
    if (hit && hit[1] !== 'ngang') {
      const [base, tone] = hit;
      return { deMarked: syllable.slice(0, i) + base + syllable.slice(i + 1), tone };
    }
  }
  return { deMarked: syllable, tone: 'ngang' };
}

function matchOnset(deMarked: string): string {
  for (const onset of ONSETS) {
    if (deMarked.startsWith(onset)) {
      return onset;
    }
  }
  return '';
}

export function analyzeSyllable(rawSyllable: string): SyllableAnalysis {
  const original = rawSyllable.toLowerCase();
  const { deMarked, tone } = stripTone(original);
  let onset = matchOnset(deMarked);
  let rhyme = deMarked.slice(onset.length);

  if (rhyme.length === 0) {
    if (onset === 'gi') {
      // "gi" + nucleus "i" is written as just "gi" in Vietnamese — the
      // trailing "i" is elided rather than doubled (cf. "gia", "giá" where
      // the nucleus is a different vowel and no elision happens).
      rhyme = 'i';
    } else {
      rhyme = deMarked;
      onset = '';
    }
  }

  if (onset === '' && rhyme.startsWith('y')) {
    rhyme = 'i' + rhyme.slice(1);
  }

  return { onset, rhyme, tone, original };
}

export function analyzePhrase(phrase: string): SyllableAnalysis[] {
  return phrase
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(analyzeSyllable);
}

export const TONE_GROUP: Record<Tone, 'bang' | 'trac'> = {
  ngang: 'bang',
  huyen: 'bang',
  sac: 'trac',
  hoi: 'trac',
  nga: 'trac',
  nang: 'trac',
};
