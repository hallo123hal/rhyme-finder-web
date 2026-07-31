# data-pipeline/tests/test_update_words.py
import itertools
import json
import string
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from update_words import run, _load_rejected_words


class TestRun(unittest.TestCase):
    def test_writes_merged_words_and_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            words_path = Path(tmp) / "words.json"
            words_path.write_text(json.dumps(["a"]), encoding="utf-8")
            summary_path = Path(tmp) / "pr_summary.txt"

            def ok_fetcher():
                return ["b"]

            def rss_fetcher(existing_words):
                return ["c"], []

            run(
                words_path=words_path,
                fetchers={"wiktionary": ok_fetcher},
                rss_fetcher=rss_fetcher,
                summary_path=summary_path,
            )

            result = json.loads(words_path.read_text(encoding="utf-8"))
            self.assertEqual(result, ["a", "b", "c"])
            summary = summary_path.read_text(encoding="utf-8")
            self.assertIn("+1 words from wiktionary", summary)
            self.assertIn("c", summary)

    def test_isolates_a_failing_source_and_reports_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            words_path = Path(tmp) / "words.json"
            words_path.write_text(json.dumps(["a"]), encoding="utf-8")
            summary_path = Path(tmp) / "pr_summary.txt"

            def ok_fetcher():
                return ["b"]

            def failing_fetcher():
                raise RuntimeError("network down")

            def rss_fetcher(existing_words):
                return [], []

            run(
                words_path=words_path,
                fetchers={"wiktionary": ok_fetcher, "github_wordlist": failing_fetcher},
                rss_fetcher=rss_fetcher,
                summary_path=summary_path,
            )

            result = json.loads(words_path.read_text(encoding="utf-8"))
            self.assertEqual(result, ["a", "b"])
            summary = summary_path.read_text(encoding="utf-8")
            self.assertIn("Skipped sources", summary)
            self.assertIn("github_wordlist", summary)
            self.assertIn("network down", summary)

    def test_reports_skipped_rss_feeds(self):
        with tempfile.TemporaryDirectory() as tmp:
            words_path = Path(tmp) / "words.json"
            words_path.write_text(json.dumps(["a"]), encoding="utf-8")
            summary_path = Path(tmp) / "pr_summary.txt"

            def rss_fetcher(existing_words):
                return [], ["http://broken-feed"]

            run(
                words_path=words_path,
                fetchers={},
                rss_fetcher=rss_fetcher,
                summary_path=summary_path,
            )

            summary = summary_path.read_text(encoding="utf-8")
            self.assertIn("http://broken-feed", summary)

    def test_truncates_rss_candidate_list_in_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            words_path = Path(tmp) / "words.json"
            words_path.write_text(json.dumps([]), encoding="utf-8")
            summary_path = Path(tmp) / "pr_summary.txt"

            # normalize_word() strips digits (only letters/diacritics/space
            # survive), so numeric suffixes like "candidate 0" would all
            # collapse to the same normalized word. Use two-letter suffixes
            # in lexicographic order instead, so each of the 250 candidates
            # survives normalization as a distinct word and the sorted
            # order in merge_word_lists matches generation order.
            suffixes = ["".join(pair) for pair in itertools.product(string.ascii_lowercase, repeat=2)][:250]
            many_candidates = [f"candidate {suffix}" for suffix in suffixes]

            def rss_fetcher(existing_words):
                return many_candidates, []

            run(
                words_path=words_path,
                fetchers={},
                rss_fetcher=rss_fetcher,
                summary_path=summary_path,
            )

            summary = summary_path.read_text(encoding="utf-8")
            self.assertIn("...and 50 more (truncated for PR body length)", summary)
            # The list itself should be capped at 200 entries, not all 250.
            self.assertIn(f"candidate {many_candidates[0].split()[-1]}", summary)
            self.assertIn(f"  - candidate {suffixes[199]}", summary)
            self.assertNotIn(f"  - candidate {suffixes[200]}", summary)
            self.assertNotIn(f"  - candidate {suffixes[249]}", summary)


class TestLoadRejectedWords(unittest.TestCase):
    def test_returns_empty_set_for_nonexistent_path(self):
        result = _load_rejected_words(Path("does/not/exist.txt"))
        self.assertEqual(result, set())

    def test_returns_stripped_nonblank_lines(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "rejected.txt"
            path.write_text("junk phrase\n\n  another junk  \n", encoding="utf-8")
            result = _load_rejected_words(path)
            self.assertEqual(result, {"junk phrase", "another junk"})


class TestRunWithRejectedWords(unittest.TestCase):
    def test_rejected_word_is_never_added_to_words_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            words_path = Path(tmp) / "words.json"
            words_path.write_text(json.dumps(["a"]), encoding="utf-8")
            summary_path = Path(tmp) / "pr_summary.txt"
            rejected_path = Path(tmp) / "rejected.txt"
            rejected_path.write_text("junk phrase\n", encoding="utf-8")

            def rss_fetcher(existing_words):
                return ["junk phrase", "good word"], []

            run(
                words_path=words_path,
                fetchers={},
                rss_fetcher=rss_fetcher,
                summary_path=summary_path,
                rejected_path=rejected_path,
            )

            result = json.loads(words_path.read_text(encoding="utf-8"))
            self.assertNotIn("junk phrase", result)
            self.assertIn("good word", result)


if __name__ == "__main__":
    unittest.main()
