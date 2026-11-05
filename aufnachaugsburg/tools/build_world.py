#!/usr/bin/env python3
"""Build the Augsburg runner world from real OpenStreetMap data.

Fetches a foot route (OSRM), buildings/roads/water/parks (Overpass API),
renders a deliberately low-resolution pixel map and bakes a playable
rooftop-parkour level out of the real building footprints.

Run from the game folder:
    python tools/build_world.py
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "cache")
MAPDIR = os.path.join(ROOT, "assets", "maps")
DATADIR = os.path.join(ROOT, "js", "runner", "data")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(MAPDIR, exist_ok=True)
os.makedirs(DATADIR, exist_ok=True)

# The maps are displayed at 512x320 CSS pixels, so the source has twice the
# detail of the old 256x160 render while keeping the same pixel-map style.
W, H = 512, 320
MAP_SCALE = 2
UA = "AufNachAugsburg/1.0 (local fan project; contact: local)"

LEVELS = [
    {
        "id": "hbf",
        "num": 1,
        "name": "HAUPTBAHNHOF",
        "subtitle": "Ankunft in Augsburg",
        "tagline": "Der letzte Zug ist durch. Jetzt geht es über die Dächer.",
        "start": [48.3655, 10.8857],
        "finish": [48.3690, 10.8943],
        "via": [],
        "accent": "#e0a458",
        "sky": ["#8fc6e7", "#cbe6ef"],
        "ground": "#3f7fbf",
    },
    {
        "id": "koenigsplatz",
        "num": 2,
        "name": "KÖNIGSPLATZ",
        "subtitle": "Auf der Maximilianstraße",
        "tagline": "Pflaster, Passagen und ein Obelisk mitten im Weg.",
        "start": [48.3690, 10.8943],
        "finish": [48.3688, 10.8987],
        "via": [],
        "accent": "#d96c4a",
        "sky": ["#9fc9e2", "#f0dcbc"],
        "ground": "#4d8cba",
    },
    {
        "id": "rathaus",
        "num": 3,
        "name": "RATHAUS & PERLACHTURM",
        "subtitle": "Durch die Altstadt",
        "tagline": "Rathaus, Perlachturm und ein kleiner Umweg durchs Lechviertel.",
        "start": [48.3688, 10.8987],
        "finish": [48.3698, 10.8973],
        "via": [[48.3718, 10.9010]],
        "accent": "#b63b2f",
        "sky": ["#90b8d8", "#e8d2b1"],
        "ground": "#3f7fbf",
    },
    {
        "id": "dom",
        "num": 4,
        "name": "DOM & LECHVIERTEL",
        "subtitle": "Über die Kanäle",
        "tagline": "Zwischen Domtürmen und Lechkanälen wird jede Lücke zur Prüfung.",
        "start": [48.3698, 10.8973],
        "finish": [48.3709, 10.9042],
        "via": [[48.3712, 10.9000]],
        "accent": "#3f7fc1",
        "sky": ["#8db9db", "#d5e7e8"],
        "ground": "#3a78ad",
    },
    {
        "id": "fuggerei",
        "num": 5,
        "name": "FUGGEREI",
        "subtitle": "Die älteste Sozialsiedlung der Welt",
        "tagline": "Rote Dächer, enge Gassen und das letzte Stück bis Jakobertor.",
        "start": [48.3709, 10.9042],
        "finish": [48.3687, 10.9074],
        "via": [],
        "accent": "#6f9d54",
        "sky": ["#9bc3d9", "#efd9b5"],
        "ground": "#4a83a1",
    },
    {
        "id": "lechkanaele",
        "num": 6,
        "name": "LECHKANÄLE",
        "subtitle": "Wasserwege der Altstadt",
        "tagline": "Schmale Stege, alte Wehre und das Wasser direkt unter den Dachkanten.",
        "start": [48.3641, 10.9022],
        "finish": [48.3710, 10.9050],
        "via": [[48.3680, 10.9045]],
        "accent": "#3f8fa8",
        "sky": ["#86b9d3", "#d7e8e4"],
        "ground": "#2d6f8c",
        "weather": "rain",
    },
    {
        "id": "zeughaus",
        "num": 7,
        "name": "ZEUGHAUS",
        "subtitle": "Am Zeugplatz",
        "tagline": "Geschütze, Gewölbe und ein letzter Sprint über die Dächer der Ulrichsstadt.",
        "start": [48.36627, 10.89702],
        "finish": [48.3641, 10.9022],
        "via": [[48.3650, 10.9000]],
        "accent": "#b07a45",
        "sky": ["#9b8fbc", "#e8c9a8"],
        "ground": "#5b5374",
        "weather": "dusk",
    },
    {
        "id": "sheridanpark",
        "num": 8,
        "name": "SHERIDAN-PARK",
        "subtitle": "Grünzug in Pfersee",
        "tagline": "Zwischen alten Bäumen und langen Wegen wird aus dem Dachlauf ein Parksprint.",
        "start": [48.3590, 10.8510],
        "finish": [48.3615, 10.8580],
        "via": [[48.3615, 10.8550]],
        "accent": "#6f9d54",
        "sky": ["#a9c6c0", "#f0dfb8"],
        "ground": "#5f8168",
        "weather": "autumn",
    },
]


# --------------------------------------------------------------------------
# Network helpers
# --------------------------------------------------------------------------

def http_get(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def http_post(url, data, timeout=120):
    body = urllib.parse.urlencode({"data": data}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def fetch_route(level):
    cache_path = os.path.join(CACHE, f"{level['id']}-route.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    coords = [level["start"]] + level["via"] + [level["finish"]]
    coord_string = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in coords)
    url = (
        "https://router.project-osrm.org/route/v1/foot/"
        + coord_string
        + "?overview=full&geometries=geojson&steps=false"
    )
    try:
        raw = json.loads(http_get(url, timeout=45).decode("utf-8"))
        route = raw["routes"][0]
        points = [[lat, lon] for lon, lat in route["geometry"]["coordinates"]]
        result = {"route": points, "distance": route["distance"]}
        print(f"  route: {result['distance']:.0f} m, {len(points)} points")
    except Exception as error:
        print(f"  ! OSRM failed ({error}); using straight route")
        points = []
        for index in range(len(coords) - 1):
            a, b = coords[index], coords[index + 1]
            for step in range(24):
                t = step / 24.0
                points.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        points.append(coords[-1])
        result = {"route": points, "distance": route_distance(points)}

    with open(cache_path, "w", encoding="utf-8") as handle:
        json.dump(result, handle)
    return result


def fetch_osm(level, route):
    cache_path = os.path.join(CACHE, f"{level['id']}-overpass.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    lats = [point[0] for point in route]
    lngs = [point[1] for point in route]
    pad_lat = 0.0025
    pad_lng = 0.0038
    south = min(lats) - pad_lat
    north = max(lats) + pad_lat
    west = min(lngs) - pad_lng
    east = max(lngs) + pad_lng
    bbox = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
    query = f"""[out:json][timeout:120][bbox:{bbox}];
