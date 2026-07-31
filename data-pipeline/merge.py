import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import normalize_word


def merge_word_lists(existing_words, source_lists):
    merged = set(existing_words)
    counts = {}
    rss_candidates = []

    for source_name, raw_words in source_lists.items():
        added = 0
        for raw in raw_words:
            normalized = normalize_word(raw)
            if not normalized or normalized in merged:
                continue
            merged.add(normalized)
            added += 1
            if source_name == "rss":
                rss_candidates.append(normalized)
        counts[source_name] = added

    return sorted(merged), counts, sorted(rss_candidates)
