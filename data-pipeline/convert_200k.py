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
