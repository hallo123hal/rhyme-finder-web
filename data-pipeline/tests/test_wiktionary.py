import gzip
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.wiktionary import fetch_wiktionary_words


def _fake_response(lines):
    body = "\n".join(json.dumps(line, ensure_ascii=False) for line in lines).encode("utf-8")
    compressed = gzip.compress(body)
    mock_resp = MagicMock()
    mock_resp.read.return_value = compressed
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False
    return mock_resp


class TestFetchWiktionaryWords(unittest.TestCase):
    @patch("sources.wiktionary.urllib.request.urlopen")
    def test_extracts_word_field_from_each_line(self, mock_urlopen):
        mock_urlopen.return_value = _fake_response([
            {"word": "trở thành", "pos": "verb"},
            {"word": "yêu", "pos": "verb"},
        ])
        result = fetch_wiktionary_words()
        self.assertEqual(result, ["trở thành", "yêu"])

    @patch("sources.wiktionary.urllib.request.urlopen")
    def test_skips_malformed_json_lines(self, mock_urlopen):
        body = b'{"word": "obj"}\nnot json\n{"word": "another"}\n'
        compressed = gzip.compress(body)
        mock_resp = MagicMock()
        mock_resp.read.return_value = compressed
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = False
        mock_urlopen.return_value = mock_resp

        result = fetch_wiktionary_words()
        self.assertEqual(result, ["obj", "another"])

    @patch("sources.wiktionary.urllib.request.urlopen")
    def test_skips_lines_without_word_field(self, mock_urlopen):
        mock_urlopen.return_value = _fake_response([
            {"pos": "verb"},
            {"word": "có nghĩa"},
        ])
        result = fetch_wiktionary_words()
        self.assertEqual(result, ["có nghĩa"])


if __name__ == "__main__":
    unittest.main()
