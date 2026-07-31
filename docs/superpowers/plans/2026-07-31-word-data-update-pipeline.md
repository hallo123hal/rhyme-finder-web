# Word Data Update Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated weekly pipeline that pulls new Vietnamese vocabulary from three sources (Wiktionary, an open wordlist, and RSS-derived candidates) and opens a GitHub PR against `data/words.json` for human review.

**Architecture:** A shared `common.py` provides normalization/output helpers used by both the existing one-time `convert_200k.py` and the new pipeline. Three independent source adapters under `data-pipeline/sources/` each fetch and return a plain list of candidate words. `merge.py` combines them with the current dictionary. `update_words.py` orchestrates the adapters (isolating failures per-source), calls merge, and writes a PR-body summary. A GitHub Actions workflow runs it weekly and opens/updates a PR via `peter-evans/create-pull-request`.

**Tech Stack:** Python 3.9+ standard library only (no pip dependencies — `urllib.request`, `gzip`, `json`, `re`, `unicodedata`, `xml.etree.ElementTree`, `collections.Counter`, `pathlib`, `unittest`, `unittest.mock`). GitHub Actions (`actions/checkout`, `actions/setup-python`, `peter-evans/create-pull-request`).

## Global Constraints

- No external Python dependencies — everything must run with a stock Python 3.9+ standard library install. No `requirements.txt`, no `pip install` step in CI.
- All new code lives under `data-pipeline/`. The deployed Next.js app is untouched except for the content of `data/words.json`.
- `data/words.json` format: a JSON array, one string per line, sorted by Python's default string ordering after NFC normalization. Both `convert_200k.py` and `update_words.py` must produce this exact format via the shared `common.write_words_json()` helper — never write the array any other way.
- Every new module gets `unittest`-based tests using `unittest.mock` to fake network calls. No test may make a real HTTP request.
- Any XML parsing of network-fetched content must reject DOCTYPE/entity declarations (XXE and billion-laughs defense). `xml.etree.ElementTree.fromstring`/`parse` must never be called directly on untrusted bytes — use the safe parser helper built in Task 4.
- Run all data-pipeline tests from the repo root with: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
- Confirmed working source URLs (verified by hand before writing this plan — do not substitute guessed URLs):
  - Wiktionary (Vietnamese, kaikki.org extract, gzip JSONL): `https://kaikki.org/dictionary/downloads/vi/vi-extract.jsonl.gz`
  - Open wordlist (74k Vietnamese words/phrases, plain text, one per line): `https://raw.githubusercontent.com/duyet/vietnamese-wordlist/master/Viet74K.txt`
  - RSS feeds (RSS 2.0, `<item><title>`/`<description>`, description is HTML-in-CDATA):
    - `https://vnexpress.net/rss/tin-moi-nhat.rss`
    - `https://tuoitre.vn/home.rss`
    - `https://thanhnien.vn/rss/home.rss`
    - `https://dantri.com.vn/rss/home.rss`

---

### Task 1: Shared normalization helpers + reformat `data/words.json`

**Files:**
- Create: `data-pipeline/common.py`
- Create: `data-pipeline/tests/__init__.py` (empty)
- Create: `data-pipeline/tests/test_common.py`
- Modify: `data-pipeline/convert_200k.py`
- Modify: `data/words.json` (regenerated, reformatted — via running the modified script, not hand-edited)

**Interfaces:**
- Produces (used by every later task): `common.ALLOWED_CHARS: str`, `common.normalize_word(text: str) -> str`, `common.write_words_json(words: list, path: pathlib.Path) -> None`

- [ ] **Step 1: Write the failing tests**

```python
# data-pipeline/tests/test_common.py
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import ALLOWED_CHARS, normalize_word, write_words_json


class TestNormalizeWord(unittest.TestCase):
    def test_nfd_input_is_recomposed(self):
        # "yêu" decomposed: y + e + COMBINING CIRCUMFLEX ACCENT (U+0302) + u
        nfd_input = "yêu"
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'common'`

- [ ] **Step 3: Implement `common.py`**

