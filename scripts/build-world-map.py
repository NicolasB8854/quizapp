#!/usr/bin/env python3
"""Baut public/img/geo/world.svg aus Natural Earth (Public Domain, 1:50m Länder).

Projektion: plattkartisch (equirectangular), damit Client und Reducer einen Tipp
trivial in Längen-/Breitengrad umrechnen können:
    x = (lon + 180) * S,  y = (LAT_TOP - lat) * S   mit S = 4, LAT_TOP = 85, LAT_BOTTOM = -60
Muss zu packages/shared/src/lib/geo.ts (MAP_*) passen.

Quelle: https://github.com/nvkelso/natural-earth-vector (ne_50m_admin_0_countries.geojson)
Aufruf: python3 scripts/build-world-map.py .audit-work/geo/countries50.geojson
"""
import json
import math
import sys
from pathlib import Path

S = 4
LAT_TOP, LAT_BOTTOM = 85, -60
W, H = 360 * S, (LAT_TOP - LAT_BOTTOM) * S
TOL = 0.9  # Vereinfachung in SVG-Einheiten (≈0.22°)


def proj(lon, lat):
    return (lon + 180) * S, (LAT_TOP - lat) * S


def dp(points, tol):
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    idx, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            idx, dmax = i, d
    if dmax > tol:
        return dp(points[: idx + 1], tol)[:-1] + dp(points[idx:], tol)
    return [points[0], points[-1]]


def ring_path(ring):
    pts = [proj(lon, max(LAT_BOTTOM - 2, min(LAT_TOP + 2, lat))) for lon, lat in ring]
    # Geschlossener Ring: an der Hälfte teilen, sonst sind Start und Ende identisch.
    mid = len(pts) // 2
    pts = dp(pts[: mid + 1], TOL)[:-1] + dp(pts[mid:], TOL)
    if len(pts) < 4:
        return ""
    # Winzige Inseln weglassen
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 2.5:
        return ""
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


def main(src):
    data = json.loads(Path(src).read_text(encoding="utf-8"))
    paths = []
    for f in data["features"]:
        if f["properties"].get("ADM0_A3") == "ATA":
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        d = "".join(ring_path(poly[0]) for poly in polys)
        if d:
            paths.append(f'<path d="{d}"/>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
        f'<g fill="#3B4C7D" stroke="#9C82FF" stroke-opacity="0.7" stroke-width="0.6" stroke-linejoin="round">'
        + "".join(paths)
        + "</g></svg>\n"
    )
    out = Path(__file__).resolve().parent.parent / "public/img/geo/world.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    print(f"{out} {len(svg) // 1024} KB, {len(paths)} Länder")


if __name__ == "__main__":
    main(sys.argv[1])
