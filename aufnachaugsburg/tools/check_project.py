#!/usr/bin/env python3
"""Static checks for Auf nach Augsburg.

Verifies the generated level data, all local asset references, sprite and map
sizes, the runner DOM contract and (when Node.js is available) the syntax of
every JavaScript file. Run from the project root:

    python tools/check_project.py

Only the Python standard library is required.
"""

from __future__ import annotations

import json
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNNER = ROOT / "js" / "runner"
LEVELS_JSON = RUNNER / "data" / "levels.json"
STREET_JS = RUNNER / "street.js"
LEVELS_JS = RUNNER / "data" / "levels.js"

REQUIRED_LEVEL_KEYS = {
    "id",
    "num",
    "name",
    "subtitle",
    "tagline",
    "distance",
    "lengthPx",
    "targetTime",
    "startX",
    "finishX",
    "finishPlatform",
    "map",
    "platforms",
    "nuts",
    "checkpoints",
    "props",
    "routePct",
    "startPct",
    "finishPct",
}

errors: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def png_size(path: Path) -> tuple[int, int] | None:
    """Read width/height from a PNG header without Pillow."""
    try:
        data = path.read_bytes()[:24]
    except OSError as exc:
        fail(f"{path.relative_to(ROOT)}: cannot read ({exc})")
        return None
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        fail(f"{path.relative_to(ROOT)}: not a valid PNG")
        return None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def check_levels() -> None:
    if not LEVELS_JSON.exists():
        fail("js/runner/data/levels.json is missing")
        return
    if not LEVELS_JS.exists():
        fail("js/runner/data/levels.js is missing")
        return

    try:
        levels = json.loads(LEVELS_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"levels.json: {exc}")
        return
    try:
        source = LEVELS_JS.read_text(encoding="utf-8")
        match = re.search(r"window\.AUGSBURG_LEVELS\s*=\s*(\[.*\])\s*;?\s*$", source, re.S)
        if not match:
            fail("levels.js: window.AUGSBURG_LEVELS assignment not found")
            return
        js_levels = json.loads(match.group(1))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"levels.js: {exc}")
        return
    if js_levels != levels:
        fail("levels.js and levels.json contain different data")
    if not isinstance(levels, list) or not levels:
        fail("levels.json must contain a non-empty list")
        return
    if len(levels) != 8:
        fail(f"expected 8 stages, found {len(levels)}")

    seen_ids: set[str] = set()
    for index, level in enumerate(levels):
        label = f"level {index + 1} ({level.get('id', '?')})"
        missing = REQUIRED_LEVEL_KEYS.difference(level)
        if missing:
            fail(f"{label}: missing keys {sorted(missing)}")
            continue
        if level["num"] != index + 1:
            fail(f"{label}: num is {level['num']}, expected {index + 1}")
        if level["id"] in seen_ids:
            fail(f"{label}: duplicate id")
        seen_ids.add(level["id"])
        if not (0 < level["startX"] < level["finishX"] < level["lengthPx"]):
            fail(f"{label}: start/finish/length are inconsistent")
        if level["targetTime"] <= 0:
            fail(f"{label}: targetTime must be positive")
        if level["distance"] <= 0:
            fail(f"{label}: distance must be positive")

        map_path = ROOT / level["map"]
        if not map_path.exists():
            fail(f"{label}: map missing: {level['map']}")
        else:
            size = png_size(map_path)
            if size and size != (512, 320):
                fail(f"{label}: map is {size[0]}x{size[1]}, expected 512x320")

        platforms = level["platforms"]
        if not isinstance(platforms, list) or len(platforms) < 3:
            fail(f"{label}: not enough platforms")
            continue
        if not any(platform.get("type") == "start" for platform in platforms):
            fail(f"{label}: no start platform")
        finish_index = level["finishPlatform"]
        if not isinstance(finish_index, int) or not (0 <= finish_index < len(platforms)):
            fail(f"{label}: finishPlatform index is invalid")
        previous_end = None
        max_gap = 0
        max_drop = 0
        for platform_index, platform in enumerate(platforms):
            if platform.get("w", 0) <= 0:
                fail(f"{label}: platform {platform_index} has no width")
            if platform.get("x", -1) < 0:
                fail(f"{label}: platform {platform_index} has a negative x")
            if platform.get("roofY", 0) <= 0:
                fail(f"{label}: platform {platform_index} has an invalid roofY")
            if previous_end is not None:
                gap = platform["x"] - previous_end
                max_gap = max(max_gap, gap)
                max_drop = max(max_drop, platform["roofY"] - platforms[platform_index - 1]["roofY"])
                if gap > 92:
                    fail(f"{label}: platform gap {gap:.0f}px between {platform_index - 1} and {platform_index} is too wide")
            previous_end = platform["x"] + platform["w"]
        if max_drop > 34:
            fail(f"{label}: downward step {max_drop:.0f}px is too steep")

        checkpoints = level["checkpoints"]
        previous_x = -1
        for checkpoint in checkpoints:
            if not (0 < checkpoint["x"] < level["finishX"]):
                fail(f"{label}: checkpoint outside the route: {checkpoint['x']}")
            if checkpoint["x"] <= previous_x:
                fail(f"{label}: checkpoints are not ordered")
            previous_x = checkpoint["x"]

        for nut in level["nuts"]:
            if not (0 <= nut["x"] <= level["lengthPx"]):
                fail(f"{label}: nut outside the world at x={nut['x']}")
            if not (0 <= nut["y"] <= 270):
                fail(f"{label}: nut outside the canvas at y={nut['y']}")
            # Hinter der Ziellinie endet die Etappe: eine Münze dort wäre
            # niemals einzusammeln und macht den Münz-Stern unmöglich.
            if nut["x"] > level["finishX"] - 40:
                fail(f"{label}: nut behind the finish line at x={nut['x']} (finishX {level['finishX']})")

        for prop in level["props"]:
            if not (0 <= prop["x"] <= level["lengthPx"]):
                fail(f"{label}: prop outside the world at x={prop['x']}")

        for key in ("startPct", "finishPct"):
            point = level[key]
            if not (isinstance(point, list) and len(point) == 2 and all(isinstance(value, (int, float)) for value in point)):
                fail(f"{label}: {key} must be an [x, y] pair")
            elif not (0 <= point[0] <= 100 and 0 <= point[1] <= 100):
                fail(f"{label}: {key} outside 0..100: {point}")

        points = level["routePct"]
        if not isinstance(points, list) or len(points) < 2:
            fail(f"{label}: routePct needs at least two points")
        else:
            for point in points:
                if not (isinstance(point, list) and len(point) == 2):
                    fail(f"{label}: routePct contains an invalid point")
                    break
                if not (0 <= point[0] <= 100 and 0 <= point[1] <= 100):
                    fail(f"{label}: routePct point outside 0..100: {point}")
                    break

    print(f"  levels: {len(levels)} stages, ids {', '.join(level['id'] for level in levels)}")


