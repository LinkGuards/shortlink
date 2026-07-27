#!/usr/bin/env python3
"""
Fetch RSS feed from brightdailyhub.my.id and convert to articles.json
This script is also used by GitHub Actions to auto-update articles.
"""
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from pathlib import Path

FEED_URL = "https://brightdailyhub.my.id/feed.php"
OUTPUT_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/articles.json")


def fetch_feed(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ShortlinkBot/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_cdata(text: str) -> str:
    # ElementTree already unwraps CDATA, but be defensive
    return text or ""


def parse_date(date_str: str) -> str:
    """Parse RFC 822 date and return ISO 8601."""
    if not date_str:
        return ""
    try:
        # e.g. "Wed, 22 Jul 2026 01:38:05 +0700"
        dt = datetime.strptime(date_str.strip(), "%a, %d %b %Y %H:%M:%S %z")
        return dt.isoformat()
    except ValueError:
        return date_str


def extract_image_from_description(desc: str) -> str:
    """Try to find first image URL inside description HTML."""
    if not desc:
        return ""
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc)
    return m.group(1) if m else ""


def clean_description(desc: str, max_len: int = 280) -> str:
    """Strip HTML tags and trim description."""
    if not desc:
        return ""
    text = re.sub(r"<[^>]+>", "", desc)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def parse_feed(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("Invalid RSS: no channel element")

    site_title = (channel.findtext("title") or "").strip()
    site_link = (channel.findtext("link") or "").strip()
    site_desc = (channel.findtext("description") or "").strip()
    last_build = (channel.findtext("lastBuildDate") or "").strip()

    items = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        guid = (item.findtext("guid") or "").strip()
        desc_raw = item.findtext("description") or ""
        author = (item.findtext("author") or "Admin").strip()
        category = (item.findtext("category") or "Umum").strip()
        pub_date = (item.findtext("pubDate") or "").strip()

        items.append({
            "title": title,
            "link": link,
            "guid": guid,
            "description": clean_description(desc_raw),
            "description_raw": strip_cdata(desc_raw).strip(),
            "author": author,
            "category": category,
            "pubDate": pub_date,
            "pubDateISO": parse_date(pub_date),
            "image": extract_image_from_description(desc_raw),
        })

    return {
        "source": site_link,
        "site_title": site_title,
        "site_description": site_desc,
        "feed_url": FEED_URL,
        "last_build_date": last_build,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total": len(items),
        "articles": items,
    }


def main() -> int:
    print(f"Fetching feed: {FEED_URL}")
    xml_text = fetch_feed(FEED_URL)
    print(f"Got {len(xml_text)} bytes")

    data = parse_feed(xml_text)
    print(f"Parsed {data['total']} articles")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
