# Rhyme Finder Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js (TypeScript) web app that finds Vietnamese rhymes in 5 modes — vần đơn, vần đôi, vần 3, vần 4, vần đảo (nói lái) — replacing the broken Python/Flask rhyme logic in `find-rhymes-main`, deployable on Vercel with no database.

**Architecture:** A pure-TypeScript phonetics layer (`lib/phonetics.ts`) decomposes each Vietnamese syllable into onset/rhyme/tone. A dictionary layer (`lib/dictionary.ts`) loads a JSON word list and builds in-memory lookup indices once. A rhyme engine (`lib/rhymeEngine.ts`) uses those indices to answer both plain rhyme searches and nói-lái generation. A single Next.js API route exposes this over HTTP; a single client page provides the UI. Word-list generation is a separate, non-deployed Python script.

**Tech Stack:** Next.js 14 (App Router, TypeScript), React 18, Vitest for unit tests, Python 3 (offline data pipeline only, not part of the deployed app).

## Global Constraints

- Repo root for all app code: `D:\rhyme-finder\rhyme-finder-web` (already `git init`-ed; spec is committed at `docs/superpowers/specs/2026-07-30-rhyme-finder-design.md`).
- Do not modify anything under `D:\rhyme-finder\find-rhymes-main` — it is read-only reference/data source.
- No database. Word data ships as a JSON file bundled with the app (`data/words.json`); regenerating it is a manual offline step, not a runtime one.
- 5 search modes: `don` (k=1), `doi` (k=2), `ba` (k=3), `bon` (k=4) match rhyme on the trailing k syllables; `dao` generates nói-lái candidates from the trailing 2 syllables.
- Candidates for `don`/`doi`/`ba`/`bon` are **not** required to match the input's total syllable count — only the trailing k syllables' rhyme must match.
- Tone need not match for `don`/`doi`/`ba`/`bon`, but exact-tone matches score `+2` and same-tone-group (bằng/trắc) matches score `+1` per position, for ranking only.
- `dao` mode must return **all** valid candidate pairs (not one guess), sorted: attested-phrase-in-dictionary first, then original-onset-preserving, then alphabetical.
- `dao` must be validated against the two worked examples from the spec: `"phải chăng"` → results include `"chẳng phai"`; `"di dời"` → results include `"rơi gì"`.
- No code comments except where a genuinely non-obvious rule needs explaining (e.g. the "gi" spelling-elision special case).

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable Next.js app skeleton that later tasks add files into. No exported functions.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "rhyme-finder-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

Task 7's API route uses the `@/*` import alias (matching Next.js convention); Vitest does not
read `tsconfig.json` paths on its own, so the same alias is configured here explicitly.

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
.next
.vercel
*.log
```

- [ ] **Step 6: Create `app/globals.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f7;
  color: #1a1a1a;
}
```

- [ ] **Step 7: Create `app/layout.tsx`**

```tsx
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Tìm Vần',
  description: 'Công cụ tìm vần tiếng Việt: vần đơn, vần đôi, vần 3, vần 4, vần đảo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return <main>Rhyme Finder — coming soon</main>;
}
```

- [ ] **Step 9: Create `README.md`**

```markdown
# Rhyme Finder Web

Vietnamese rhyme finder: vần đơn, vần đôi, vần 3, vần 4, vần đảo.

## Develop

    npm install
    npm run dev

## Test

    npm test

## Build

    npm run build

## Regenerate word data

See `data-pipeline/README.md`.
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: completes with no errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 11: Verify the app builds**

Run: `npm run build`
Expected: build succeeds (this also auto-generates `next-env.d.ts` — do not hand-write that file).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts .gitignore app README.md next-env.d.ts
git commit -m "Scaffold Next.js app skeleton"
```

---

### Task 2: Data pipeline — generate `data/words.json`

**Files:**
- Create: `data-pipeline/convert_200k.py`
- Create: `data-pipeline/README.md`
- Create: `data/words.json` (generated by running the script)

**Interfaces:**
- Consumes: `find-rhymes-main/app/rhymes/data/200k.txt` (sibling repo, read-only).
- Produces: `data/words.json` — a JSON array of lowercase strings, each a word or space-separated phrase. This is the sole input `lib/dictionary.ts` (Task 4) reads.

- [ ] **Step 1: Create `data-pipeline/convert_200k.py`**

```python
import json
import re
from pathlib import Path

