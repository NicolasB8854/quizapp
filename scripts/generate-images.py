#!/usr/bin/env python3
"""Bildgenerierung für QUIZO via Amazon Bedrock (Stability) + automatisches Review.

Alle Motive teilen EINE Art Direction (STYLE + NEGATIVE), damit Hintergründe,
Modus-Bilder und Splash-Art zusammenpassen.

Aufruf:
  python3 scripts/generate-images.py <preset> [--n 2] [--model core|sd35|ultra] [--review]
  python3 scripts/generate-images.py --list

Ausgabe: .audit-work/brand/candidates/<preset>-<model>-<seed>.jpg (+ .review.txt)
Kosten (us-west-2, Richtwert): core ~0,04 $, sd35 ~0,08 $, ultra ~0,14 $ pro Bild.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".audit-work/brand/candidates"
REGION = "us-west-2"
# Bildkosten laufen über einen separaten Account (Nicolas, 2026-10-03). Override per IMAGE_AWS_PROFILE.
PROFILE = os.environ.get("IMAGE_AWS_PROFILE", "nicolas-alliance-account")
MODELS = {
    "core": "stability.stable-image-core-v1:1",
    "sd35": "stability.sd3-5-large-v1:0",
    "ultra": "stability.stable-image-ultra-v1:1",
}

# ---- Art Direction „Warm Neon Game Night" ---------------------------------
STYLE = (
    "cinematic photograph, evening atmosphere, anticipation and fun among friends, "
    "deep navy night tones, electric violet (#7C5CFF) and cyan (#27D8FF) glow like a TV game show, "
    "warm amber (#FFB84D) practical lamp light for coziness, soft bokeh, shallow depth of field, "
    "subtle film grain, high-end, low-key lighting, asymmetric composition, subjects only in the right third, "
    "left half of the frame is empty deep navy near-black negative space for interface text"
)
NEGATIVE = (
    "text, letters, words, numbers, logo, watermark, signage, captions, user interface, screen text, "
    "readable faces, close-up faces, deformed hands, extra fingers, distorted bodies, clutter, "
    "harsh daylight, oversaturated, cartoon, illustration, lowres, blurry subject, "
    "front view, side faces, profiles, glasses, people on the TV screen, figures on screen, crowd, centered, symmetrical, "
    "picture frames, wall art, bunting, banners, chandelier, bookshelf, extra limbs, bright ceiling"
)

PRESETS: dict[str, dict] = {
    # Startseite: Freunde im Wohnzimmer, Show-Glow, Raum links für Text.
    "home-wohnzimmer": {
        "aspect": "16:9",
        "prompt": "rear view of three friends as backlit black silhouettes on a sofa, leaning forward excitedly, each holding a "
                  "glowing smartphone, facing a large TV whose screen shows only an abstract violet-to-cyan light gradient with no figures, "
                  "warm amber floor lamp at the far right edge, bare dark navy wall on the left",
    },
    "home-moment": {
        "aspect": "16:9",
        "prompt": "rear view of two or three backlit black silhouettes cheering with raised arms in a dark living room, "
                  "sparse confetti catching violet and cyan light, warm amber lamp glow behind them, anatomically correct hands, "
                  "figures clustered in the right third, dark ceiling out of frame",
    },
    "home-buehne": {
        "aspect": "16:9",
        "prompt": "an empty cozy living room at night transformed into a small game show set, volumetric violet and cyan "
                  "spotlight cones from the top right through light haze, a low glowing platform in front of a sofa, sparse confetti, "
                  "one warm amber table lamp, furniture in soft focus on the right, bare dark wall on the left",
    },
    # Show-Bühne (v4, Nicolas: Bühne statt Couch). Bildaufbau löst das Layout per CSS.
    "stage-podiums": {
        "aspect": "16:9",
        "prompt": "a glamorous TV quiz game show studio stage at night, four contestant podiums in a gentle arc, each with a glowing "
                  "round buzzer on top, podium fronts glowing violet and cyan, a huge LED wall behind showing only abstract violet "
                  "and cyan light waves, volumetric spotlight beams through haze, glossy dark stage floor with reflections, "
                  "warm amber accent lights along the stage edge, empty and waiting before the show starts",
    },
    "stage-contestants": {
        "aspect": "16:9",
        "prompt": "a TV quiz game show studio stage, three or four friends seen from behind as dark backlit silhouettes standing at "
                  "glowing contestant podiums with round buzzers, facing a huge LED wall of abstract violet and cyan light, "
                  "spotlight beams through haze, glossy reflective floor, warm amber edge lights, tension right before the question",
    },
    "stage-wide": {
        "aspect": "16:9",
        "prompt": "wide shot of an empty quiz game show set, circular glowing stage platform in the center, curved LED walls with "
                  "abstract violet and cyan gradients, rows of soft spotlights, light haze, gold confetti resting on the glossy floor, "
                  "warm amber rim lights, premium TV production look",
    },
    # v5 — nach Nicolas' Designkonzept-Mockups (TV-Studio-Arena, Publikum von hinten, Neon-Gegenlicht).
    "arena-hero": {
        "aspect": "16:9",
        "prompt": "a TV quiz show studio arena at night seen from the back of the audience, rows of excited people as dark backlit "
                  "silhouettes from behind in the foreground, one arm raised cheering, a bright stage in the distance with "
                  "contestant podiums, strong violet and blue backlight, cyan neon accents, spotlight beams from above through haze, "
                  "glossy reflective stage floor, a few warm golden lights",
    },
    "arena-portrait": {
        "aspect": "9:16",
        "prompt": "vertical view of a TV quiz show studio arena at night from behind the audience, dark backlit silhouettes of "
                  "heads and shoulders at the bottom edge, a glowing stage far away in the upper middle, violet and blue "
                  "backlight, cyan neon accents, spotlight beams from the top through haze, deep navy darkness in the middle",
    },
    # Atmosphärisch (v3): keine Personen/Möbel -> keine KI-Artefakte, UI trägt das „Freunde"-Element.
    "atmo-showlight": {
        "aspect": "16:9",
        "prompt": "pure atmosphere, no people, no furniture: volumetric violet and cyan game show spotlight beams falling "
                  "from the top right through soft haze, a few golden confetti pieces floating in the light, warm amber bokeh "
                  "orbs from out-of-focus home lamps in the lower right background, deep navy darkness filling the left half",
    },
    "atmo-bokeh": {
        "aspect": "16:9",
        "prompt": "pure atmosphere, no people, no objects: dreamy out-of-focus bokeh of warm amber fairy lights and lamp light "
                  "mixed with violet and cyan neon glow, like looking at a cozy party room through a lens wide open at night, "
                  "light concentrated on the right, smooth dark navy gradient on the left",
    },
    "atmo-confetti": {
        "aspect": "16:9",
        "prompt": "pure atmosphere, no people, no objects: celebration moment, slow-motion golden and violet confetti and "
                  "streamers falling through a single cyan spotlight beam from the top right, haze, dark navy background, "
                  "most confetti on the right side, calm empty darkness on the left",
    },
    # Spiel-Hintergrund: ruhig, abstrakt, Inhalt liegt darüber.
    "stage": {
        "aspect": "9:16",
        "prompt": "abstract game show stage background, soft violet and cyan light beams from above through haze, "
                  "deep navy darkness in the center, warm amber glow at the very bottom edge, bokeh particles, no objects",
    },
}

# Modus-Splash-Art (gleiche Art Direction, je ein Motiv-Fokus).
MODE_MOTIFS = {
    # v2 — im freigegebenen Studio-/Arena-Look (wie stage-podiums-4000 / arena-hero-5000).
    "category-duel": "a TV quiz show studio with a giant LED wall showing a grid of twelve glowing abstract category tiles without text, two contestant podiums facing it",
    "around-corner": "a TV quiz show studio at night, one huge glowing light bulb shape on the LED wall, a curved contestant desk in front of it, empty, warm amber glow from the bulb, aha moment",
    "category-board": "a TV quiz show studio with a classic game board on the LED wall made of glowing violet and gold square panels without text, three contestant podiums",
    "experts": "a TV quiz show studio, a single contestant chair on a small round platform under one bright spotlight, hot seat, the rest of the studio dark",
    "elimination": "a TV quiz show studio floor with a large circle of glowing floor panels, some panels switched off and dark, dramatic last one standing",
    "duel-1v1": "close shot of two game show buzzer buttons, big round domed push buttons on top of two podiums facing each other, one glowing violet and one glowing cyan, a spotlight cone between them, dark TV studio",
    "sprinter": "a TV quiz show studio with light streaks racing along the floor and walls, motion blur, a huge abstract circular countdown ring glowing on the LED wall, speed",
    "points-ladder": "a TV quiz show studio with a glowing ladder of stacked light bars rising on the LED wall, the top bar golden, one contestant seat in a spotlight, rising tension",
    "flash": "a TV quiz show stage lit in two strong halves, intense cyan light on the left side and intense magenta-violet light on the right side, a bright white lightning flash in the middle of the stage, fast decision",
    "blindguess": "a TV quiz show studio with a huge LED wall showing one heavily blurred abstract photograph slowly coming into focus, two contestant podiums with glowing answer pads, cyan light",
    "geoguess": "a TV quiz show studio with a giant glowing world map on the LED wall, continents in emerald green neon outlines, several glowing location pins on the map, two contestant podiums facing it",
    "player-spotlight": "an empty TV quiz show stage with a single golden spotlight cone falling on one empty contestant podium in the center, the rest of the studio in violet and cyan light, anticipation",
}
for mode_id, motif in MODE_MOTIFS.items():
    PRESETS[f"mode-{mode_id}"] = {"aspect": "16:9", "prompt": motif + ", glossy reflective floor, volumetric spotlight beams through haze, premium TV production look"}


# Bild-Fragen fürs Bilderrätsel: eigener, neutraler Foto-Stil (das Motiv muss eindeutig sein).
PICTURE_STYLE = "professional photograph, sharp focus on the single subject, natural colors, clean uncluttered background"
PICTURE_NEGATIVE = "text, letters, numbers, logo, watermark, labels, multiple subjects, people, hands, cartoon, illustration, blurry"
_pq = ROOT / "scripts/picture-questions.json"
if _pq.exists():
    for _q in json.loads(_pq.read_text(encoding="utf-8")):
        PRESETS[f"pic-{_q['slug']}"] = {"aspect": "3:2", "prompt": _q["prompt"], "picture": True,
                                        "answer": _q["options"][_q["correct"]],
                                        "distractors": [o for i, o in enumerate(_q["options"]) if i != _q["correct"]]}


def generate(preset: str, model: str, seed: int) -> Path:
    cfg = PRESETS[preset]
    body = {
        "prompt": f"{cfg['prompt']}. {PICTURE_STYLE if cfg.get('picture') else STYLE}",
        "negative_prompt": PICTURE_NEGATIVE if cfg.get("picture") else NEGATIVE,
        "aspect_ratio": cfg["aspect"],
        "output_format": "jpeg",
        "seed": seed,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{preset}-{model}-{seed}.jpg"
    with tempfile.TemporaryDirectory(dir=OUT) as tmp:
        req, resp = Path(tmp) / "req.json", Path(tmp) / "resp.json"
        req.write_text(json.dumps(body), encoding="utf-8")
        proc = subprocess.run(
            ["aws", "bedrock-runtime", "invoke-model", "--region", REGION, "--profile", PROFILE,
             "--model-id", MODELS[model], "--body", f"fileb://{req}",
             "--content-type", "application/json", "--accept", "application/json", str(resp)],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"{preset}: Bedrock-Fehler: {proc.stderr.strip()[-400:]}")
        data = json.loads(resp.read_text(encoding="utf-8"))
    reasons = data.get("finish_reasons") or [None]
    if reasons[0] not in (None, "SUCCESS"):
        raise RuntimeError(f"{preset}: Bedrock finish_reason {reasons[0]}")
    target.write_bytes(base64.b64decode(data["images"][0]))
    return target


def review(image: Path, preset: str) -> str:
    """Bild-Review durch einen frischen kiro-cli-Lauf (kann Bilder lesen)."""
    cfg = PRESETS[preset]
    if cfg.get("picture"):
        prompt = (
            f"Lies das Bild {image} mit deinem Datei-Lesetool (Bildmodus). Es ist eine Quizfrage 'Was ist das?' mit den "
            f"Antworten {[cfg['answer'], *cfg['distractors']]}. Richtig ist '{cfg['answer']}'. Prüfe streng: Ist das Motiv "
            f"eindeutig und anatomisch/sachlich korrekt als '{cfg['answer']}' erkennbar und NICHT mit den anderen Optionen "
            "verwechselbar? Gibt es Text, Wasserzeichen, Fehler? Antworte NUR mit: SCORE: <1-10> | PASST: <ja/nein> | "
            "FEHLER: <...> | STIMMUNG: <1 Satz> | TIPP: <1 Satz>"
        )
    else:
      prompt = (
        f"Lies das Bild {image} mit deinem Datei-Lesetool (Bildmodus). Kontext: Hintergrund/Artwork für eine Quiz-App "
        f"'QUIZO — spannender Quizabend mit Freunden', Art Direction: navy Nacht, Violett/Cyan-Show-Glow, warmes Amber, "
        f"keine Texte, keine erkennbaren Gesichter. Der Bildaufbau (wo UI-Text liegt) wird per CSS gelöst — bewerte die "
        f"Verteilung NICHT. Motiv-Ziel: {PRESETS[preset]['prompt']}. "
        "Antworte NUR mit: SCORE: <1-10> | PASST: <ja/nein> | FEHLER: <KI-Artefakte, Text, Hände, Gesichter> | "
        "STIMMUNG: <1 Satz> | TIPP: <1 Satz Prompt-Verbesserung>"
    )
    out = subprocess.run(
        ["kiro-cli", "chat", "--no-interactive", "--model", "claude-opus-5.5", "--trust-tools=fs_read", prompt],
        capture_output=True, text=True, timeout=600,
    ).stdout
    lines = [l for l in out.splitlines() if "SCORE" in l]
    text = lines[-1].strip() if lines else out.strip()[-600:]
    image.with_suffix(".review.txt").write_text(text, encoding="utf-8")
    return text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("presets", nargs="*")
    ap.add_argument("--n", type=int, default=2, help="Varianten (Seeds) pro Preset")
    ap.add_argument("--model", choices=MODELS, default="core")
    ap.add_argument("--seed", type=int, default=1000)
    ap.add_argument("--review", action="store_true")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if a.list or not a.presets:
        print("\n".join(PRESETS))
        return
    for preset in a.presets:
        if preset not in PRESETS:
            sys.exit(f"unbekanntes Preset: {preset}")
        for i in range(a.n):
            try:
                img = generate(preset, a.model, a.seed + i)
            except RuntimeError as e:
                print(f"FEHLER {e}", flush=True)
                continue
            line = review(img, preset) if a.review else ""
            print(f"{img.name}  {line}", flush=True)


if __name__ == "__main__":
    main()
