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