```python
# data-pipeline/common.py
import json
import re
import unicodedata
from pathlib import Path

# Must stay in sync with ALLOWED_CHARS / STRIP_PATTERN in
# app/api/search/route.ts: anything the API strips from user input must
# also be absent from the shipped word list, otherwise unreachable junk
# syllables get offered as rhymes.
ALLOWED_CHARS = (
    "a-zđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩị"
    "òóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ"
)
_STRIP_PATTERN = re.compile(rf"[^{ALLOWED_CHARS}\s]")


def normalize_word(text: str) -> str:
    text = text.replace("﻿", "")
    # Source text may be NFD (tone marks as separate combining codepoints).
    # The allowlist below only knows precomposed letters, so decomposed
    # input must be recomposed first or its tone marks would simply be
    # deleted as "disallowed" characters.
    text = unicodedata.normalize("NFC", text)
    text = text.strip().lower()
    # Hyphens/commas/exclamations become a separator rather than being
    # deleted, so "a-xít" yields two real syllables instead of one glued
    # non-syllable.
    text = re.sub(r"[-!,]", " ", text)
    text = _STRIP_PATTERN.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def write_words_json(words, path: Path) -> None:
    unique_sorted = sorted(set(words))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        f.write("[\n")
        f.write(",\n".join(f"  {json.dumps(w, ensure_ascii=False)}" for w in unique_sorted))
        f.write("\n]\n")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Update `convert_200k.py` to use the shared helpers**

Replace the whole file with:

```python
# data-pipeline/convert_200k.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import normalize_word, write_words_json

SOURCE = Path(__file__).parent / "source" / "200k.txt"
OUTPUT = Path(__file__).parent.parent / "data" / "words.json"