(
  way["building"];
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|footway|path|cycleway|service|steps)$"];
  way["waterway"~"^(river|stream|canal|ditch)$"];
  way["natural"="water"];
  way["landuse"="reservoir"];
  way["leisure"~"^(park|garden|playground)$"];
  way["landuse"~"^(grass|forest|meadow|cemetery)$"];
  way["natural"~"^(wood|scrub)$"];
  way["railway"~"^(rail|tram|light_rail)$"];
);
out tags geom;"""

    endpoints = [
        "https://z.overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    last_error = None
    for endpoint in endpoints:
        try:
            print(f"  fetching OSM via {endpoint.split('/')[2]} ...")
            raw = http_post(endpoint, query, timeout=150)
            data = json.loads(raw.decode("utf-8"))
            with open(cache_path, "w", encoding="utf-8") as handle:
                json.dump(data, handle, separators=(",", ":"))
            print(f"  OSM: {len(data.get('elements', []))} ways")
            return data
        except Exception as error:
            last_error = error
            print(f"  ! {endpoint}: {error}")
            time.sleep(2)
    raise RuntimeError(f"Overpass failed for {level['id']}: {last_error}")


# --------------------------------------------------------------------------
# Geo helpers
# --------------------------------------------------------------------------

def haversine(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371000.0 * 2 * math.asin(min(1.0, math.sqrt(h)))


def route_distance(points):
    return sum(haversine(points[i], points[i + 1]) for i in range(len(points) - 1))


def simplify(points, tolerance=2.0, max_points=60, closed=False):
    if len(points) <= 2:
        return points
    kept = [points[0]]
    for point in points[1:-1]:
        if haversine(kept[-1], point) >= tolerance:
            kept.append(point)
    if kept[-1] != points[-1]:
        kept.append(points[-1])
    if len(kept) > max_points:
        step = (len(kept) - 1) / (max_points - 1)
        kept = [kept[round(i * step)] for i in range(max_points)]
    if closed and kept[0] != kept[-1]:
        kept.append(kept[0])
    return kept


def polygon_area(points):
    if len(points) < 3:
        return 0.0
    lat0 = sum(point[0] for point in points) / len(points)
    sx = 111320.0 * math.cos(math.radians(lat0))
    sy = 110540.0
    lon0 = points[0][1]
    lat_ref = points[0][0]
    xy = [((lon - lon0) * sx, (lat - lat_ref) * sy) for lat, lon in points]
    area = 0.0
    for i in range(len(xy)):
        x1, y1 = xy[i]
        x2, y2 = xy[(i + 1) % len(xy)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def centroid(points):
    return [sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points)]


def point_segment_projection(point, start, end):
    """Return (distance_m, t) of point projected onto a lat/lng segment."""
    lat0 = math.radians((start[0] + end[0]) / 2.0)
    sx = 111320.0 * math.cos(lat0)
    sy = 110540.0
    px = (point[1] - start[1]) * sx
    py = (point[0] - start[0]) * sy
    ex = (end[1] - start[1]) * sx
    ey = (end[0] - start[0]) * sy
    denom = ex * ex + ey * ey
    if denom == 0:
        return math.hypot(px, py), 0.0
    t = max(0.0, min(1.0, (px * ex + py * ey) / denom))
    dx = px - ex * t
    dy = py - ey * t
    return math.hypot(dx, dy), t


def nearest_route(point, route):
    best = (1e9, 0.0)
    travelled = 0.0
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        seg = haversine(a, b)
        dist, t = point_segment_projection(point, a, b)
        if dist < best[0]:
            best = (dist, travelled + seg * t)
        travelled += seg
    return best[0], best[1]


def parse_levels(tags):
    raw = tags.get("building:levels") or tags.get("levels")
    if raw:
        try:
            return max(1.0, min(14.0, float(str(raw).replace(",", "."))))
        except ValueError:
            pass
    height = tags.get("height")
    if height:
        try:
            return max(1.0, min(14.0, float(str(height).replace("m", "").replace(",", ".")) / 3.2))
        except ValueError:
            pass
    return 4.0


# --------------------------------------------------------------------------
# Parse OSM into a compact drawing + level-building format
# --------------------------------------------------------------------------

def parse_osm(data):
    buildings = []
    roads = []
    water_areas = []
    water_lines = []
    green = []
    rails = []
    way_count = 0

    for element in data.get("elements", []):
        if element.get("type") != "way":
            continue
        tags = element.get("tags") or {}
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        points = []
        for vertex in geometry:
            if "lat" not in vertex or "lon" not in vertex:
                continue
            point = [round(vertex["lat"], 5), round(vertex["lon"], 5)]
            if not points or point != points[-1]:
                points.append(point)
        if len(points) < 2:
            continue

        if "building" in tags:
            if len(points) < 3:
                continue
            is_closed = haversine(points[0], points[-1]) < 1.0
            clean = simplify(points, tolerance=1.3, max_points=40, closed=True)
            area = polygon_area(clean)
            if area < 12:
                continue
            centre = centroid(clean)
            buildings.append({
                "pts": clean,
                "area": area,
                "levels": parse_levels(tags),
                "name": tags.get("name", ""),
                "cx": centre[0],
                "cy": centre[1],
                "kind": tags.get("building", "yes"),
                "closed": is_closed,
            })
            way_count += 1
            continue

        if tags.get("natural") == "water" or tags.get("landuse") == "reservoir" or tags.get("waterway") == "riverbank":
            clean = simplify(points, tolerance=2.2, max_points=50, closed=True)
            if len(clean) >= 3:
                water_areas.append({"pts": clean, "name": tags.get("name", "")})
                way_count += 1
            continue

        if tags.get("waterway") in {"river", "stream", "canal", "ditch"}:
            clean = simplify(points, tolerance=2.0, max_points=100)
            water_lines.append({
                "pts": clean,
                "name": tags.get("name", ""),
                "kind": tags.get("waterway"),
            })
            way_count += 1
            continue

        if tags.get("railway") in {"rail", "tram", "light_rail"}:
            clean = simplify(points, tolerance=3.0, max_points=100)
            rails.append({"pts": clean, "name": tags.get("name", ""), "kind": tags.get("railway")})
            way_count += 1
            continue

        if tags.get("highway"):
            clean = simplify(points, tolerance=2.2, max_points=100)
            roads.append({
                "pts": clean,
                "name": tags.get("name", ""),
                "kind": tags.get("highway"),
            })
            way_count += 1
            continue

        if (
            tags.get("leisure") in {"park", "garden", "playground"}
            or tags.get("landuse") in {"grass", "forest", "meadow", "cemetery"}
            or tags.get("natural") in {"wood", "scrub"}
        ):
            clean = simplify(points, tolerance=2.5, max_points=50, closed=True)
            if len(clean) >= 3:
                green.append({
                    "pts": clean,
                    "name": tags.get("name", ""),
                    "kind": tags.get("leisure") or tags.get("landuse") or tags.get("natural"),
                })
                way_count += 1

    print(
        f"  parsed: {len(buildings)} buildings, {len(roads)} roads, "
        f"{len(water_areas)} water areas, {len(water_lines)} waterways, "
        f"{len(green)} green areas, {len(rails)} rails"
    )
    return {
        "buildings": buildings,
        "roads": roads,
        "water_areas": water_areas,
        "water_lines": water_lines,
        "green": green,
        "rails": rails,
    }


# --------------------------------------------------------------------------
# Pixel map renderer
# --------------------------------------------------------------------------

def map_bounds(route):
    lats = [point[0] for point in route]
    lngs = [point[1] for point in route]
    lat0 = math.radians((min(lats) + max(lats)) / 2.0)

    minlat, maxlat = min(lats), max(lats)
    minlon, maxlon = min(lngs), max(lngs)
    pad_lat = 0.0018
    pad_lng = 0.0028
    minlat -= pad_lat
    maxlat += pad_lat
    minlon -= pad_lng
    maxlon += pad_lng

    xspan = (maxlon - minlon) * math.cos(lat0)
    yspan = maxlat - minlat
    aspect = W / H
    if xspan / yspan < aspect:
        need = aspect * yspan
        add = (need - xspan) / 2.0 / math.cos(lat0)
        minlon -= add
        maxlon += add
    else:
        need = xspan / aspect
        add = (need - yspan) / 2.0
        minlat -= add
        maxlat += add
    return minlat, minlon, maxlat, maxlon


def render_map(level, route, osm):
    minlat, minlon, maxlat, maxlon = map_bounds(route)

    def project(point):
        x = (point[1] - minlon) / (maxlon - minlon) * W
        y = (maxlat - point[0]) / (maxlat - minlat) * H
        return (x, y)

    image = Image.new("RGB", (W, H), "#efe4c8")
    draw = ImageDraw.Draw(image)

    # faint city-map grid
    for gx in range(0, W, 16 * MAP_SCALE):
        draw.line([(gx, 0), (gx, H)], fill="#e7d9b8", width=1)
    for gy in range(0, H, 16 * MAP_SCALE):
        draw.line([(0, gy), (W, gy)], fill="#e7d9b8", width=1)

    for area in osm["green"]:
        poly = [project(point) for point in area["pts"]]
        if len(poly) >= 3:
            draw.polygon(poly, fill="#a9c08c")

    for area in osm["water_areas"]:
        poly = [project(point) for point in area["pts"]]
        if len(poly) >= 3:
            draw.polygon(poly, fill="#4f93c8", outline="#2f6690")

    for line in osm["water_lines"]:
        pts = [project(point) for point in line["pts"]]
        if len(pts) < 2:
            continue
        width = (6 if line["kind"] == "river" else 4 if line["kind"] == "canal" else 2) * MAP_SCALE
        draw.line(pts, fill="#2f6690", width=width + 2 * MAP_SCALE, joint="curve")
        draw.line(pts, fill="#4f93c8", width=width, joint="curve")
        if width >= 4:
            draw.line(pts, fill="#7fc4e8", width=MAP_SCALE, joint="curve")

    for rail in osm["rails"]:
        pts = [project(point) for point in rail["pts"]]
        if len(pts) >= 2:
            draw.line(pts, fill="#6d6254", width=MAP_SCALE, joint="curve")

    # roads: minor paths first, then streets, then the big axes
    road_order = {"path": 0, "minor": 1, "major": 2}
    major = {"motorway", "trunk", "primary", "secondary", "tertiary"}
    minor = {"residential", "unclassified", "living_street", "pedestrian", "service"}
    groups = {0: [], 1: [], 2: []}
    for road in osm["roads"]:
        kind = road["kind"]
        if kind in major:
            groups[2].append(road)
        elif kind in minor:
            groups[1].append(road)
        else:
            groups[0].append(road)

    for rank in (0, 1, 2):
        for road in groups[rank]:
            pts = [project(point) for point in road["pts"]]
            if len(pts) < 2:
                continue
            if rank == 2:
                casing, fill, width = "#8f8268", "#f7eed8", 5 * MAP_SCALE
            elif rank == 1:
                casing, fill, width = "#9b8d71", "#f3e9d1", 3 * MAP_SCALE
            else:
                casing, fill, width = "#b3a486", "#e9dfc3", 1 * MAP_SCALE
            draw.line(pts, fill=casing, width=width + 2 * MAP_SCALE, joint="curve")
            draw.line(pts, fill=fill, width=width, joint="curve")

    def building_fill(building):
        levels = building["levels"]
        if levels >= 7:
            return "#bd765b"
        if levels >= 5:
            return "#c88e70"
        if levels >= 3:
            return "#cfa986"
        return "#d8c6a5"

    sorted_buildings = sorted(osm["buildings"], key=lambda item: -item["area"])
    # A soft drop shadow under every footprint gives the map more depth at the
    # higher resolution.
    for building in sorted_buildings:
        poly = [project(point) for point in building["pts"]]
        if len(poly) < 3:
            continue
        shadow = [(x + MAP_SCALE, y + MAP_SCALE) for x, y in poly]
        draw.polygon(shadow, fill="#d8c8a8")
    for building in sorted_buildings:
        poly = [project(point) for point in building["pts"]]
        if len(poly) < 3:
            continue
        fill = building_fill(building)
        outline = "#7e644c" if building["area"] > 120 else "#9a8568"
        draw.polygon(poly, fill=fill, outline=outline)

    route_px = [project(point) for point in route]
    if len(route_px) >= 2:
        draw.line(route_px, fill="#3a2a1c", width=4 * MAP_SCALE, joint="curve")
        draw.line(route_px, fill="#f2c14e", width=2 * MAP_SCALE, joint="curve")
        draw.line(route_px, fill="#ffe9a8", width=MAP_SCALE, joint="curve")

    start = project(route[0])
    finish = project(route[-1])
    sx, sy = int(round(start[0])), int(round(start[1]))
    fx, fy = int(round(finish[0])), int(round(finish[1]))

    draw.rectangle([sx - 4 * MAP_SCALE, sy - 4 * MAP_SCALE, sx + 4 * MAP_SCALE, sy + 4 * MAP_SCALE], fill="#3a2a1c")
    draw.rectangle([sx - 3 * MAP_SCALE, sy - 3 * MAP_SCALE, sx + 3 * MAP_SCALE, sy + 3 * MAP_SCALE], fill="#f2c14e")
    draw.rectangle([sx - MAP_SCALE, sy - MAP_SCALE, sx + MAP_SCALE, sy + MAP_SCALE], fill="#fff4cf")

    draw.rectangle([fx - 5 * MAP_SCALE, fy - 5 * MAP_SCALE, fx + 5 * MAP_SCALE, fy + 5 * MAP_SCALE], fill="#3a2a1c")
    for row in range(2):
        for col in range(2):
            fill = "#fff4cf" if (row + col) % 2 == 0 else "#b63b2f"
            draw.rectangle(
                [
                    fx - 4 * MAP_SCALE + col * 4 * MAP_SCALE,
                    fy - 4 * MAP_SCALE + row * 4 * MAP_SCALE,
                    fx - MAP_SCALE + col * 4 * MAP_SCALE,
                    fy - MAP_SCALE + row * 4 * MAP_SCALE,
                ],
                fill=fill,
            )

    # north arrow
    draw.polygon(
        [(W - 12 * MAP_SCALE, 7 * MAP_SCALE), (W - 8 * MAP_SCALE, 15 * MAP_SCALE),
         (W - 12 * MAP_SCALE, 12 * MAP_SCALE), (W - 16 * MAP_SCALE, 15 * MAP_SCALE)],
        fill="#3a2a1c",
    )
    try:
        north_font = ImageFont.load_default(size=14)
    except TypeError:
        north_font = ImageFont.load_default()
    draw.text((W - 15 * MAP_SCALE, 16 * MAP_SCALE), "N", fill="#3a2a1c", font=north_font)

    draw.rectangle([0, 0, W - 1, H - 1], outline="#3a2a1c", width=MAP_SCALE)
    draw.rectangle([MAP_SCALE, MAP_SCALE, W - 1 - MAP_SCALE, H - 1 - MAP_SCALE], outline="#d8c69e")

    path = os.path.join(MAPDIR, f"{level['id']}.png")
    image.save(path, optimize=True)
    print(f"  map: {path}")

    return {
        "map": f"assets/maps/{level['id']}.png",
        "mapW": W,
        "mapH": H,
        "startPct": [round(start[0] / W * 100, 2), round(start[1] / H * 100, 2)],
        "finishPct": [round(finish[0] / W * 100, 2), round(finish[1] / H * 100, 2)],
        "routePct": [
            [round(point[0] / W * 100, 2), round(point[1] / H * 100, 2)]
            for point in route_px
        ],
    }


# --------------------------------------------------------------------------
# Parkour generation
# --------------------------------------------------------------------------

def build_level(level, route, distance, osm):
    """Turn real building footprints along the route into a playable rooftop run.

    Every generated transition is clamped so that the level can be completed
    with the runner physics (max. 92 px gaps, max. 30 px height difference).
    """
    seed = sum(ord(ch) for ch in level["id"]) * 7919
    rng = seed & 0xFFFFFFFF

    def rand():
        nonlocal rng
        rng = (1664525 * rng + 1013904223) & 0xFFFFFFFF
        return rng / 4294967296.0

    def jitter(scale):
        return (rand() * 2.0 - 1.0) * scale

    distance_m = max(250.0, round(distance / 10.0) * 10.0)
    length_px = int(max(2800, min(6200, distance_m * 6.0)))

    # Candidate buildings along the real foot route.
    candidates = []
    for building in osm["buildings"]:
        if building["area"] < 45:
            continue
        offset, progress = nearest_route([building["cx"], building["cy"]], route)
        if offset > 82 or progress < 25 or progress > distance - 35:
            continue
        facade = max(7.0, min(42.0, math.sqrt(building["area"])))
        candidates.append({
            "progress": progress,
            "offset": offset,
            "area": building["area"],
            "facade": facade,
            "levels": building["levels"],
            "name": building["name"],
        })

    candidates.sort(key=lambda item: item["progress"])

    # One building per ~25-35 metre slice of the route.
    bin_size = max(12.0, distance / 32.0)
    binned = {}
    for item in candidates:
        index = int(item["progress"] / bin_size)
        previous = binned.get(index)
        if previous is None:
            binned[index] = item
        else:
            score = item["area"] - item["offset"] * 4
            old_score = previous["area"] - previous["offset"] * 4
            if score > old_score:
                binned[index] = item
    picks = [binned[key] for key in sorted(binned)]

    usable_start = 400
    usable_end = length_px - 430
    platforms = []
    props = []
    nuts = []
    checkpoints = []

    # The start roof reaches all the way to the left edge so the car can
    # visibly drive in and drop the runner off.
    start_platform = {
        "type": "start",
        "x": 0,
        "w": 360,
        "roofY": 188,
        "levels": 2,
        "name": "START",
    }
    platforms.append(start_platform)
    previous_end = start_platform["x"] + start_platform["w"]
    previous_y = start_platform["roofY"]

    def clamp_y(value):
        return max(116, min(198, value))

    def add_platform(item, x, width, roof_y, kind="roof"):
        nonlocal previous_end, previous_y
        platform = {
            "type": kind,
            "x": int(round(x)),
            "w": int(round(width)),
            "roofY": int(round(roof_y)),
            "levels": int(round(item.get("levels", 3))) if item else 3,
            "name": item.get("name", "") if item else "",
        }
        platforms.append(platform)
        previous_end = platform["x"] + platform["w"]
        previous_y = platform["roofY"]
        return platform

    def bridge_to(next_x, next_y):
        """Insert small balconies until the next roof is a safe jump away."""
        nonlocal previous_end, previous_y
        guard = 0
        while (next_x - previous_end > 92 or abs(next_y - previous_y) > 30) and guard < 14:
            gap = next_x - previous_end
            step_w = 48
            step_x = previous_end + max(32, min(68, gap * 0.45))
            if step_x + step_w > next_x - 28:
                step_x = previous_end + max(20, (gap - step_w) / 2)
            step_y = previous_y + max(-30, min(30, next_y - previous_y))
            step_y = clamp_y(step_y + jitter(2.5))
            if step_x <= previous_end + 12:
                step_x = previous_end + 24
            add_platform(None, step_x, step_w, step_y, "bridge")
            guard += 1

    for index, item in enumerate(picks):
        raw_x = usable_start + (item["progress"] / distance_m) * (usable_end - usable_start)
        width = max(66.0, min(205.0, item["facade"] * 4.6 + 30))
        x = max(raw_x, previous_end + 46)
        if x + width > usable_end:
            width = usable_end - x
            if width < 60:
                continue

        levels = max(2.0, min(9.0, item["levels"]))
        target_y = 206.0 - (levels * 9.2 + jitter(8))
        target_y = max(previous_y - 28, min(previous_y + 28, target_y))
        target_y = clamp_y(target_y)

        bridge_to(x, target_y)
        x = max(x, previous_end + 46)
        if x + width > usable_end:
            width = usable_end - x
            if width < 60:
                continue

        platform = add_platform(item, x, width, target_y, "roof")

        if index % 2 == 1 and width > 86:
            props.append({
                "type": "chimney",
                "x": int(platform["x"] + platform["w"] * (0.28 + rand() * 0.4)),
                "y": int(platform["roofY"] - 16),
                "w": 11,
                "h": 16,
            })
        if index % 5 == 2 and width > 110:
            props.append({
                "type": "antenna",
                "x": int(platform["x"] + platform["w"] * 0.72),
                "y": int(platform["roofY"] - 28),
                "w": 2,
                "h": 28,
            })
        if index % 4 == 3 and width > 130:
            props.append({
                "type": "dormer",
                "x": int(platform["x"] + platform["w"] * (0.2 + rand() * 0.5)),
                "y": int(platform["roofY"] - 18),
                "w": 22,
                "h": 18,
            })

    # Make sure there is enough parkour if the OSM data was sparse.
    fill_index = 0
    while previous_end < usable_end - 90:
        gap = min(86, max(56, 70 + jitter(14)))
        x = previous_end + gap
        width = 84 + rand() * 80
        if x + width > usable_end:
            width = usable_end - x
        if width < 52:
            break
        target_y = clamp_y(previous_y + jitter(22))
        kind = "roof" if fill_index % 3 == 1 else "bridge"
        add_platform(None, x, width, target_y, kind)
        fill_index += 1
        if fill_index > 60:
            break

    finish_x = usable_end + 24
    bridge_to(finish_x, 205)
    # Extra terrace to the right: the car needs room to pull in and pick
    # the runner up after the finish gate.
    finish_platform = add_platform(None, finish_x, 560, 205, "plaza")

    finish_line = finish_platform["x"] + 176

    # Collectibles and checkpoints are derived from the finished layout so
    # even very short routes get a fair set of both.
    for index, platform in enumerate(platforms):
        if platform["type"] == "start":
            continue
        if index % 2 == 0:
            count = 3 if index % 6 == 0 and platform["w"] > 110 else 1
            for number in range(count):
                nuts.append({
                    "x": int(platform["x"] + platform["w"] * 0.5 + (number - (count - 1) / 2) * 18),
                    "y": int(platform["roofY"] - 27),
                })
        if index >= 4 and index % 5 == 0:
            checkpoints.append({
                "x": int(platform["x"] + 20),
                "y": int(platform["roofY"]),
                "platform": index,
            })

    # A few nuts sit high above the roofline. They are optional, visible only
    # as a small sparkle from the normal running line, and reward exploring.
    for index, platform in enumerate(platforms):
        if platform["type"] != "roof" or platform["w"] < 96:
            continue
        if index % 6 != 3:
            continue
        nuts.append({
            "x": int(platform["x"] + platform["w"] * 0.5),
            "y": int(platform["roofY"] - 52),
            "hidden": True,
        })

    # Guarantee at least a couple of checkpoint flags on the short Fuggerei run.
    if len(checkpoints) < 2:
        middle = max(1, len(platforms) // 2)
        platform = platforms[middle]
        checkpoints = [{
            "x": int(platform["x"] + 20),
            "y": int(platform["roofY"]),
            "platform": middle,
        }]

    gaps = [platforms[i + 1]["x"] - (platforms[i]["x"] + platforms[i]["w"]) for i in range(len(platforms) - 1)]
    drops = [abs(platforms[i + 1]["roofY"] - platforms[i]["roofY"]) for i in range(len(platforms) - 1)]
    max_gap = max(gaps) if gaps else 0
    max_drop = max(drops) if drops else 0
    if max_gap > 92 or max_drop > 34:
        raise RuntimeError(f"unplayable layout for {level['id']}: gap {max_gap}, drop {max_drop}")

    level_data = {
        "id": level["id"],
        "num": level["num"],
        "name": level["name"],
        "subtitle": level["subtitle"],
        "tagline": level["tagline"],
        "accent": level["accent"],
        "sky": level["sky"],
        "ground": level["ground"],
        "distance": int(distance_m),
        "lengthPx": length_px,
        "targetTime": max(18, int(round(length_px / 150.0))),
        "weather": level.get("weather", "clear"),
        "startX": 210,
        "startY": start_platform["roofY"] - 26,
        "finishX": int(finish_line),
        "platforms": platforms,
        "props": props,
        "nuts": nuts,
        "checkpoints": checkpoints,
        "finishPlatform": len(platforms) - 1,
        "routePoints": len(route),
        "maxGap": max_gap,
        "maxDrop": max_drop,
        "origin": level["start"],
        "destination": level["finish"],
        "source": "OpenStreetMap via Overpass API; route via OSRM",
    }
    print(
        f"  level: {len(platforms)} platforms, {len(nuts)} nuts, "
        f"{len(checkpoints)} checkpoints, {distance_m:.0f} m, "
        f"max gap {max_gap}px, max drop {max_drop}px"
    )
    return level_data


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    force = "--force" in sys.argv
    if force:
        for file_name in os.listdir(CACHE):
            os.remove(os.path.join(CACHE, file_name))

    levels_out = []
    for level in LEVELS:
        print(f"\n== {level['num']}. {level['name']} ==")
        route_data = fetch_route(level)
        route = route_data["route"]
        distance = route_data["distance"]
        raw = fetch_osm(level, route)
        osm = parse_osm(raw)
        map_data = render_map(level, route, osm)
        level_data = build_level(level, route, distance, osm)
        level_data.update(map_data)
        levels_out.append(level_data)

    output_path = os.path.join(DATADIR, "levels.json")
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(levels_out, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {output_path} ({os.path.getsize(output_path)} bytes)")

    # A JS copy keeps the game working from file:// as well as GitHub Pages.
    js_path = os.path.join(DATADIR, "levels.js")
    with open(js_path, "w", encoding="utf-8") as handle:
        handle.write("/* Generated by tools/build_world.py - do not edit by hand. */\n")
        handle.write("window.AUGSBURG_LEVELS = ")
        json.dump(levels_out, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")
    print(f"wrote {js_path} ({os.path.getsize(js_path)} bytes)")
    print("done")


if __name__ == "__main__":
    main()
