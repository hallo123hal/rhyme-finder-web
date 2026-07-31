# data-pipeline/tests/test_rss_candidates.py
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.rss_candidates import fetch_rss_candidates, safe_parse_xml, _tokenize, _ngrams


SAMPLE_FEED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
  <title>Trào lưu sương sương lan rộng khắp nơi</title>
  <description><![CDATA[<a href="x">ảnh</a>Giới trẻ đang sương sương với trào lưu mới.]]></description>
</item>
<item>
  <title>Ai cũng thích sương sương vào cuối tuần</title>
  <description><![CDATA[Không khí sương sương bao trùm thành phố.]]></description>
</item>
</channel></rss>
"""

MALICIOUS_FEED_XML = """<?xml version="1.0"?>
<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]>
<rss><channel><item><title>&lol2;</title></item></channel></rss>
"""


class TestSafeParseXml(unittest.TestCase):
    def test_parses_normal_feed(self):
        root = safe_parse_xml(SAMPLE_FEED_XML)
        self.assertEqual(root.tag, "rss")

    def test_rejects_doctype_declarations(self):
        with self.assertRaises(Exception):
            safe_parse_xml(MALICIOUS_FEED_XML)


class TestTokenizeAndNgrams(unittest.TestCase):
    def test_tokenize_lowercases_and_extracts_vietnamese_words(self):
        self.assertEqual(_tokenize("Xin Chào 123 Việt Nam!"), ["xin", "chào", "việt", "nam"])

    def test_ngrams_builds_adjacent_windows(self):
        self.assertEqual(_ngrams(["a", "b", "c"], 2), ["a b", "b c"])
        self.assertEqual(_ngrams(["a", "b", "c"], 4), [])


class TestFetchRssCandidates(unittest.TestCase):
    def test_finds_repeated_new_phrase_above_threshold(self):
        def fake_fetch(url):
            return SAMPLE_FEED_XML

        candidates, skipped = fetch_rss_candidates(
            existing_words={"trào lưu", "giới trẻ"},
            feeds=["http://fake-feed"],
            min_count=2,
            fetch_fn=fake_fetch,
        )
        self.assertIn("sương sương", candidates)
        self.assertEqual(skipped, [])

    def test_excludes_words_already_in_dictionary(self):
        def fake_fetch(url):
            return SAMPLE_FEED_XML

        candidates, _ = fetch_rss_candidates(
            existing_words={"sương sương", "trào lưu", "giới trẻ"},
            feeds=["http://fake-feed"],
            min_count=2,
            fetch_fn=fake_fetch,
        )
        self.assertNotIn("sương sương", candidates)

    def test_excludes_single_occurrence_below_threshold(self):
        def fake_fetch(url):
            return SAMPLE_FEED_XML

        candidates, _ = fetch_rss_candidates(
            existing_words=set(),
            feeds=["http://fake-feed"],
            min_count=2,
            fetch_fn=fake_fetch,
        )
        # "cuối tuần" only appears once across both items
        self.assertNotIn("cuối tuần", candidates)

    def test_records_failed_feed_as_skipped_and_continues(self):
        def fake_fetch(url):
            if url == "http://broken-feed":
                raise RuntimeError("connection refused")
            return SAMPLE_FEED_XML

        candidates, skipped = fetch_rss_candidates(
            existing_words=set(),
            feeds=["http://broken-feed", "http://fake-feed"],
            min_count=2,
            fetch_fn=fake_fetch,
        )
        self.assertEqual(skipped, ["http://broken-feed"])
        self.assertIn("sương sương", candidates)

    def test_malicious_feed_is_skipped_not_crashed_on(self):
        def fake_fetch(url):
            return MALICIOUS_FEED_XML

        candidates, skipped = fetch_rss_candidates(
            existing_words=set(),
            feeds=["http://evil-feed"],
            min_count=1,
            fetch_fn=fake_fetch,
        )
        self.assertEqual(skipped, ["http://evil-feed"])
        self.assertEqual(candidates, [])


if __name__ == "__main__":
    unittest.main()
