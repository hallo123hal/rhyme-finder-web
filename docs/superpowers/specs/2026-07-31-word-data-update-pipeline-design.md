# Word Data Update Pipeline — Design

## Background

The rhyme finder's dictionary (`data/words.json`) currently comes from a
one-time conversion of a static legacy file (`200k.txt`, now vendored at
`data-pipeline/source/200k.txt`). That file is frozen — it will never gain
new vocabulary on its own. The goal of this feature is to keep the
dictionary growing over time: more coverage of standard Vietnamese
vocabulary, plus a way to notice new/slang terms as they appear in
circulation, without requiring anyone to babysit a server or write manual
merge scripts by hand each time.

## Goals

- Periodically pull in words the current dictionary is missing, from
  sources that are actually maintained over time (not just a one-off import).
- Surface a lightweight, low-noise way to catch genuinely new/slang terms
  from live Vietnamese text, with a human always deciding what gets kept.
- Fully automated except for the final approve/merge step — no manual
  script-running required to keep the pipeline moving.
- Keep the deployed Next.js app untouched: it still just reads
  `data/words.json` at build time. All of this lives in
  `data-pipeline/`, runs offline/in CI, never at request time.

## Non-goals

- No automatic merging without human review — every update lands as a PR.
- No scraping of arbitrary article HTML — only RSS feed content (title +
  description), which is structured and doesn't break when a site
  redesigns its pages.
- No Vietnamese word-segmentation/tokenizer model — syllables are already
  space-separated in written Vietnamese, so whitespace/punctuation
  splitting is sufficient.
- No persistent state/database for candidate tracking — each run is
  stateless, working only from the current `data/words.json` and that
  week's freshly-fetched source data.

## Architecture

```
GitHub Actions (weekly cron + manual dispatch)
        │
        ▼
data-pipeline/update_words.py
   ├─ sources/wiktionary.py      → kaikki.org Vietnamese Wiktionary JSONL extract
   ├─ sources/wordlist_github.py → a maintained open Vietnamese wordlist repo
   ├─ sources/rss_candidates.py  → 4 Vietnamese news RSS feeds
   └─ merge.py                   → combine + normalize + dedupe against
                                    current data/words.json
        │
        ▼
data/words.json (rewritten: one word per line, alphabetically sorted)
        │
        ▼
peter-evans/create-pull-request → opens/updates "Weekly word update" PR
        │
        ▼
Human reviews diff on GitHub (edits/deletes lines as needed) → merge
        │
        ▼
Vercel redeploys automatically
```

Each source is an independent adapter with the same output shape (a list
of candidate words/phrases); `merge.py` doesn't need to know where a word
came from except for building the PR description.

## Data format change

`data/words.json` is currently written as a single line (one giant JSON
array with no whitespace), which makes diffs unreviewable. It will be
rewritten as one array entry per line, sorted alphabetically by NFC
codepoint order:

```json
[
  "a",
  "a ba giua",
  "a bá hợi",
  ...
]
```

This is still valid JSON — `JSON.parse` in `lib/dictionary.ts` is
unaffected. The only consumers of the formatting itself are humans reading
PR diffs and `git diff` in general.

## Source adapters

### `sources/wiktionary.py` — trusted, auto-merged

Downloads the Vietnamese-language JSONL extract published by
[kaikki.org/dictionary/Vietnamese](https://kaikki.org) — a machine-readable
export of Wiktionary maintained on a regular cadence, so pulling it weekly
picks up genuinely new dictionary entries over time. This avoids parsing
raw MediaWiki XML dumps, which would be far heavier and messier.

Each line is a JSON object with a `word` field; the adapter extracts that
field, applies NFC normalization, and filters through the same
Vietnamese-character allowlist used in `convert_200k.py`.

### `sources/wordlist_github.py` — trusted, one-time-boost in practice

Downloads a raw wordlist file from a maintained open-source Vietnamese
wordlist repository (candidate: `undertheseanlp/dictionary`; the exact
repo/file path is confirmed during implementation — if it can't be
fetched, the adapter reports a clear error rather than silently skipping).

Re-running this weekly is harmless: after the first successful merge,
subsequent runs will typically produce zero new candidates since the
source rarely changes. No special "run once" flag is needed — treating all
three adapters uniformly (fetch + diff against current `words.json` every
run) keeps the pipeline simpler.

### `sources/rss_candidates.py` — higher-risk, flagged for review

Reads the RSS feed XML directly (title + description fields only) from
four Vietnamese news outlets: VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí.
Does **not** fetch individual article pages — RSS content is structured
and stable, avoiding fragile HTML scraping entirely.

Processing:
1. Split feed text on whitespace/punctuation into syllable tokens.
2. Build all 1–4 syllable n-grams (matching the four rhyme-search modes).
3. Filter through the Vietnamese-character allowlist.
4. Keep only n-grams that are **not already in `data/words.json`** and
   appear **at least twice** across that run's fetched feed items (cuts
   down one-off typos/noise; a real emerging term is likely to show up
   more than once across ~20-50 items per feed × 4 feeds).

No cross-run state is kept — each week's feeds naturally contain that
week's items, so re-fetching is inherently "what's new this week."

## Merge & PR generation

`merge.py`:
1. Loads current `data/words.json`.
2. Loads each adapter's candidate list (skipping any adapter that failed,
   logging why).
3. Normalizes (NFC) and dedupes everything together.
4. Writes the result back in the new one-per-line sorted format.
5. Returns per-source counts and the actual RSS candidate list, for the PR
   body.

Example PR body:
```
+42 words from Wiktionary
+3 words from GitHub wordlist
+15 RSS candidates (please double-check these):
  - flex
  - trà xanh
  - ...
```

If a source fails entirely (feed unreachable, dump download fails), the
run continues with the remaining sources and the PR body states which
source was skipped and why — a single flaky source never blocks the
others.

## GitHub Actions workflow

`.github/workflows/update-words.yml`:
- Triggers: weekly cron (Monday, Vietnam time) + `workflow_dispatch` for
  manual runs.
- Runs `data-pipeline/update_words.py`, then uses
  `peter-evans/create-pull-request` to open/update a PR with the branch
  and PR body described above.
- Requires `contents: write` and `pull-requests: write` permissions.
- Before creating a new PR, checks for an already-open PR carrying a fixed
  label (e.g. `word-update`) and pushes to that existing branch instead of
  opening a duplicate — so an unmerged PR from a previous week doesn't
  pile up alongside a new one.

## Testing

- Each adapter gets unit tests against mocked HTTP responses (no real
  network calls in tests) — verifying correct parsing of sample
  Wiktionary/wordlist/RSS data.
- `merge.py` tests cover: dedup correctness, one-per-line sorted output
  format, and that pre-existing words are preserved untouched when nothing
  new is found.
- `rss_candidates.py` gets a focused test for the frequency-threshold
  filter (≥2 occurrences) and the character allowlist filter, using
  fabricated RSS content.
- No CI test attempts to validate the GitHub Actions YAML itself by
  running it end-to-end — that's reviewed by hand.

## Open items for implementation

- Confirm the exact GitHub wordlist repo/file to pull from.
- Confirm exact kaikki.org file URL/format for the current Vietnamese
  extract at implementation time (these paths can change between kaikki.org
  releases).
