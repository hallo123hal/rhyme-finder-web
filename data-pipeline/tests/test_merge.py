import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from merge import merge_word_lists


class TestMergeWordLists(unittest.TestCase):
    def test_adds_new_words_and_counts_per_source(self):
        merged, counts, rss = merge_word_lists(
            existing_words=["a", "b"],
            source_lists={
                "wiktionary": ["c", "a"],
                "github_wordlist": ["d"],
            },
        )
        self.assertEqual(merged, ["a", "b", "c", "d"])
        self.assertEqual(counts, {"wiktionary": 1, "github_wordlist": 1})
        self.assertEqual(rss, [])

    def test_preserves_existing_words_when_nothing_new(self):
        merged, counts, rss = merge_word_lists(
            existing_words=["a", "b"],
            source_lists={"wiktionary": ["a", "b"]},
        )
        self.assertEqual(merged, ["a", "b"])
        self.assertEqual(counts, {"wiktionary": 0})

    def test_rss_source_is_reported_separately(self):
        merged, counts, rss = merge_word_lists(
            existing_words=["a"],
            source_lists={"rss": ["sương sương", "a"]},
        )
        self.assertEqual(merged, ["a", "sương sương"])
        self.assertEqual(counts, {"rss": 1})
        self.assertEqual(rss, ["sương sương"])

    def test_normalizes_raw_candidates_before_dedup(self):
        merged, counts, rss = merge_word_lists(
            existing_words=["a bung"],
            source_lists={"github_wordlist": ["A Bung", "A-Bung"]},
        )
        self.assertEqual(merged, ["a bung"])
        self.assertEqual(counts, {"github_wordlist": 0})

    def test_deduplicates_across_sources(self):
        merged, counts, rss = merge_word_lists(
            existing_words=[],
            source_lists={"wiktionary": ["cùng"], "github_wordlist": ["cùng"]},
        )
        self.assertEqual(merged, ["cùng"])
        self.assertEqual(counts["wiktionary"] + counts["github_wordlist"], 1)


if __name__ == "__main__":
    unittest.main()