SOURCE = Path(__file__).parent.parent.parent / "find-rhymes-main" / "app" / "rhymes" / "data" / "200k.txt"
OUTPUT = Path(__file__).parent.parent / "data" / "words.json"


def clean_line(line: str) -> str:
    line = line.replace("\ufeff", "")
    line = line.strip().lower()
    line = line.replace("'", "").replace('"', "")
    line = re.sub(r"[-!,]", " ", line)
    line = re.sub(r"\d+", "", line)
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def main() -> None:
    raw_lines = SOURCE.read_text(encoding="utf-8").split("\n")
    seen = set()
    words = []
    for raw_line in raw_lines:
        cleaned = clean_line(raw_line)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        words.append(cleaned)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(words)} words to {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create `data-pipeline/README.md`**

```markdown
# Data pipeline

Not part of the deployed app. Run manually, offline, whenever the word list
needs to be regenerated.

    python convert_200k.py

Reads `../../find-rhymes-main/app/rhymes/data/200k.txt` and writes
`../data/words.json`. Commit the resulting `data/words.json` and redeploy —
the web app never reads the old repo or runs Python at runtime.
```

- [ ] **Step 3: Run the script**

Run: `python data-pipeline/convert_200k.py`
Expected: prints `Wrote N words to ...data/words.json` with N in the tens of thousands, and creates `data/words.json`.

- [ ] **Step 4: Verify the output is valid, non-trivial JSON**

Run: `node -e "const w = require('./data/words.json'); console.log(w.length, w.slice(0, 5), w.includes(''))"`
Expected: prints a count > 100000, a 5-element sample array, and `false` (no empty strings in the list).

- [ ] **Step 5: Commit**

```bash
git add data-pipeline data/words.json
git commit -m "Add data pipeline and generate word list from 200k.txt"
```

---

### Task 3: Phonetics module

**Files:**
- Create: `lib/phonetics.ts`
- Test: `lib/phonetics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Tone = 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang'`
  - `interface SyllableAnalysis { onset: string; rhyme: string; tone: Tone; original: string }`
  - `function analyzeSyllable(rawSyllable: string): SyllableAnalysis`
  - `function analyzePhrase(phrase: string): SyllableAnalysis[]`
  - `const TONE_GROUP: Record<Tone, 'bang' | 'trac'>`

  These are consumed by `lib/dictionary.ts` (Task 4) and `lib/rhymeEngine.ts` (Tasks 5–6).

- [ ] **Step 1: Write the failing tests**

Create `lib/phonetics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeSyllable, analyzePhrase, TONE_GROUP } from './phonetics';

describe('analyzeSyllable', () => {
  it('splits a simple onset + rhyme + ngang tone', () => {
    expect(analyzeSyllable('ba')).toEqual({ onset: 'b', rhyme: 'a', tone: 'ngang', original: 'ba' });
  });

  it('keeps ă as its own base vowel and extracts the hỏi tone correctly', () => {
    expect(analyzeSyllable('chăng')).toEqual({ onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' });
    expect(analyzeSyllable('phải')).toEqual({ onset: 'ph', rhyme: 'ai', tone: 'hoi', original: 'phải' });
  });

  it('handles the ngh/gh/tr/kh digraph onsets', () => {
    expect(analyzeSyllable('nghiêng')).toEqual({ onset: 'ngh', rhyme: 'iêng', tone: 'ngang', original: 'nghiêng' });
    expect(analyzeSyllable('trường')).toEqual({ onset: 'tr', rhyme: 'ương', tone: 'huyen', original: 'trường' });
  });

  it('handles the "gi" onset elision when the rhyme would otherwise be empty', () => {
    expect(analyzeSyllable('gì')).toEqual({ onset: 'gi', rhyme: 'i', tone: 'huyen', original: 'gì' });
  });

  it('treats a standalone leading "y" as equivalent to "i" when there is no onset', () => {
    expect(analyzeSyllable('yêu')).toEqual({ onset: '', rhyme: 'iêu', tone: 'ngang', original: 'yêu' });
    expect(analyzeSyllable('chiều')).toEqual({ onset: 'ch', rhyme: 'iêu', tone: 'huyen', original: 'chiều' });
  });

  it('preserves distinct vowel letters instead of collapsing them', () => {
    expect(analyzeSyllable('dời')).toEqual({ onset: 'd', rhyme: 'ơi', tone: 'huyen', original: 'dời' });
    expect(analyzeSyllable('rơi')).toEqual({ onset: 'r', rhyme: 'ơi', tone: 'ngang', original: 'rơi' });
    expect(analyzeSyllable('di')).toEqual({ onset: 'd', rhyme: 'i', tone: 'ngang', original: 'di' });
  });

  it('lowercases input before analysis', () => {
    expect(analyzeSyllable('Chăng')).toEqual({ onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' });
  });
});

describe('analyzePhrase', () => {
  it('splits on whitespace and analyzes each syllable', () => {
    expect(analyzePhrase('phải chăng')).toEqual([
      { onset: 'ph', rhyme: 'ai', tone: 'hoi', original: 'phải' },
      { onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' },
    ]);
  });

  it('collapses repeated whitespace', () => {
    expect(analyzePhrase('  di   dời  ')).toEqual([
      { onset: 'd', rhyme: 'i', tone: 'ngang', original: 'di' },
      { onset: 'd', rhyme: 'ơi', tone: 'huyen', original: 'dời' },
    ]);
  });
});

describe('TONE_GROUP', () => {
  it('groups ngang and huyen as bang, the rest as trac', () => {
    expect(TONE_GROUP.ngang).toBe('bang');
    expect(TONE_GROUP.huyen).toBe('bang');
    expect(TONE_GROUP.sac).toBe('trac');
    expect(TONE_GROUP.hoi).toBe('trac');
    expect(TONE_GROUP.nga).toBe('trac');
    expect(TONE_GROUP.nang).toBe('trac');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/phonetics.test.ts`
Expected: FAIL — `lib/phonetics.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/phonetics.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/phonetics.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/phonetics.ts lib/phonetics.test.ts
git commit -m "Add Vietnamese syllable phonetics analyzer"
```

---

### Task 4: Dictionary module

**Files:**
- Create: `lib/dictionary.ts`
- Test: `lib/dictionary.test.ts`

**Interfaces:**
- Consumes: `analyzePhrase` from `lib/phonetics.ts` (Task 3); `data/words.json` (Task 2) for the real singleton only.
- Produces:
  - `interface DictionaryEntry { text: string; syllables: SyllableAnalysis[] }`
  - `interface Dictionary { entries: DictionaryEntry[]; indices: Map<number, Map<string, string[]>>; syllablesByRhymeTone: Map<string, { onset: string; syllable: string }[]>; adjacentPairs: Set<string> }`
  - `function buildDictionary(words: string[]): Dictionary` — pure, used directly by tests and by Tasks 5–6 with fixture data.
  - `function getDictionary(): Dictionary` — cached singleton built from `data/words.json`, used by the API route (Task 7).

  These are consumed by `lib/rhymeEngine.ts` (Tasks 5–6) and `app/api/search/route.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `lib/dictionary.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/dictionary.test.ts`
Expected: FAIL — `lib/dictionary.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/dictionary.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/dictionary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dictionary.ts lib/dictionary.test.ts
git commit -m "Add dictionary indexing for rhyme lookup and syllable vocabulary"
```

---

### Task 5: Rhyme engine — vần đơn/đôi/3/4

**Files:**
- Create: `lib/rhymeEngine.ts`
- Test: `lib/rhymeEngine.test.ts`

**Interfaces:**
- Consumes: `analyzePhrase`, `TONE_GROUP`, `SyllableAnalysis` from `lib/phonetics.ts`; `Dictionary`, `buildDictionary` from `lib/dictionary.ts`.
- Produces:
  - `type PlainMode = 'don' | 'doi' | 'ba' | 'bon'`
  - `type Mode = PlainMode | 'dao'`
  - `class RhymeSearchError extends Error {}`
  - `interface RhymeSearchResult { total: number; results: string[] }`
  - `function searchRhyme(dictionary: Dictionary, word: string, mode: PlainMode): RhymeSearchResult`

  `searchRhyme` is consumed by `app/api/search/route.ts` (Task 7). Task 6 adds `generateDao` to this same file.

- [ ] **Step 1: Write the failing tests**

Create `lib/rhymeEngine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDictionary } from './dictionary';
import { searchRhyme, RhymeSearchError } from './rhymeEngine';

