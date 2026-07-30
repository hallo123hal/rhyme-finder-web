import json
import re
from pathlib import Path

SOURCE = Path(__file__).parent.parent.parent / "find-rhymes-main" / "app" / "rhymes" / "data" / "200k.txt"
OUTPUT = Path(__file__).parent.parent / "data" / "words.json"


def clean_line(line: str) -> str:
    line = line.replace("﻿", "")
    line = line.strip().lower()
    line = line.replace("'", "").replace('"', "")
    line = re.sub(r"[-!,]", " ", line)
    line = re.sub(r"\d+", "", line)
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
