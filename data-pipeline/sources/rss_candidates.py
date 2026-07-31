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


def _extract_fields(feed_xml: str) -> list:
    """Return each item's title and description as separate field texts
    so callers can tokenize/n-gram them independently. Joining them into
    one string before n-gramming would fabricate phrases that span two
    unrelated fields (e.g. the last word of one item's description glued
    to the first word of the next item's title)."""
    root = safe_parse_xml(feed_xml)
    fields = []
    for item in root.iter("item"):
        fields.append(item.findtext("title") or "")
        description = item.findtext("description") or ""
        fields.append(_TAG_RE.sub(" ", description))
    return fields


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
            fields = _extract_fields(feed_xml)
        except Exception:
            skipped.append(url)
            continue
        for field_text in fields:
            tokens = _tokenize(field_text)
            for n in (1, 2, 3, 4):
                counts.update(_ngrams(tokens, n))

    candidates = sorted(
        phrase for phrase, count in counts.items()
        if count >= min_count and phrase not in existing_words
    )
    return candidates, skipped
