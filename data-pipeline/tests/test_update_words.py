# data-pipeline/tests/test_update_words.py
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from update_words import run


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


if __name__ == "__main__":
    unittest.main()
