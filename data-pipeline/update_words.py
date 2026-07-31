# data-pipeline/update_words.py
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import write_words_json
from merge import merge_word_lists
from sources.wiktionary import fetch_wiktionary_words
from sources.wordlist_github import fetch_github_wordlist_words
from sources.rss_candidates import fetch_rss_candidates

WORDS_JSON = Path(__file__).parent.parent / "data" / "words.json"
SUMMARY_FILE = Path(__file__).parent / "pr_summary.txt"


def run(words_path: Path, fetchers: dict, rss_fetcher, summary_path: Path) -> None:
    existing_words = json.loads(words_path.read_text(encoding="utf-8"))
    existing_set = set(existing_words)

    source_lists = {}
    skipped_sources = []

    for name, fetch in fetchers.items():
        try:
            source_lists[name] = fetch()
        except Exception as exc:
            skipped_sources.append(f"{name} ({exc})")

    try:
        rss_words, skipped_feeds = rss_fetcher(existing_set)
        source_lists["rss"] = rss_words
        skipped_sources.extend(f"rss feed {url}" for url in skipped_feeds)
    except Exception as exc:
        skipped_sources.append(f"rss ({exc})")

    merged, counts, rss_candidates = merge_word_lists(existing_words, source_lists)
    write_words_json(merged, words_path)

    lines = [f"+{counts.get(name, 0)} words from {name}" for name in source_lists]
    if rss_candidates:
        lines.append(f"+{len(rss_candidates)} RSS candidates (please double-check these):")
        lines.extend(f"  - {word}" for word in rss_candidates)
    if skipped_sources:
        lines.append("Skipped sources:")
        lines.extend(f"  - {s}" for s in skipped_sources)

    summary = "\n".join(lines) if lines else "No changes this run."
    summary_path.write_text(summary, encoding="utf-8")
    print(summary)


if __name__ == "__main__":
    run(
        words_path=WORDS_JSON,
        fetchers={
            "wiktionary": fetch_wiktionary_words,
            "github_wordlist": fetch_github_wordlist_words,
        },
        rss_fetcher=fetch_rss_candidates,
        summary_path=SUMMARY_FILE,
    )
