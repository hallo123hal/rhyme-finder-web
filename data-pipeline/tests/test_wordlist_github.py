import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources.wordlist_github import fetch_github_wordlist_words


def _fake_response(text: str):
    mock_resp = MagicMock()
    mock_resp.read.return_value = text.encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False
    return mock_resp


class TestFetchGithubWordlistWords(unittest.TestCase):
    @patch("sources.wordlist_github.urllib.request.urlopen")
    def test_splits_into_one_entry_per_line(self, mock_urlopen):
        mock_urlopen.return_value = _fake_response("a\nA Bung\na-ba-giua\n")
        result = fetch_github_wordlist_words()
        self.assertEqual(result, ["a", "A Bung", "a-ba-giua"])

    @patch("sources.wordlist_github.urllib.request.urlopen")
    def test_skips_blank_lines(self, mock_urlopen):
        mock_urlopen.return_value = _fake_response("a\n\n\nb\n")
        result = fetch_github_wordlist_words()
        self.assertEqual(result, ["a", "b"])


if __name__ == "__main__":
    unittest.main()
