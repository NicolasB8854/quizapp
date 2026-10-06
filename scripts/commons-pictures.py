#!/usr/bin/env python3
"""Bilderrätsel-Fotos von Wikimedia Commons (nur Public Domain / CC0).

Pro Motiv (Slug aus scripts/picture-questions.json): Commons-Suche, Filter auf
gemeinfreie Lizenzen und Mindestgröße, die besten Kandidaten laden, per
kiro-cli bewerten (wie generate-images.py --review). Ergebnis in
.audit-work/brand/candidates/pic-<slug>-commons-<n>.jpg + .review.txt + .license.json.
Danach übernimmt scripts/merge-picture-questions.py wie gewohnt das beste Bild.

Aufruf: python3 scripts/commons-pictures.py [slug ...]   (ohne Slugs: alle ohne Bild)
"""
import html
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".audit-work/brand/candidates"
UA = {"User-Agent": "quizo-private-quiz/1.0 (picture search; non-commercial)"}
PER_MOTIF = 4
FREE = re.compile(r"^(public domain|pd\b|cc0|cc-zero|no restrictions)", re.I)
SKIP = re.compile(r"\b(map|karte|diagram|drawing|illustration|logo|stamp|briefmarke|coat of arms|plate \d|engraving|museum label)\b", re.I)

# Suchbegriffe (englisch/wissenschaftlich liefert auf Commons die besten Treffer)
QUERY = {
    "sitar": "sitar instrument", "steeldrum": "steelpan", "drehleier": "hurdy-gurdy instrument",
    "nautilus": "Nautilus pompilius", "kasuar": "Casuarius", "schuhschnabel": "Balaeniceps rex",
    "rechenschieber": "slide rule", "astrolabium": "astrolabe", "okapi": "Okapia johnstoni",
    "axolotl": "Ambystoma mexicanum", "theremin": "theremin", "sextant": "sextant navigation",
    "didgeridoo": "didgeridoo", "romanesco": "romanesco broccoli", "geige": "violin",
    "tapir": "Tapirus", "okra": "okra pods", "kohlrabi": "kohlrabi", "pastinake": "parsnip",
    "dudelsack": "bagpipes", "abakus": "abacus", "igelfisch": "Diodon porcupinefish",
    "venusfliegenfalle": "Dionaea muscipula", "nasenaffe": "Nasalis larvatus", "mandrill": "Mandrillus sphinx",
    "sternfrucht": "carambola star fruit", "metronom": "metronome", "stimmgabel": "tuning fork",
    "rotes-panda": "Ailurus fulgens", "pfeilgiftfrosch": "Dendrobates", "baobab": "Adansonia baobab tree",
    "tukan": "Ramphastos toco", "ameisenbaer": "Myrmecophaga tridactyla", "seeotter": "Enhydra lutris",
    "durian": "durian fruit", "kakaofrucht": "cacao pod", "bandoneon": "bandoneon", "hackbrett": "hammered dulcimer",
}


def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({"format": "json", **params})
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read())


def strip(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def candidates(term: str):
    data = api({
        "action": "query", "generator": "search", "gsrsearch": f"filetype:bitmap {term}", "gsrnamespace": "6",
        "gsrlimit": "50", "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": "1200",
        "iiextmetadatafilter": "LicenseShortName|Artist|ObjectName",
    })
    pages = sorted((data.get("query", {}).get("pages") or {}).values(), key=lambda p: p.get("index", 999))
    for p in pages:
        ii = p["imageinfo"][0]
        meta = ii.get("extmetadata", {})
        lic = meta.get("LicenseShortName", {}).get("value", "")
        if not FREE.match(lic) or ii["width"] < 900 or ii["height"] < 600 or SKIP.search(p["title"]):
            continue
        if ii["width"] / ii["height"] > 2.2 or ii["height"] / ii["width"] > 1.6:
            continue
        # Die Commons-Suche ist unscharf: Suchwort muss im Dateinamen vorkommen.
        words = [w.lower() for w in re.split(r"[\s-]+", term) if len(w) > 3]
        if words and not any(w[:6] in p["title"].lower() for w in words):
            continue
        yield {
            "title": p["title"], "license": lic, "artist": strip(meta.get("Artist", {}).get("value", "")),
            "url": ii.get("thumburl") or ii["url"], "page": ii["descriptionurl"],
        }


def review(img: Path, q: dict) -> str:
    opts = q["options"]
    prompt = (
        f"Lies das Bild {img} mit deinem Datei-Lesetool (Bildmodus). Es ist ein echtes Foto für eine Quizfrage 'Was ist das?' "
        f"mit den Antworten {opts}. Richtig ist '{opts[q['correct']]}'. Prüfe streng: Zeigt das Foto eindeutig und gut erkennbar "
        f"'{opts[q['correct']]}' als Hauptmotiv (nicht verwechselbar mit den anderen Optionen)? Gibt es Text, Beschriftungen, "
        "Wasserzeichen, Rahmen, Collagen, Personen im Vordergrund oder schlechte Qualität? "
        "Antworte NUR mit: SCORE: <1-10> | PASST: <ja/nein> | FEHLER: <...> | STIMMUNG: <1 Satz> | TIPP: <1 Satz>"
    )
    out = subprocess.run(["kiro-cli", "chat", "--no-interactive", "--model", "claude-opus-5.5", "--trust-tools=fs_read", prompt],
                         capture_output=True, text=True, timeout=600).stdout
    lines = [ln for ln in out.splitlines() if "SCORE" in ln]
    text = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", lines[-1].strip() if lines else out.strip()[-600:])
    img.with_suffix(".review.txt").write_text(text, encoding="utf-8")
    return text


def main():
    qs = {q["slug"]: q for q in json.loads((ROOT / "scripts/picture-questions.json").read_text(encoding="utf-8"))}
    have = {p.stem for p in (ROOT / "public/img/pictures").glob("*.jpg")}
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    slugs = args or [s for s in qs if s not in have]
    OUT.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        term = QUERY.get(slug)
        if not term:
            print(f"{slug}: kein Suchbegriff", flush=True)
            continue
        done = sorted(OUT.glob(f"pic-{slug}-commons-*.review.txt"))
        if done and "--again" not in sys.argv:
            print(f"{slug}: schon geprüft ({len(done)})", flush=True)
            continue
        try:
            found = list(candidates(term))
        except Exception as e:  # noqa: BLE001 - Netzfehler: Motiv überspringen, Rest weiter
            print(f"{slug}: Suche fehlgeschlagen ({e})", flush=True)
            continue
        n = 0
        for c in found:
            raw = OUT / f"pic-{slug}-commons-{n}.src"
            try:
                req = urllib.request.Request(c["url"], headers=UA)
                raw.write_bytes(urllib.request.urlopen(req, timeout=60).read())
            except Exception as e:  # noqa: BLE001
                print(f"{slug}: Download fehlgeschlagen ({e})", flush=True)
                continue
            img = raw.with_suffix(".jpg")
            subprocess.run(["sips", "-Z", "1200", "-s", "format", "jpeg", str(raw), "--out", str(img)], check=True, capture_output=True)
            raw.unlink()
            img.with_suffix(".license.json").write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"{img.name}  {c['license']}  {review(img, qs[slug])[:90]}", flush=True)
            n += 1
            if n >= PER_MOTIF:
                break
        if n == 0:
            print(f"{slug}: keine freien Fotos gefunden", flush=True)


if __name__ == "__main__":
    main()
