import urllib.request

WORDLIST_URL = "https://raw.githubusercontent.com/duyet/vietnamese-wordlist/master/Viet74K.txt"


def fetch_github_wordlist_words(url: str = WORDLIST_URL) -> list:
    request = urllib.request.Request(url, headers={"User-Agent": "rhyme-finder-web-bot/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read().decode("utf-8")
    return [line for line in raw.splitlines() if line.strip()]
