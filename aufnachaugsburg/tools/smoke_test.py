#!/usr/bin/env python3
"""Headless acceptance test for Auf nach Augsburg.

Starts a local server, opens the game in headless Chromium and checks the
paths that are easy to break by hand:

* the stage browser and the help dialog,
* the automatic run through the three active stages,
* pause, map, resume and manual takeover of the auto-run,
* endless mode and its running total time,
* progress reset and v1 storage migration,
* the classic mode page,
* a narrow mobile viewport without horizontal overflow.

Requirements:

    python -m pip install playwright
    python -m playwright install chromium

Run from the project root:

    python tools/smoke_test.py

The test uses a throw-away browser profile, so it never touches your own
progress. It is not a replacement for the manual playtest in PLAYTEST.md.
"""

from __future__ import annotations

import functools
import http.server
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover - depends on the local machine
    print("Playwright is missing. Install it with:")
    print("  python -m pip install playwright")
    print("  python -m playwright install chromium")
    sys.exit(2)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


class Server:
    def __init__(self) -> None:
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        host, port = self.httpd.server_address[:2]
        return f"http://{host}:{port}"

    def __enter__(self) -> "Server":
        self.thread.start()
        return self

    def __exit__(self, *exc_info) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class Checker:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.checks = 0

    def check(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.failures.append(message)
            print(f"  FAIL  {message}")
        else:
            print(f"  ok    {message}")

    def equal(self, actual, expected, message: str) -> None:
        self.check(actual == expected, f"{message} (got {actual!r}, expected {expected!r})")


INSTALL_AUTO_RUN = """
() => {
  if (!window.__augsburgTest) {
    const originalRaf = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    window.__augsburgTest = {
      originalRaf,
      originalCancel,
      callback: null,
      time: performance.now(),
      install() {
        window.requestAnimationFrame = (fn) => { this.callback = fn; return 1; };
        window.cancelAnimationFrame = () => {};
      },
      restore() {
        window.requestAnimationFrame = this.originalRaf;
        window.cancelAnimationFrame = this.originalCancel;
        this.callback = null;
      },
      step(frames) {
        for (let i = 0; i < frames; i += 1) {
          this.time += 100;
          if (this.callback) this.callback(this.time);
        }
      }
    };
  }
  window.__augsburgTest.install();
  return true;
}
"""

SIMULATE_CURRENT_STAGE = """
() => {
  const test = window.__augsburgTest;
  test.time = performance.now();
  const stage = document.getElementById('stage');
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  let frames = 0;
  while (frames < 6000) {
    test.step(1);
    frames += 1;
    if (frames % 30 === 0) {
      const mode = window.RunnerGame.debug().mode;
      if (mode === 'complete' || mode === 'browser') break;
    }
  }
  const debug = window.RunnerGame.debug();
  return {
    levelId: debug.levelId,
    mode: debug.mode,
    elapsed: debug.elapsed,
    falls: debug.falls,
    hits: debug.hits,
    scooterHits: debug.scooterHits,
    frames,
    hudTime: document.getElementById('hud-time').textContent,
    winTime: document.getElementById('win-time').textContent,
    winStars: document.getElementById('win-stars').textContent,
    winNuts: document.getElementById('win-nuts').textContent
  };
}
"""

RUN_STAGE = """
(index) => {
  const test = window.__augsburgTest;
  test.callback = null;
  test.time = performance.now();
  window.RunnerGame.start(index);
  const stage = document.getElementById('stage');
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  let frames = 0;
  while (frames < 6000) {
    test.step(1);
    frames += 1;
    if (frames % 30 === 0) {
      const mode = window.RunnerGame.debug().mode;
      if (mode === 'complete' || mode === 'browser') break;
    }
  }
  const debug = window.RunnerGame.debug();
  return {
    level: index + 1,
    mode: debug.mode,
    elapsed: debug.elapsed,
    falls: debug.falls,
    hits: debug.hits,
    scooterHits: debug.scooterHits,
    frames,
    hudTime: document.getElementById('hud-time').textContent,
    winTime: document.getElementById('win-time').textContent,
    winStars: document.getElementById('win-stars').textContent,
    winNuts: document.getElementById('win-nuts').textContent
  };
}
"""


CHECKPOINT_RESPAWN = """
() => {
  const test = window.__augsburgTest;
  test.callback = null;
  test.time = performance.now();
  window.RunnerGame.start(0);
  const stage = document.getElementById('stage');
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const key = (value) => document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const keyup = (value) => document.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true, cancelable: true }));
  let frames = 0;
  while (frames < 1600) {
    test.step(1);
    frames += 1;
    if (frames % 10 === 0 && window.RunnerGame.debug().activeCheckpoint >= 0) break;
  }
  const checkpoint = window.RunnerGame.debug();
  if (!checkpoint.lastCheckpoint) {
    return { checkpoint, respawn: checkpoint, frames, error: 'no checkpoint reached' };
  }
  const lastSafeBefore = window.RunnerGame.debug().lastSafe;
  window.RunnerGame.forceFall();
  return { checkpoint, lastSafeBefore, respawn: window.RunnerGame.debug(), frames };
}
"""


def unlock_all(page) -> None:
    page.evaluate(
        """
        () => {
          const levels = window.AUGSBURG_LEVELS || [];
          const cleared = {}, best = {}, stars = {}, seen = {};
          levels.forEach((level) => {
            cleared[level.id] = true;
            best[level.id] = {
              time: level.targetTime,
              nuts: level.nuts.length,
              totalNuts: level.nuts.length,
              hits: 0,
              stars: 3,
              distance: level.distance
            };
            stars[level.id] = 3;
            seen[level.id] = true;
          });
          localStorage.setItem('aufnachaugsburg.runner.progress.v2', JSON.stringify({
            version: 2,
            unlocked: levels.length,
            cleared, best, stars, seen,
            endless: { bestStage: 0, bestTime: null, bestNuts: 0 }
          }));
        }
        """
    )
    page.reload()
    page.wait_for_load_state("load")


def attach_error_capture(page, label: str, checker: Checker) -> None:
    page.on(
        "pageerror",
        lambda error: checker.failures.append(f"{label}: page error: {error}"),
    )
    page.on(
        "console",
        lambda message: checker.failures.append(f"{label}: console {message.type}: {message.text}")
        if message.type == "error"
        else None,
    )


def main() -> int:
    checker = Checker()
    with Server() as server, sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 1360, "height": 900})
        page = context.new_page()
        attach_error_capture(page, "desktop", checker)

        page.goto(server.url + "/")
        page.wait_for_load_state("load")
        checker.check(page.evaluate("() => Boolean(window.RunnerGame && window.RunnerStore)"), "runner API is available")
        checker.equal(page.locator(".level-card").count(), 3, "three active stage cards rendered")
        checker.check(
            page.evaluate("() => document.getElementById('load-error').classList.contains('hidden')"),
            "load error banner stays hidden",
        )

        # Enter belongs to the focused control, not to the stage browser.
        page.focus("#help-open")
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        checker.check(
            page.evaluate("() => document.getElementById('play').classList.contains('hidden')"),
            "Enter on the help button does not start a stage",
        )
        checker.check(
            page.evaluate("() => !document.getElementById('help-modal').classList.contains('hidden')"),
            "Enter on the help button opens the help dialog",
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)

        checker.equal(page.locator("#browser-music").inner_text(), "MUSIK AN", "music starts enabled")
        page.click("#browser-music")
        page.wait_for_timeout(100)
        checker.check(
            not page.evaluate("() => window.RunnerAudio.isMusicEnabled()"),
            "the music button disables the soundtrack",
        )
        checker.equal(page.locator("#browser-music").inner_text(), "MUSIK AUS", "the music button label follows")
        page.click("#browser-music")
        page.wait_for_timeout(100)
        checker.check(
            page.evaluate("() => window.RunnerAudio.isMusicEnabled()"),
            "the music button enables the soundtrack again",
        )
        checker.check(
            page.evaluate("() => window.RunnerAudio.isMusicPlaying()"),
            "the soundtrack scheduler is running",
        )

        checker.equal(page.locator(".level-card.locked").count(), 2, "a fresh profile starts with two locked stages")
        page.evaluate(INSTALL_AUTO_RUN)
        fresh = page.evaluate(RUN_STAGE, 0)
        checker.equal(fresh["mode"], "complete", "the first stage is playable from a fresh profile")
        checker.equal(
            page.evaluate("() => window.RunnerStore.get().unlocked"),
            2,
            "finishing stage 1 unlocks stage 2",
        )
        checker.equal(page.locator("#progress-count").inner_text(), "1 / 3", "the progress counter updates")

        unlock_all(page)
        checker.equal(page.locator(".level-card").count(), 3, "three active stage cards after unlock")
        checker.check(
            page.evaluate("() => !document.getElementById('endless-start').classList.contains('hidden')"),
            "endless mode appears after the active stages",
        )

        page.evaluate(INSTALL_AUTO_RUN)
        print("\nAutomatic run through all stages")
        results = []
        for index in range(3):
            result = page.evaluate(RUN_STAGE, index)
            results.append(result)
            checker.equal(result["mode"], "complete", f"stage {index + 1} reaches the goal")
            checker.check(result["elapsed"] > 0, f"stage {index + 1} records a time")
            checker.check(result["falls"] <= 2, f"stage {index + 1} needs at most two retries")
        print()
        print("  stage   time    target   falls   hits   stars   nuts")
        for result in results:
            level = page.evaluate("(index) => window.AUGSBURG_LEVELS[index].targetTime", result["level"] - 1)
            print(
                f"  {result['level']:>5}   {result['elapsed']:>5.1f}s   {level:>4}s   "
                f"{result['falls']:>5}   {result['hits']:>4}   {result['winStars']}   {result['winNuts']}"
            )
        scooter_hits = sum(result["scooterHits"] for result in results)
        checker.check(scooter_hits > 0, f"E-scooter kids bump the runner ({scooter_hits} hits)")

        # Pause, map and manual takeover.
        print("\nPause, map and manual takeover")
        page.evaluate("() => window.RunnerGame.goBrowser(0)")
        page.evaluate("() => window.RunnerGame.start(0)")
        page.evaluate(
            "() => document.getElementById('stage').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true}))"
        )
        page.evaluate("() => window.__augsburgTest.step(60)")
        before = page.evaluate("() => window.RunnerGame.debug()")
        page.keyboard.press("p")
        page.wait_for_timeout(100)
        paused = page.evaluate("() => window.RunnerGame.debug()")
        page.evaluate("() => window.__augsburgTest.step(30)")
        paused_later = page.evaluate("() => window.RunnerGame.debug()")
        checker.equal(paused["mode"], "paused", "P pauses the stage")
        checker.check(
            abs(paused_later["elapsed"] - paused["elapsed"]) < 0.001,
            "the clock stops while paused",
        )
        page.keyboard.press("p")
        page.wait_for_timeout(100)
        page.evaluate("() => window.__augsburgTest.step(30)")
        resumed = page.evaluate("() => window.RunnerGame.debug()")
        checker.equal(resumed["mode"], "playing", "P resumes the stage")
        checker.check(resumed["autoRun"], "the auto-run survives pause and resume")
        page.keyboard.press("m")
        page.wait_for_timeout(100)
        page.evaluate("() => window.__augsburgTest.step(30)")
        map_state = page.evaluate("() => window.RunnerGame.debug()")
        checker.equal(map_state["mode"], "map", "M opens the map")
        page.keyboard.press("m")
        page.wait_for_timeout(100)
        page.evaluate("() => window.__augsburgTest.step(30)")
        back_state = page.evaluate("() => window.RunnerGame.debug()")
        checker.equal(back_state["mode"], "playing", "M closes the map again")
        checker.check(back_state["autoRun"], "the auto-run survives the map")
        page.keyboard.press("a")
        page.wait_for_timeout(100)
        checker.check(
            not page.evaluate("() => window.RunnerGame.debug().autoRun"),
            "A cancels the auto-run",
        )

        # The last flag is the respawn point, even after later safe landings.
        print("\nCheckpoint respawn")
        page.evaluate("() => window.RunnerGame.goBrowser(0)")
        page.wait_for_timeout(100)
        respawn = page.evaluate(CHECKPOINT_RESPAWN)
        checkpoint = respawn["checkpoint"].get("lastCheckpoint")
        checker.check(checkpoint is not None, "a flag checkpoint is reached")
        if checkpoint:
            player = respawn["respawn"].get("player") or {}
            checker.check(
                abs(player.get("x", -999) - checkpoint["x"]) <= 20,
                f"respawn x is at the last flag (flag {checkpoint['x']}, player {player.get('x')})",
            )
            checker.check(
                abs((player.get("y", -999) + 28) - checkpoint["y"]) <= 1,
                f"respawn y is on the checkpoint roof (player y {player.get('y')}, checkpoint y {checkpoint['y']})",
            )
            last_safe = respawn.get("lastSafeBefore")
            checker.check(last_safe is not None, "a safe street position was recorded")
        page.evaluate("() => window.RunnerGame.goBrowser(0)")
        page.wait_for_timeout(100)

        # Endless mode.
        print("\nEndless mode")
        page.evaluate("() => window.RunnerGame.goBrowser(0)")
        page.wait_for_timeout(150)
        page.click("#endless-start")
        page.wait_for_timeout(150)
        checker.check(page.evaluate("() => window.RunnerGame.debug().endless"), "endless mode starts")
        first = page.evaluate(SIMULATE_CURRENT_STAGE)
        checker.equal(first["mode"], "complete", "the first endless stage finishes")
        page.wait_for_timeout(1800)
        page.evaluate("() => window.__augsburgTest.step(60)")
        next_state = page.evaluate("() => window.RunnerGame.debug()")
        checker.check(next_state["endless"], "endless mode stays active")
        checker.equal(next_state["levelId"], "koenigsplatz", "endless mode advances to the next stage")
        checker.check(
            page.evaluate("() => document.getElementById('hud-time').textContent !== '0:00.0'"),
            "the endless HUD shows the running total time",
        )
        page.evaluate("() => window.__augsburgTest.restore()")
        page.keyboard.press("p")
        page.wait_for_timeout(100)
        page.click("#pause-browser-btn")
        page.wait_for_timeout(150)
        checker.check(page.evaluate("() => !window.RunnerGame.debug().endless"), "leaving endless mode stops it")
        checker.check(
            page.evaluate("() => !document.getElementById('browser').classList.contains('hidden')"),
            "the stage browser returns",
        )

        # Reset and v1 migration.
        print("\nProgress, reset and migration")
        page.click("#reset-progress")
        page.click("#reset-progress")
        page.wait_for_timeout(150)
        checker.equal(page.locator("#progress-count").inner_text(), "0 / 3", "reset clears all progress")
        checker.equal(page.evaluate("() => window.RunnerStore.get().unlocked"), 1, "reset locks later stages")

        page.evaluate(
            """
            () => {
              localStorage.removeItem('aufnachaugsburg.runner.progress.v2');
              localStorage.setItem('aufnachaugsburg.runner.progress.v1', JSON.stringify({
                unlocked: 3,
                cleared: { hbf: true, koenigsplatz: true },
                best: { hbf: { time: 31.2, nuts: 24 }, koenigsplatz: { time: 38.4, nuts: 25 } }
              }));
            }
            """
        )
        page.reload()
        page.wait_for_load_state("load")
        checker.equal(page.evaluate("() => window.RunnerStore.get().unlocked"), 3, "v1 progress is migrated")
        checker.equal(page.locator("#progress-count").inner_text(), "2 / 3", "v1 clears are kept")

        # Classic mode.
        print("\nClassic mode")
        classic = context.new_page()
        attach_error_capture(classic, "classic", checker)
        classic.goto(server.url + "/classic.html")
        classic.wait_for_load_state("load")
        checker.check(classic.evaluate("() => Boolean(window.Mario && window.Mario.Augsburg)"), "classic engine loads")
        classic.click("#start-btn")
        classic.wait_for_timeout(1200)
        checker.check(classic.evaluate("() => window.gameStarted === true"), "classic stage starts")
        checker.check(
            classic.evaluate("() => document.getElementById('hud-time').textContent !== '0:00'"),
            "classic HUD clock runs",
        )
        classic.close()

        # Small screen.
        print("\nMobile layout")
        mobile = context.new_page()
        attach_error_capture(mobile, "mobile", checker)
        mobile.set_viewport_size({"width": 390, "height": 844})
        mobile.goto(server.url + "/")
        mobile.wait_for_load_state("load")
        checker.equal(mobile.locator(".level-card").count(), 3, "mobile shows all three active cards")
        checker.check(
            mobile.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"),
            "mobile page has no horizontal overflow",
        )
        mobile.close()

        browser.close()

    print()
    if checker.failures:
        print(f"{len(checker.failures)} failure(s) out of {checker.checks} checks:")
        for failure in checker.failures:
            print(f"  - {failure}")
        return 1
    print(f"OK - {checker.checks} checks passed.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PlaywrightError as exc:  # pragma: no cover - environment problem
        print(f"Browser test could not run: {exc}")
        print("Install Chromium with: python -m playwright install chromium")
        sys.exit(2)

