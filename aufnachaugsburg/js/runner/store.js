/* Fortschritt, Bestzeiten, Sterne und Freischaltungen. */
(function () {
  "use strict";

  var STORAGE_KEY = "aufnachaugsburg.runner.progress.v2";
  var LEGACY_KEY = "aufnachaugsburg.runner.progress.v1";
  var VERSION = 2;

  function emptyProgress() {
    return {
      version: VERSION,
      unlocked: 1,
      cleared: {},
      best: {},
      stars: {},
      seen: {},
      endless: {
        bestStage: 0,
        bestTime: null,
        bestNuts: 0
      }
    };
  }

  function sanitise(raw) {
    var base = emptyProgress();
    if (!raw || typeof raw !== "object") {
      return base;
    }
    var maxLevel = (window.AUGSBURG_ACTIVE_LEVELS || window.AUGSBURG_LEVELS || []).length || 1;
    base.unlocked = Math.max(1, Math.min(maxLevel, Number(raw.unlocked) || 1));
    if (raw.cleared && typeof raw.cleared === "object") {
      base.cleared = raw.cleared;
    }
    if (raw.best && typeof raw.best === "object") {
      base.best = raw.best;
    }
    if (raw.stars && typeof raw.stars === "object") {
      base.stars = raw.stars;
    }
    if (raw.seen && typeof raw.seen === "object") {
      base.seen = raw.seen;
    }
    if (raw.endless && typeof raw.endless === "object") {
      base.endless.bestStage = Math.max(0, Number(raw.endless.bestStage) || 0);
      base.endless.bestTime = isFinite(Number(raw.endless.bestTime)) && raw.endless.bestTime != null
        ? Number(raw.endless.bestTime)
        : null;
      base.endless.bestNuts = Math.max(0, Number(raw.endless.bestNuts) || 0);
    }
    return base;
  }

  function parseStored(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function read() {
    var current = parseStored(STORAGE_KEY);
    if (current) {
      return sanitise(current);
    }
    // v1 had no stars and no endless record. Keep every bit of progress.
    var legacy = parseStored(LEGACY_KEY);
    return sanitise(legacy);
  }

  var data = read();

  function write() {
    data.version = VERSION;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.localStorage.removeItem(LEGACY_KEY);
    } catch (error) {
      /* Fortschritt bleibt dann nur für diese Sitzung erhalten. */
    }
  }

  function levelId(level) {
    return level && level.id ? level.id : String(level);
  }

  function activeLevels() {
    return window.AUGSBURG_ACTIVE_LEVELS || window.AUGSBURG_LEVELS || [];
  }

  function unlockedCount() {
    var levels = activeLevels();
    var count = 0;
    levels.forEach(function (level) {
      if (isUnlocked(level)) {
        count += 1;
      }
    });
    return count;
  }

  function clearedCount() {
    var levels = activeLevels();
    return levels.filter(function (level) {
      return Boolean(data.cleared[levelId(level)]);
    }).length;
  }

  function isUnlocked(level) {
    if (!level) {
      return false;
    }
    return Number(level.num) <= Number(data.unlocked);
  }

  function best(level) {
    return data.best[levelId(level)] || null;
  }

  function stars(level) {
    return Math.max(0, Math.min(3, Number(data.stars[levelId(level)]) || 0));
  }

  function complete(level, result) {
    var id = levelId(level);
    var levels = activeLevels();
    var previous = data.best[id];
    var previousStars = Number(data.stars[id]) || 0;
    var nextUnlock = Math.max(data.unlocked, Math.min(levels.length, Number(level.num) + 1));
    var newlyUnlocked = nextUnlock > data.unlocked;
    data.unlocked = nextUnlock;
    data.cleared[id] = true;
    data.best[id] = {
      time: previous && previous.time ? Math.min(previous.time, result.time) : result.time,
      nuts: Math.max(previous && previous.nuts ? previous.nuts : 0, result.nuts || 0),
      totalNuts: result.totalNuts || (previous ? previous.totalNuts : 0) || 0,
      hits: previous && isFinite(previous.hits) ? Math.min(previous.hits, result.hits || 0) : (result.hits || 0),
      stars: Math.max(previousStars, result.stars || 0),
      distance: level.distance,
      at: Date.now()
    };
    data.stars[id] = Math.max(previousStars, result.stars || 0);
    write();
    return {
      isBest: !previous || result.time < previous.time,
      previousTime: previous ? previous.time : null,
      newlyUnlocked: newlyUnlocked,
      unlocked: data.unlocked,
      stars: data.stars[id],
      starsGained: data.stars[id] > previousStars
    };
  }

  function recordEndless(stage, time, nuts) {
    if (stage > data.endless.bestStage) {
      data.endless.bestStage = stage;
    }
    if (data.endless.bestTime == null || time < data.endless.bestTime) {
      data.endless.bestTime = time;
    }
    data.endless.bestNuts = Math.max(data.endless.bestNuts, nuts || 0);
    write();
    return data.endless;
  }

  function markSeen(level) {
    data.seen[levelId(level)] = true;
    write();
  }

  function get() {
    return data;
  }

  function reset() {
    data = emptyProgress();
    write();
  }

  window.RunnerStore = {
    get: get,
    isUnlocked: isUnlocked,
    best: best,
    stars: stars,
    complete: complete,
    recordEndless: recordEndless,
    markSeen: markSeen,
    unlockedCount: unlockedCount,
    clearedCount: clearedCount,
    reset: reset
  };
})();