def check_street_model() -> None:
    """Drei Spuren müssen in das 480x270-Canvas passen und belegt sein."""
    if not STREET_JS.exists():
        fail("js/runner/street.js is missing")
        return
    source = STREET_JS.read_text(encoding="utf-8")
    try:
        street_y = int(re.search(r"var STREET_Y = (\d+)", source).group(1))
        heights_match = re.search(r"var LANE_HEIGHTS = \[([^\]]+)\]", source)
        heights = [int(value.strip()) for value in heights_match.group(1).split(",")]
    except (AttributeError, ValueError):
        fail("street.js: lane constants not found")
        return
    if len(heights) != 3:
        fail(f"street.js: expected three lanes, found {len(heights)}")
        return
    feet = [street_y]
    for height in heights[:-1]:
        feet.append(feet[-1] + height)
    bottoms = [feet[i] + heights[i] for i in range(3)]
    if bottoms[-1] > 270:
        fail(f"street.js: lane 2 ends at {bottoms[-1]}px, canvas is 270px high")
    if feet != sorted(feet) or min(heights) < 12:
        fail("street.js: lane bands overlap or are too flat")
    for needle in ("nut.lane = 0", "checkpoints[c].lane = 0"):
        if needle not in source:
            fail(f"street.js: lane assignment missing ({needle})")
    if "window.AUGSBURG_LANE_FEET" not in source:
        fail("street.js: lane feet are not exported for game.js")
    print(f"  street: 3 lanes, feet {feet}, bottoms {bottoms}")


