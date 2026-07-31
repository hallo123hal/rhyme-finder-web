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
