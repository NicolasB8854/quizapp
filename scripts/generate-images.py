#!/usr/bin/env python3
"""Bildgenerierung für QUIZO via Amazon Bedrock (Stability) + automatisches Review.

Alle Motive teilen EINE Art Direction (STYLE + NEGATIVE), damit Hintergründe,
Modus-Bilder und Splash-Art zusammenpassen.

Aufruf:
  AWS_PROFILE=quizapp python3 scripts/generate-images.py <preset> [--n 2] [--model core|sd35|ultra] [--review]
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
PROFILE = os.environ.get("AWS_PROFILE", "quizapp")
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
    "category-duel": "two glowing tiles facing each other on a dark table, one violet one cyan, like a duel of categories",
    "around-corner": "a single glowing light bulb hanging in a cozy dark room, warm amber glow, idea moment",
    "category-board": "a grid of softly glowing square panels on a dark wall, game show board, gold accents",
    "experts": "a lone armchair under a single spotlight in a dark living room, expert hot seat",
    "elimination": "a circle of glowing floor lights with some switched off, dramatic last one standing",
    "duel-1v1": "two hands hovering over two big glowing buzzer buttons, one violet one cyan, silhouettes",
    "sprinter": "light streaks racing across a dark room with a glowing stopwatch shape, motion blur, speed",
    "points-ladder": "a glowing staircase of light ascending into darkness, golden top step, rising tension",
    "flash": "split lighting, one side cyan one side violet, a flash of light between them, fast decision",
    "player-spotlight": "a single person silhouette on a sofa caught in a warm spotlight, friends blurred around in violet light",
}
for mode_id, motif in MODE_MOTIFS.items():
    PRESETS[f"mode-{mode_id}"] = {"aspect": "1:1", "prompt": motif}


def generate(preset: str, model: str, seed: int) -> Path:
    cfg = PRESETS[preset]
    body = {
        "prompt": f"{cfg['prompt']}. {STYLE}",
        "negative_prompt": NEGATIVE,
        "aspect_ratio": cfg["aspect"],
        "output_format": "jpeg",
        "seed": seed,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{preset}-{model}-{seed}.jpg"
    with tempfile.TemporaryDirectory(dir=OUT) as tmp:
        req, resp = Path(tmp) / "req.json", Path(tmp) / "resp.json"
        req.write_text(json.dumps(body), encoding="utf-8")
        subprocess.run(
            ["aws", "bedrock-runtime", "invoke-model", "--region", REGION, "--profile", PROFILE,
             "--model-id", MODELS[model], "--body", f"fileb://{req}",
             "--content-type", "application/json", "--accept", "application/json", str(resp)],
            check=True, capture_output=True,
        )
        data = json.loads(resp.read_text(encoding="utf-8"))
    reasons = data.get("finish_reasons") or [None]
    if reasons[0] not in (None, "SUCCESS"):
        raise RuntimeError(f"{preset}: Bedrock finish_reason {reasons[0]}")
    target.write_bytes(base64.b64decode(data["images"][0]))
    return target


def review(image: Path, preset: str) -> str:
    """Bild-Review durch einen frischen kiro-cli-Lauf (kann Bilder lesen)."""
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
            img = generate(preset, a.model, a.seed + i)
            line = review(img, preset) if a.review else ""
            print(f"{img.name}  {line}", flush=True)


if __name__ == "__main__":
    main()
