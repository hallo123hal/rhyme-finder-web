import json
import sys
import tempfile
import unicodedata
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import ALLOWED_CHARS, normalize_word, write_words_json


class TestNormalizeWord(unittest.TestCase):
    def test_nfd_input_is_recomposed(self):
        nfd_input = unicodedata.normalize("NFD", "yêu")
        # sanity-check the fixture itself is actually decomposed (4 codepoints,
        # not 3) — this guards against the exact transcription bug that slipped
        # through last time, where a literal silently became NFC again
        self.assertEqual(len(nfd_input), 4)
        self.assertEqual(normalize_word(nfd_input), "yêu")

    def test_hyphen_becomes_separator(self):
        self.assertEqual(normalize_word("a-xít"), "a xít")

    def test_disallowed_characters_are_stripped(self):
        self.assertEqual(normalize_word("hello123 xin chào!"), "hello xin chào")

    def test_uppercase_is_lowered(self):
        self.assertEqual(normalize_word("A Di Đà Phật"), "a di đà phật")

    def test_collapses_whitespace(self):
        self.assertEqual(normalize_word("xin   chào"), "xin chào")

    def test_empty_after_stripping_returns_empty_string(self):
        self.assertEqual(normalize_word("123!!!"), "")


class TestWriteWordsJson(unittest.TestCase):
    def test_writes_sorted_deduped_one_per_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "words.json"
            write_words_json(["b", "a", "a", "c"], path)
            content = path.read_text(encoding="utf-8")
            self.assertEqual(json.loads(content), ["a", "b", "c"])
            lines = content.splitlines()
            # opening bracket, 3 entries, closing bracket = 5 lines
            self.assertEqual(len(lines), 5)
            self.assertIn('"a"', lines[1])


if __name__ == "__main__":
    unittest.main()
