#!/usr/bin/env python3
"""Collects public reviews of the original app through official feeds only,
into replica/reviews.csv (source,url,date,rating,text), verbatim.

    python3 tools/collect_reviews.py --out replica/reviews.csv

Sources, both used within their published terms:
  - Apple's customer reviews RSS feed (JSON), several storefronts, 10 pages each
  - Hacker News via the Algolia search API (comments)
Reddit, Google Play, Trustpilot and the rest are read by hand and appended.
Rows already in the CSV (same url) are kept and not duplicated.
"""
import argparse, csv, html, json, os, re, sys, time, urllib.request

APP_ID = "426826309"
COUNTRIES = ["us", "gb", "pt", "br", "au", "ca"]
HN_QUERIES = ["strava alternative", "strava subscription", "strava privacy", "switched from strava", "strava segments"]
UA = {"User-Agent": "passo-research/0.1 (reads public review feeds)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def apple(rows):
    for cc in COUNTRIES:
        for page in range(1, 11):
            url = f"https://itunes.apple.com/{cc}/rss/customerreviews/page={page}/id={APP_ID}/sortBy=mostRecent/json"
            try:
                feed = get(url).get("feed", {})
            except Exception as e:
                print(f"apple {cc} p{page}: {e}", file=sys.stderr); break
            entries = feed.get("entry", [])
            if isinstance(entries, dict):
                entries = [entries]
            entries = [e for e in entries if "im:rating" in e]
            if not entries:
                break
            for e in entries:
                rid = e["id"]["label"]
                title = e.get("title", {}).get("label", "")
                body = e.get("content", {}).get("label", "")
                rows.append({
                    "source": "app-store-" + cc,
                    "url": f"https://apps.apple.com/{cc}/app/id{APP_ID}?see-all=reviews#review-{rid}",
                    "date": e.get("updated", {}).get("label", "")[:10],
                    "rating": e["im:rating"]["label"],
                    "text": (title + ". " + body).strip(),
                })
            time.sleep(1)


def hn(rows):
    for q in HN_QUERIES:
        url = "https://hn.algolia.com/api/v1/search?tags=comment&hitsPerPage=100&query=" + urllib.parse.quote(q)
        try:
            hits = get(url).get("hits", [])
        except Exception as e:
            print(f"hn {q}: {e}", file=sys.stderr); continue
        for h in hits:
            text = html.unescape(re.sub(r"<[^>]+>", " ", h.get("comment_text") or "")).strip()
            if "strava" not in text.lower():
                continue
            rows.append({"source": "hacker-news", "url": f"https://news.ycombinator.com/item?id={h['objectID']}",
                         "date": (h.get("created_at") or "")[:10], "rating": "", "text": re.sub(r"\s+", " ", text)})
        time.sleep(1)


def main():
    import urllib.parse  # noqa: F401
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="replica/reviews.csv")
    args = ap.parse_args()
    existing = []
    if os.path.exists(args.out):
        with open(args.out, newline="", encoding="utf-8") as fh:
            existing = list(csv.DictReader(fh))
    rows = []
    apple(rows); hn(rows)
    seen = {r["url"] for r in existing}
    new = [r for r in rows if r["url"] not in seen and not seen.add(r["url"])]
    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["source", "url", "date", "rating", "text"])
        w.writeheader(); w.writerows(existing + new)
    print(f"{len(new)} new reviews, {len(existing) + len(new)} total -> {args.out}")


if __name__ == "__main__":
    import urllib.parse
    main()
