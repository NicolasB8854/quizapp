#!/usr/bin/env python3
"""Baut packages/shared/src/data/geoShapes.json (Länder-Umriss) aus Natural Earth 1:50m.

Pro Land: Silhouette als SVG-Pfad in einer 200×200-Box (flächentreu genug: x mit cos(lat)
gestaucht), Drehung (je schwerer, desto schräger), Mittelpunkt (LABEL_X/Y von Natural Earth),
Radius aus der Fläche und ein automatischer Fakt (Fläche, Einwohner).

Aufruf: python3 scripts/build-geo-shapes.py .audit-work/geo/countries50.geojson
"""
import hashlib
import json
import math
import sys
from pathlib import Path

# ADM0_A3 -> (Stufe, Name überschreiben oder None)
PICK = {
    "ITA": (1, None), "AUS": (1, None), "DEU": (1, None), "ESP": (1, None), "FRA": (1, None), "IND": (1, None), "JPN": (1, None),
    "CHL": (2, None), "GRC": (2, None), "NOR": (2, None), "GBR": (2, "Vereinigtes Königreich"), "MEX": (2, None), "TUR": (2, None),
    "SWE": (2, None), "CHN": (2, None), "ARG": (2, None), "AUT": (2, None), "BRA": (2, None),
    "MDG": (3, None), "NZL": (3, None), "IRL": (3, None), "ISL": (3, None), "CUB": (3, None), "KOR": (3, None), "THA": (3, None),
    "VNM": (3, None), "UKR": (3, None), "POL": (3, None), "CHE": (3, None), "FIN": (3, None), "EGY": (3, None), "ZAF": (3, None),
    "PRT": (4, None), "BEL": (4, None), "CZE": (4, None), "HUN": (4, None), "PAN": (4, None), "NPL": (4, None), "LKA": (4, None),
    "PER": (4, None), "COL": (4, None), "KAZ": (4, None), "SAU": (4, None), "MNG": (4, None), "PAK": (4, None),
    "LAO": (5, None), "MWI": (5, None), "SVN": (5, None), "LTU": (5, None), "NIC": (5, None), "URY": (5, None),
    "PRY": (5, None), "NAM": (5, None), "BOL": (5, None), "KHM": (5, None), "MOZ": (5, None),
}
MAX_ROT = {1: 25, 2: 60, 3: 120, 4: 180, 5: 180}


def ring_area_km2(ring, lat0):
    k = 111.32
    pts = [(lon * k * math.cos(math.radians(lat0)), lat * k) for lon, lat in ring]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


def dp(points, tol):
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


def main(src):
    feats = {f["properties"]["ADM0_A3"]: f for f in json.loads(Path(src).read_text(encoding="utf-8"))["features"]}
    out = []
    for a3, (diff, name_override) in PICK.items():
        f = feats[a3]
        p = f["properties"]
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        lat0 = p["LABEL_Y"]
        areas = [ring_area_km2(poly[0], lat0) for poly in polys]
        biggest = max(areas)
        # Inseln/Exklaven nur, wenn ≥ 0,5 % der Hauptfläche und nahe am Hauptland
        main = polys[areas.index(biggest)][0]
        bx0, bx1 = min(x for x, _ in main), max(x for x, _ in main)
        by0, by1 = min(y for _, y in main), max(y for _, y in main)

        def near(poly):
            """Teilfläche liegt höchstens ~600 km neben der Bounding-Box der Hauptfläche."""
            lon, lat = poly[0][0]
            dx = max(bx0 - lon, 0, lon - bx1) * math.cos(math.radians(lat)) * 111.32
            dy = max(by0 - lat, 0, lat - by1) * 111.32
            return math.hypot(dx, dy) < 600

        # Überseegebiete (z. B. Französisch-Guayana, Spitzbergen) weglassen
        keep = [poly for poly, a in zip(polys, areas) if a >= 0.005 * biggest and near(poly)]
        rings = [poly[0] for poly in keep]
        cos0 = math.cos(math.radians(lat0))
        xy = [[((lon - p["LABEL_X"]) * cos0, -(lat - lat0)) for lon, lat in r] for r in rings]
        allp = [pt for r in xy for pt in r]
        minx, maxx = min(x for x, _ in allp), max(x for x, _ in allp)
        miny, maxy = min(y for _, y in allp), max(y for _, y in allp)
        span = max(maxx - minx, maxy - miny)
        s = 180 / span
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        parts = []
        for r in xy:
            pts = [((x - cx) * s + 100, (y - cy) * s + 100) for x, y in r]
            mid = len(pts) // 2
            pts = dp(pts[: mid + 1], 0.6)[:-1] + dp(pts[mid:], 0.6)
            if len(pts) >= 4:
                parts.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
        h = int(hashlib.sha1(a3.encode()).hexdigest(), 16)
        rot = (h % (2 * MAX_ROT[diff] + 1)) - MAX_ROT[diff]
        total = sum(a for poly, a in zip(polys, areas) if near(poly))
        radius = math.sqrt(sum(a for poly, a in zip(polys, areas) if a >= 0.005 * biggest and near(poly)) / math.pi)
        pop = p.get("POP_EST") or 0
        pop_txt = f"{pop / 1e6:.1f}".replace(".", ",") + " Mio." if pop >= 1e6 else f"{round(pop / 1000)} Tsd."
        out.append({
            "id": f"shape-{a3.lower()}",
            "name": name_override or p["NAME_DE"],
            "country": name_override or p["NAME_DE"],
            "lat": round(lat0, 3),
            "lon": round(p["LABEL_X"], 3),
            "difficulty": diff,
            "path": "".join(parts),
            "rotate": rot,
            "radiusKm": round(radius),
            "fact": f"Rund {f'{round(total, -3):,.0f}'.replace(',', '.')} km² groß, etwa {pop_txt} Einwohner.",
        })
    dst = Path(__file__).resolve().parent.parent / "packages/shared/src/data/geoShapes.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(dst, len(out), "Länder", dst.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1])
