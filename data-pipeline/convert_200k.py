import json
import re
import unicodedata
from pathlib import Path

SOURCE = Path(__file__).parent / "source" / "200k.txt"
OUTPUT = Path(__file__).parent.parent / "data" / "words.json"


# Must stay in sync with ALLOWED_CHARS / STRIP_PATTERN in app/api/search/route.ts:
# anything the API strips from user input must also be absent from the shipped
# word list, otherwise unreachable junk syllables get offered as rhymes.
ALLOWED_CHARS = (
    "a-zđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩị"
    "òóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ"
)
STRIP_PATTERN = re.compile(rf"[^{ALLOWED_CHARS}\s]")


def clean_line(line: str) -> str:
    line = line.replace("﻿", "")
    # 200k.txt is ~58% NFD (tone marks as separate combining codepoints). The
    # allowlist below — and the phonetics analyzer — only know precomposed
    # letters, so decomposed input must be recomposed first or its tone marks
    # would simply be deleted as "disallowed" characters.
    line = unicodedata.normalize("NFC", line)
    line = line.strip().lower()
    # Hyphens/commas/exclamations become a separator rather than being deleted,
    # so "a-xít" yields two real syllables instead of one glued non-syllable.
    line = re.sub(r"[-!,]", " ", line)
    line = STRIP_PATTERN.sub("", line)
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def main() -> None:
    raw_lines = SOURCE.read_text(encoding="utf-8").split("\n")
    seen = set()
    words = []
    for raw_line in raw_lines:
        cleaned = clean_line(raw_line)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        words.append(cleaned)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(words)} words to {OUTPUT}")


if __name__ == "__main__":
    main()