const FIXTURE = ['yêu', 'chiều', 'chăng', 'trăng', 'vắng', 'yêu thương', 'kiều dương'];

describe('searchRhyme', () => {
  it('finds vần đơn matches on the last syllable regardless of tone', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu', 'don');
    expect(result.results).toContain('chiều');
  });

  it('excludes the input word itself from results', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu', 'don');
    expect(result.results).not.toContain('yêu');
  });

  it('ranks same-tone candidates above different-tone-group candidates', () => {
    // chăng/trăng/vắng all rhyme "ăng"; trăng is tone ngang (exact match with
    // the ngang query, +2), vắng is tone sắc (different tone group, +0).
    const dict = buildDictionary(['chăng', 'trăng', 'vắng']);
    const result = searchRhyme(dict, 'chăng', 'don');
    expect(result.results.indexOf('trăng')).toBeLessThan(result.results.indexOf('vắng'));
  });

  it('matches vần đôi on the trailing two syllables regardless of total length', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu thương', 'doi');
    expect(result.results).toContain('kiều dương');
  });

  it('throws RhymeSearchError when input has fewer syllables than the mode needs', () => {
    const dict = buildDictionary(FIXTURE);
    expect(() => searchRhyme(dict, 'yêu', 'doi')).toThrow(RhymeSearchError);
  });

  it('reports the total count alongside a capped results list', () => {
    const many = Array.from({ length: 250 }, () => 'chăng');
    const dict = buildDictionary(['măng', ...many]);
    const result = searchRhyme(dict, 'măng', 'don');
    expect(result.total).toBeGreaterThan(200);
    expect(result.results.length).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/rhymeEngine.test.ts`
Expected: FAIL — `lib/rhymeEngine.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/rhymeEngine.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/rhymeEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rhymeEngine.ts lib/rhymeEngine.test.ts
git commit -m "Add vần đơn/đôi/3/4 rhyme search"
```

---

### Task 6: Rhyme engine — vần đảo (nói lái)

**Files:**
- Modify: `lib/rhymeEngine.ts`
- Modify: `lib/rhymeEngine.test.ts`

**Interfaces:**
- Consumes: same as Task 5, plus `dictionary.syllablesByRhymeTone` and `dictionary.adjacentPairs` from `lib/dictionary.ts`.
- Produces:
  - `interface DaoCandidate { text: string; attested: boolean; keepsOriginalOnsets: boolean }`
  - `interface DaoSearchResult { total: number; results: DaoCandidate[] }`
  - `function generateDao(dictionary: Dictionary, word: string): DaoSearchResult`

  Consumed by `app/api/search/route.ts` (Task 7).

- [ ] **Step 1: Add the failing tests**

Append to `lib/rhymeEngine.test.ts`:

```ts
import { generateDao } from './rhymeEngine';

const DAO_FIXTURE = ['phải', 'chăng', 'chẳng', 'phẳng', 'phai', 'di', 'dời', 'rơi', 'gì', 'dơi', 'dì'];

describe('generateDao', () => {
  it('reproduces the "phải chăng" -> "chẳng phai" nói lái pair', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'phải chăng');
    expect(result.results.map((r) => r.text)).toContain('chẳng phai');
  });

  it('reproduces the "di dời" -> "rơi gì" nói lái pair', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'di dời');
    expect(result.results.map((r) => r.text)).toContain('rơi gì');
  });

  it('flags candidates that keep the original onsets', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'di dời');
    const dơiDi = result.results.find((r) => r.text === 'dơi dì');
    expect(dơiDi?.keepsOriginalOnsets).toBe(true);
    const rơiGi = result.results.find((r) => r.text === 'rơi gì');
    expect(rơiGi?.keepsOriginalOnsets).toBe(false);
  });

  it('flags candidates that are also an attested adjacent pair in the dictionary', () => {
    const dict = buildDictionary(['phải chăng', 'chẳng phai', ...DAO_FIXTURE]);
    const result = generateDao(dict, 'phải chăng');
    const chẳngPhai = result.results.find((r) => r.text === 'chẳng phai');
    expect(chẳngPhai?.attested).toBe(true);
  });

  it('sorts attested candidates before non-attested ones', () => {
    // With "phẳng" also matching the ăng|hỏi slot, "phẳng phai" becomes a
    // second valid-but-unattested candidate alongside the attested "chẳng phai".
    const dict = buildDictionary(['phải chăng', 'chẳng phai', ...DAO_FIXTURE]);
    const result = generateDao(dict, 'phải chăng');
    expect(result.results[0].text).toBe('chẳng phai');
  });

  it('keeps a fixed prefix when the input has more than two syllables', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'xin di dời');
    expect(result.results.some((r) => r.text === 'xin rơi gì')).toBe(true);
  });

  it('throws RhymeSearchError when input has fewer than two syllables', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    expect(() => generateDao(dict, 'di')).toThrow(RhymeSearchError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/rhymeEngine.test.ts`
Expected: FAIL — `generateDao` is not exported yet.

- [ ] **Step 3: Add `generateDao` to `lib/rhymeEngine.ts`**

Append to `lib/rhymeEngine.ts`:

```ts
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
  const candidates: DaoCandidate[] = [];

  for (const a of pos1Candidates) {
    for (const b of pos2Candidates) {
      const pairText = `${a.syllable} ${b.syllable}`;
      if (seen.has(pairText)) continue;
      seen.add(pairText);
      candidates.push({
        text: prefixText ? `${prefixText} ${pairText}` : pairText,
        attested: dictionary.adjacentPairs.has(pairText),
        keepsOriginalOnsets: a.onset === s2.onset && b.onset === s1.onset,
      });
    }
  }

  candidates.sort((x, y) => {
    if (x.attested !== y.attested) return x.attested ? -1 : 1;
    if (x.keepsOriginalOnsets !== y.keepsOriginalOnsets) return x.keepsOriginalOnsets ? -1 : 1;
    return x.text.localeCompare(y.text);
  });

  return { total: candidates.length, results: candidates.slice(0, 100) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/rhymeEngine.test.ts`
Expected: PASS — including the two worked examples from the spec.

- [ ] **Step 5: Commit**

```bash
git add lib/rhymeEngine.ts lib/rhymeEngine.test.ts
git commit -m "Add vần đảo (nói lái) candidate generation"
```

---

### Task 7: API route

**Files:**
- Create: `app/api/search/route.ts`
- Test: `app/api/search/route.test.ts`

**Interfaces:**
- Consumes: `getDictionary` from `lib/dictionary.ts`; `searchRhyme`, `generateDao`, `RhymeSearchError`, `PlainMode` from `lib/rhymeEngine.ts`.
- Produces: `GET(request: NextRequest): Promise<NextResponse>` handling `GET /api/search?word=...&mode=...`, consumed by `app/page.tsx` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `app/api/search/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

function request(word: string, mode: string): NextRequest {
  const url = `http://localhost/api/search?word=${encodeURIComponent(word)}&mode=${mode}`;
  return new NextRequest(url);
}

describe('GET /api/search', () => {
  it('returns rhyme results for a plain mode', async () => {
    const res = await GET(request('yêu', 'don'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('don');
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('returns dao candidates shaped as {text, attested, keepsOriginalOnsets}', async () => {
    // Exact nói-lái correctness (e.g. "phải chăng" -> "chẳng phai") is already
    // verified against controlled fixtures in lib/rhymeEngine.test.ts; this
    // route-level test only checks wiring and response shape against the
    // real bundled dictionary.
    const res = await GET(request('phải chăng', 'dao'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('dao');
    if (body.results.length > 0) {
      expect(body.results[0]).toEqual(
        expect.objectContaining({
          text: expect.any(String),
          attested: expect.any(Boolean),
          keepsOriginalOnsets: expect.any(Boolean),
        })
      );
    }
  });

  it('returns 400 with an error message for empty input', async () => {
    const res = await GET(request('', 'don'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('returns 400 when the mode requires more syllables than given', async () => {
    const res = await GET(request('yêu', 'doi'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('strips punctuation and digits from the input before searching', async () => {
    const res = await GET(request('yêu!!123', 'don'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.query).toBe('yêu');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: FAIL — `app/api/search/route.ts` does not exist yet.

- [ ] **Step 3: Implement `app/api/search/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDictionary } from '@/lib/dictionary';
import { searchRhyme, generateDao, RhymeSearchError, PlainMode } from '@/lib/rhymeEngine';

const PLAIN_MODES: PlainMode[] = ['don', 'doi', 'ba', 'bon'];
const ALLOWED_CHARS =
  'a-zđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ';
const STRIP_PATTERN = new RegExp(`[^${ALLOWED_CHARS}\\s]`, 'g');

function normalizeInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(STRIP_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const word = normalizeInput(searchParams.get('word') ?? '');
  const modeParam = searchParams.get('mode') ?? 'don';

  if (!word) {
    return NextResponse.json({ error: 'Vui lòng nhập từ cần tìm.' }, { status: 400 });
  }

  const dictionary = getDictionary();

  try {
    if (modeParam === 'dao') {
      const { total, results } = generateDao(dictionary, word);
      return NextResponse.json({ mode: modeParam, query: word, total, results });
    }
    if ((PLAIN_MODES as string[]).includes(modeParam)) {
      const { total, results } = searchRhyme(dictionary, word, modeParam as PlainMode);
      return NextResponse.json({ mode: modeParam, query: word, total, results });
    }
    return NextResponse.json({ error: 'Chế độ không hợp lệ.' }, { status: 400 });
  } catch (err) {
    if (err instanceof RhymeSearchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/search/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/search/route.ts app/api/search/route.test.ts
git commit -m "Add /api/search route"
```

---

### Task 8: Frontend UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `GET /api/search?word=&mode=` (Task 7) via `fetch`.
- Produces: the rendered page at `/`. No further tasks depend on this one.

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'don' | 'doi' | 'ba' | 'bon' | 'dao';

const MODES: { value: Mode; label: string }[] = [
  { value: 'don', label: 'Vần đơn' },
  { value: 'doi', label: 'Vần đôi' },
  { value: 'ba', label: 'Vần 3' },
  { value: 'bon', label: 'Vần 4' },
  { value: 'dao', label: 'Vần đảo' },
];

interface DaoCandidate {
  text: string;
  attested: boolean;
  keepsOriginalOnsets: boolean;
}

interface SearchState {
  loading: boolean;
  error: string | null;
  total: number;
  results: string[] | DaoCandidate[];
}

const INITIAL_STATE: SearchState = { loading: false, error: null, total: 0, results: [] };

export default function Home() {
  const [word, setWord] = useState('');
  const [mode, setMode] = useState<Mode>('don');
  const [state, setState] = useState<SearchState>(INITIAL_STATE);

  useEffect(() => {
    const trimmed = word.trim();
    if (!trimmed) {
      setState(INITIAL_STATE);
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?word=${encodeURIComponent(trimmed)}&mode=${mode}`);
        const data = await res.json();
        if (!res.ok) {
          setState({ loading: false, error: data.error, total: 0, results: [] });
          return;
        }
        setState({ loading: false, error: null, total: data.total, results: data.results });
      } catch {
        setState({ loading: false, error: 'Có lỗi xảy ra, thử lại sau.', total: 0, results: [] });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [word, mode]);

  const isDao = mode === 'dao';
  const daoResults = useMemo(() => (isDao ? (state.results as DaoCandidate[]) : []), [isDao, state.results]);
  const plainResults = useMemo(() => (!isDao ? (state.results as string[]) : []), [isDao, state.results]);

  return (
    <main className="page">
      <h1>Tìm Vần</h1>
      <input
        className="search-input"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Nhập từ hoặc cụm từ..."
      />
      <div className="tabs">
        {MODES.map((m) => (
          <button
            key={m.value}
            className={m.value === mode ? 'tab tab-active' : 'tab'}
            onClick={() => setMode(m.value)}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      {state.loading && <p className="status">Đang tìm...</p>}
      {state.error && <p className="status status-error">{state.error}</p>}
      {!state.loading && !state.error && word.trim() && state.total === 0 && (
        <p className="status">Không tìm thấy.</p>
      )}

      {!isDao && plainResults.length > 0 && (
        <ul className="results">
          {plainResults.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {isDao && daoResults.length > 0 && (
        <ul className="results">
          {daoResults.map((r) => (
            <li key={r.text}>
              {r.text}
              {r.attested && <span className="badge badge-attested">cụm có sẵn</span>}
              {r.keepsOriginalOnsets && <span className="badge">giữ phụ âm gốc</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f7;
  color: #1a1a1a;
}

.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  text-align: center;
  font-size: 28px;
  margin-bottom: 24px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 18px;
  border: 1px solid #d0d0d5;
  border-radius: 10px;
  outline: none;
}

.search-input:focus {
  border-color: #6b5bff;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}

.tab {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid #d0d0d5;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.tab-active {
  background: #6b5bff;
  border-color: #6b5bff;
  color: white;
}

.status {
  color: #666;
  margin-top: 16px;
}

.status-error {
  color: #c0392b;
}

.results {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.results li {
  background: white;
  border: 1px solid #eaeaea;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 16px;
}

.badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eee;
  color: #555;
}

.badge-attested {
  background: #e6f4ea;
  color: #1e7e34;
}
```

- [ ] **Step 3: Start the dev server and verify each mode functionally**

Run: `npm run dev &` (or start it in the background)

Then, with the server running, verify each mode via `curl` against the API (the same endpoint the UI calls):

```bash
curl "http://localhost:3000/api/search?word=y%C3%AAu&mode=don"
curl "http://localhost:3000/api/search?word=y%C3%AAu%20th%C6%B0%C6%A1ng&mode=doi"
curl "http://localhost:3000/api/search?word=ph%E1%BA%A3i%20ch%C4%83ng&mode=dao"
curl "http://localhost:3000/api/search?word=y%C3%AAu&mode=doi"
```

Expected: first three return HTTP 200 with non-empty `results`; the third's results include `"chẳng phai"`; the fourth returns HTTP 400 with an `error` message (not enough syllables for vần đôi).

Then open `http://localhost:3000` in a browser, type a word, switch between all 5 tabs, and confirm the results list updates without a page reload and the loading/no-results/error states render correctly. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "Add rhyme search UI"
```

---

### Task 9: Full test suite and build sanity check

**Files:**
- None created; this task only verifies the finished app.

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: nothing new — this is the final verification gate before considering the plan complete.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all test files pass (`lib/phonetics.test.ts`, `lib/dictionary.test.ts`, `lib/rhymeEngine.test.ts`, `app/api/search/route.test.ts`).

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 3: Fix and re-verify if anything fails**

If any test or the build fails, fix the underlying code (not the test) and re-run Steps 1–2 until both pass.

- [ ] **Step 4: Final commit (only if Step 3 required changes)**

```bash
git add -A
git commit -m "Fix issues found in full test suite and build verification"
```
