"""Find freely-licensed campus images for colleges via the Wikipedia API.

Only CC / public-domain images are accepted. Wikipedia lead images for Indian
colleges are frequently non-free logos uploaded under fair use, so every
candidate's licence is checked via imageinfo->extmetadata and anything not
clearly free is dropped rather than guessed at.

Writes images_found.json: [{name, imageUrl, license, credit, pageTitle}]
"""
import json
import re
import time
import urllib.parse
import urllib.request

STOP = {
    "the", "of", "and", "for", "institute", "institutes", "institution", "college",
    "medical", "sciences", "science", "hospital", "research", "centre", "center",
    "school", "university", "postgraduate", "post", "graduate", "education",
}


def _tokens(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2}


def title_matches(college_name, article_title):
    """Guard against the search returning a city or 'List of...' article.

    Without this, "…Institute of Medical Sciences, Port Blair" matches the
    article for the town of Port Blair and we would show a photo of the town
    as the college campus.
    """
    t = article_title.lower()
    if t.startswith(("list of", "index of", "outline of")):
        return False
    a, b = _tokens(college_name), _tokens(article_title)
    if not a or not b:
        return False
    return len(a & b) / len(a | b) >= 0.5

API = "https://en.wikipedia.org/w/api.php"
UA = "Uniscope-CollegeDataSeed/1.0 (educational mentorship app; contact: sri.hari.8101@gmail.com)"

FREE_HINTS = ("cc0", "cc by", "cc-by", "public domain", "pd-", "attribution")
NONFREE_HINTS = ("fair use", "non-free", "nonfree", "copyright", "all rights reserved")


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt == 2:
                print("   api fail:", e)
                return {}
            time.sleep(2 * (attempt + 1))
    return {}


def is_free(license_short, license_url, artist):
    blob = f"{license_short} {license_url}".lower()
    if any(h in blob for h in NONFREE_HINTS):
        return False
    return any(h in blob for h in FREE_HINTS)


def search_title(name):
    """Best-matching article title for a college name, or None."""
    data = api(
        {
            "action": "query",
            "list": "search",
            "srsearch": name,
            "srlimit": 1,
            "srnamespace": 0,
        }
    )
    hits = data.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def page_image(title):
    """(file_title, thumb_url) for the article's lead image."""
    data = api(
        {
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "piprop": "original|name",
            "redirects": 1,
        }
    )
    pages = data.get("query", {}).get("pages", [])
    if not pages:
        return None, None
    p = pages[0]
    orig = (p.get("original") or {}).get("source")
    fname = p.get("pageimage")
    return (f"File:{fname}" if fname else None), orig


def image_license(file_title):
    data = api(
        {
            "action": "query",
            "titles": file_title,
            "prop": "imageinfo",
            "iiprop": "extmetadata|url",
        }
    )
    pages = data.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        return None
    info = pages[0]["imageinfo"][0]
    md = info.get("extmetadata", {})

    def g(k):
        return (md.get(k) or {}).get("value", "") or ""

    return {
        "license": g("LicenseShortName"),
        "licenseUrl": g("LicenseUrl"),
        "artist": g("Artist"),
        "url": info.get("url"),
    }


def main():
    colleges = json.load(open("colleges.json"))
    try:
        found = {c["name"]: c for c in json.load(open("images_found.json"))}
    except Exception:
        found = {}

    stats = {"free": 0, "nonfree": 0, "no_image": 0, "no_article": 0}

    for idx, c in enumerate(colleges):
        name = c["name"]
        if name in found:
            continue
        if idx % 25 == 0:
            print(f"[{idx}/{len(colleges)}] {stats}", flush=True)

        query = name if len(name) < 90 else name[:90]
        title = search_title(f"{query} {c['state']}")
        if not title or not title_matches(name, title):
            stats["no_article"] += 1
            found[name] = {
                "name": name,
                "imageUrl": None,
                "reason": f"no confident article match (got {title!r})",
            }
            continue

        file_title, orig = page_image(title)
        if not file_title or not orig:
            stats["no_image"] += 1
            found[name] = {"name": name, "imageUrl": None, "reason": "no lead image", "pageTitle": title}
            continue

        lic = image_license(file_title) or {}
        if not is_free(lic.get("license", ""), lic.get("licenseUrl", ""), lic.get("artist", "")):
            stats["nonfree"] += 1
            found[name] = {
                "name": name,
                "imageUrl": None,
                "reason": f"non-free: {lic.get('license','?')}",
                "pageTitle": title,
            }
            continue

        stats["free"] += 1
        found[name] = {
            "name": name,
            "imageUrl": orig,
            "license": lic.get("license"),
            "credit": lic.get("artist"),
            "pageTitle": title,
        }

        if idx % 20 == 0:
            json.dump(list(found.values()), open("images_found.json", "w"), indent=1)
        time.sleep(0.35)  # be polite to the API

    json.dump(list(found.values()), open("images_found.json", "w"), indent=1)
    print("DONE", stats)
    print("with free image:", len([v for v in found.values() if v.get("imageUrl")]))


if __name__ == "__main__":
    main()
