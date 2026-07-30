# Data pipeline

Not part of the deployed app. Run manually, offline, whenever the word list
needs to be regenerated.

    python convert_200k.py

Reads `../../find-rhymes-main/app/rhymes/data/200k.txt` and writes
`../data/words.json`. Commit the resulting `data/words.json` and redeploy —
the web app never reads the old repo or runs Python at runtime.
