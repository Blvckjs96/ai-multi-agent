"""Token compression — reduces input token usage before sending to LLM.

Inspired by OpenHuman's TokenJuice: HTML-to-text conversion, URL shortening,
and whitespace collapse. Reduces cost and latency on long user inputs.
"""

import re
import unicodedata
from html.parser import HTMLParser


class _HTMLStripper(HTMLParser):
    """Strip HTML tags and convert block-level elements to newlines."""

    def __init__(self) -> None:
        super().__init__()
        self.reset()
        self._parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "head"):
            self._skip = True
        elif tag in ("p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr"):
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "head"):
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self._parts.append(data)

    def get_text(self) -> str:
        return "".join(self._parts)


_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_SPACES_RE = re.compile(r"[ \t]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")
_HTML_HINT_RE = re.compile(r"<(?:html|head|body|div|p|span|script)", re.IGNORECASE)


def html_to_text(html: str) -> str:
    """Convert HTML markup to plain text."""
    stripper = _HTMLStripper()
    stripper.feed(html)
    return stripper.get_text()


def shorten_urls(text: str, max_len: int = 80) -> str:
    """Truncate long URLs to save tokens."""

    def _trim(m: re.Match) -> str:  # type: ignore[type-arg]
        url = m.group(0)
        return url if len(url) <= max_len else url[:max_len] + "…"

    return _URL_RE.sub(_trim, text)


def remove_non_ascii(text: str) -> str:
    """Normalise unicode and drop non-ASCII characters (lossy)."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def collapse_whitespace(text: str) -> str:
    """Collapse repeated spaces/tabs and limit blank lines to two."""
    text = _SPACES_RE.sub(" ", text)
    text = _BLANK_LINES_RE.sub("\n\n", text)
    return text.strip()


def compress_text(
    text: str,
    *,
    strip_html: bool = True,
    shorten_urls_flag: bool = True,
    strip_non_ascii: bool = False,
) -> str:
    """Compress text to reduce token count before sending to an LLM.

    Args:
        text: Raw input (may contain HTML markup).
        strip_html: Convert HTML to plain text when markup is detected.
        shorten_urls_flag: Truncate URLs longer than 80 characters.
        strip_non_ascii: Remove non-ASCII characters. Off by default (lossy).

    Returns:
        Compressed text ready for LLM consumption.
    """
    if strip_html and _HTML_HINT_RE.search(text):
        text = html_to_text(text)

    if shorten_urls_flag:
        text = shorten_urls(text)

    if strip_non_ascii:
        text = remove_non_ascii(text)

    return collapse_whitespace(text)


def estimate_tokens(text: str) -> int:
    """Rough token estimate at ~4 chars per token."""
    return max(1, len(text) // 4)