def main() -> None:
    raw_lines = SOURCE.read_text(encoding="utf-8").split("\n")
    seen = set()
    words = []
    for raw_line in raw_lines:
        cleaned = normalize_word(raw_line)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        words.append(cleaned)

    write_words_json(words, OUTPUT)
    print(f"Wrote {len(words)} words to {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Regenerate `data/words.json` and verify the word set is unchanged**

```bash
cd data-pipeline
python -c "import json; print(len(set(json.load(open('../data/words.json')))))"
python convert_200k.py
python -c "import json; print(len(set(json.load(open('../data/words.json')))))"
```

Expected: both counts print the same number (201939), confirming the reformat didn't lose or duplicate any words. Then confirm the file is now one-entry-per-line:

```bash
head -n 5 ../data/words.json
```

Expected: `[`, then one quoted word per line, sorted alphabetically.

- [ ] **Step 7: Confirm the Next.js app still reads the reformatted file correctly**

```bash
cd ..
npm test
```

Expected: existing test suite passes unchanged (JSON.parse doesn't care about formatting).

- [ ] **Step 8: Commit**

```bash
git add data-pipeline/common.py data-pipeline/convert_200k.py data-pipeline/tests/__init__.py data-pipeline/tests/test_common.py data/words.json
git commit -m "Extract shared word-normalization helpers, reformat words.json for readable diffs"
```

---

### Task 2: Wiktionary source adapter

**Files:**
- Create: `data-pipeline/sources/__init__.py` (empty)
- Create: `data-pipeline/sources/wiktionary.py`
- Create: `data-pipeline/tests/test_wiktionary.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 6): `sources.wiktionary.fetch_wiktionary_words(url: str = WIKTIONARY_URL) -> list[str]`, constant `sources.wiktionary.WIKTIONARY_URL: str`

- [ ] **Step 1: Write the failing tests**

```python
# data-pipeline/tests/test_wiktionary.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sources'`

- [ ] **Step 3: Implement `sources/wiktionary.py`**

```python
# data-pipeline/sources/wiktionary.py
import gzip
import json
import urllib.request

WIKTIONARY_URL = "https://kaikki.org/dictionary/downloads/vi/vi-extract.jsonl.gz"


def fetch_wiktionary_words(url: str = WIKTIONARY_URL) -> list:
    request = urllib.request.Request(url, headers={"User-Agent": "rhyme-finder-web-bot/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = gzip.decompress(response.read())

    words = []
    for line in raw.decode("utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        word = entry.get("word")
        if word:
            words.append(word)
    return words
```

Also create the empty `data-pipeline/sources/__init__.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all tests including Task 1's)

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/sources/__init__.py data-pipeline/sources/wiktionary.py data-pipeline/tests/test_wiktionary.py
git commit -m "Add Wiktionary source adapter for word data pipeline"
```

---

### Task 3: GitHub wordlist source adapter

**Files:**
- Create: `data-pipeline/sources/wordlist_github.py`
- Create: `data-pipeline/tests/test_wordlist_github.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 6): `sources.wordlist_github.fetch_github_wordlist_words(url: str = WORDLIST_URL) -> list[str]`, constant `sources.wordlist_github.WORDLIST_URL: str`

- [ ] **Step 1: Write the failing tests**

```python
# data-pipeline/tests/test_wordlist_github.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sources.wordlist_github'`

- [ ] **Step 3: Implement `sources/wordlist_github.py`**

```python
# data-pipeline/sources/wordlist_github.py
import urllib.request

WORDLIST_URL = "https://raw.githubusercontent.com/duyet/vietnamese-wordlist/master/Viet74K.txt"


def fetch_github_wordlist_words(url: str = WORDLIST_URL) -> list:
    request = urllib.request.Request(url, headers={"User-Agent": "rhyme-finder-web-bot/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read().decode("utf-8")
    return [line for line in raw.splitlines() if line.strip()]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/sources/wordlist_github.py data-pipeline/tests/test_wordlist_github.py
git commit -m "Add GitHub wordlist source adapter for word data pipeline"
```

---

### Task 4: RSS candidates source adapter

**Files:**
- Create: `data-pipeline/sources/rss_candidates.py`
- Create: `data-pipeline/tests/test_rss_candidates.py`

**Interfaces:**
- Consumes: `common.ALLOWED_CHARS` (Task 1).
- Produces (used by Task 6): `sources.rss_candidates.fetch_rss_candidates(existing_words: set, feeds: list = None, min_count: int = 2, fetch_fn=None) -> tuple[list[str], list[str]]` — returns `(candidates, skipped_feed_urls)`. Constant `sources.rss_candidates.RSS_FEEDS: list[str]`. Also produces `sources.rss_candidates.safe_parse_xml(xml_bytes_or_str) -> xml.etree.ElementTree.Element`, a DOCTYPE/entity-rejecting parser — this is the only function in the codebase allowed to turn network-fetched bytes into an XML tree, per the Global Constraints XXE rule.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sources.rss_candidates'`

- [ ] **Step 3: Implement `sources/rss_candidates.py`**

```python
# data-pipeline/sources/rss_candidates.py
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from xml.parsers import expat

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import ALLOWED_CHARS

RSS_FEEDS = [
    "https://vnexpress.net/rss/tin-moi-nhat.rss",
    "https://tuoitre.vn/home.rss",
    "https://thanhnien.vn/rss/home.rss",
    "https://dantri.com.vn/rss/home.rss",
]

_TAG_RE = re.compile(r"<[^>]+>")
_TOKEN_RE = re.compile(f"[{ALLOWED_CHARS}]+")


class EntitiesForbidden(ValueError):
    pass


def _forbid_doctype(name, sysid, pubid, has_internal_subset):
    raise EntitiesForbidden(f"DOCTYPE declarations are not allowed: {name}")


def _forbid_entity(*args, **kwargs):
    raise EntitiesForbidden("entity declarations are not allowed")


def safe_parse_xml(xml_bytes_or_str):
    """Parse XML from an untrusted source without expanding DOCTYPEs or
    entities (defends against XXE and billion-laughs). Never parse
    network-fetched XML with xml.etree.ElementTree.fromstring/parse
    directly — always go through this function instead."""
    if isinstance(xml_bytes_or_str, str):
        xml_bytes_or_str = xml_bytes_or_str.encode("utf-8")
    parser = expat.ParserCreate()
    parser.StartDoctypeDeclHandler = _forbid_doctype
    parser.EntityDeclHandler = _forbid_entity
    parser.UnparsedEntityDeclHandler = _forbid_entity
    builder = ET.TreeBuilder()
    parser.StartElementHandler = lambda name, attrs: builder.start(name, attrs)
    parser.EndElementHandler = lambda name: builder.end(name)
    parser.CharacterDataHandler = lambda data: builder.data(data)
    parser.Parse(xml_bytes_or_str, True)
    return builder.close()


def _default_fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def _extract_text(feed_xml: str) -> str:
    root = safe_parse_xml(feed_xml)
    parts = []
    for item in root.iter("item"):
        parts.append(item.findtext("title") or "")
        description = item.findtext("description") or ""
        parts.append(_TAG_RE.sub(" ", description))
    return " ".join(parts)


def _tokenize(text: str) -> list:
    return _TOKEN_RE.findall(text.lower())


def _ngrams(tokens: list, n: int) -> list:
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def fetch_rss_candidates(existing_words, feeds=None, min_count=2, fetch_fn=None):
    feeds = RSS_FEEDS if feeds is None else feeds
    fetch_fn = _default_fetch if fetch_fn is None else fetch_fn

    counts = Counter()
    skipped = []
    for url in feeds:
        try:
            feed_xml = fetch_fn(url)
            text = _extract_text(feed_xml)
        except Exception:
            skipped.append(url)
            continue
        tokens = _tokenize(text)
        for n in (1, 2, 3, 4):
            counts.update(_ngrams(tokens, n))

    candidates = sorted(
        phrase for phrase, count in counts.items()
        if count >= min_count and phrase not in existing_words
    )
    return candidates, skipped
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/sources/rss_candidates.py data-pipeline/tests/test_rss_candidates.py
git commit -m "Add RSS candidate-word source adapter for word data pipeline"
```

---

### Task 5: Merge logic

**Files:**
- Create: `data-pipeline/merge.py`
- Create: `data-pipeline/tests/test_merge.py`

**Interfaces:**
- Consumes: `common.normalize_word` (Task 1).
- Produces (used by Task 6): `merge.merge_word_lists(existing_words: list, source_lists: dict) -> tuple[list[str], dict[str, int], list[str]]` — returns `(merged_sorted_words, counts_by_source_name, rss_candidates)`. `source_lists` is `{source_name: [raw_word, ...]}`; the literal key `"rss"` is treated specially and its newly-added words are also returned as the third tuple element for PR-body callouts.

- [ ] **Step 1: Write the failing tests**

```python
# data-pipeline/tests/test_merge.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'merge'`

- [ ] **Step 3: Implement `merge.py`**

```python
# data-pipeline/merge.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/merge.py data-pipeline/tests/test_merge.py
git commit -m "Add merge logic combining word data pipeline sources"
```

---

### Task 6: Orchestrator script

**Files:**
- Create: `data-pipeline/update_words.py`
- Create: `data-pipeline/tests/test_update_words.py`
- Modify: `rhyme-finder-web/.gitignore` (repo root, one level up from `data-pipeline/`)

**Interfaces:**
- Consumes: `common.write_words_json` (Task 1), `merge.merge_word_lists` (Task 5), all three `fetch_*` functions (Tasks 2-4).
- Produces: `update_words.run(words_path: Path, fetchers: dict, rss_fetcher, summary_path: Path) -> None`. `fetchers` is `{source_name: callable() -> list[str]}` for the non-RSS sources; `rss_fetcher` is `callable(existing_words: set) -> tuple[list[str], list[str]]`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'update_words'`

- [ ] **Step 3: Implement `update_words.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -t data-pipeline -s data-pipeline/tests -v`
Expected: PASS (all tests across every task so far)

- [ ] **Step 5: Ignore the generated summary file**

Add a line to `.gitignore` (repo root):

```
data-pipeline/pr_summary.txt
```

- [ ] **Step 6: Commit**

```bash
git add data-pipeline/update_words.py data-pipeline/tests/test_update_words.py .gitignore
git commit -m "Add orchestrator script wiring word data pipeline sources together"
```

---

### Task 7: GitHub Actions workflow + documentation

**Files:**
- Create: `.github/workflows/update-words.yml`
- Modify: `data-pipeline/README.md`

**Interfaces:**
- Consumes: `data-pipeline/update_words.py` as a runnable script (Task 6); reads `data-pipeline/pr_summary.txt` written by it.

- [ ] **Step 1: Write the workflow file**

```yaml
# .github/workflows/update-words.yml
name: Weekly word update

on:
  schedule:
    # 17:00 UTC Sunday = 00:00 ICT (UTC+7) Monday
    - cron: "0 17 * * 0"
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  update-words:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Run word data pipeline
        run: python data-pipeline/update_words.py

      - name: Read PR summary
        id: summary
        run: |
          {
            echo 'body<<PIPELINE_SUMMARY_EOF'
            cat data-pipeline/pr_summary.txt
            echo 'PIPELINE_SUMMARY_EOF'
          } >> "$GITHUB_OUTPUT"

      - name: Open or update pull request
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "Weekly word data update"
          title: "Weekly word update"
          body: ${{ steps.summary.outputs.body }}
          branch: automated/weekly-word-update
          labels: word-update
          delete-branch: true
```

- [ ] **Step 2: Verify the YAML parses**

```bash
python -c "import yaml, sys; yaml.safe_load(open('.github/workflows/update-words.yml', encoding='utf-8')); print('valid YAML')"
```

Expected: `valid YAML`. (If `pyyaml` isn't installed locally, skip this check — it's a convenience check, not a project dependency; the workflow syntax will also be validated by GitHub itself on push.)

- [ ] **Step 3: Rewrite `data-pipeline/README.md`**

```markdown
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

This runs automatically every week via
`.github/workflows/update-words.yml`, which opens a PR against
`data/words.json` for review. Merging the PR redeploys the site
automatically. You can also trigger it manually from the Actions tab
(`workflow_dispatch`), or run `python update_words.py` locally.

Run tests for this pipeline from the repo root:

    python -m unittest discover -t data-pipeline -s data-pipeline/tests -v
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/update-words.yml data-pipeline/README.md
git commit -m "Add weekly GitHub Actions workflow for automated word data updates"
```

---
