# Data pipeline

Not part of the deployed app. Two separate scripts, both offline:

## One-time legacy import (already run — reference only)

    python convert_200k.py

Reads `source/200k.txt` (a vendored historical wordlist) and writes
`../data/words.json`. This has already been run and its output committed;
you shouldn't need to run it again unless rebuilding the dictionary from
scratch.

## Ongoing weekly updates

    python update_words.py

Pulls new candidate words from three sources and merges them into
`../data/words.json`:

- **Wiktionary** (`sources/wiktionary.py`) — the kaikki.org Vietnamese
  extract, auto-merged (trusted, structured source).
- **Open wordlist** (`sources/wordlist_github.py`) — a maintained
  Vietnamese wordlist on GitHub, auto-merged.
- **RSS candidates** (`sources/rss_candidates.py`) — phrases pulled from
  Vietnamese news RSS feeds that aren't in the dictionary yet and appear
  at least twice that run. These are flagged separately in the pipeline's
  summary output — review them before trusting they're real words rather
  than noise.

If an RSS candidate turns out to be junk (a name, boilerplate, a
fragment that isn't really a word), don't just delete it from the PR —
the same phrase will likely reappear in a future run's feeds and get
re-proposed. Instead, add it (one phrase per line) to
`data-pipeline/rejected.txt` in the same PR (or a follow-up commit).
Anything listed there is permanently excluded from future RSS candidate
proposals.

This runs automatically every week via
`.github/workflows/update-words.yml`, which opens a PR against
`data/words.json` for review. Merging the PR redeploys the site
automatically. You can also trigger it manually from the Actions tab
(`workflow_dispatch`), or run `python update_words.py` locally.

Run tests for this pipeline from the repo root:

    python -m unittest discover -t data-pipeline -s data-pipeline/tests -v