def check_lane_rules() -> None:
    """Nur Strassenbahnen auf dem Gleis, Autos auf der Strasse, keine Spurtaste."""
    game = (RUNNER / "game.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css" / "runner.css").read_text(encoding="utf-8")
    for needle in (
        "var LANE_TRAM = 1;",
        "var LANE_CARS = 2;",
        "function drawTramLine(",
        "function applyRenderScale(",
        "function fitStage(",
        "applyViewport();",
    ):
        if needle not in game:
            fail(f"game.js: expected {needle!r}")
    if 'return type !== "tram";' not in game:
        fail("game.js: buildTraffic must keep trams out of the car pool")
    if "drawDeutscheBahn" in game or "DB_LEVELS" in game:
        fail("game.js: the Deutsche Bahn background must stay removed")
    if "CROUCH_H" not in game or "player.crouching" not in game:
        fail("game.js: the crouch mechanic is missing")
    if 'data-touch="down"' not in index:
        fail("index.html: the touch crouch button is missing")
    if "lowBirds" not in game or "STREET_Y - 26" not in game:
        fail("game.js: the low bird swarm that requires crouching is missing")
    if 'id="hud-heart"' not in index or "beginDeath(" not in game or "updateDeath(" not in game:
        fail("game.js: the one-heart death sequence is missing")
    if "state.heartFull" not in game:
        fail("game.js: the one-heart state is missing")
    if "restartFromDeath(" not in game or "state.activeCheckpoint >= 0" not in game:
        fail("game.js: checkpoint or full-level restart after death is missing")
    if "DAY_CYCLE_SECONDS" not in game or "nightFactor" not in game or "drawNightLighting(" not in game:
        fail("game.js: the day/night cycle with night lights is missing")
    if "drawHousePlaque" in game or "SHOP_SIGNS" in game or "Ausleger-Schild" in game:
        fail("game.js: shop signs on the house facades must stay removed")
    if "function drawSimpleHouses(" not in game or "drawSimpleHouses();" not in game:
        fail("game.js: the simple side-by-side house row is missing")
    if "drawStreetMarket();" in game or "drawBuildingRows();" in game:
        fail("game.js: busy foreground scenery must stay removed")
    if "drawStartStreetSign(" not in game:
        fail("game.js: the single street sign at the start is missing")
    if "signStart" in game:
        fail("game.js: repeated street signs must stay removed")
    if "autoLaneThink" in game or "switchLane(" in game:
        fail("game.js: automatic lane switching must stay removed")
    if 'data-touch="lane"' in index:
        fail("index.html: the manual lane button must stay removed")
    touch_button = re.search(r'data-touch="jump"', index)
    if not touch_button:
        fail("index.html: the jump button is missing")
    if "function switchLane(" in game:
        fail("game.js: lane switching helper is still present")
    if "--stage-w" not in css or "--app-vh" not in css:
        fail("runner.css: viewport variables for the responsive stage are missing")
    print("  lanes: simple road, fixed sidewalk runner, one sign at the start")


def check_sprites() -> None:
    expected = {
        "sprites/boy.png": (12 * 24, 33),
        "sprites/car.png": (72, 32),
        "sprites/car-b.png": (72, 32),
        "sprites/crest.png": (64, 76),
    }
    for relative, size in expected.items():
        path = ROOT / relative
        if not path.exists():
            fail(f"sprite missing: {relative}")
            continue
        actual = png_size(path)
        if actual and actual != size:
            fail(f"{relative}: {actual[0]}x{actual[1]}, expected {size[0]}x{size[1]}")
    print(f"  sprites: {len(expected)} checked")


def local_refs(text: str) -> set[str]:
    refs = set(re.findall(r'(?:src|href)\s*=\s*["\']([^"\'#]+)', text))
    refs.update(re.findall(r'url\(["\']?([^"\')]+)', text))
    return {
        ref
        for ref in refs
        if not ref.startswith(("http://", "https://", "data:", "mailto:", "javascript:", "//"))
        and not ref.startswith("#")
    }


def check_html_and_css() -> None:
    pages = ["index.html", "classic.html"]
    css_files = ["css/runner.css", "css/game.css"]
    for page in pages:
        path = ROOT / page
        if not path.exists():
            fail(f"{page} is missing")
            continue
        text = path.read_text(encoding="utf-8")
        for ref in sorted(local_refs(text)):
            if not (ROOT / ref).exists():
                fail(f"{page}: local reference not found: {ref}")
        ids = re.findall(r'\bid\s*=\s*"([^"]+)"', text)
        duplicates = {value for value in ids if ids.count(value) > 1}
        if duplicates:
            fail(f"{page}: duplicate ids {sorted(duplicates)}")
    for css in css_files:
        path = ROOT / css
        if not path.exists():
            fail(f"{css} is missing")
            continue
        for ref in sorted(local_refs(path.read_text(encoding="utf-8"))):
            if not (ROOT / ref).exists():
                fail(f"{css}: local reference not found: {ref}")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', index)
    order = [
        "js/runner/data/levels.js",
        "js/runner/street.js",
        "js/runner/audio.js",
        "js/runner/store.js",
        "js/runner/browser.js",
        "js/runner/game.js",
    ]
    positions = [scripts.index(item) if item in scripts else -1 for item in order]
    if -1 in positions:
        fail(f"index.html: missing runner scripts, found {scripts}")
    elif positions != sorted(positions):
        fail("index.html: runner scripts are not loaded in dependency order")
    print(f"  pages: {len(pages)} checked, css: {len(css_files)} checked")


def check_dom_contract() -> None:
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    ids = set(re.findall(r'\bid\s*=\s*"([^"]+)"', index))
    missing: dict[str, list[str]] = {}
    for path in sorted(RUNNER.glob("*.js")):
        source = path.read_text(encoding="utf-8")
        for element_id in re.findall(r'getElementById\(\s*"([^"]+)"', source):
            if element_id not in ids:
                missing.setdefault(path.name, []).append(element_id)
    for name, values in missing.items():
        fail(f"{name}: DOM ids missing from index.html: {sorted(set(values))}")
    referenced = sum(
        len(re.findall(r'getElementById\(\s*"([^"]+)"', path.read_text(encoding="utf-8")))
        for path in RUNNER.glob("*.js")
    )
    print(f"  DOM contract: {referenced} element lookups checked")


def check_js_syntax() -> None:
    node = shutil.which("node")
    if not node:
        warn("Node.js not found; skipped JavaScript syntax checks")
        return
    files = sorted(ROOT.glob("js/**/*.js"))
    for path in files:
        result = subprocess.run(
            [node, "--check", str(path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            fail(f"{path.relative_to(ROOT)}: {result.stderr.strip()}")
    print(f"  JavaScript: {len(files)} files parsed with node --check")


def main() -> int:
    print("Auf nach Augsburg - static project check")
    check_levels()
    check_street_model()
    check_lane_rules()
    check_sprites()
    check_html_and_css()
    check_dom_contract()
    check_js_syntax()

    for message in warnings:
        print(f"WARN  {message}")
    if errors:
        print()
        for message in errors:
            print(f"FAIL  {message}")
        print(f"\n{len(errors)} problem(s) found.")
        return 1
    print("\nOK - all static checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
