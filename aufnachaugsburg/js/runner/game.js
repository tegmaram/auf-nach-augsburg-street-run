/* Auf nach Augsburg — der Pixel-Stadtlauf.
   Die Levelgeometrie kommt aus echten OpenStreetMap-Gebäuden entlang
   echter Augsburger Fußrouten. Hier wohnt der Runner selbst. */
(function () {
  "use strict";

  var LEVELS = window.AUGSBURG_LEVELS || [];
  var ACTIVE_LEVELS = window.AUGSBURG_ACTIVE_LEVELS || LEVELS;
  var STREET_Y = window.AUGSBURG_STREET_Y || 212;

  // Drei Spuren pro Etappe: Bürgersteig, Straße 1 und Straße 2. Die Spuren
  // liegen als flache Bänder untereinander (Pseudo-Perspektive). Der Junge
  // steht immer auf der Oberkante seines Bandes, der Verkehr fährt im Band.
  var LANE_COUNT = 3;
  var LANE_SIDEWALK = 0;
  // Höhen und Standlinien kommen aus street.js, damit es nur eine Quelle gibt.
  var LANE_HEIGHTS = window.AUGSBURG_LANE_HEIGHTS || [16, 21, 21];
  var LANE_FEET = window.AUGSBURG_LANE_FEET || [
    STREET_Y,
    STREET_Y + LANE_HEIGHTS[0],
    STREET_Y + LANE_HEIGHTS[0] + LANE_HEIGHTS[1]
  ];
  var LANE_BOTTOMS = [
    LANE_FEET[0] + LANE_HEIGHTS[0],
    LANE_FEET[1] + LANE_HEIGHTS[1],
    LANE_FEET[2] + LANE_HEIGHTS[2]
  ];
  var LANE_LABELS = ["BÜRGERSTEIG", "STRASSENBAHN", "STRASSE"];
  var LANE_SHORT = ["GEHWEG", "TRAM", "STRASSE"];
  // Spur 1 ist die Straßenbahn-Linie (nur Bahnen, Fahrtrichtung mit),
  // Spur 2 ist die Autofahrbahn (Gegenverkehr).
  var LANE_DIRS = [0, 1, -1];
  var LANE_TRAM = 1;
  var LANE_CARS = 2;

  function laneFeet(lane) {
    return LANE_FEET[clampLane(lane)];
  }

  function clampLane(lane) {
    var value = Math.round(Number(lane) || 0);
    return Math.max(0, Math.min(LANE_COUNT - 1, value));
  }

  function laneTrafficGround(lane) {
    return LANE_BOTTOMS[clampLane(lane)] - 3;
  }

  var canvas = document.getElementById("game-canvas");
  if (!canvas || !LEVELS.length) {
    return;
  }
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var W = canvas.width;
  var H = canvas.height;
  // Die Spiellogik rechnet immer in 480x270 (WxH). Fuer scharfe Pixelkunst
  // waechst nur der Backing-Store in ganzen Vielfachen mit - alle Koordinaten
  // im Spiel bleiben unveraendert, die Leinwand wird per Transform skaliert.
  var BASE_W = W;
  var BASE_H = H;
  var renderScale = 1;
  var viewportQueued = false;

  var STEP = 1 / 60;
  var WALK = 1.68;
  var RUN = 2.9;
  var GRAVITY = 0.42;
  var JUMP = -7.9;
  var MAX_FALL = 9.2;
  var BOY_W = 24;
  var BOY_H = 33;
  var STAND_H = 28;
  var CROUCH_H = 18;
  // Ein kompletter Tag-Nacht-Zyklus dauert gut eine Minute. So erlebt man
  // während einer Etappe den Wechsel von Tageslicht zu Abend und Nacht.
  var DAY_CYCLE_SECONDS = 72;

  var PALETTES = {
    hbf: {
      walls: ["#d8c3a1", "#c9ae8d", "#e3d2b6", "#bf9d78"],
      roofs: ["#97523f", "#a86148", "#7f4436"],
      trim: "#f0dfbf",
      accent: "#b63b2f",
      shutters: "#3e6258"
    },
    koenigsplatz: {
      walls: ["#ddcba9", "#ccb58f", "#e7d6b9", "#bda27e"],
      roofs: ["#5b6270", "#8f5844", "#a6684d"],
      trim: "#f2e3c7",
      accent: "#cc6b43",
      shutters: "#425f6e"
    },
    rathaus: {
      walls: ["#d9b884", "#c99c6a", "#e3c79c", "#b8895b"],
      roofs: ["#843e31", "#a14e37", "#70352b"],
      trim: "#f4e0b8",
      accent: "#b63b2f",
      shutters: "#4b6b4d"
    },
    dom: {
      walls: ["#d9cdb4", "#c9bda5", "#e7ddc9", "#b8ab92"],
      roofs: ["#427b72", "#356861", "#5b8b7b"],
      trim: "#efe6d2",
      accent: "#3f7fc1",
      shutters: "#586c5e"
    },
    fuggerei: {
      walls: ["#e0c8a2", "#d4b58d", "#e8d5b3", "#c7a67d"],
      roofs: ["#b5523b", "#cc674a", "#9a4634"],
      trim: "#f4e2c2",
      accent: "#6f9d54",
      shutters: "#4f6f4a"
    },
    lechkanaele: {
      walls: ["#cdd6c8", "#bcc8bd", "#dde4d6", "#aebba9"],
      roofs: ["#4d7c74", "#3d6863", "#5c8b7e"],
      trim: "#e9f0df",
      accent: "#3f8fa8",
      shutters: "#3f6470"
    },
    zeughaus: {
      walls: ["#d4b48e", "#c39d75", "#e0c6a2", "#b08661"],
      roofs: ["#6b4a3c", "#7f5847", "#5a3d33"],
      trim: "#f1dfbf",
      accent: "#b07a45",
      shutters: "#5a4b45"
    },
    sheridanpark: {
      walls: ["#d8d2b8", "#c8c1a3", "#e4deca", "#b6ae8d"],
      roofs: ["#5f7450", "#72845c", "#4d6243"],
      trim: "#f0ead4",
      accent: "#6f9d54",
      shutters: "#4f6b4a"
    }
  };

  // Die Kulisse jeder Etappe zeigt reale Augsburger Bauwerke entlang der
  // jeweiligen Route (nicht erfunden, sondern recherchiert).
  var LANDMARK_SEQUENCE = {
    // Hauptbahnhof -> Bahnhofstraße -> Königsplatz
    hbf: ["hauptbahnhof", "bahnhofstrasse", "synagoge", "koenigsplatz"],
    // Königsplatz -> Maximilianstraße -> Rathausplatz
    koenigsplatz: ["koenigsplatz", "schaezlerpalais", "merkurbrunnen", "herkulesbrunnen"],
    // Rathausplatz: Rathaus, Perlachturm, Augustusbrunnen, Holl-Obelisk
    rathaus: ["rathaus", "augustusbrunnen", "perlachturm", "obelisk"],
    dom: ["dom", "hoherweg", "perlachturm", "fuggerhaeuser"],
    fuggerei: ["fuggerei", "fuggerhaeuser", "perlachturm"],
    lechkanaele: ["zeug", "perlachturm", "dom", "hoherweg"],
    zeughaus: ["zeug", "rathaus", "perlachturm", "fuggerhaeuser"],
    sheridanpark: ["fuggerei", "dom", "perlachturm"]
  };

  var SHORT_NAMES = {
    hbf: "HAUPTBAHNHOF",
    koenigsplatz: "KÖNIGSPLATZ",
    rathaus: "RATHAUS",
    dom: "DOM",
    fuggerei: "FUGGEREI",
    lechkanaele: "LECHKANÄLE",
    zeughaus: "ZEUGHAUS",
    sheridanpark: "SHERIDAN"
  };

  // Jede Etappe ist eine eigene Straßenszene. Die Werte steuern Belag,
  // Bordstein, Fahrzeuge, Laternen und die Skyline im Hintergrund.
  var DISTRICTS = {
    hbf: {
      street: "#3b4149", streetDark: "#242a30", sidewalk: "#c8c3b4",
      curb: "#8b887d", line: "#e9dfc4", accent: "#e0a458", material: "brick",
      cars: ["taxi", "bus", "van", "sedan"], carRate: 0.85, trees: false,
      rails: true, water: false, signature: "station"
    },
    koenigsplatz: {
      street: "#474540", streetDark: "#2b2a27", sidewalk: "#d6cfba",
      curb: "#9b9382", line: "#efe3bf", accent: "#d96c4a", material: "plaster",
      cars: ["tram", "taxi", "sedan", "bus"], carRate: 0.9, trees: true,
      rails: true, water: false, signature: "boulevard"
    },
    rathaus: {
      street: "#4b4640", streetDark: "#2c2925", sidewalk: "#d2c5a8",
      curb: "#9a8a70", line: "#e8d6ac", accent: "#b63b2f", material: "stone",
      cars: ["sedan", "van", "taxi"], carRate: 0.65, trees: false,
      rails: false, water: false, signature: "rathaus"
    },
    dom: {
      street: "#484744", streetDark: "#2a2a29", sidewalk: "#cfc8b8",
      curb: "#948d80", line: "#e5dfcc", accent: "#3f7fc1", material: "stone",
      cars: ["sedan", "van", "taxi"], carRate: 0.55, trees: true,
      rails: false, water: true, signature: "dom"
    },
    fuggerei: {
      street: "#5a4f44", streetDark: "#332d28", sidewalk: "#cdbb98",
      curb: "#a08968", line: "#dcc89e", accent: "#6f9d54", material: "timber",
      cars: ["sedan", "van"], carRate: 0.35, trees: false,
      rails: false, water: false, signature: "fuggerei"
    },
    lechkanaele: {
      street: "#3d4b4f", streetDark: "#243033", sidewalk: "#b9c9c2",
      curb: "#829690", line: "#d6e7df", accent: "#3f8fa8", material: "plaster",
      cars: ["van", "sedan"], carRate: 0.35, trees: true,
      rails: false, water: true, signature: "canal"
    },
    zeughaus: {
      street: "#4a4550", streetDark: "#2b2831", sidewalk: "#c4b9a2",
      curb: "#8d816c", line: "#e0cfae", accent: "#b07a45", material: "stone",
      cars: ["tram", "sedan", "van", "taxi"], carRate: 0.7, trees: true,
      rails: true, water: false, signature: "zeughaus"
    },
    sheridanpark: {
      street: "#59634e", streetDark: "#333b2e", sidewalk: "#c8c2a4",
      curb: "#948e70", line: "#e8dfba", accent: "#6f9d54", material: "plaster",
      cars: ["van", "sedan"], carRate: 0.2, trees: true,
      rails: false, water: true, signature: "park"
    }
  };

  // Fahrzeugtypen für den Straßenverkehr. Sie werden als Pixelgrafik
  // gezeichnet, damit neue Autos ohne zusätzliche Bilddateien dazukommen.
  var CAR_TYPES = {
    sedan: { w: 38, h: 19, bodies: ["#b63b2f", "#3f7fc1", "#6f9d54", "#8a5a3c", "#e8e2d0"] },
    taxi: { w: 42, h: 21, bodies: ["#f2c14e", "#e8b24e"], sign: "TAXI" },
    van: { w: 47, h: 25, bodies: ["#e8e2d0", "#5b8fd6", "#8a5a3c"] },
    bus: { w: 68, h: 28, bodies: ["#3f7fc1", "#b63b2f", "#6f9d54"], sign: "STADT" },
    tram: { w: 96, h: 30, bodies: ["#e8e2d0", "#c8443c", "#d8c46a"], sign: "1" },
    police: { w: 41, h: 20, bodies: ["#e8e2d0"], stripe: "#3f6f8a", sign: "POLIZEI" }
  };

  var NPC_COATS = ["#9f4f3f", "#3f6f8a", "#5f7a4a", "#b08a3e", "#6b4f6f", "#4a5560", "#8a5a3c"];
  var NPC_SKINS = ["#e8b07a", "#c98f5f", "#8a5b3c", "#f0c9a0", "#b9784f"];
  var NPC_HAIRS = ["#39251b", "#5a3c27", "#241f1c", "#7a5a36", "#b8b0a0"];
  var NPC_HATS = [null, "#3c4c5a", "#7a3b32", "#d0b37a", "#6f9d54", "#b63b2f", "#e8e2d0"];
  var NPC_JACKETS = ["#2b3038", "#3a2f42", "#243b36", "#4e322c", "#333a4f", "#5a4636"];
  var NPC_CAPS = ["#b63b2f", "#e0a458", "#3f7fc1", "#f2c14e", "#6f9d54", "#8a5a3c"];
  var HELMET_COLORS = ["#f2c14e", "#e8e2d0", "#3f7fc1", "#b63b2f", "#6f9d54", "#e07a5f"];
  var NPC_BAGS = ["tote", "backpack", "newspaper", "none"];
  var SCOOTER_COLORS = [
    { deck: "#62b8a4", glow: "#8ee4c8", light: "#f7dc8a" },
    { deck: "#e07a5f", glow: "#ffb59d", light: "#fff1b8" },
    { deck: "#5b8fd6", glow: "#9bc4ff", light: "#f7dc8a" },
    { deck: "#d6b24c", glow: "#ffe08a", light: "#fff7d2" },
    { deck: "#8d6fbf", glow: "#c4a7f0", light: "#f7dc8a" }
  ];
  // Die Hausfassaden tragen bewusst keine Ladenschilder mehr.

  var reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduceMotion = Boolean(reducedMotionQuery && reducedMotionQuery.matches);

  var els = {
    browser: document.getElementById("browser"),
    play: document.getElementById("play"),
    stage: document.getElementById("stage"),
    hud: document.getElementById("hud"),
    hudLevelNum: document.getElementById("hud-levelnum"),
    hudLevelName: document.getElementById("hud-levelname"),
    hudSubtitle: document.getElementById("hud-subtitle"),
    hudMode: document.getElementById("hud-mode"),
    hudMeters: document.getElementById("hud-meters"),
    hudHeart: document.getElementById("hud-heart"),
    hudNuts: document.getElementById("hud-nuts"),
    hudNutsTotal: document.getElementById("hud-nuts-total"),
    hudTime: document.getElementById("hud-time"),
    routeFill: document.getElementById("route-fill"),
    routeBoy: document.getElementById("route-boy"),
    minimapPanel: document.getElementById("minimap-panel"),
    minimapPlace: document.getElementById("minimap-place"),
    minimapImg: document.getElementById("minimap-img"),
    minimapDot: document.getElementById("minimap-dot"),
    cinematic: document.getElementById("cinematic"),
    cinematicKicker: document.getElementById("cinematic-kicker"),
    cinematicName: document.getElementById("cinematic-name"),
    cinematicTagline: document.getElementById("cinematic-tagline"),
    toast: document.getElementById("toast"),
    clickHint: document.getElementById("click-hint"),
    pauseModal: document.getElementById("pause-modal"),
    pauseCopy: document.getElementById("pause-copy"),
    winModal: document.getElementById("win-modal"),
    winKicker: document.getElementById("win-kicker"),
    winTitle: document.getElementById("win-title"),
    winCopy: document.getElementById("win-copy"),
    winTime: document.getElementById("win-time"),
    winNuts: document.getElementById("win-nuts"),
    winDistance: document.getElementById("win-distance"),
    winBest: document.getElementById("win-best"),
    winStars: document.getElementById("win-stars"),
    winTarget: document.getElementById("win-target"),
    unlockBanner: document.getElementById("unlock-banner"),
    winNext: document.getElementById("win-next"),
    winRestart: document.getElementById("win-restart"),
    winBrowser: document.getElementById("win-browser"),
    mapModal: document.getElementById("map-modal"),
    bigMapImg: document.getElementById("big-map-img"),
    bigMapDot: document.getElementById("big-map-dot"),
    mapModalLevel: document.getElementById("map-modal-level"),
    mapModalDistance: document.getElementById("map-modal-distance"),
    mapModalProgress: document.getElementById("map-modal-progress"),
    mapGoogle: document.getElementById("map-google"),
    pauseSound: document.getElementById("pause-sound")
  };

  var images = {
    boy: new Image(),
    car: new Image(),
    carB: new Image()
  };
  images.boy.src = "sprites/boy.png";
  images.car.src = "sprites/car.png";
  images.carB.src = "sprites/car-b.png";
  LEVELS.forEach(function (level) {
    level._map = new Image();
    level._map.src = level.map;
    level._routeCache = null;
  });

  var state = {
    mode: "browser",
    level: null,
    levelIndex: 0,
    startPlatform: null,
    finishPlatform: null,
    palette: PALETTES.hbf,
    colors: null,
    player: null,
    playerVisible: false,
    playerInCar: false,
    car: { x: 0, y: 0, visible: false, moving: false, direction: 1 },
    camera: 0,
    elapsed: 0,
    worldTime: 0,
    dayTime: 0.3,
    sunElevation: 0,
    nightFactor: 0,
    sunsetFactor: 0,
    skyNow: null,
    nightWindows: [],
    nightLamps: [],
    hudTick: 0,
    introTime: 0,
    outroTime: 0,
    carSoundPlayed: false,
    carHornPlayed: false,
    introPlayerAction: "idle",
    collected: new Set(),
    activeCheckpoint: -1,
    lastCheckpoint: null,
    lastSafe: null,
    autoTarget: null,
    autoRun: false,
    particles: [],
    npcs: [],
    birds: [],
    traffic: [],
    hitCooldown: 0,
    heartFull: true,
    deathTime: 0,
    deathSpin: 0,
    deathCause: "",
    hits: 0,
    carHits: 0,
    laneSwitchCooldown: 0,
    laneDrawOffset: 0,
    laneThinkTimer: 0,
    laneHopFlash: 0,
    coinChaseX: null,
    coinChaseLane: null,
    falls: 0,
    scooterHits: 0,
    stepTimer: 0,
    stepFlip: false,
    scooterBumpToastShown: false,
    carHintShown: false,
    carHornCooldown: 0,
    carWarnCooldown: 0,
    bumpTimer: 0,
    bumpDirection: 0,
    landSquash: 0,
    scooterHintShown: false,
    lowBirdHintShown: false,
    scooterBellCooldown: 0,
    weatherParticles: [],
    keys: { left: false, right: false, jump: false, run: false, down: false },
    jumpBuffer: 0,
    jumpPower: JUMP,
    coyote: 0,
    onGround: false,
    standing: -1,
    dustTimer: 0,
    carSmokeTimer: 0,
    smokeTimer: 0,
    shake: 0,
    flash: 0,
    completed: false,
    endless: false,
    endlessStage: 0,
    endlessTime: 0,
    endlessNuts: 0,
    endlessAdvanceTimer: null,
    autoRetries: 0,
    autoRetryX: null,
    jumpLog: [],
    hintTimer: null,
    toastTimer: null,
    focusReturn: null,
    buildingCache: {},
    gradients: {}
  };

  var running = false;
  var rafId = null;
  var lastTimestamp = 0;
  var accumulator = 0;
  var mapReturnMode = "playing";

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function approach(value, target, amount) {
    if (value < target) {
      return Math.min(target, value + amount);
    }
    return Math.max(target, value - amount);
  }

  function easeOutCubic(t) {
    var p = clamp(t, 0, 1) - 1;
    return 1 + p * p * p;
  }

  function hash01(value) {
    var n = value | 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  function hexToRgb(hex) {
    var value = parseInt(String(hex).replace("#", ""), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function mixRgb(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }

  function rgb(color) {
    return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
  }

  function rgba(color, alpha) {
    return "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + alpha + ")";
  }

  // Gradients are immutable per level. Building them once per stage instead
  // of once per frame keeps the render loop light.
  function cachedGradient(key, build) {
    if (!state.gradients[key]) {
      state.gradients[key] = build();
    }
    return state.gradients[key];
  }

  function formatClock(seconds) {
    var value = Number(seconds);
    if (!isFinite(value) || value < 0) {
      value = 0;
    }
    var totalTenths = Math.max(0, Math.round(value * 10));
    var minutes = Math.floor(totalTenths / 600);
    var rest = totalTenths % 600;
    return minutes + ":" + String(Math.floor(rest / 10)).padStart(2, "0") + "." + (rest % 10);
  }

  // In endless mode the HUD shows the running total, not just the current stage.
  function displayTime() {
    return state.endless ? state.endlessTime + state.elapsed : state.elapsed;
  }

  function sfx(name) {
    if (window.RunnerAudio && window.RunnerAudio.sfx && window.RunnerAudio.sfx[name]) {
      window.RunnerAudio.sfx[name]();
    }
  }

  function googleDirections(level) {
    if (!level || !level.origin || !level.destination) {
      return "https://www.google.com/maps/place/Augsburg";
    }
    return (
      "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" +
      encodeURIComponent(level.origin[0] + "," + level.origin[1]) +
      "&destination=" +
      encodeURIComponent(level.destination[0] + "," + level.destination[1])
    );
  }

  function prepareRoute(level) {
    if (level._routeCache) {
      return level._routeCache;
    }
    var points = level.routePct || [];
    var total = 0;
    var segments = [];
    for (var i = 0; i < points.length - 1; i += 1) {
      var dx = points[i + 1][0] - points[i][0];
      var dy = points[i + 1][1] - points[i][1];
      var length = Math.sqrt(dx * dx + dy * dy);
      segments.push({ start: points[i], end: points[i + 1], length: length });
      total += length;
    }
    level._routeCache = { points: points, segments: segments, total: total };
    return level._routeCache;
  }

  function routePointAt(level, progress) {
    var route = prepareRoute(level);
    if (!route.points.length) {
      var fallbackStart = level.startPct || [10, 50];
      var fallbackEnd = level.finishPct || [90, 50];
      return [
        lerp(fallbackStart[0], fallbackEnd[0], progress),
        lerp(fallbackStart[1], fallbackEnd[1], progress)
      ];
    }
    if (!route.segments.length) {
      return route.points[0];
    }
    var target = clamp(progress, 0, 1) * route.total;
    var travelled = 0;
    for (var i = 0; i < route.segments.length; i += 1) {
      var segment = route.segments[i];
      if (travelled + segment.length >= target) {
        var t = segment.length ? (target - travelled) / segment.length : 0;
        return [
          lerp(segment.start[0], segment.end[0], t),
          lerp(segment.start[1], segment.end[1], t)
        ];
      }
      travelled += segment.length;
    }
    return route.points[route.points.length - 1];
  }

  function progressNow() {
    if (!state.level || !state.player) {
      return 0;
    }
    return clamp(
      (state.player.x - state.level.startX) / (state.level.finishX - state.level.startX),
      0,
      1
    );
  }

  function metersLeft() {
    if (!state.level) {
      return 0;
    }
    return Math.max(0, Math.round(state.level.distance * (1 - progressNow())));
  }

  function platformUnder(worldX) {
    if (!state.level) {
      return null;
    }
    for (var i = 0; i < state.level.platforms.length; i += 1) {
      var platform = state.level.platforms[i];
      if (worldX >= platform.x && worldX <= platform.x + platform.w) {
        return platform;
      }
    }
    return null;
  }

  function npcSpotClear(level, x, radius, result, platformIndex, platform) {
    var i;
    if (Math.abs(level.startX - x) < 96) {
      return false;
    }
    for (i = 0; i < level.checkpoints.length; i += 1) {
      if (Math.abs(level.checkpoints[i].x - x) < radius + 22) {
        return false;
      }
    }
    for (i = 0; i < level.props.length; i += 1) {
      if (Math.abs(level.props[i].x - x) < radius + 14) {
        return false;
      }
    }
    for (i = 0; i < result.length; i += 1) {
      if (result[i].platformIndex === platformIndex && Math.abs(result[i].x - x) < radius + 34) {
        return false;
      }
    }
    return true;
  }

  function trafficTypeFor(level, seed) {
    var district = districtFor(level);
    var types = district.cars && district.cars.length ? district.cars : ["sedan"];
    return types[Math.floor(hash01(seed + 101) * types.length) % types.length];
  }

  // Verkehr auf der Fahrbahn: Die Autos fahren einmal durch, wenden nicht
  // und sind reine Kulisse. Hindernisse auf dem Gehweg sind Fußgänger,
  // Fahrräder, E-Scooter und Tauben.
  // Auf der Straßenbahn-Linie fahren ausschließlich Bahnen, auf der
  // Autospur ausschließlich Autos – nie gemischt.
  function buildTraffic(level) {
    var result = [];
    var district = districtFor(level);
    var cars = (district.cars || []).filter(function (type) {
      return type !== "tram";
    });
    if (!cars.length) {
      cars = ["sedan"];
    }
    // Keine Straßenbahnen mehr: Die schlichte Straße hat nur noch ein paar
    // Autos als ruhige Kulisse.
    var carCount = 2 + Math.min(level.num, 3);

    for (var i = 0; i < carCount; i += 1) {
      var seed = level.num * 4703 + i * 311;
      var carType = cars[Math.floor(hash01(seed + 101) * cars.length) % cars.length];
      var spec = CAR_TYPES[carType] || CAR_TYPES.sedan;
      var span = W * 2.3;
      var x = -240 + (i + 0.5) * span / carCount + (hash01(seed + 5) - 0.5) * 42;
      result.push({
        carType: carType,
        x: x,
        lane: LANE_CARS,
        y: laneTrafficGround(LANE_CARS),
        w: spec.w,
        h: spec.h,
        dir: LANE_DIRS[LANE_CARS],
        speed: 62 + hash01(seed + 19) * 44 + Math.min(level.num, 8) * 2.4,
        body: spec.bodies[Math.floor(hash01(seed + 23) * spec.bodies.length) % spec.bodies.length],
        seed: seed,
        animTime: hash01(seed + 29) * 4,
        stunned: 0,
        turnTimer: 0
      });
    }
    return result;
  }

  function hazardProfile(level) {
    var profiles = [
      { ped: 2, bike: 2, scooter: 1, birds: 0, lowBirds: 2, speed: 0.82 },
      { ped: 3, bike: 2, scooter: 2, birds: 2, lowBirds: 2, speed: 0.94 },
      { ped: 3, bike: 2, scooter: 2, birds: 3, lowBirds: 3, speed: 1.02 },
      { ped: 5, bike: 4, scooter: 4, birds: 5, lowBirds: 4, speed: 1.14 },
      { ped: 6, bike: 4, scooter: 5, birds: 6, lowBirds: 4, speed: 1.2 },
      { ped: 7, bike: 5, scooter: 6, birds: 8, lowBirds: 5, speed: 1.26 },
      { ped: 8, bike: 6, scooter: 7, birds: 10, lowBirds: 5, speed: 1.32 },
      { ped: 9, bike: 7, scooter: 8, birds: 12, lowBirds: 6, speed: 1.4 }
    ];
    return profiles[Math.min(level.num, profiles.length) - 1] || profiles[0];
  }

  function buildNpcs(level) {
    var result = [];
    var profile = hazardProfile(level);
    var base = STREET_Y;
    var startX = 360;
    var endX = Math.max(startX + 400, level.finishX - 130);
    var total = profile.ped + profile.bike + profile.scooter;
    var slot = 0;

    function place(type, index) {
      slot += 1;
      var seed = level.num * 8111 + slot * 997 + index * 53;
      var t = total <= 1 ? 0.5 : (slot - 0.5) / total;
      var x = lerp(startX, endX, t) + (hash01(seed + 1) - 0.5) * 150;
      x = clamp(x, startX - 80, endX + 80);
      var dir = hash01(seed + 2) > 0.5 ? 1 : -1;
      var patrol = type === "pedestrian" && hash01(seed + 3) < 0.16;
      var speed = 1;
      if (type === "pedestrian") {
        speed = (13 + hash01(seed + 4) * 12) * profile.speed;
      } else if (type === "cyclist") {
        speed = (46 + hash01(seed + 5) * 28) * profile.speed;
      } else {
        speed = (52 + hash01(seed + 6) * 34) * profile.speed;
      }
      return {
        type: type,
        platformIndex: 0,
        lane: LANE_SIDEWALK,
        x: x,
        y: base,
        w: type === "cyclist" ? 26 : (type === "scooter" ? 17 : 10),
        h: type === "cyclist" ? 36 : (type === "scooter" ? 31 : 30),
        minX: patrol ? x - 78 : -70,
        maxX: patrol ? x + 78 : level.lengthPx + 70,
        patrol: patrol,
        dir: dir,
        speed: speed,
        animTime: hash01(seed + 7) * 5,
        turnTimer: 0,
        stunned: 0,
        seed: seed,
        coat: NPC_COATS[Math.floor(hash01(seed + 8) * NPC_COATS.length)],
        skin: NPC_SKINS[Math.floor(hash01(seed + 9) * NPC_SKINS.length)],
        hair: NPC_HAIRS[Math.floor(hash01(seed + 10) * NPC_HAIRS.length)],
        hat: NPC_HATS[Math.floor(hash01(seed + 11) * NPC_HATS.length)],
        jacket: NPC_JACKETS[Math.floor(hash01(seed + 12) * NPC_JACKETS.length)],
        cap: NPC_CAPS[Math.floor(hash01(seed + 13) * NPC_CAPS.length)],
        bag: hash01(seed + 14) > 0.58,
        bagType: NPC_BAGS[Math.floor(hash01(seed + 16) * NPC_BAGS.length)],
        scarf: hash01(seed + 15) > 0.48,
        scooterColor: SCOOTER_COLORS[Math.floor(hash01(seed + 17) * SCOOTER_COLORS.length)],
        bikeColor: ["#b63b2f", "#3f7fc1", "#6f9d54", "#d8b24c", "#7a5a8f"][Math.floor(hash01(seed + 18) * 5)],
        helmet: (type === "scooter" || type === "cyclist") && hash01(seed + 19) > 0.35,
        helmetColor: HELMET_COLORS[Math.floor(hash01(seed + 20) * HELMET_COLORS.length)],
        phone: type === "scooter" && hash01(seed + 21) > 0.64,
        bellPlayed: false,
        pattern: Math.floor(hash01(seed + 22) * 3)
      };
    }

    for (var p = 0; p < profile.ped; p += 1) {
      result.push(place("pedestrian", p));
    }
    for (var b = 0; b < profile.bike; b += 1) {
      result.push(place("cyclist", b));
    }
    for (var s = 0; s < profile.scooter; s += 1) {
      result.push(place("scooter", s));
    }
    return result;
  }

  function buildBirds(level) {
    var result = [];
    var profile = hazardProfile(level);
    var count = profile.birds;
    for (var i = 0; i < count; i += 1) {
      var seed = level.num * 791 + i * 97;
      var x = 420 + (i + 0.5) * (level.lengthPx - 700) / Math.max(1, count);
      var baseY = STREET_Y - (32 + hash01(seed + 1) * 22);
      result.push({
        lane: LANE_SIDEWALK,
        x: x,
        baseY: baseY,
        y: baseY,
        minX: -50,
        maxX: level.lengthPx + 50,
        dir: hash01(seed + 3) > 0.5 ? 1 : -1,
        speed: 34 + level.num * 10 + hash01(seed + 4) * 26,
        phase: hash01(seed + 5) * 6.28,
        bob: 4 + hash01(seed + 6) * 5,
        animTime: hash01(seed + 7) * 4,
        pattern: Math.floor(hash01(seed + 8) * 3),
        flock: Math.floor(hash01(seed + 9) * 2) === 0,
        active: true,
        respawn: 0
      });
    }

    // Tief fliegende Tauben auf Kopfhöhe: stehen = Treffer, ducken = vorbei.
    var lowCount = profile.lowBirds || 0;
    for (var low = 0; low < lowCount; low += 1) {
      var lowSeed = level.num * 5039 + low * 733;
      var lowX = 380 + (low + 0.5) * (level.lengthPx - 760) / Math.max(1, lowCount);
      result.push({
        lane: LANE_SIDEWALK,
        x: lowX,
        baseY: STREET_Y - 26,
        y: STREET_Y - 26,
        minX: -50,
        maxX: level.lengthPx + 50,
        dir: hash01(lowSeed + 3) > 0.5 ? 1 : -1,
        speed: 30 + level.num * 7 + hash01(lowSeed + 4) * 18,
        phase: hash01(lowSeed + 5) * 6.28,
        bob: 1,
        animTime: hash01(lowSeed + 7) * 4,
        pattern: 0,
        low: true,
        active: true,
        respawn: 0
      });
    }
    return result;
  }

  function updateNpcs(dt) {
    state.scooterBellCooldown = Math.max(0, state.scooterBellCooldown - dt);
    for (var i = 0; i < state.npcs.length; i += 1) {
      var npc = state.npcs[i];
      npc.animTime += dt;
      if (npc.stunned > 0) {
        npc.stunned = Math.max(0, npc.stunned - dt);
        continue;
      }
      if (npc.turnTimer > 0) {
        npc.turnTimer = Math.max(0, npc.turnTimer - dt);
        continue;
      }
      npc.x += npc.dir * npc.speed * dt;

      if (npc.patrol) {
        if (npc.x <= npc.minX) {
          npc.x = npc.minX;
          npc.dir = 1;
          npc.turnTimer = 0.5;
        } else if (npc.x >= npc.maxX) {
          npc.x = npc.maxX;
          npc.dir = -1;
          npc.turnTimer = 0.5;
        }
      } else if (npc.x > npc.maxX) {
        npc.x = npc.minX;
      } else if (npc.x < npc.minX) {
        npc.x = npc.maxX;
      }

      if (npc.type === "scooter" && state.mode === "playing" && state.player &&
          !state.scooterHintShown && Math.abs(state.player.x - npc.x) < 160) {
        state.scooterHintShown = true;
        showToast("ACHTUNG!", "Fahrräder, E-Scooter, Fußgänger und Tauben sind unterwegs.", 1800);
      }
      if ((npc.type === "scooter" || npc.type === "cyclist") && state.mode === "playing" && state.player &&
          !npc.bellPlayed && state.scooterBellCooldown <= 0 &&
          Math.abs(state.player.x - npc.x) < 100) {
        npc.bellPlayed = true;
        state.scooterBellCooldown = 3.2;
        sfx(npc.type === "cyclist" ? "bikeBell" : "scooter");
      }
    }
  }

  function updateBirds(dt) {
    for (var i = 0; i < state.birds.length; i += 1) {
      var bird = state.birds[i];
      bird.animTime += dt;
      if (!bird.active) {
        bird.respawn = Math.max(0, bird.respawn - dt);
        if (bird.respawn <= 0) {
          bird.active = true;
          bird.x = bird.dir > 0 ? bird.minX : bird.maxX;
          bird.phase = Math.random() * 6.28;
        }
        continue;
      }
      bird.phase += dt * (2.4 + Math.min(state.level.num, 6) * 0.25) * (bird.pattern === 1 ? 1.25 : 1);
      bird.x += bird.dir * bird.speed * (bird.pattern === 2 ? 0.65 : 1) * dt;
      if (bird.pattern === 2) {
        bird.x += Math.cos(bird.phase * 0.8) * 9 * dt;
      }
      bird.y = bird.baseY + Math.sin(bird.phase) * bird.bob * (bird.pattern === 1 ? 2.4 : 1);
      if (bird.x <= bird.minX) {
        bird.x = bird.maxX;
      } else if (bird.x >= bird.maxX) {
        bird.x = bird.minX;
      }
      if (bird.low && state.mode === "playing" && state.player &&
          !state.lowBirdHintShown && Math.abs(state.player.x - bird.x) < 140) {
        state.lowBirdHintShown = true;
        showToast("TIEFE TAUBEN!", "Duck dich mit S / ↓, sonst erwischt dich der Schwarm.", 2200);
      }
    }
  }

  function checkBirdHits() {
    var player = state.player;
    if (!player || state.hitCooldown > 0 || state.mode !== "playing") {
      return;
    }
    for (var i = 0; i < state.birds.length; i += 1) {
      var bird = state.birds[i];
      if (!bird.active || (bird.lane || 0) !== player.lane) {
        continue;
      }
      var horizontalOverlap = Math.abs(player.x - bird.x) < player.w * 0.5 + 8;
      var verticalOverlap = bird.y + 6 > player.y && bird.y - 6 < player.y + player.h;
      if (!horizontalOverlap || !verticalOverlap) {
        continue;
      }

      var direction = player.x < bird.x ? -1 : 1;
      bird.active = false;
      bird.respawn = 2.4;
      state.hits += 1;
      if (!state.autoRun) {
        beginDeath(bird.low ? "Tiefe Taube" : "Taube", direction);
        return;
      }
      state.bumpTimer = 0.34;
      state.bumpDirection = direction;
      state.hitCooldown = 0.95;
      if (!state.autoRun) {
        player.vx = direction * 2.8;
        player.vy = Math.min(player.vy, -2.4);
        player.onGround = false;
        state.onGround = false;
        state.standing = -1;
      }
      state.shake = Math.max(state.shake, 2.3);
      state.flash = Math.max(state.flash, 0.18);
      spawnBurst(bird.x, bird.y, ["#e8e2cf", "#9ba7aa", "#f2c14e"], 8, 2.4);
      sfx("bird");
      // A startled pigeon takes the nearest flock with it.
      for (var flockIndex = 0; flockIndex < state.birds.length; flockIndex += 1) {
        var flockBird = state.birds[flockIndex];
        if (flockBird === bird || !flockBird.active) {
          continue;
        }
        if (Math.abs(flockBird.x - bird.x) < 68 && Math.abs(flockBird.baseY - bird.baseY) < 42) {
          flockBird.active = false;
          flockBird.respawn = 1.4 + Math.random() * 1.2;
        }
      }
      return;
    }
  }

  function checkNpcHits() {
    var player = state.player;
    if (!player || state.hitCooldown > 0 || state.mode !== "playing") {
      return;
    }
    for (var i = 0; i < state.npcs.length; i += 1) {
      var npc = state.npcs[i];
      if ((npc.lane || 0) !== player.lane) {
        continue;
      }
      var npcTop = npc.y - npc.h;
      var playerBottom = player.y + player.h;
      var verticalOverlap = playerBottom > npcTop + 4 && player.y < npc.y - 3;
      var horizontalOverlap = Math.abs(player.x - npc.x) < player.w * 0.5 + npc.w * 0.5 + 2;
      if (!verticalOverlap || !horizontalOverlap) {
        continue;
      }

      // A jump onto the head (or the roof of a car) is a clean hop, not a
      // crash. Auto-run keeps its line instead, because the bounce can
      // overshoot the next street block.
      if (player.vy > 1.6 && playerBottom - player.vy < npcTop + 10) {
        if (state.autoRun) {
          return;
        }
        player.y = npcTop - player.h - 1;
        player.vy = npc.type === "car" ? -6.6 : -5.5;
        player.onGround = false;
        state.onGround = false;
        state.standing = -1;
        state.hitCooldown = 0.42;
        state.shake = Math.max(state.shake, npc.type === "car" ? 1.8 : 1.1);
        npc.stunned = Math.max(npc.stunned, npc.type === "car" ? 0.85 : 0.55);
        spawnDustPuff(npc.x, npcTop, npc.type === "car" ? 6 : 4);
        sfx(npc.type === "car" ? "carHorn" : "jump");
        return;
      }

      var direction = player.x < npc.x ? -1 : 1;
      var isScooter = npc.type === "scooter";
      var isBike = npc.type === "cyclist";
      state.hits += 1;
      if (!state.autoRun) {
        beginDeath(npc.type === "scooter" ? "E-Scooter" : (isBike ? "Fahrrad" : "Fußgänger"), direction);
        return;
      }
      state.bumpTimer = (isScooter || isBike) ? (state.autoRun ? 0.24 : 0.56) : 0.24;
      state.bumpDirection = direction;
      state.hitCooldown = (isScooter || isBike) ? (state.autoRun ? 1.05 : 1.25) : 0.78;
      npc.stunned = (isScooter || isBike) ? 1.1 : 0.5;
      if (isScooter || isBike) {
        if (isScooter) {
          state.scooterHits += 1;
        }
        player.onGround = false;
        state.onGround = false;
        state.standing = -1;
        state.coyote = 0;
        if (state.autoRun) {
          player.vx = RUN;
          player.vy = -3.8;
          player.facing = 1;
        } else {
          player.vx = direction * (isBike ? 3.9 : 4.4);
          player.vy = isBike ? -4.2 : -4.7;
          player.facing = direction;
        }
        state.shake = Math.max(state.shake, isBike ? 3.5 : 4.2);
        state.flash = Math.max(state.flash, 0.26);
        spawnDustPuff(npc.x, npc.y, 8);
        spawnBurst(npc.x, npc.y - 17,
          isBike ? ["#f2c14e", "#3f7fc1", "#e8e2d0", "#b63b2f"] : ["#f2c14e", "#e07a5f", "#fff1ba", "#62b8a4"],
          11, 3.0);
        sfx(isBike ? "bikeCrash" : "scooterCrash");
        if (!state.scooterBumpToastShown) {
          state.scooterBumpToastShown = true;
          showToast(isBike ? "RADFAHRER!" : "SCHEPPER!",
            isBike ? "Ein Fahrrad hat dich erwischt. Lauf weiter!" : "Der E-Scooter hat dich erwischt. Lauf weiter!",
            1600);
        }
      } else {
        if (!state.autoRun) {
          player.vx = direction * 1.9;
        }
        state.shake = Math.max(state.shake, 1.2);
        sfx("scrape");
        spawnDustPuff(npc.x, npc.y, 4);
      }
      return;
    }
  }

  function districtFor(level) {
    return DISTRICTS[level && level.id] || DISTRICTS.hbf;
  }

  function districtForCurrent() {
    return districtFor(state.level);
  }

  function buildColors(level) {
    var district = districtFor(level);
    var skyTop = hexToRgb(level.sky[0]);
    var skyBottom = hexToRgb(level.sky[1]);
    var navy = [26, 47, 66];
    var slate = [69, 100, 122];
    var warm = [255, 244, 203];
    return {
      skyTop: skyTop,
      skyBottom: skyBottom,
      alpsFar: mixRgb(skyBottom, slate, 0.48),
      alpsNear: mixRgb(skyBottom, [58, 89, 112], 0.62),
      farCity: mixRgb(skyBottom, navy, 0.55),
      nearCity: mixRgb(skyBottom, [14, 35, 52], 0.72),
      landmark: mixRgb(skyBottom, [18, 41, 58], 0.82),
      landmarkLight: mixRgb(skyBottom, [53, 83, 103], 0.62),
      street: hexToRgb(district.street),
      streetDark: hexToRgb(district.streetDark),
      sidewalk: hexToRgb(district.sidewalk),
      curb: hexToRgb(district.curb),
      streetLine: hexToRgb(district.line),
      accent: hexToRgb(district.accent),
      streetLight: mixRgb(hexToRgb(district.street), [150, 170, 180], 0.45),
      sun: warm,
      cloud: [255, 249, 229]
    };
  }

  // Tag & Nacht: dayTime läuft von 0 (Mitternacht) über 0.25 (Sonnenaufgang)
  // und 0.5 (Mittag) bis 0.75 (Sonnenuntergang) wieder auf 0 zu.
  function computeDayNight() {
    var time = state.dayTime || 0;
    var elevation = Math.sin((time - 0.25) * Math.PI * 2);
    var night = clamp(0.5 - elevation * 0.9, 0, 1);
    var sunset = clamp(1 - Math.abs(elevation) * 2.6, 0, 1);
    state.sunElevation = elevation;
    state.nightFactor = night;
    state.sunsetFactor = sunset;

    var colors = state.colors || {};
    var dayTop = colors.skyTop || [143, 198, 231];
    var dayBottom = colors.skyBottom || [203, 230, 239];
    var nightTop = [7, 11, 26];
    var nightBottom = [18, 28, 50];
    var duskTop = [86, 58, 120];
    var duskBottom = [244, 118, 62];
    var top = mixRgb(dayTop, nightTop, night);
    var bottom = mixRgb(dayBottom, nightBottom, night);
    top = mixRgb(top, duskTop, sunset * 0.55);
    bottom = mixRgb(bottom, duskBottom, sunset * 0.75);
    state.skyNow = { top: top, bottom: bottom };
  }

  function updateDayNight(dt) {
    state.dayTime = (state.dayTime + dt / DAY_CYCLE_SECONDS) % 1;
    computeDayNight();
  }

  function skyBucket() {
    return "sky" + (Math.floor(((state.dayTime || 0) % 1) * 72) % 72);
  }

  function focusModal(modal, selector, keepReturn) {
    if (!modal) {
      return;
    }
    if (!keepReturn) {
      state.focusReturn = document.activeElement;
    }
    var target = selector ? modal.querySelector(selector) : null;
    if (!target) {
      target = modal.querySelector('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    }
    if (target) {
      window.setTimeout(function () {
        target.focus();
      }, 0);
    }
  }

  function releaseModalFocus() {
    if (state.focusReturn && typeof state.focusReturn.focus === "function") {
      try {
        state.focusReturn.focus();
      } catch (error) {
        /* Der Fokus kehrt dann an den Dokumentanfang zurück. */
      }
    }
    state.focusReturn = null;
  }

  function trapModalFocus(event) {
    if (event.key !== "Tab") {
      return;
    }
    var modal = document.querySelector(".modal:not(.hidden)");
    if (!modal) {
      return;
    }
    var focusable = modal.querySelectorAll(
      'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) {
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showToast(title, subtitle, duration) {
    window.clearTimeout(state.toastTimer);
    els.toast.classList.remove("hidden");
    els.toast.innerHTML = "";
    var head = document.createElement("strong");
    head.textContent = title;
    els.toast.appendChild(head);
    if (subtitle) {
      var sub = document.createElement("span");
      sub.className = "toast-sub";
      sub.textContent = subtitle;
      els.toast.appendChild(sub);
    }
    els.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, duration || 2300);
  }

  function setLevelDom() {
    var level = state.level;
    els.hudLevelNum.textContent = "ETAPPE " + pad(level.num);
    els.hudLevelName.textContent = level.name;
    els.hudSubtitle.textContent = level.subtitle;
    els.hudMeters.textContent = level.distance;
    els.hudNuts.textContent = "000";
    els.hudNutsTotal.textContent = "/" + level.nuts.length;
    if (els.hudHeart) {
      els.hudHeart.textContent = "♥";
      els.hudHeart.classList.remove("is-empty");
    }
    els.hudTime.textContent = "0:00.0";
    els.minimapPlace.textContent = SHORT_NAMES[level.id] || level.name;
    els.minimapImg.src = level.map;
    els.bigMapImg.src = level.map;
    els.mapModalLevel.textContent = pad(level.num) + " · " + level.name;
    els.mapGoogle.href = googleDirections(level);
    els.pauseCopy.textContent =
      level.name + " · " + level.distance + " Meter bis zum Ziel";
    els.routeFill.style.width = "0%";
    els.routeBoy.style.left = "0%";
    els.minimapDot.style.left = (level.startPct ? level.startPct[0] : 12) + "%";
    els.minimapDot.style.top = (level.startPct ? level.startPct[1] : 50) + "%";
    document.title = level.name + " — Auf nach Augsburg";
  }

  function updateHud(force) {
    if (!state.level || !state.player) {
      return;
    }
    var progress = progressNow();
    var meters = metersLeft();
    var percent = Math.round(progress * 1000) / 10;
    if (force || els.hudMeters.textContent !== String(meters)) {
      els.hudMeters.textContent = String(meters);
    }
    var clock = formatClock(displayTime());
    if (force || els.hudTime.textContent !== clock) {
      els.hudTime.textContent = clock;
    }
    var nutText = String(state.collected.size).padStart(3, "0");
    if (force || els.hudNuts.textContent !== nutText) {
      els.hudNuts.textContent = nutText;
    }
    if (els.hudHeart) {
      els.hudHeart.textContent = state.heartFull ? "♥" : "♡";
      els.hudHeart.classList.toggle("is-empty", !state.heartFull);
      els.hudHeart.setAttribute("aria-label", state.heartFull ? "1 Leben" : "kein Leben");
    }
    els.routeFill.style.width = percent + "%";
    els.routeBoy.style.left = percent + "%";
    if (els.hudMode) {
      els.hudMode.classList.toggle("is-on", state.autoRun || state.endless);
      els.hudMode.textContent = state.endless
        ? (state.autoRun ? "ENDLOS · DAUERLAUF" : "ENDLOS")
        : "DAUERLAUF";
    }
    var mapPoint = routePointAt(state.level, progress);
    els.minimapDot.style.left = mapPoint[0] + "%";
    els.minimapDot.style.top = mapPoint[1] + "%";
    if (window.RunnerAudio && window.RunnerAudio.setIntensity) {
      window.RunnerAudio.setIntensity(0.3 + progress * 0.5);
    }
  }

  function updateIntro(dt) {
    var level = state.level;
    var car = state.car;
    var player = state.player;
    state.introTime += dt;
    var t = state.introTime;

    if (t < 1.25) {
      car.visible = true;
      car.moving = true;
      car.x = lerp(-92, 44, easeOutCubic(t / 1.25));
      car.direction = 1;
      if (!state.carSoundPlayed && t > 0.12) {
        state.carSoundPlayed = true;
        sfx("car");
      }
      state.carSmokeTimer -= dt;
      if (state.carSmokeTimer <= 0) {
        state.carSmokeTimer = 0.08;
        spawnCarSmoke(car.x + 8, car.y + 24);
      }
    } else {
      car.x = 44;
      car.moving = false;
      if (t > 1.4) {
        state.playerVisible = true;
        var runT = clamp((t - 1.4) / 0.62, 0, 1);
        player.x = lerp(128, level.startX, easeOutCubic(runT));
        player.facing = 1;
        player.animTime += dt;
        state.introPlayerAction = runT < 1 ? "run" : "wave";
        player.lane = LANE_SIDEWALK;
        player.y = laneFeet(LANE_SIDEWALK) - player.h;
      }
      if (t > 2.0) {
        car.visible = true;
        car.moving = true;
        car.x = 44 - (t - 2.0) * 155;
        car.direction = -1;
        if (car.x < -110) {
          car.visible = false;
        }
        state.carSmokeTimer -= dt;
        if (state.carSmokeTimer <= 0) {
          state.carSmokeTimer = 0.08;
          spawnCarSmoke(car.x + 66, car.y + 24);
        }
      }
      if (t > 2.78) {
        beginPlaying();
      }
    }
  }

  function beginPlaying() {
    if (state.mode !== "intro") {
      return;
    }
    state.mode = "playing";
    state.heartFull = true;
    state.deathTime = 0;
    state.deathSpin = 0;
    state.playerVisible = true;
    state.playerInCar = false;
    state.car.visible = false;
    state.player.x = state.level.startX;
    state.player.lane = LANE_SIDEWALK;
    state.player.y = laneFeet(LANE_SIDEWALK) - state.player.h;
    state.laneDrawOffset = 0;
    state.laneSwitchCooldown = 0;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.h = STAND_H;
    state.player.crouching = false;
    state.player.onGround = true;
    state.player.standing = state.level.platforms.indexOf(state.startPlatform);
    state.lastSafe = { x: state.level.startX, y: state.startPlatform.roofY };
    state.coyote = 7;
    accumulator = 0;
    els.cinematic.classList.add("hidden");
    els.hud.classList.remove("hidden");
    els.minimapPanel.classList.remove("hidden");
    els.clickHint.classList.remove("hidden");
    window.clearTimeout(state.hintTimer);
    state.hintTimer = window.setTimeout(function () {
      if (state.mode === "playing") {
        els.clickHint.classList.add("hidden");
      }
    }, 9000);
    showToast("LOS, LEO!", "Klick für Dauerlauf oder nutze WASD.");
    sfx("horn");
    updateHud(true);
  }

  function beginOutro() {
    if (state.mode !== "playing") {
      return;
    }
    state.mode = "outro";
    state.outroTime = 0;
    state.completed = false;
    state.autoRun = false;
    state.autoTarget = null;
    state.bumpTimer = 0;
    state.hitCooldown = 0;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.h = STAND_H;
    state.player.crouching = false;
    state.player.x = Math.max(state.player.x, state.level.finishX + 8);
    state.player.lane = LANE_SIDEWALK;
    state.player.y = laneFeet(LANE_SIDEWALK) - state.player.h;
    state.laneDrawOffset = 0;
    state.player.onGround = true;
    state.player.facing = 1;
    state.car = {
      x: state.level.finishX + 240,
      y: state.finishPlatform.roofY - 31,
      visible: true,
      moving: true,
      direction: -1
    };
    state.carSoundPlayed = false;
    state.carHornPlayed = false;
    els.clickHint.classList.add("hidden");
    els.hudMeters.textContent = "0";
    els.routeFill.style.width = "100%";
    els.routeBoy.style.left = "100%";
    sfx("win");
    spawnConfetti(state.camera + W * 0.55, 80, 48);
    showToast("ZIEL!", "Der Kadett holt dich ab.", 3000);
  }

  function updateOutro(dt) {
    var level = state.level;
    var car = state.car;
    var player = state.player;
    state.outroTime += dt;
    var t = state.outroTime;

    if (t < 0.9) {
      car.visible = true;
      car.moving = true;
      car.direction = -1;
      car.x = lerp(level.finishX + 240, level.finishX + 54, easeOutCubic(t / 0.9));
      state.carSmokeTimer -= dt;
      if (state.carSmokeTimer <= 0) {
        state.carSmokeTimer = 0.07;
        spawnCarSmoke(car.x + 66, car.y + 24);
      }
    } else {
      car.x = level.finishX + 54;
      car.moving = false;
      car.direction = 1;
      if (!state.carHornPlayed) {
        state.carHornPlayed = true;
        sfx("horn");
        spawnDustPuff(car.x - 12, car.y + 29, 6);
      }
      if (t > 1.2 && t < 2.15) {
        state.playerVisible = true;
        state.introPlayerAction = "run";
        var walkT = clamp((t - 1.2) / 0.75, 0, 1);
        player.x = lerp(level.finishX + 8, car.x + 12, easeOutCubic(walkT));
        player.facing = 1;
        player.animTime += dt;
        player.lane = LANE_SIDEWALK;
        player.y = laneFeet(LANE_SIDEWALK) - player.h;
      }
      if (t >= 2.15) {
        state.playerInCar = true;
        state.playerVisible = false;
      }
      if (t > 2.25 && t < 3.9) {
        car.moving = true;
        car.direction = 1;
        car.x += 150 * dt;
        state.carSmokeTimer -= dt;
        if (state.carSmokeTimer <= 0) {
          state.carSmokeTimer = 0.06;
          spawnCarSmoke(car.x + 6, car.y + 24);
        }
      }
      if (t >= 4.0) {
        finishOutro();
      }
    }
  }

  function finishOutro() {
    if (state.completed) {
      return;
    }
    state.completed = true;
    state.mode = "complete";
    state.car.visible = false;
    els.hud.classList.add("hidden");
    els.minimapPanel.classList.add("hidden");
    els.clickHint.classList.add("hidden");
    els.pauseModal.classList.add("hidden");
    els.mapModal.classList.add("hidden");

    var targetTime = Number(state.level.targetTime) ||
      Math.max(18, Math.round(state.level.lengthPx / 150));
    var starFlags = {
      time: state.elapsed <= targetTime,
      nuts: state.collected.size === state.level.nuts.length && state.level.nuts.length > 0,
      clean: state.hits === 0 && state.falls === 0
    };
    var result = {
      time: Math.round(state.elapsed * 10) / 10,
      nuts: state.collected.size,
      totalNuts: state.level.nuts.length,
      distance: state.level.distance,
      hits: state.hits,
      falls: state.falls,
      targetTime: targetTime,
      starFlags: starFlags,
      stars: (starFlags.time ? 1 : 0) + (starFlags.nuts ? 1 : 0) + (starFlags.clean ? 1 : 0)
    };
    var meta = window.RunnerStore.complete(state.level, result);

    if (state.endless) {
      state.endlessStage += 1;
      state.endlessTime += result.time;
      state.endlessNuts += result.nuts;
      var endlessRecord = window.RunnerStore.recordEndless(state.endlessStage, state.endlessTime, state.endlessNuts);
      var activePos = ACTIVE_LEVELS.indexOf(state.level);
      var endlessNextLevel = ACTIVE_LEVELS[(activePos + 1) % ACTIVE_LEVELS.length] || LEVELS[0];
      var endlessNext = LEVELS.indexOf(endlessNextLevel);
      showToast(
        "ENDLOS · ETAPPE " + state.endlessStage + " GESCHAFFT",
        LEVELS[endlessNext].name + " · " + formatClock(state.endlessTime) + " · " +
          state.endlessNuts + " Münzen · Rekord " + endlessRecord.bestStage + " Etappen",
        1700
      );
      document.dispatchEvent(
        new CustomEvent("augsburg:complete", { detail: { result: result, meta: meta, endless: true } })
      );
      window.clearTimeout(state.endlessAdvanceTimer);
      state.endlessAdvanceTimer = window.setTimeout(function () {
        if (state.endless) {
          startLevel(endlessNext);
        }
      }, 1500);
      return;
    }

    var activePos = ACTIVE_LEVELS.indexOf(state.level);
    var nextLevel = activePos >= 0 ? ACTIVE_LEVELS[activePos + 1] : null;
    var nextIndex = nextLevel ? LEVELS.indexOf(nextLevel) : -1;
    var best = window.RunnerStore.best(state.level);

    els.winKicker.textContent =
      "ETAPPE " + pad(state.level.num) + " ABGESCHLOSSEN · " + (nextLevel ? "WEITER GEHT'S" : "STRASSENZUG KOMPLETT");
    els.winTitle.innerHTML = state.level.name + "<br><span>" + (nextLevel ? "GESCHAFFT!" : "KOMPLETT!") + "</span>";
    els.winCopy.textContent = nextLevel
      ? "Der Kadett wartet schon. Nächster Halt: " + nextLevel.name + "."
      : "Drei Straßenzüge, ein Hoodie. Der Kadett bringt dich zurück – Augsburg liegt hinter dir.";
    els.winTime.textContent = formatClock(result.time);
    els.winNuts.textContent = result.nuts + " / " + result.totalNuts;
    els.winDistance.textContent = state.level.distance + " m";
    if (els.winStars) {
      els.winStars.textContent =
        (starFlags.time ? "★" : "☆") + (starFlags.nuts ? "★" : "☆") + (starFlags.clean ? "★" : "☆");
      els.winStars.setAttribute(
        "aria-label",
        result.stars + " von 3 Sternen: " +
          (starFlags.time ? "Zielzeit geschafft" : "Zielzeit verpasst") + ", " +
          (starFlags.nuts ? "alle Münzen" : "nicht alle Münzen") + ", " +
          (starFlags.clean ? "ohne Treffer" : "mit Treffern")
      );
    }
    if (els.winTarget) {
      els.winTarget.textContent = "ZIELZEIT " + formatClock(targetTime);
    }
    var diff = meta.previousTime != null ? result.time - meta.previousTime : null;
    els.winBest.textContent = meta.isBest
      ? (diff != null && diff < -0.05
        ? "NEUE BESTZEIT! " + Math.abs(diff).toFixed(1) + " s schneller"
        : "NEUE BESTZEIT!")
      : "BESTZEIT: " + formatClock(best ? best.time : result.time) +
        (diff != null && diff > 0.05 ? " · +" + diff.toFixed(1) + " s" : "");

    if (meta.newlyUnlocked && nextLevel) {
      els.unlockBanner.textContent = "ETAPPE " + pad(nextLevel.num) + " FREIGESCHALTET: " + nextLevel.name;
      els.unlockBanner.classList.remove("hidden");
    } else {
      els.unlockBanner.classList.add("hidden");
    }

    if (nextLevel) {
      els.winNext.dataset.next = String(nextIndex);
      els.winNext.textContent = "WEITER: " + nextLevel.name + " →";
    } else {
      els.winNext.dataset.next = "";
      els.winNext.textContent = "ZUR ETAPPENAUSWAHL";
    }

    els.winModal.classList.remove("hidden");
    focusModal(els.winModal, "#win-next");
    document.dispatchEvent(
      new CustomEvent("augsburg:complete", { detail: { result: result, meta: meta } })
    );
    if (meta.newlyUnlocked) {
      window.setTimeout(function () {
        sfx("unlock");
      }, 420);
    }
  }

  function skipOutro() {
    if (state.mode !== "outro") {
      return;
    }
    finishOutro();
  }

  function startLevel(index) {
    var level = LEVELS[index];
    if (!level) {
      return;
    }
    state.levelIndex = index;
    state.level = level;
    if (window.RunnerAudio && window.RunnerAudio.setLevelMood) {
      window.RunnerAudio.setLevelMood(level.id);
      window.RunnerAudio.setIntensity(0.28 + Math.min(level.num, 8) * 0.055);
    }
    // Die Buehne ist jetzt sichtbar: Groesse neu messen (Handy-Drehung,
    // Adressleiste, Vollbild) und die Leinwand passend skalieren.
    queueViewport();
    state.mode = "intro";
    state.palette = PALETTES[level.id] || PALETTES.hbf;
    state.colors = buildColors(level);
    state.startPlatform =
      level.platforms.filter(function (platform) {
        return platform.type === "start";
      })[0] || level.platforms[0];
    state.finishPlatform = level.platforms[level.finishPlatform] || level.platforms[level.platforms.length - 1];
    state.player = {
      x: level.startX,
      y: state.startPlatform.roofY - 28,
      vx: 0,
      vy: 0,
      facing: 1,
      w: 14,
      h: STAND_H,
      crouching: false,
      lane: LANE_SIDEWALK,
      onGround: true,
      standing: level.platforms.indexOf(state.startPlatform),
      animTime: 0
    };
    state.playerVisible = false;
    state.playerInCar = false;
    state.car = {
      x: -92,
      y: state.startPlatform.roofY - 31,
      visible: true,
      moving: true,
      direction: 1
    };
    state.camera = 0;
    state.elapsed = 0;
    state.worldTime = 0;
    // Etappen starten zu unterschiedlichen Tageszeiten, laufen aber alle
    // in einen sichtbaren Sonnenuntergang hinein.
    state.dayTime = 0.38 + ((level.num - 1) % 4) * 0.025;
    state.nightWindows = [];
    state.nightLamps = [];
    state.hudTick = 0;
    state.introTime = 0;
    state.outroTime = 0;
    state.carSoundPlayed = false;
    state.carHornPlayed = false;
    state.introPlayerAction = "idle";
    state.collected = new Set();
    state.activeCheckpoint = -1;
    state.lastCheckpoint = null;
    state.lastSafe = { x: level.startX, y: state.startPlatform.roofY };
    state.autoTarget = null;
    state.autoRun = false;
    state.particles = [];
    state.npcs = buildNpcs(level);
    state.birds = buildBirds(level);
    state.traffic = buildTraffic(level);
    state.hitCooldown = 0;
    state.heartFull = true;
    state.deathTime = 0;
    state.deathSpin = 0;
    state.deathCause = "";
    state.hits = 0;
    state.falls = 0;
    state.carHits = 0;
    state.carWarnCooldown = 0;
    state.laneSwitchCooldown = 0;
    state.laneDrawOffset = 0;
    state.laneThinkTimer = 0;
    state.coinChaseX = null;
    state.coinChaseLane = null;
    state.scooterHits = 0;
    state.stepTimer = 0;
    state.stepFlip = false;
    state.scooterBumpToastShown = false;
    state.carHintShown = false;
    state.carHornCooldown = 0;
    state.bumpTimer = 0;
    state.bumpDirection = 0;
    state.landSquash = 0;
    state.scooterHintShown = false;
    state.lowBirdHintShown = false;
    state.scooterBellCooldown = 0;
    state.weatherParticles = [];
    state.buildingCache = {};
    state.gradients = {};
    computeDayNight();
    window.clearTimeout(state.endlessAdvanceTimer);
    state.endlessAdvanceTimer = null;
    state.keys.left = false;
    state.keys.right = false;
    state.keys.jump = false;
    state.keys.run = false;
    state.keys.down = false;
    state.jumpBuffer = 0;
    state.jumpPower = JUMP;
    state.jumpLog = [];
    state.autoRetries = 0;
    state.autoRetryX = null;
    state.coyote = 7;
    state.onGround = true;
    state.standing = level.platforms.indexOf(state.startPlatform);
    state.shake = 0;
    state.flash = 0;
    state.completed = false;
    accumulator = 0;
    window.clearTimeout(state.toastTimer);
    window.clearTimeout(state.hintTimer);
    els.toast.classList.remove("is-visible");
    els.winModal.classList.add("hidden");
    els.pauseModal.classList.add("hidden");
    els.mapModal.classList.add("hidden");
    els.hud.classList.add("hidden");
    els.minimapPanel.classList.add("hidden");
    els.clickHint.classList.add("hidden");
    releaseModalFocus();
    els.cinematic.classList.remove("hidden");
    els.cinematicKicker.textContent = "ETAPPE " + pad(level.num) + " · " + level.subtitle.toUpperCase();
    els.cinematicName.textContent = level.name;
    els.cinematicTagline.textContent = level.tagline;
    els.browser.classList.add("hidden");
    els.play.classList.remove("hidden");
    document.body.classList.add("in-game");
    setLevelDom();
    updateHud(true);
    window.RunnerStore.markSeen(level);
    startLoop();
    document.dispatchEvent(new CustomEvent("augsburg:levelstart", { detail: { level: level } }));
  }

  function isJumpKey(key) {
    return key === " " || key === "spacebar" || key === "w" || key === "arrowup";
  }

  function handleKeyDown(event) {
    if (els.play.classList.contains("hidden")) {
      return;
    }
    var key = event.key;
    var k = key.toLowerCase();

    if (state.mode === "map") {
      if (k === "escape" || k === "m") {
        event.preventDefault();
        closeMap();
      }
      return;
    }

    if (state.mode === "paused") {
      if (k === "escape" || k === "p") {
        event.preventDefault();
        resumeGame();
      }
      return;
    }

    if (state.mode === "complete") {
      if (state.endless) {
        if (k === "escape") {
          event.preventDefault();
          goBrowser(state.levelIndex);
        }
        return;
      }
      if (k === "enter") {
        event.preventDefault();
        els.winNext.click();
      } else if (k === "escape") {
        event.preventDefault();
        goBrowser(state.levelIndex);
      }
      return;
    }

    if (state.mode === "intro") {
      if (isJumpKey(k) || k === "enter") {
        event.preventDefault();
        beginPlaying();
      }
      return;
    }

    if (state.mode === "outro") {
      if ((isJumpKey(k) || k === "enter") && state.outroTime > 0.55) {
        event.preventDefault();
        skipOutro();
      }
      return;
    }

    if (state.mode !== "playing") {
      return;
    }

    if (k === "escape" || k === "p") {
      event.preventDefault();
      pauseGame();
      return;
    }
    if (k === "m") {
      event.preventDefault();
      openMap();
      return;
    }
    if (k === "a" || k === "arrowleft") {
      event.preventDefault();
      state.keys.left = true;
      state.autoRun = false;
      state.autoTarget = null;
    }
    if (k === "d" || k === "arrowright") {
      event.preventDefault();
      state.keys.right = true;
      state.autoRun = false;
      state.autoTarget = null;
    }
    if (isJumpKey(k)) {
      event.preventDefault();
      if (!event.repeat) {
        state.jumpBuffer = 8;
      }
      state.keys.jump = true;
    }
    if (key === "Shift") {
      state.keys.run = true;
    }
    if (k === "s" || k === "arrowdown") {
      event.preventDefault();
      state.keys.down = true;
      state.autoRun = false;
      state.autoTarget = null;
    }
  }

  function handleKeyUp(event) {
    var key = event.key;
    var k = key.toLowerCase();
    if (k === "a" || k === "arrowleft") {
      state.keys.left = false;
    }
    if (k === "d" || k === "arrowright") {
      state.keys.right = false;
    }
    if (isJumpKey(k)) {
      state.keys.jump = false;
      if (state.player && state.player.vy < -2.6) {
        state.player.vy = -2.6;
      }
    }
    if (key === "Shift") {
      state.keys.run = false;
    }
    if (k === "s" || k === "arrowdown") {
      state.keys.down = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Spuren: Bürgersteig, Straße 1, Straße 2                             */
  /* ------------------------------------------------------------------ */

  // Der Junge bleibt auf dem Gehweg; Verkehr und Tram sind Kulisse.

  // Autos treffen nur, wenn der Junge auf der Fahrbahn läuft.
  function checkTrafficHits(dt) {
    var player = state.player;
    if (!player || state.mode !== "playing") {
      return;
    }
    state.carWarnCooldown = Math.max(0, state.carWarnCooldown - dt);
    if (state.hitCooldown > 0) {
      return;
    }
    for (var i = 0; i < state.traffic.length; i += 1) {
      var car = state.traffic[i];
      if (car.lane !== player.lane) {
        continue;
      }
      var distance = Math.abs(car.x - player.x);
      if (distance < car.w * 0.5 + 8) {
        state.carHits += 1;
        state.hits += 1;
        state.hitCooldown = 1.4;
        state.carWarnCooldown = 2.2;
        if (!state.autoRun) {
          beginDeath("Auto", car.dir);
        } else {
          showToast("AUTO!", "Der Verkehr erwischt dich. Zurück auf den Gehweg.", 1800);
          respawnPlayer();
        }
        return;
      }
      if (distance < car.w * 0.5 + 120 && state.carWarnCooldown <= 0) {
        state.carWarnCooldown = 2.4;
        sfx("carHorn");
      }
    }
  }

  function updatePlaying(dt) {
    var level = state.level;
    var player = state.player;
    if (!level || !player) {
      return;
    }
    state.elapsed += dt;
    player.animTime += dt;
    state.dustTimer -= dt;
    state.hitCooldown = Math.max(0, state.hitCooldown - dt);
    state.laneSwitchCooldown = Math.max(0, state.laneSwitchCooldown - dt);
    state.laneDrawOffset *= 0.72;
    if (Math.abs(state.laneDrawOffset) < 0.4) {
      state.laneDrawOffset = 0;
    }
    state.bumpTimer = Math.max(0, state.bumpTimer - dt);
    state.landSquash = Math.max(0, state.landSquash - dt * 5.5);

    var wasGrounded = player.onGround;
    if (wasGrounded) {
      state.coyote = 7;
    } else {
      state.coyote = Math.max(0, state.coyote - 1);
    }

    var dir = 0;
    if (state.keys.left) {
      dir -= 1;
    }
    if (state.keys.right) {
      dir += 1;
    }
    if (dir !== 0) {
      state.autoRun = false;
      state.autoTarget = null;
    }

    var autoRunning = false;
    if (dir === 0 && state.autoRun && state.autoTarget != null) {
      var delta = state.autoTarget - player.x;
      if (Math.abs(delta) < 7) {
        state.autoRun = false;
        state.autoTarget = null;
      } else {
        dir = delta > 0 ? 1 : -1;
        autoRunning = true;
      }
    }

    // Der Junge bleibt auf dem Gehweg. Straßenbahn und Autos fahren auf
    // ihren eigenen Spuren im Vordergrund - kein automatischer Spurwechsel.
    // Ducken: S/↓ senkt den Jungen am Boden, die Füße bleiben stehen.
    var wantCrouch = Boolean(state.keys.down) && player.onGround && !autoRunning;
    if (wantCrouch && !player.crouching) {
      player.crouching = true;
      player.y += player.h - CROUCH_H;
      player.h = CROUCH_H;
    } else if (!wantCrouch && player.crouching) {
      player.h = STAND_H;
      player.y -= STAND_H - CROUCH_H;
      player.crouching = false;
    }

    if (autoRunning && state.autoTarget != null) {
      if (state.jumpBuffer === 0 && state.bumpTimer <= 0 && wasGrounded) {
        for (var npcIndex = 0; npcIndex < state.npcs.length; npcIndex += 1) {
          var autoNpc = state.npcs[npcIndex];
          if ((autoNpc.lane || 0) !== player.lane) {
            continue;
          }
          var npcAhead = (autoNpc.x - player.x) * dir;
          var fastHazard = autoNpc.type === "cyclist";
          var trigger = fastHazard ? 62 : 46;
          if (npcAhead > 0 && npcAhead < trigger) {
            state.jumpBuffer = 2;
            state.jumpPower = fastHazard ? -6.0 : -5.2;
            break;
          }
        }
        // Versteckte Münzen hängen in Sprunghöhe: rechtzeitig abspringen.
        if (state.jumpBuffer === 0) {
          for (var coinIndex = 0; coinIndex < state.level.nuts.length; coinIndex += 1) {
            if (state.collected.has(coinIndex)) {
              continue;
            }
            var hidden = state.level.nuts[coinIndex];
            if (!hidden.hidden || (hidden.lane || 0) !== player.lane) {
              continue;
            }
            var coinAhead = (hidden.x - player.x) * dir;
            if (coinAhead > 18 && coinAhead < 46) {
              state.jumpBuffer = 2;
              state.jumpPower = -5.6;
              break;
            }
          }
        }
      }
    }

    if (state.jumpBuffer > 0) {
      if (wasGrounded || state.coyote > 0) {
        state.jumpLog.push({
          t: Math.round(state.elapsed * 100) / 100,
          x: Math.round(player.x),
          y: Math.round(player.y),
          power: Math.round((state.jumpPower || JUMP) * 100) / 100,
          grounded: wasGrounded,
          coyote: state.coyote
        });
        if (state.jumpLog.length > 24) {
          state.jumpLog.shift();
        }
        if (player.crouching) {
          player.h = STAND_H;
          player.y -= STAND_H - CROUCH_H;
          player.crouching = false;
        }
        player.vy = state.jumpPower || JUMP;
        player.onGround = false;
        state.coyote = 0;
        state.jumpBuffer = 0;
        state.jumpPower = JUMP;
        spawnDustPuff(player.x, player.y + player.h, 5);
        sfx("jump");
      } else {
        state.jumpBuffer -= 1;
        if (state.jumpBuffer <= 0) {
          state.jumpPower = JUMP;
        }
      }
    }

    if (dir !== 0) {
      player.facing = dir;
    }
    var speedTarget = 0;
    if (dir !== 0) {
      var sprint = state.keys.run || autoRunning;
      speedTarget = dir * (sprint ? RUN : WALK);
      if (player.crouching) {
        speedTarget *= 0.52;
      }
    }
    var acceleration = wasGrounded ? (dir !== 0 ? 0.34 : 0.42) : (dir !== 0 ? 0.2 : 0.05);
    if (state.bumpTimer > 0) {
      speedTarget = 0;
      acceleration = 0.08;
    }
    player.vx = approach(player.vx, speedTarget, acceleration);

    if (!state.keys.jump && !autoRunning && player.vy < -2.6) {
      player.vy += 0.58;
    }
    if (state.keys.down && !player.onGround) {
      player.vy += 0.2;
    }
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);

    var ground = laneFeet(player.lane);
    var previousBottom = player.y + player.h;
    player.x = clamp(player.x + player.vx, 20, level.lengthPx - 20);
    player.y += player.vy;
    var newBottom = player.y + player.h;

    player.onGround = false;
    state.onGround = false;
    var landed = false;
    if (player.vy >= 0 && previousBottom <= ground + 1.5 && newBottom >= ground) {
      landed = true;
      var impact = player.vy;
      player.y = ground - player.h;
      player.vy = 0;
      player.onGround = true;
      state.onGround = true;
      state.standing = 0;
      state.coyote = 7;
      state.lastSafe = {
        x: clamp(player.x, 24, level.lengthPx - 24),
        y: ground,
        lane: player.lane
      };
      if (!wasGrounded && impact > 2.5) {
        sfx("land");
        spawnDustPuff(player.x, ground, 5);
        state.shake = Math.max(state.shake, 1.3);
        state.landSquash = clamp(impact / 9, 0.14, 0.58);
      }
    }
    if (!landed) {
      state.standing = -1;
      if (player.y > H + 50) {
        if (state.autoRun) {
          respawnPlayer();
        } else {
          player.y = H - 24;
          player.vy = -5.2;
          beginDeath("Sturz", 0);
        }
        return;
      }
    }

    if (wasGrounded && Math.abs(player.vx) > 1.4 && state.dustTimer <= 0) {
      state.dustTimer = 0.13;
      spawnDustPuff(player.x - player.vx * 2, player.y + player.h, 1);
    }

    // Soft alternating footsteps make running and sprinting feel grounded.
    if (player.onGround && Math.abs(player.vx) > 0.9) {
      state.stepTimer -= dt;
      if (state.stepTimer <= 0) {
        state.stepTimer = Math.abs(player.vx) > 2.2 ? 0.17 : 0.24;
        state.stepFlip = !state.stepFlip;
        sfx(state.stepFlip ? "step1" : "step2");
      }
    } else {
      state.stepTimer = Math.min(state.stepTimer, 0.05);
    }

    checkNpcHits();
    checkBirdHits();
    checkTrafficHits(dt);
    if (state.mode !== "playing") {
      return;
    }

    for (var nutIndex = 0; nutIndex < level.nuts.length; nutIndex += 1) {
      if (state.collected.has(nutIndex)) {
        continue;
      }
      var nut = level.nuts[nutIndex];
      if ((nut.lane || 0) !== player.lane) {
        continue;
      }
      var dx = player.x - nut.x;
      var dy = player.y + 14 - nut.y;
      if (dx * dx + dy * dy < 19 * 19) {
        state.collected.add(nutIndex);
        sfx("nut");
        spawnBurst(nut.x, nut.y, ["#f2c14e", "#8bc66b", "#fff0b6"], 8, 2.2);
        updateHud(true);
        if (state.collected.size === level.nuts.length) {
          showToast("ALLES GESAMMELT!", "Alle Münzen dieser Etappe.");
        }
      }
    }

    for (var cpIndex = 0; cpIndex < level.checkpoints.length; cpIndex += 1) {
      var checkpoint = level.checkpoints[cpIndex];
      if (checkpoint && player.x >= checkpoint.x && cpIndex > state.activeCheckpoint) {
        var checkpointY = laneFeet(LANE_SIDEWALK);
        state.activeCheckpoint = cpIndex;
        state.lastCheckpoint = {
          x: checkpoint.x,
          y: checkpointY,
          index: cpIndex
        };
        state.lastSafe = { x: checkpoint.x, y: checkpointY, lane: LANE_SIDEWALK };
        sfx("checkpoint");
        spawnBurst(checkpoint.x, checkpoint.y - 20, ["#f2c14e", "#fff3c6", "#3f7fc1"], 12, 2.8);
        showToast("ZWISCHENZIEL " + (cpIndex + 1), "Sichere Straßenecke gespeichert.");
      }
    }

    if (player.x >= level.finishX) {
      beginOutro();
    }
  }

  function beginDeath(cause, direction) {
    var player = state.player;
    if (!player || state.mode !== "playing") {
      return;
    }
    state.mode = "dying";
    state.heartFull = false;
    state.deathTime = 0;
    state.deathSpin = 0;
    state.deathCause = cause || "Treffer";
    player.h = STAND_H;
    player.crouching = false;
    player.onGround = false;
    state.onGround = false;
    state.standing = -1;
    player.vx = (direction || 0) * 2.1;
    player.vy = -6.2;
    state.jumpBuffer = 0;
    state.hitCooldown = 1.2;
    state.shake = Math.max(state.shake, 5);
    state.flash = 0.5;
    spawnBurst(player.x, player.y + player.h * 0.5, ["#f2c14e", "#e2594a", "#e8e2d0", "#3f7fc1"], 16, 3.4);
    sfx("death");
    showToast("AUS!", state.deathCause + " – ein Herz, ein Leben.", 1600);
    updateHud(true);
  }

  function updateDeath(dt) {
    var player = state.player;
    if (!player) {
      return;
    }
    state.deathTime += dt;
    state.deathSpin += dt * 8.2;
    player.animTime += dt;
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * 0.86);
    player.x = clamp(player.x + player.vx, 20, state.level.lengthPx - 20);
    player.vx *= 0.985;
    player.y += player.vy;
    if ((state.deathTime > 1.25 && player.y > laneFeet(LANE_SIDEWALK) - 12) || state.deathTime > 1.9) {
      state.deathCause = "";
      if (state.activeCheckpoint >= 0) {
        state.mode = "playing";
        state.heartFull = true;
        respawnPlayer();
      } else {
        restartFromDeath();
      }
    }
  }

  // Ohne Checkpoint beginnt die Etappe komplett von vorn: Zeit, Münzen und
  // Zwischenziele werden zurückgesetzt.
  function restartFromDeath() {
    var index = state.levelIndex;
    var keepEndless = state.endless;
    state.heartFull = true;
    startLevel(index);
    state.endless = keepEndless;
    beginPlaying();
    showToast("NEUER LAUF", "Kein Checkpoint erreicht – die Etappe startet von vorn.", 2400);
  }

  function respawnPlayer() {
    var player = state.player;
    if (!player || !state.level) {
      return;
    }
    // The last activated flag is the respawn point. Before the first flag the
    // latest safe street edge is used instead.
    var checkpointSafe = state.lastCheckpoint;
    var safe = checkpointSafe || { x: state.level.startX, y: laneFeet(LANE_SIDEWALK), lane: LANE_SIDEWALK };
    var safeLane = clampLane(safe.lane == null ? LANE_SIDEWALK : safe.lane);
    var safeY = laneFeet(safeLane);
    var safeX = clamp(safe.x, 24, state.level.lengthPx - 24);
    var wasAutoRun = state.autoRun;
    var sameSpot = state.autoRetryX != null && Math.abs(safeX - state.autoRetryX) < 12;
    state.falls += 1;
    state.heartFull = true;
    player.h = STAND_H;
    player.crouching = false;
    player.x = safeX;
    player.y = safeY - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    player.lane = safeLane;
    state.laneDrawOffset = 0;
    state.laneSwitchCooldown = 0.4;
    state.onGround = true;
    state.standing = 0;
    state.jumpBuffer = 0;
    state.jumpPower = JUMP;
    state.bumpTimer = 0;
    state.hitCooldown = 0;
    state.stepTimer = 0;
    state.autoTarget = null;
    state.camera = clamp(player.x - W * 0.38, 0, state.level.lengthPx - W);
    state.flash = 0.55;
    state.shake = 3.5;
    spawnBurst(player.x, player.y + 12, ["#f5e9c9", "#b63b2f", "#7297b4"], 14, 3.2);
    sfx("fail");

    if (wasAutoRun) {
      state.autoRetries = sameSpot ? state.autoRetries + 1 : 1;
      state.autoRetryX = safeX;
      if (state.autoRetries <= 2) {
        state.autoRun = true;
        state.autoTarget = state.level.finishX + 40;
        showToast(
          "STURZ!",
          "Dauerlauf setzt fort · Versuch " + state.autoRetries + "/2 an dieser Stelle.",
          2200
        );
      } else {
        state.autoRun = false;
        state.autoRetryX = null;
        showToast("DAUERLAUF GESTOPPT", "Zweimal an derselben Stelle gestürzt. Klick für einen neuen Lauf.");
      }
    } else {
      state.autoRun = false;
      if (checkpointSafe) {
        showToast(
          "ZURÜCK ZU ZWISCHENZIEL " + (checkpointSafe.index + 1),
          "Die letzte Flaggen-Straßenecke ist dein neuer Startpunkt."
        );
      } else {
        showToast("STURZ!", "Zurück zur letzten sicheren Straßenecke.");
      }
    }
    updateHud(true);
  }

  function updateCamera(dt) {
    if (!state.level || !state.player) {
      return;
    }
    if (state.mode === "intro") {
      state.camera = 0;
      return;
    }
    var reference = state.player.x;
    var target = clamp(reference - W * 0.38, 0, Math.max(0, state.level.lengthPx - W));
    var factor = Math.min(1, dt * 8);
    state.camera += (target - state.camera) * factor;
  }

  function pauseGame() {
    if (state.mode !== "playing") {
      return;
    }
    state.mode = "paused";
    state.keys.left = false;
    state.keys.right = false;
    state.keys.jump = false;
    state.keys.run = false;
    state.keys.down = false;
    els.pauseCopy.textContent =
      state.level.name + " · " + metersLeft() + " Meter bis zum Ziel · " +
      (state.endless ? "Gesamt " : "") + formatClock(displayTime());
    els.pauseModal.classList.remove("hidden");
    focusModal(els.pauseModal, "#resume-btn");
    sfx("click");
  }

  function resumeGame() {
    if (state.mode !== "paused") {
      return;
    }
    state.mode = "playing";
    els.pauseModal.classList.add("hidden");
    releaseModalFocus();
    accumulator = 0;
    lastTimestamp = performance.now();
    sfx("click");
  }

  function updateMapModal() {
    if (!state.level) {
      return;
    }
    var progress = progressNow();
    var point = routePointAt(state.level, progress);
    els.bigMapImg.src = state.level.map;
    els.bigMapDot.style.left = point[0] + "%";
    els.bigMapDot.style.top = point[1] + "%";
    els.mapModalLevel.textContent = pad(state.level.num) + " · " + state.level.name;
    els.mapModalDistance.textContent = metersLeft() + " m";
    els.mapModalProgress.textContent = Math.round(progress * 100) + " %";
    els.mapGoogle.href = googleDirections(state.level);
  }

  function openMap() {
    if (state.mode !== "playing" && state.mode !== "paused") {
      return;
    }
    mapReturnMode = state.mode;
    state.mode = "map";
    els.pauseModal.classList.add("hidden");
    updateMapModal();
    els.mapModal.classList.remove("hidden");
    focusModal(els.mapModal, "#map-resume", mapReturnMode === "paused");
    sfx("click");
  }

  function closeMap() {
    if (state.mode !== "map") {
      return;
    }
    els.mapModal.classList.add("hidden");
    if (mapReturnMode === "paused") {
      state.mode = "paused";
      els.pauseModal.classList.remove("hidden");
      focusModal(els.pauseModal, "#resume-btn", true);
      els.pauseCopy.textContent =
        state.level.name + " · " + metersLeft() + " Meter bis zum Ziel · " +
        (state.endless ? "Gesamt " : "") + formatClock(displayTime());
    } else {
      state.mode = "playing";
      releaseModalFocus();
      accumulator = 0;
      lastTimestamp = performance.now();
    }
  }

  function restartLevel() {
    els.pauseModal.classList.add("hidden");
    els.winModal.classList.add("hidden");
    startLevel(state.levelIndex);
  }

  function goBrowser(preferredIndex) {
    stopLoop();
    state.endless = false;
    window.clearTimeout(state.endlessAdvanceTimer);
    state.endlessAdvanceTimer = null;
    els.pauseModal.classList.add("hidden");
    els.winModal.classList.add("hidden");
    els.mapModal.classList.add("hidden");
    els.toast.classList.remove("is-visible");
    releaseModalFocus();
    els.play.classList.add("hidden");
    els.browser.classList.remove("hidden");
    document.body.classList.remove("in-game");
    document.title = "Auf nach Augsburg — Der Pixel-Stadtlauf";
    state.mode = "browser";
    state.autoRun = false;
    state.autoTarget = null;
    state.keys.left = false;
    state.keys.right = false;
    state.keys.jump = false;
    state.keys.run = false;
    state.keys.down = false;
    if (window.RunnerBrowser) {
      window.RunnerBrowser.show(preferredIndex);
    }
  }

  function startAutoRun() {
    if (state.mode !== "playing" || !state.level) {
      return;
    }
    state.autoRun = true;
    state.autoTarget = state.level.finishX + 40;
    state.autoRetries = 0;
    state.autoRetryX = null;
    sfx("click");
  }

  function startEndless() {
    var mainStages = ACTIVE_LEVELS.length;
    if (window.RunnerStore && window.RunnerStore.clearedCount() < mainStages) {
      return;
    }
    state.endless = true;
    state.endlessStage = 0;
    state.endlessTime = 0;
    state.endlessNuts = 0;
    window.clearTimeout(state.endlessAdvanceTimer);
    state.endlessAdvanceTimer = null;
    startLevel(0);
    showToast("ENDLOS-MODUS", "Alle Etappen hintereinander. Über Pause → Etappen beendest du den Lauf.", 2800);
  }

  function onStagePointerDown(event) {
    if (event.target.closest && event.target.closest("button, a, #hud, .minimap-panel, .touch-controls")) {
      return;
    }
    if (state.mode === "intro") {
      beginPlaying();
      startAutoRun();
      return;
    }
    if (state.mode === "outro") {
      if (state.outroTime > 0.55) {
        skipOutro();
      }
      return;
    }
    if (state.mode !== "playing" || !state.level) {
      return;
    }
    startAutoRun();
  }

  function bindTouchControls() {
    var buttons = document.querySelectorAll("[data-touch]");
    Array.prototype.forEach.call(buttons, function (button) {
      var action = button.getAttribute("data-touch");
      function press(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.pointerId != null && button.setPointerCapture) {
          try {
            button.setPointerCapture(event.pointerId);
          } catch (error) {
            /* egal */
          }
        }
        if (state.mode !== "playing") {
          return;
        }
        if (action === "left") {
          state.keys.left = true;
          state.autoRun = false;
          state.autoTarget = null;
        } else if (action === "right") {
          state.keys.right = true;
          state.autoRun = false;
          state.autoTarget = null;
        } else if (action === "run") {
          state.keys.run = true;
        } else if (action === "down") {
          state.keys.down = true;
          state.autoRun = false;
          state.autoTarget = null;
        } else if (action === "jump") {
          state.keys.jump = true;
          state.jumpBuffer = 8;
        }
      }
      function release(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (action === "left") {
          state.keys.left = false;
        } else if (action === "right") {
          state.keys.right = false;
        } else if (action === "run") {
          state.keys.run = false;
        } else if (action === "down") {
          state.keys.down = false;
        } else if (action === "jump") {
          state.keys.jump = false;
          if (state.player && state.player.vy < -2.6) {
            state.player.vy = -2.6;
          }
        }
      }
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      button.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    });
  }

  /* ================================================================== */
  /* Zeichnen: Grundformen, Himmel und die Augsburger Silhouette          */
  /* ================================================================== */

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function pickColor(list, seed) {
    var value = Math.abs(Math.floor(seed)) % list.length;
    return list[value];
  }

  function fillBox(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }

  function drawPixelLine(x0, y0, x1, y1, color, thickness) {
    var tx = Math.round(x0);
    var ty = Math.round(y0);
    var ex = Math.round(x1);
    var ey = Math.round(y1);
    var dx = Math.abs(ex - tx);
    var dy = Math.abs(ey - ty);
    var sx = tx < ex ? 1 : -1;
    var sy = ty < ey ? 1 : -1;
    var error = dx - dy;
    var thicknessValue = thickness || 1;
    while (true) {
      fillBox(tx, ty, thicknessValue, thicknessValue, color);
      if (tx === ex && ty === ey) {
        break;
      }
      var doubled = error * 2;
      if (doubled > -dy) {
        error -= dy;
        tx += sx;
      }
      if (doubled < dx) {
        error += dx;
        ty += sy;
      }
    }
  }

  function drawPixelDisc(cx, cy, radius, color) {
    ctx.beginPath();
    for (var y = -radius; y <= radius; y += 1) {
      var half = Math.floor(Math.sqrt(radius * radius - y * y));
      ctx.rect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawCloud(x, y, scale, color, shade) {
    var s = Math.max(1, Math.round(scale));
    fillBox(x + 2 * s, y + 4 * s, 15 * s, 3 * s, shade);
    fillBox(x + 1 * s, y + 3 * s, 17 * s, 3 * s, color);
    fillBox(x + 4 * s, y + 1 * s, 7 * s, 4 * s, color);
    fillBox(x + 10 * s, y + 2 * s, 6 * s, 4 * s, color);
    fillBox(x + 6 * s, y, 4 * s, 2 * s, color);
    fillBox(x + 2 * s, y + 2 * s, 3 * s, 2 * s, color);
    fillBox(x + 12 * s, y + 1 * s, 2 * s, 2 * s, color);
    fillBox(x + 3 * s, y + 5 * s, 12 * s, 1 * s, shade);
  }

  function drawBirds() {
    var scroll = state.worldTime * 7 + state.camera * 0.055;
    for (var i = 0; i < 4; i += 1) {
      var x = mod(i * 127 - scroll, W + 80) - 40;
      var y = 38 + hash01(i + 4) * 54 + Math.sin(state.worldTime * 1.3 + i) * 2;
      var flap = Math.floor(state.worldTime * 5 + i) % 2;
      ctx.globalAlpha = 0.34;
      fillBox(x, y + flap, 4, 1, "#263c4e");
      fillBox(x - 3, y + 1 - flap, 3, 1, "#263c4e");
      fillBox(x + 4, y + 1 - flap, 3, 1, "#263c4e");
      ctx.globalAlpha = 1;
    }
  }

  function drawRidge(offset, baseY, height, color, seed) {
    ctx.fillStyle = color;
    for (var x = 0; x < W; x += 2) {
      var slot = mod(x + offset, 188);
      var peak = 1 - Math.abs(slot / 94 - 1);
      var wave = Math.sin((x + offset) * 0.013 + seed) * 0.18 + 0.5;
      var ridge = height * (0.26 + peak * 0.54 + wave * 0.25);
      var top = Math.round(baseY - ridge);
      ctx.fillRect(x, top, 2, Math.ceil(baseY - top + 3));
    }
  }

  function drawAlps() {
    var colors = state.colors;
    var night = state.nightFactor || 0;
    var far = mixRgb(colors.alpsFar, [10, 18, 30], night * 0.78);
    var near = mixRgb(colors.alpsNear, [8, 14, 24], night * 0.82);
    ctx.globalAlpha = 0.32;
    drawRidge(state.camera * 0.045 + 60, 176, 70, rgb(far), 1.7);
    ctx.globalAlpha = 0.38;
    drawRidge(state.camera * 0.075 + 230, 186, 55, rgb(near), 4.3);
    ctx.globalAlpha = 1;
  }

  function drawCityLayer(offset, baseY, color, windowColor, step, minHeight, maxHeight, seed, litBoost) {
    var windowThreshold = 0.62 - (litBoost || 0) * 0.34;
    var startSlot = Math.floor((offset - step) / step);
    var endSlot = startSlot + Math.ceil(W / step) + 3;
    ctx.globalAlpha = 0.94;
    for (var slot = startSlot; slot <= endSlot; slot += 1) {
      var x = slot * step - offset;
      if (x > W + step || x < -step * 2) {
        continue;
      }
      var h = minHeight + hash01(slot * 3 + seed) * (maxHeight - minHeight);
      var width = step * (0.58 + hash01(slot * 7 + seed) * 0.3);
      var top = baseY - h;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(top), Math.round(width), Math.ceil(h + 42));
      if (hash01(slot + seed + 19) > 0.45) {
        ctx.fillRect(Math.round(x + width * 0.16), Math.round(top - 4 - hash01(slot + seed) * 5), Math.round(width * 0.68), 4);
      }
      if (hash01(slot + seed + 31) > 0.72) {
        ctx.fillRect(Math.round(x + width * 0.36), Math.round(top - 11), 2, 8);
      }
      ctx.fillStyle = windowColor;
      for (var row = 0; row < 4; row += 1) {
        for (var col = 0; col < 3; col += 1) {
          if (hash01(slot * 31 + row * 7 + col * 13 + seed) > windowThreshold) {
            ctx.fillRect(
              Math.round(x + 5 + col * (width / 3.4)),
              Math.round(top + 10 + row * 13),
              2,
              3
            );
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLandmark(type, x, baseY, color, light) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    var y;
    if (type === "perlach" || type === "perlachturm") {
      // Schlanker Perlachturm mit Zwiebelhaube und Uhr.
      fillBox(x - 33, baseY - 22, 66, 24, color);
      fillBox(x - 12, baseY - 98, 24, 78, color);
      fillBox(x - 14, baseY - 104, 28, 7, color);
      fillBox(x - 11, baseY - 111, 22, 7, color);
      fillBox(x - 8, baseY - 117, 16, 6, color);
      fillBox(x - 5, baseY - 122, 10, 5, color);
      fillBox(x - 2, baseY - 130, 4, 8, color);
      fillBox(x - 1, baseY - 136, 2, 6, color);
      ctx.fillStyle = light;
      fillBox(x - 9, baseY - 88, 18, 12, light);
      ctx.fillStyle = color;
      drawPixelDisc(x, baseY - 82, 4, color);
      ctx.fillStyle = light;
      drawPixelDisc(x, baseY - 82, 3, light);
      ctx.fillStyle = color;
      fillBox(x - 1, baseY - 84, 1, 2, color);
      fillBox(x, baseY - 82, 2, 1, color);
      fillBox(x - 9, baseY - 68, 18, 2, light);
      fillBox(x - 14, baseY - 49, 28, 2, light);
      for (var row = 0; row < 3; row += 1) {
        fillBox(x - 8 + row * 7, baseY - 39, 4, 8, light);
      }
      fillBox(x - 25, baseY - 16, 4, 15, color);
      fillBox(x + 21, baseY - 16, 4, 15, color);
    } else if (type === "dom") {
      // Dom mit zwei Türmen, Rosenfenster und grünem Kupferdach.
      fillBox(x - 52, baseY - 30, 104, 31, color);
      fillBox(x - 46, baseY - 58, 92, 30, color);
      fillBox(x - 36, baseY - 89, 13, 34, color);
      fillBox(x + 23, baseY - 89, 13, 34, color);
      fillBox(x - 39, baseY - 97, 19, 9, color);
      fillBox(x + 20, baseY - 97, 19, 9, color);
      fillBox(x - 36, baseY - 104, 13, 8, color);
      fillBox(x + 23, baseY - 104, 13, 8, color);
      fillBox(x - 34, baseY - 112, 9, 9, color);
      fillBox(x + 25, baseY - 112, 9, 9, color);
      fillBox(x - 31, baseY - 119, 3, 8, color);
      fillBox(x + 28, baseY - 119, 3, 8, color);
      fillBox(x - 18, baseY - 76, 36, 18, color);
      ctx.fillStyle = light;
      drawPixelDisc(x, baseY - 48, 10, light);
      ctx.fillStyle = color;
      drawPixelDisc(x, baseY - 48, 7, color);
      ctx.fillStyle = light;
      fillBox(x - 1, baseY - 55, 2, 7, light);
      fillBox(x - 4, baseY - 48, 8, 2, light);
      for (var domeRow = 0; domeRow < 3; domeRow += 1) {
        fillBox(x - 32 + domeRow * 2, baseY - 52, 2, 8, light);
        fillBox(x + 30 - domeRow * 2, baseY - 52, 2, 8, light);
      }
      fillBox(x - 53, baseY - 16, 5, 15, color);
      fillBox(x + 48, baseY - 16, 5, 15, color);
    } else if (type === "rathaus") {
      // Prunkvolles Rathaus mit großem Mittelturm.
      fillBox(x - 60, baseY - 27, 120, 28, color);
      fillBox(x - 49, baseY - 49, 98, 24, color);
      fillBox(x - 8, baseY - 88, 16, 39, color);
      fillBox(x - 13, baseY - 94, 26, 8, color);
      fillBox(x - 10, baseY - 101, 20, 7, color);
      fillBox(x - 7, baseY - 110, 14, 9, color);
      fillBox(x - 4, baseY - 117, 8, 7, color);
      fillBox(x - 1, baseY - 126, 2, 9, color);
      ctx.fillStyle = light;
      fillBox(x - 45, baseY - 42, 25, 13, light);
      fillBox(x + 20, baseY - 42, 25, 13, light);
      fillBox(x - 3, baseY - 77, 6, 5, light);
      drawPixelDisc(x, baseY - 70, 5, light);
      ctx.fillStyle = color;
      fillBox(x - 1, baseY - 73, 1, 3, color);
      fillBox(x, baseY - 71, 2, 1, color);
      for (var flag = 0; flag < 3; flag += 1) {
        fillBox(x - 31 + flag * 26, baseY - 34, 3, 8, light);
      }
      fillBox(x - 50, baseY - 19, 4, 18, color);
      fillBox(x + 46, baseY - 19, 4, 18, color);
    } else if (type === "fuggerei") {
      // Fuggerei: kleine Giebelhäuser mit Schornsteinen.
      for (var house = 0; house < 3; house += 1) {
        var hx = x - 45 + house * 34;
        fillBox(hx - 12, baseY - 27, 28, 28, color);
        fillBox(hx - 10, baseY - 35, 24, 9, color);
        fillBox(hx - 6, baseY - 40, 16, 5, color);
        ctx.fillStyle = light;
        fillBox(hx - 6, baseY - 23, 5, 9, light);
        fillBox(hx + 3, baseY - 23, 5, 9, light);
        ctx.fillStyle = color;
        fillBox(hx - 6, baseY - 8, 6, 8, light);
        fillBox(hx + 1, baseY - 46, 4, 9, color);
        fillBox(hx + 1, baseY - 48, 7, 2, light);
      }
    } else if (type === "hauptbahnhof") {
      // Hauptbahnhof Augsburg: 1845 von Eduard Rüber, ältester noch
      // betriebener Großstadtbahnhof Deutschlands – flacher Baukörper,
      // Mittelrisalit mit Uhr und Laterne, offene Bogenhalle.
      fillBox(x - 58, baseY - 38, 116, 39, color);
      fillBox(x - 62, baseY - 42, 124, 5, color);
      fillBox(x - 62, baseY - 37, 124, 1, light);
      fillBox(x - 20, baseY - 54, 40, 17, color);
      fillBox(x - 17, baseY - 60, 34, 7, color);
      fillBox(x - 9, baseY - 66, 18, 7, color);
      fillBox(x - 5, baseY - 72, 10, 7, color);
      fillBox(x - 2, baseY - 78, 4, 6, color);
      // Uhr im Mittelrisaliten.
      drawPixelDisc(x, baseY - 57, 5, light);
      drawPixelDisc(x, baseY - 57, 4, color);
      fillBox(x, baseY - 60, 1, 3, light);
      fillBox(x, baseY - 57, 3, 1, light);
      // Fensterreihen und Bogenhalle.
      for (var hbfCol = 0; hbfCol < 7; hbfCol += 1) {
        fillBox(x - 52 + hbfCol * 15, baseY - 33, 7, 8, light);
        fillBox(x - 52 + hbfCol * 15, baseY - 20, 7, 9, light);
      }
      for (var hbfArch = 0; hbfArch < 3; hbfArch += 1) {
        fillBox(x - 30 + hbfArch * 22, baseY - 14, 18, 15, color);
        drawPixelDisc(x - 21 + hbfArch * 22, baseY - 14, 9, color);
        fillBox(x - 26 + hbfArch * 22, baseY - 12, 11, 12, light);
      }
      fillBox(x - 64, baseY - 4, 128, 2, "rgba(20,26,30,0.35)");
    } else if (type === "bahnhofstrasse") {
      // Bahnhofstraße: 1869 angelegter Prachtboulevard mit Gründerzeit-
      // und Jugendstilfassaden, Erker und Ecktürmchen.
      for (var bh = 0; bh < 3; bh += 1) {
        var bhx = x - 52 + bh * 36;
        var bhTop = baseY - (bh === 1 ? 52 : 44);
        fillBox(bhx, bhTop, 30, baseY - bhTop, color);
        fillBox(bhx - 2, bhTop - 3, 34, 4, color);
        fillBox(bhx + 10, bhTop - 9, 10, 7, color);
        drawPixelDisc(bhx + 15, bhTop - 11, 5, color);
        for (var bhRow = 0; bhRow < 3; bhRow += 1) {
          for (var bhCol = 0; bhCol < 3; bhCol += 1) {
            fillBox(bhx + 4 + bhCol * 9, bhTop + 8 + bhRow * 11, 5, 6, light);
          }
        }
        fillBox(bhx + 2, baseY - 11, 8, 12, light);
        fillBox(bhx + 18, baseY - 11, 8, 12, light);
        fillBox(bhx + 12, baseY - 12, 6, 13, color);
      }
    } else if (type === "synagoge") {
      // Große Synagoge an der Halderstraße, 1913–17 im Jugendstil mit
      // orientalischer Kuppel.
      fillBox(x - 44, baseY - 26, 88, 27, color);
      fillBox(x - 38, baseY - 34, 76, 9, color);
      fillBox(x - 24, baseY - 40, 48, 7, color);
      drawPixelDisc(x, baseY - 48, 22, color);
      drawPixelDisc(x, baseY - 52, 17, color);
      drawPixelDisc(x, baseY - 58, 12, color);
      drawPixelDisc(x, baseY - 63, 7, color);
      fillBox(x - 2, baseY - 74, 4, 11, color);
      // Davidstern auf der Kuppel.
      fillBox(x - 4, baseY - 80, 8, 1, light);
      fillBox(x - 4, baseY - 76, 8, 1, light);
      fillBox(x - 1, baseY - 80, 1, 5, light);
      fillBox(x - 3, baseY - 79, 1, 1, light);
      fillBox(x + 2, baseY - 79, 1, 1, light);
      fillBox(x - 3, baseY - 77, 1, 1, light);
      fillBox(x + 2, baseY - 77, 1, 1, light);
      for (var synArch = 0; synArch < 5; synArch += 1) {
        fillBox(x - 30 + synArch * 15, baseY - 20, 8, 12, light);
        drawPixelDisc(x - 26 + synArch * 15, baseY - 20, 4, light);
      }
      fillBox(x - 46, baseY - 10, 6, 11, color);
      fillBox(x + 40, baseY - 10, 6, 11, color);
      fillBox(x - 47, baseY - 16, 8, 6, color);
      fillBox(x + 39, baseY - 16, 8, 6, color);
    } else if (type === "koenigsplatz") {
      // Königsplatz: seit 1869 Parkplatz, ab 1905 Tramknoten. Der runde
      // Warte-Pavillon "Pilz" (Otto Holzer, 1913/14) und der
      // Thormann-Brunnen von 1880 prägen den Platz.
      fillBox(x - 60, baseY - 3, 120, 4, "rgba(30,34,36,0.22)");
      // Pilz-Pavillon.
      drawPixelDisc(x - 20, baseY - 34, 20, color);
      fillBox(x - 40, baseY - 34, 40, 3, color);
      fillBox(x - 36, baseY - 31, 2, 28, color);
      fillBox(x - 20, baseY - 31, 2, 28, color);
      fillBox(x - 4, baseY - 31, 2, 28, color);
      fillBox(x - 38, baseY - 20, 34, 2, light);
      fillBox(x - 38, baseY - 8, 34, 2, light);
      // Thormann-Brunnen: flaches Becken mit Strahl.
      fillBox(x + 8, baseY - 9, 46, 10, color);
      fillBox(x + 6, baseY - 11, 50, 3, light);
      fillBox(x + 30, baseY - 17, 3, 7, light);
      fillBox(x + 28, baseY - 21, 7, 4, "rgba(210,235,240,0.7)");
      fillBox(x + 24, baseY - 5, 38, 2, "rgba(210,232,238,0.45)");
      // Tram davor.
      fillBox(x - 52, baseY - 18, 26, 16, "rgba(24,30,34,0.3)");
      fillBox(x - 50, baseY - 22, 22, 6, "rgba(24,30,34,0.3)");
    } else if (type === "schaezlerpalais") {
      // Schaezlerpalais an der Maximilianstraße: Rokoko-Palais von 1765
      // mit Mansarddach und Mittelrisalit.
      fillBox(x - 54, baseY - 30, 108, 31, color);
      fillBox(x - 50, baseY - 34, 100, 5, light);
      fillBox(x - 14, baseY - 48, 28, 15, color);
      fillBox(x - 16, baseY - 52, 32, 5, color);
      fillBox(x - 10, baseY - 57, 20, 5, light);
      fillBox(x - 6, baseY - 61, 12, 4, color);
      for (var spRow = 0; spRow < 2; spRow += 1) {
        for (var spCol = 0; spCol < 7; spCol += 1) {
          fillBox(x - 46 + spCol * 14, baseY - 26 + spRow * 13, 7, 8, light);
        }
      }
      for (var spArch = 0; spArch < 3; spArch += 1) {
        fillBox(x - 22 + spArch * 18, baseY - 13, 12, 14, light);
        drawPixelDisc(x - 16 + spArch * 18, baseY - 13, 6, light);
      }
      fillBox(x - 56, baseY - 2, 112, 2, "rgba(20,24,28,0.3)");
    } else if (type === "merkurbrunnen" || type === "herkulesbrunnen" || type === "augustusbrunnen") {
      // Die drei Prachtbrunnen der Maximilianstraße: Merkurbrunnen
      // (1596–99), Herkulesbrunnen (1602) und Augustusbrunnen (1594).
      var fountainTall = type === "augustusbrunnen" ? 74 : 62;
      fillBox(x - 30, baseY - 10, 60, 11, color);
      fillBox(x - 32, baseY - 12, 64, 3, light);
      fillBox(x - 26, baseY - 6, 52, 2, "rgba(200,226,232,0.5)");
      fillBox(x - 6, baseY - fountainTall, 12, fountainTall - 10, color);
      fillBox(x - 9, baseY - fountainTall + 4, 18, 4, light);
      fillBox(x - 8, baseY - 24, 16, 5, color);
      drawPixelDisc(x, baseY - fountainTall - 1, 6, color);
      if (type === "merkurbrunnen") {
        fillBox(x - 1, baseY - fountainTall - 12, 3, 10, color);
        fillBox(x - 4, baseY - fountainTall - 14, 9, 3, color);
        fillBox(x + 3, baseY - fountainTall - 11, 2, 8, color);
      } else if (type === "herkulesbrunnen") {
        fillBox(x - 5, baseY - fountainTall - 9, 10, 8, color);
        fillBox(x - 7, baseY - fountainTall - 12, 4, 5, color);
        fillBox(x + 3, baseY - fountainTall - 12, 4, 5, color);
        fillBox(x - 1, baseY - fountainTall - 15, 3, 4, color);
      } else {
        fillBox(x - 4, baseY - fountainTall - 10, 8, 9, color);
        fillBox(x - 6, baseY - fountainTall - 13, 12, 4, color);
        fillBox(x - 1, baseY - fountainTall - 18, 3, 5, color);
      }
      fillBox(x - 3, baseY - 6, 2, 6, "rgba(200,226,232,0.6)");
      fillBox(x + 2, baseY - 6, 2, 6, "rgba(200,226,232,0.6)");
    } else if (type === "obelisk") {
      // Elias-Holl-Obelisk auf dem Rathausplatz (1968) – nicht auf dem
      // Königsplatz, dort steht er nicht.
      fillBox(x - 14, baseY - 6, 28, 7, color);
      fillBox(x - 10, baseY - 11, 20, 5, color);
      fillBox(x - 6, baseY - 15, 12, 4, color);
      for (var ob = 0; ob < 16; ob += 1) {
        var obWidth = Math.max(2, 8 - Math.floor(ob / 2));
        fillBox(x - Math.floor(obWidth / 2), baseY - 16 - ob * 4, obWidth, 4, color);
      }
      fillBox(x - 1, baseY - 84, 3, 6, light);
      fillBox(x - 3, baseY - 86, 7, 3, light);
    } else if (type === "zeug") {
      // Zeughaus am Zeugplatz (Elias Holl, 1602–07): langer Bau mit
      // großem Rundbogenportal und geschwungenem Giebel.
      fillBox(x - 62, baseY - 32, 124, 33, color);
      fillBox(x - 64, baseY - 35, 128, 4, light);
      fillBox(x - 18, baseY - 46, 36, 12, color);
      fillBox(x - 14, baseY - 52, 28, 7, color);
      fillBox(x - 8, baseY - 58, 16, 7, color);
      fillBox(x - 3, baseY - 63, 6, 6, color);
      for (var zeugCol = 0; zeugCol < 5; zeugCol += 1) {
        fillBox(x - 56 + zeugCol * 24, baseY - 26, 8, 10, light);
        fillBox(x - 56 + zeugCol * 24, baseY - 12, 8, 11, light);
      }
      fillBox(x - 16, baseY - 22, 32, 23, color);
      drawPixelDisc(x, baseY - 22, 16, color);
      fillBox(x - 13, baseY - 20, 26, 21, light);
      fillBox(x - 13, baseY - 6, 26, 2, color);
    } else if (type === "fuggerhaeuser") {
      // Fuggerhäuser in der Maximilianstraße: hohe Renaissancehäuser
      // mit steilen Dächern und Staffelgiebeln.
      for (var fh = 0; fh < 3; fh += 1) {
        var fhx = x - 48 + fh * 34;
        var fhTop = baseY - (fh === 1 ? 58 : 48);
        fillBox(fhx, fhTop, 28, baseY - fhTop, color);
        fillBox(fhx - 2, fhTop, 32, 3, light);
        for (var fhStep = 0; fhStep < 4; fhStep += 1) {
          fillBox(fhx + 4 + fhStep * 2, fhTop - 7 - fhStep * 4, 20 - fhStep * 4, 4, color);
        }
        for (var fhRow = 0; fhRow < 3; fhRow += 1) {
          for (var fhCol = 0; fhCol < 2; fhCol += 1) {
            fillBox(fhx + 5 + fhCol * 12, fhTop + 9 + fhRow * 11, 7, 6, light);
          }
        }
        fillBox(fhx + 11, baseY - 10, 7, 11, light);
      }
    } else if (type === "hoherweg") {
      // Hoher Weg / Domviertel: enge Altstadthäuser, teils Fachwerk.
      for (var hw = 0; hw < 4; hw += 1) {
        var hwx = x - 50 + hw * 26;
        var hwTop = baseY - 26 - (hw % 3) * 6;
        fillBox(hwx, hwTop, 22, baseY - hwTop, color);
        fillBox(hwx - 1, hwTop - 6, 24, 7, color);
        fillBox(hwx + 4, hwTop - 10, 14, 5, color);
        fillBox(hwx + 3, hwTop + 6, 6, 6, light);
        fillBox(hwx + 13, hwTop + 6, 6, 6, light);
        fillBox(hwx + 3, hwTop + 17, 6, 6, light);
        fillBox(hwx + 13, hwTop + 17, 6, 6, light);
      }
    } else {
      // Ersatzkulisse: schlichte Altstadtzeile.
      for (var fallbackHouse = 0; fallbackHouse < 3; fallbackHouse += 1) {
        var fx = x - 42 + fallbackHouse * 30;
        fillBox(fx, baseY - 34, 26, 35, color);
        fillBox(fx - 2, baseY - 38, 30, 5, color);
        fillBox(fx + 4, baseY - 26, 6, 7, light);
        fillBox(fx + 16, baseY - 26, 6, 7, light);
        fillBox(fx + 4, baseY - 14, 6, 7, light);
        fillBox(fx + 16, baseY - 14, 6, 7, light);
      }
    }
    ctx.restore();
  }

  function drawLandmarks() {
    var level = state.level;
    if (!level || !state.colors) {
      return;
    }
    var sequence = LANDMARK_SEQUENCE[level.id] || LANDMARK_SEQUENCE.hbf;
    var offset = state.camera * 0.22;
    var spacing = 210;
    var startSlot = Math.floor((offset - spacing) / spacing);
    var endSlot = startSlot + Math.ceil(W / spacing) + 3;
    var colors = state.colors;
    for (var slot = startSlot; slot <= endSlot; slot += 1) {
      var x = slot * spacing - offset + 210;
      var type = sequence[mod(slot, sequence.length)];
      ctx.globalAlpha = 0.92;
      // Kulisse in Dunstfarbe: die echten Gebäude stehen weit hinten.
      drawLandmark(
        type,
        x,
        203 - hash01(slot * 17 + level.num) * 3,
        rgb(mixRgb(colors.landmark, colors.farCity, 0.45)),
        rgb(mixRgb(colors.landmarkLight, colors.skyBottom, 0.35))
      );
      ctx.globalAlpha = 1;
    }
  }

  function drawTree(x, base, scale, color, light) {
    var s = scale || 1;
    fillBox(x - 1 * s, base - 12 * s, 2 * s, 12 * s, "rgba(43,38,30,0.82)");
    ctx.globalAlpha = 0.9;
    fillBox(x - 7 * s, base - 20 * s, 14 * s, 9 * s, color);
    fillBox(x - 5 * s, base - 26 * s, 10 * s, 8 * s, color);
    fillBox(x - 3 * s, base - 31 * s, 6 * s, 6 * s, color);
    fillBox(x - 5 * s, base - 28 * s, 3 * s, 3 * s, light);
    fillBox(x + 1 * s, base - 23 * s, 3 * s, 2 * s, light);
    ctx.globalAlpha = 1;
  }

  function drawDistrictSignature() {
    var level = state.level;
    var colors = state.colors;
    if (!level || !colors) {
      return;
    }
    var signature = districtFor(level).signature;
    var offset = state.camera * 0.2;
    var baseY = 208;
    var dark = rgb(colors.landmark);
    var light = rgb(colors.landmarkLight);

    if (signature === "station") {
      // Hauptbahnhof: große Bahnhofshalle, Gleise und ein einfahrender Zug.
      var sx = mod(180 - offset, 760) - 180;
      fillBox(sx - 120, baseY - 54, 240, 56, dark);
      fillBox(sx - 132, baseY - 49, 264, 6, light);
      fillBox(sx - 110, baseY - 62, 220, 9, "rgba(44,70,84,0.72)");
      for (var roofRib = -100; roofRib < 110; roofRib += 22) {
        fillBox(sx + roofRib, baseY - 60, 2, 8, light);
      }
      fillBox(sx - 74, baseY - 26, 148, 5, "rgba(255,240,196,0.28)");
      for (var win = 0; win < 8; win += 1) {
        fillBox(sx - 86 + win * 22, baseY - 22, 10, 14, "rgba(245,228,170,0.22)");
      }
      // Zug auf den Gleisen.
      var trainX = mod(430 - offset * 0.9, 900) - 260;
      fillBox(trainX, baseY - 12, 110, 12, "#6d777f");
      fillBox(trainX + 3, baseY - 20, 104, 9, "#c3c9c5");
      for (var tw = 0; tw < 7; tw += 1) {
        fillBox(trainX + 8 + tw * 14, baseY - 18, 8, 4, "#3b5666");
      }
      fillBox(trainX + 4, baseY + 1, 104, 2, "rgba(24,30,32,0.55)");
    } else if (signature === "boulevard") {
      // Königsplatz: Warte-Pavillon "Pilz" (1913/14), Thormann-Brunnen (1880)
      // und die Straßenbahn-Oberleitungen. Der Elias-Holl-Obelisk steht am
      // Rathausplatz, nicht hier.
      var ox = mod(260 - offset, 620) - 120;
      // Flaches Pilzdach auf vier dünnen Stützen.
      fillBox(ox - 26, baseY - 38, 64, 3, dark);
      fillBox(ox - 22, baseY - 41, 56, 3, dark);
      fillBox(ox - 14, baseY - 44, 40, 3, dark);
      fillBox(ox - 18, baseY - 35, 2, 28, dark);
      fillBox(ox - 2, baseY - 35, 2, 28, dark);
      fillBox(ox + 16, baseY - 35, 2, 28, dark);
      fillBox(ox + 30, baseY - 35, 2, 28, dark);
      fillBox(ox - 20, baseY - 24, 52, 2, "rgba(232,226,208,0.4)");
      fillBox(ox - 6, baseY - 5, 34, 4, light);
      for (var wire = 0; wire < 2; wire += 1) {
        fillBox(sx0(offset) + wire * 3, 172 + wire * 7, 480, 1, "rgba(35,45,48,0.4)");
      }
      var fountainX = ox + 150;
      fillBox(fountainX - 28, baseY - 8, 56, 10, light);
      fillBox(fountainX - 24, baseY - 20, 48, 12, "rgba(86,142,154,0.62)");
      fillBox(fountainX - 22, baseY - 24, 44, 4, "rgba(164,216,220,0.5)");
      fillBox(fountainX - 2, baseY - 34, 4, 12, "rgba(164,216,220,0.5)");
    } else if (signature === "capital" || signature === "rathaus") {
      var rx = mod(300 - offset, 680) - 120;
      ctx.globalAlpha = 0.75;
      drawLandmark("rathaus", rx, baseY, dark, light);
      ctx.globalAlpha = 1;
      for (var b = 0; b < 3; b += 1) {
        drawTree(rx + 190 + b * 54, baseY + 2, 1, "rgba(52,84,62,0.8)", "rgba(93,128,78,0.8)");
      }
    } else if (signature === "dom") {
      var dx = mod(280 - offset, 720) - 80;
      ctx.globalAlpha = 0.78;
      drawLandmark("dom", dx, baseY, dark, light);
      ctx.globalAlpha = 1;
      drawTree(dx - 230, baseY + 2, 1.2, "rgba(52,84,62,0.8)", "rgba(93,128,78,0.8)");
      drawTree(dx + 245, baseY + 2, 1.1, "rgba(52,84,62,0.8)", "rgba(93,128,78,0.8)");
    } else if (signature === "fuggerei") {
      var fx = mod(220 - offset, 560) - 80;
      ctx.globalAlpha = 0.72;
      drawLandmark("fuggerei", fx, baseY, dark, light);
      drawLandmark("fuggerei", fx + 250, baseY, dark, light);
      ctx.globalAlpha = 1;
    } else if (signature === "canal") {
      // Lechkanäle: Ufermauer, Bögen und Schilf.
      fillBox(0, 236, W, 34, "rgba(46,105,120,0.46)");
      var bridgeX = mod(140 - offset, 440) - 100;
      fillBox(bridgeX - 60, 226, 120, 10, light);
      fillBox(bridgeX - 48, 236, 12, 15, "rgba(32,58,62,0.55)");
      fillBox(bridgeX - 6, 236, 12, 15, "rgba(32,58,62,0.55)");
      fillBox(bridgeX + 36, 236, 12, 15, "rgba(32,58,62,0.55)");
      for (var reed = 0; reed < 9; reed += 1) {
        var rx2 = mod(reed * 79 - offset * 1.2, W + 50) - 25;
        fillBox(rx2, 244, 1, 8, "rgba(108,142,88,0.58)");
        fillBox(rx2 + 2, 246, 1, 6, "rgba(132,160,98,0.48)");
      }
    } else if (signature === "zeughaus") {
      var zx = mod(250 - offset, 640) - 90;
      fillBox(zx - 95, baseY - 38, 190, 40, dark);
      fillBox(zx - 88, baseY - 48, 176, 12, light);
      fillBox(zx - 8, baseY - 90, 16, 46, dark);
      fillBox(zx - 12, baseY - 96, 24, 8, light);
      fillBox(zx - 5, baseY - 104, 10, 9, dark);
      for (var crenel = -80; crenel < 84; crenel += 20) {
        fillBox(zx + crenel, baseY - 52, 9, 6, dark);
      }
      for (var gun = 0; gun < 4; gun += 1) {
        fillBox(zx + 38 + gun * 15, baseY - 28, 10, 3, "#2c2a25");
      }
    } else if (signature === "park") {
      // Sheridan-Park: Baumreihen, Wiese und ein kleiner See.
      fillBox(0, 238, W, 32, "rgba(87,116,70,0.44)");
      for (var tree = 0; tree < 6; tree += 1) {
        var tx = mod(tree * 113 - offset * 0.9, W + 100) - 50;
        drawTree(tx, 240, 1.1 + hash01(tree + 2) * 0.7, "rgba(52,84,62,0.82)", "rgba(103,138,84,0.82)");
      }
      fillBox(0, 252, W, 18, "rgba(64,116,130,0.34)");
      for (var parkGlint = 0; parkGlint < 8; parkGlint += 1) {
        fillBox(mod(parkGlint * 71 - offset, W + 30) - 15, 258 + (parkGlint % 3) * 3, 14, 1, "rgba(174,226,226,0.32)");
      }
    }
  }

  function sx0(offset) {
    return mod(-offset, 480);
  }

  function drawBackdrop() {
    var colors = state.colors;
    if (!colors) {
      return;
    }
    var skyNow = state.skyNow || { top: colors.skyTop, bottom: colors.skyBottom };
    var night = state.nightFactor || 0;
    var sunset = state.sunsetFactor || 0;
    var sky = cachedGradient(skyBucket(), function () {
      var gradient = ctx.createLinearGradient(0, 0, 0, H * 0.82);
      gradient.addColorStop(0, rgb(skyNow.top));
      gradient.addColorStop(0.62, rgb(skyNow.bottom));
      gradient.addColorStop(1, rgb(mixRgb(skyNow.bottom, mixRgb([243, 219, 174], [28, 36, 58], night), 0.3)));
      return gradient;
    });
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sterne tauchen mit der Dämmerung auf.
    if (night > 0.06) {
      for (var star = 0; star < 56; star += 1) {
        var starX = Math.round(hash01(star * 73 + 11) * W);
        var starY = Math.round(hash01(star * 97 + 29) * 118) + 3;
        var twinkle = 0.55 + 0.45 * Math.sin(state.worldTime * (1.1 + hash01(star + 5) * 2.2) + star * 1.7);
        ctx.globalAlpha = night * (0.22 + twinkle * 0.62) * (0.35 + hash01(star + 8) * 0.65);
        fillBox(starX, starY, hash01(star + 3) > 0.86 ? 2 : 1, 1, "#eaf2ff");
      }
      ctx.globalAlpha = 1;
    }

    // Sonne und Mond wandern auf einem Bogen über den Himmel.
    var horizon = 156;
    var elevation = state.sunElevation || 0;
    if (elevation > -0.14) {
      var dayProgress = clamp((state.dayTime - 0.25) / 0.5, 0, 1);
      var sunX = W * 0.08 + dayProgress * W * 0.84;
      var sunY = horizon - Math.sin(dayProgress * Math.PI) * 112;
      var sunAlpha = clamp((elevation + 0.14) * 4, 0, 1);
      ctx.globalAlpha = 0.14 * sunAlpha;
      drawPixelDisc(sunX, sunY, 31, rgb(colors.sun));
      ctx.globalAlpha = 0.2 * sunAlpha;
      drawPixelDisc(sunX, sunY, 23, rgb(colors.sun));
      ctx.globalAlpha = sunAlpha;
      drawPixelDisc(sunX, sunY, 14, "#fff2bf");
      drawPixelDisc(sunX - 3, sunY - 3, 9, "#fff9dc");
      ctx.globalAlpha = 1;
    }
    if (elevation < 0.14) {
      var moonProgress = clamp(((state.dayTime - 0.75 + 1) % 1) / 0.5, 0, 1);
      var moonX = W * 0.08 + moonProgress * W * 0.84;
      var moonY = horizon - Math.sin(moonProgress * Math.PI) * 104;
      var moonAlpha = clamp((-elevation + 0.14) * 4, 0, 1);
      ctx.globalAlpha = 0.16 * moonAlpha;
      drawPixelDisc(moonX, moonY, 26, "#b9ccf2");
      ctx.globalAlpha = 0.92 * moonAlpha;
      drawPixelDisc(moonX, moonY, 15, "#e8eeff");
      drawPixelDisc(moonX + 4, moonY - 2, 12, "#f7faff");
      ctx.globalAlpha = 0.3 * moonAlpha;
      drawPixelDisc(moonX - 3, moonY + 2, 3, "#b9c6e4");
      drawPixelDisc(moonX + 5, moonY - 5, 2, "#c3cfe9");
      ctx.globalAlpha = 1;
    }

    var cloudBase = mixRgb(colors.cloud, [32, 40, 64], night * 0.82);
    cloudBase = mixRgb(cloudBase, [255, 178, 132], sunset * 0.32);
    var cloudShade = mixRgb(cloudBase, skyNow.top, 0.25);
    var cloudScroll = state.camera * 0.05 + state.worldTime * 2.2;
    for (var cloud = 0; cloud < 6; cloud += 1) {
      var cloudX = mod(cloud * 151 - cloudScroll + 20, W + 190) - 95;
      var cloudY = 25 + hash01(cloud + 12) * 76;
      ctx.globalAlpha = (0.56 + hash01(cloud + 2) * 0.24) * (1 - night * 0.42);
      drawCloud(
        cloudX,
        cloudY,
        0.72 + hash01(cloud + 8) * 0.72,
        rgb(cloudBase),
        rgb(cloudShade)
      );
    }
    ctx.globalAlpha = 1;

    // Ein paar sanfte Bergrücken am Horizont.
    drawAlps();

    // Ganz schlicht: Himmel, Sonne/Mond, Sterne und ein paar Wolken.
    // Die Häuserzeile und die Straße kommen erst in der Spielwelt.
  }

  function drawFacadeTexture(left, top, width, bottom, material, seed) {
    var right = left + width;
    var i;
    var x;
    var y;
    if (material === "brick") {
      for (y = top + 12; y < bottom; y += 7) {
        fillBox(left + 2, y, width - 4, 1, "rgba(64,40,30,0.14)");
        var brickOffset = (((y - top) / 7) | 0) % 2 === 0 ? 0 : 6;
        for (x = left + 4 + brickOffset; x < right - 4; x += 13) {
          fillBox(x, y + 1, 1, 5, "rgba(64,40,30,0.1)");
        }
      }
    } else if (material === "stone") {
      for (y = top + 12; y < bottom; y += 9) {
        fillBox(left + 2, y, width - 4, 1, "rgba(54,48,39,0.15)");
        var stoneOffset = (((y - top) / 9) | 0) % 2 === 0 ? 0 : 8;
        for (x = left + 5 + stoneOffset; x < right - 4; x += 16) {
          fillBox(x, y + 1, 1, 7, "rgba(54,48,39,0.09)");
        }
      }
      for (y = top + 12; y < bottom; y += 14) {
        fillBox(left + 1, y, 4, 5, "rgba(255,248,226,0.09)");
        fillBox(right - 5, y + 7, 4, 5, "rgba(255,248,226,0.09)");
      }
    } else if (material === "timber") {
      for (i = 0; i < Math.max(3, Math.floor(width / 14)); i += 1) {
        var grainX = left + 4 + Math.floor(hash01(seed + i * 11) * Math.max(1, width - 8));
        var grainY = top + 12 + Math.floor(hash01(seed + i * 17 + 3) * Math.max(1, bottom - top - 22));
        ctx.globalAlpha = 0.055;
        fillBox(grainX, grainY, 1, 4, "#5c4633");
      }
      ctx.globalAlpha = 1;
    } else {
      for (i = 0; i < Math.max(4, Math.floor(width / 6)); i += 1) {
        var speckX = left + 4 + Math.floor(hash01(seed + i * 7) * Math.max(1, width - 8));
        var speckY = top + 14 + Math.floor(hash01(seed + i * 13 + 2) * Math.max(1, bottom - top - 26));
        var speckW = 1 + Math.floor(hash01(seed + i * 17 + 5) * 3);
        var speckH = 1 + Math.floor(hash01(seed + i * 19 + 9) * 2);
        ctx.globalAlpha = 0.045 + hash01(seed + i * 23 + 11) * 0.055;
        fillBox(speckX, speckY, speckW, speckH, i % 3 === 0 ? "#fff7dc" : "#2c2a24");
      }
      ctx.globalAlpha = 1;
      for (y = top + 18; y < bottom; y += 29) {
        fillBox(left + 3, y, width - 6, 1, "rgba(255,250,230,0.07)");
        fillBox(left + 3, y + 1, width - 6, 1, "rgba(22,22,20,0.05)");
      }
    }

    // Cracks, damp corners and weather streaks add texture at close range.
    var crackCount = Math.max(1, Math.floor(width / 44));
    for (i = 0; i < crackCount; i += 1) {
      var crackX = left + 6 + Math.floor(hash01(seed + i * 61) * Math.max(1, width - 12));
      var crackY = top + 18 + Math.floor(hash01(seed + i * 67) * Math.max(1, bottom - top - 42));
      ctx.globalAlpha = 0.085;
      for (var crackStep = 0; crackStep < 4; crackStep += 1) {
        fillBox(crackX + crackStep, crackY + crackStep * 2, 1, 2, "#2b251d");
        if (crackStep % 2 === 0) {
          fillBox(crackX - 1 + crackStep, crackY + crackStep * 2 + 2, 1, 1, "#2b251d");
        }
      }
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < 2; i += 1) {
      var dampX = i === 0 ? left + 8 : right - 12;
      ctx.globalAlpha = 0.05;
      fillBox(dampX, top + 20, 4, bottom - top - 30, "#22302a");
      ctx.globalAlpha = 1;
    }

    // Edges and base get a little dirt so the facades do not look printed on.
    fillBox(left + 2, top + 8, 3, bottom - top - 8, "rgba(15,22,22,0.08)");
    fillBox(right - 5, top + 8, 3, bottom - top - 8, "rgba(15,22,22,0.1)");
    fillBox(left + 1, bottom - 11, width - 2, 11, "rgba(23,25,23,0.12)");
  }

  function drawFacadeWindow(wx, wy, ww, wh, options) {
    var trim = options.trim || "#f0dfbf";
    var lit = Boolean(options.lit);
    fillBox(wx - 1, wy - 1, ww + 2, wh + 2, "rgba(28,29,26,0.68)");
    fillBox(wx, wy, ww, wh, lit ? "#efc979" : "#355361");
    fillBox(wx, wy, ww, 2, lit ? "#ffe7a4" : "#648596");
    fillBox(
      wx + 1,
      wy + 2,
      Math.max(1, ww - 3),
      Math.max(1, wh - 4),
      lit ? "rgba(255,222,145,0.32)" : "rgba(23,48,58,0.28)"
    );
    fillBox(wx + Math.floor(ww / 2), wy, 1, wh, "rgba(20,26,27,0.6)");
    fillBox(wx, wy + Math.floor(wh * 0.55), ww, 1, "rgba(20,26,27,0.5)");
    fillBox(wx - 2, wy + wh, ww + 4, 2, trim);
    fillBox(wx - 1, wy + wh + 2, ww + 2, 1, "rgba(25,25,22,0.28)");
    fillBox(wx - 1, wy - 3, ww + 2, 1, "rgba(255,249,226,0.22)");

    // Glass reflection and a hint of curtains behind the panes.
    fillBox(wx + 1, wy + 3, Math.max(1, ww - 2), 1, lit ? "rgba(255,255,225,0.28)" : "rgba(215,242,250,0.16)");
    fillBox(wx + 2, wy + 4, 1, Math.max(1, wh - 6), "rgba(235,250,255,0.12)");
    if (options.curtain) {
      fillBox(wx + 1, wy + 1, 2, wh - 2, "rgba(238,228,200,0.22)");
      fillBox(wx + ww - 3, wy + 1, 2, wh - 2, "rgba(238,228,200,0.18)");
      fillBox(wx + 1, wy + 1, ww - 2, 1, "rgba(70,55,40,0.28)");
    }

    if (options.shutters) {
      var shutter = options.shutter || "#3e6258";
      if (options.closed) {
        fillBox(wx, wy, ww, wh, shutter);
        for (var slat = wy + 1; slat < wy + wh; slat += 3) {
          fillBox(wx, slat, ww, 1, "rgba(18,29,27,0.25)");
        }
        fillBox(wx + Math.floor(ww / 2), wy, 1, wh, "rgba(18,29,27,0.35)");
      } else {
        fillBox(wx - 4, wy - 1, 3, wh + 2, shutter);
        fillBox(wx + ww + 1, wy - 1, 3, wh + 2, shutter);
        for (var slatLine = wy + 1; slatLine < wy + wh; slatLine += 4) {
          fillBox(wx - 4, slatLine, 3, 1, "rgba(16,27,25,0.24)");
          fillBox(wx + ww + 1, slatLine, 3, 1, "rgba(16,27,25,0.24)");
        }
      }
    }

    if (options.flowers) {
      fillBox(wx - 1, wy + wh - 1, ww + 2, 3, "#5a3827");
      fillBox(wx + 1, wy + wh - 3, 2, 3, "#6f9d54");
      fillBox(wx + 4, wy + wh - 2, 2, 2, "#78a957");
      fillBox(wx + Math.max(1, ww - 3), wy + wh - 3, 2, 3, "#b65b43");
    }
  }

  // Schilder und Markisen der Häuser bleiben bewusst in gedeckten Farben.
  // Kein kräftiges Rot mehr an den Fassaden.
  var SHOP_SIGN_COLORS = ["#2f5d62", "#3b5f7a", "#566345", "#7a6a3e", "#4d5666", "#6a563e"];

  function shopSignColor(seed) {
    var index = Math.floor(hash01(seed) * SHOP_SIGN_COLORS.length);
    return SHOP_SIGN_COLORS[index % SHOP_SIGN_COLORS.length];
  }

  function drawFacadeDoor(x, baseY, width, height, trim, accent, seed, simple) {
    fillBox(x - 3, baseY - height - 2, width + 6, height + 3, "rgba(28,25,21,0.62)");
    fillBox(x, baseY - height, width, height, "#5a3b27");
    fillBox(x + 1, baseY - height + 1, width - 2, height - 2, "#7b4f32");
    var panelHeight = Math.max(4, Math.floor((height - 8) / 2));
    fillBox(x + 2, baseY - height + 3, width - 4, panelHeight, "#5f3d28");
    fillBox(x + 2, baseY - height + 5 + panelHeight, width - 4, Math.max(3, height - panelHeight - 10), "#5f3d28");
    fillBox(x + 1, baseY - height - 4, width - 2, 3, "#c6a56b");
    fillBox(x + 1, baseY - height - 4, width - 2, 1, "#f2d795");
    fillBox(x + width - 3, baseY - Math.floor(height * 0.48), 1, 2, "#f2c14e");
    fillBox(x - 3, baseY, width + 6, 2, trim);
    fillBox(x - 1, baseY + 2, width + 2, 1, "rgba(22,23,21,0.22)");

  }

  function drawShopFront(x, baseY, width, seed, trim, accent) {
    var height = 21;
    var top = baseY - height;
    var night = state.nightFactor || 0;
    fillBox(x - 2, top - 2, width + 4, height + 4, "rgba(26,24,21,0.6)");
    fillBox(x, top, width, height, "#c9a35d");
    if (night > 0.05) {
      ctx.globalAlpha = 0.2 + night * 0.34;
      fillBox(x + 1, top + 3, width - 2, height - 4, "#ffd27a");
      ctx.globalAlpha = 1;
    }
    fillBox(x, top, width, 3, "#efd28a");
    fillBox(x, top + 3, width, height - 3, "rgba(255,226,151,0.32)");
    fillBox(x + 2, top + 3, 1, height - 4, "rgba(255,255,255,0.2)");
    fillBox(x + 3, top + 4, Math.max(2, width - 10), 1, "rgba(255,255,255,0.08)");

    // Goods in the window: small, abstract silhouettes.
    for (var item = 0; item < 4; item += 1) {
      var ix = x + 4 + Math.floor(hash01(seed + item * 5) * Math.max(1, width - 10));
      var ih = 3 + Math.floor(hash01(seed + item * 7 + 2) * 7);
      fillBox(ix, baseY - 4 - ih, 2, ih, item % 2 === 0 ? "#6e5236" : "#8e6a3e");
      fillBox(ix - 1, baseY - 5 - ih, 4, 1, item % 2 === 0 ? "#d7c18a" : "#c4ad76");
    }
    fillBox(x + Math.floor(width / 2), top, 1, height, "rgba(52,44,34,0.65)");
    fillBox(x + width - 8, top + 4, 5, height, "rgba(42,34,27,0.55)");

    var awningY = top - 8;
    fillBox(x - 3, awningY, width + 6, 5, shopSignColor(seed + 3));
    for (var stripe = 0; stripe < width + 6; stripe += 6) {
      fillBox(x - 3 + stripe, awningY, 3, 5, trim);
    }
    fillBox(x - 3, awningY + 5, width + 6, 1, "rgba(20,22,20,0.28)");
    if (night > 0.08) {
      state.nightWindows.push({ x: x + 2, y: top + 2, w: Math.max(2, width - 4), h: height - 4 });
    }
  }

  function streetBuildingHeight(platform, index) {
    var base = Math.round(platform.roofY);
    var levels = clamp(Number(platform.levels) || 3, 2, 9);
    var seed = index * 97 + Math.round(platform.x * 0.17) + (state.level ? state.level.num * 31 : 0);
    var height = 46 + levels * 8 + hash01(seed + 3) * 14;
    if (platform.type === "start" && state.level && state.level.id === "hbf") {
      height = Math.max(height, 132);
    }
    return Math.round(clamp(height, 54, Math.min(148, Math.max(54, base - 10))));
  }

  function streetBuildingTop(platform, index) {
    return Math.round(platform.roofY) - streetBuildingHeight(platform, index);
  }

  // Fassade oberhalb der Straße: Der Junge läuft davor auf dem Asphalt,
  // die Häuser stehen dahinter. So bleibt die Kollisionslinie unverändert.
  function drawStreetFacade(platform, index) {
    var palette = state.palette;
    var district = districtForCurrent();
    var left = Math.round(platform.x);
    var width = Math.round(platform.w);
    var right = left + width;
    var base = Math.round(platform.roofY);
    var top = streetBuildingTop(platform, index);
    var height = base - top;
    var seed = index * 97 + Math.round(platform.x * 0.17) + state.level.num * 31;
    var wall = pickColor(palette.walls, index + state.level.num);
    var trim = palette.trim;
    var accent = palette.accent;
    var material = district.material || "plaster";
    var isStart = platform.type === "start";

    fillBox(left, top, width, height, wall);
    fillBox(left, top, 4, height, "rgba(20,28,28,0.16)");
    fillBox(right - 5, top, 5, height, "rgba(20,28,28,0.2)");
    fillBox(left + 4, top, 1, height, "rgba(255,255,240,0.08)");
    drawFacadeTexture(left, top, width, base, material, seed);

    if (material === "timber") {
      var beam = "rgba(73,52,35,0.5)";
      for (var beamY = top + 20; beamY < base - 12; beamY += 24) {
        fillBox(left + 3, beamY, width - 6, 2, beam);
      }
      for (var beamX = left + 16; beamX < right - 6; beamX += 30) {
        fillBox(beamX, top + 8, 2, base - top - 14, beam);
      }
    }

    // Flaches Gesims statt Dach: die Straße bleibt die Spielfläche.
    fillBox(left - 2, top - 2, width + 4, 3, trim);
    fillBox(left - 2, top - 2, width + 4, 1, "rgba(255,252,232,0.55)");
    fillBox(left, top + 1, width, 1, "rgba(26,26,22,0.28)");
    fillBox(left - 1, top + 2, 1, height - 2, "rgba(20,25,24,0.24)");
    fillBox(right, top + 2, 1, height - 2, "rgba(20,25,24,0.28)");

    if (isStart) {
      fillBox(left + 10, top + 4, width - 20, 1, accent);
      fillBox(left + 10, top + 5, width - 20, 1, "rgba(255,250,230,0.22)");
    }

    // Fenster mit Rahmen, Sprossen, Läden und Blumenkästen.
    var windowWidth = width >= 150 ? 9 : 8;
    var cell = width >= 210 ? 26 : (width >= 130 ? 24 : 22);
    var columns = Math.max(1, Math.floor((width - 20) / cell));
    var usedWidth = (columns - 1) * cell;
    var firstCenter = left + width / 2 - usedWidth / 2;
    var windowTop = top + 16;
    var row = 0;
    var night = state.nightFactor || 0;
    while (windowTop + 12 < base - 34 && row < 10) {
      for (var column = 0; column < columns; column += 1) {
        var wx = Math.round(firstCenter + column * cell - windowWidth / 2);
        var windowSeed = seed + row * 37 + column * 11;
        var closed = hash01(windowSeed + 7) > 0.88;
        var lit = hash01(windowSeed) > (0.8 - night * 0.52);
        drawFacadeWindow(wx, windowTop, windowWidth, 11, {
          trim: trim,
          shutter: palette.shutters,
          lit: lit,
          shutters: hash01(windowSeed + 4) > (material === "timber" ? 0.34 : 0.58),
          closed: closed,
          flowers: hash01(windowSeed + 11) > (material === "timber" ? 0.5 : 0.8),
          curtain: hash01(windowSeed + 13) > 0.76
        });
        if (lit && !closed && night > 0.08) {
          state.nightWindows.push({ x: wx, y: windowTop, w: windowWidth, h: 11 });
        }
      }
      row += 1;
      windowTop += 23;
    }

    // Ladenzeile und Hauseingang auf Straßenhöhe.
    var groundBase = base - 1;
    var doorWidth = width > 150 ? 14 : 11;
    var doorHeight = Math.min(30, height - 12);
    if (doorHeight > 14) {
      var doorX = left + Math.round(width * (hash01(seed + 61) > 0.5 ? 0.62 : 0.24));
      doorX = clamp(doorX, left + 10, right - doorWidth - 10);
      drawFacadeDoor(doorX, groundBase, doorWidth, doorHeight, trim, accent, seed + 67, material === "timber");
      if (material !== "timber" && width >= 124) {
        var shopWidth = Math.min(58, Math.round(width * 0.32));
        var shopX = doorX > left + width * 0.5 ? left + 12 : right - shopWidth - 12;
        if (Math.abs(shopX - doorX) > shopWidth + 8 && shopWidth > 30) {
          drawShopFront(shopX, groundBase, shopWidth, seed + 71, trim, accent);
        }
      }

    }

    // Der Hauptbahnhof bekommt eine echte Bahnhofsfassade: Sandstein,
    // große Glastüren, Vordach und Uhr statt einer gewöhnlichen Ladenzeile.
    if (isStart && state.level.id === "hbf" && width >= 220) {
      var stationX = Math.round(left + width * 0.5);
      var entranceWidth = Math.min(150, Math.round(width * 0.46));
      fillBox(stationX - entranceWidth / 2 - 8, base - 57, entranceWidth + 16, 57, "#c9b48e");
      fillBox(stationX - entranceWidth / 2, base - 51, entranceWidth, 51, "#203a49");
      for (var mullion = 0; mullion < 5; mullion += 1) {
        fillBox(stationX - entranceWidth / 2 + 8 + mullion * (entranceWidth - 16) / 5, base - 50, 3, 50, "#d8c7a3");
      }
      fillBox(stationX - entranceWidth / 2, base - 51, entranceWidth, 3, "#e8d9b7");
      fillBox(stationX - entranceWidth / 2, base - 16, entranceWidth, 16, "rgba(216,231,236,0.22)");
      var stationSignWidth = Math.min(width - 24, entranceWidth + 72);
      fillBox(stationX - stationSignWidth / 2 - 2, base - 70, stationSignWidth + 4, 14, "#1e2a2f");
      fillBox(stationX - stationSignWidth / 2 - 2, base - 70, stationSignWidth + 4, 1, "#f2c14e");
      fillBox(stationX - stationSignWidth / 2 - 2, base - 57, stationSignWidth + 4, 1, "#f2c14e");
      ctx.save();
      ctx.font = "bold 8px 'Trebuchet MS', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff6d8";
      ctx.fillText("HAUPTBAHNHOF", stationX, base - 62);
      ctx.restore();
      drawPixelDisc(stationX, base - 88, 9, "#2b3538");
      drawPixelDisc(stationX, base - 88, 7, "#f0e5c6");
      fillBox(stationX - 1, base - 92, 2, 4, "#2b3538");
      fillBox(stationX, base - 89, 3, 1, "#2b3538");
      fillBox(stationX - entranceWidth / 2 - 16, base - 10, entranceWidth + 32, 3, "#e8dcbc");
      fillBox(stationX - entranceWidth / 2 - 16, base - 7, entranceWidth + 32, 1, "rgba(28,32,30,0.28)");
    }

    // Fallrohr bis zur Straßenkante.
    if (width > 72) {
      var pipe = "rgba(43,58,57,0.4)";
      fillBox(left + 8, top + 4, 2, height - 6, pipe);
      fillBox(left + width - 10, top + 4, 2, height - 6, pipe);
      fillBox(left + 8, top + 4, 1, height - 6, "rgba(194,205,196,0.24)");
      fillBox(left + width - 10, top + 4, 1, height - 6, "rgba(194,205,196,0.24)");
    }
  }

  function buildingCacheEntry(building, index) {
    state.buildingCache = state.buildingCache || {};
    if (state.buildingCache[index]) {
      return state.buildingCache[index];
    }
    var pad = 16;
    var left = Math.round(building.x);
    var top = streetBuildingTop(building, index);
    var cacheWidth = Math.round(building.w) + pad * 2;
    var cacheHeight = STREET_Y + 10 - (top - pad);
    if (cacheWidth <= 0 || cacheHeight <= 0) {
      return null;
    }
    var cacheCanvas = document.createElement("canvas");
    cacheCanvas.width = cacheWidth;
    cacheCanvas.height = cacheHeight;
    var cacheCtx = cacheCanvas.getContext("2d");
    if (!cacheCtx) {
      return null;
    }
    cacheCtx.imageSmoothingEnabled = false;
    var mainCtx = ctx;
    ctx = cacheCtx;
    cacheCtx.translate(-(left - pad), -(top - pad));
    try {
      drawStreetFacade(building, index);
    } finally {
      ctx = mainCtx;
    }
    var entry = { canvas: cacheCanvas, x: left - pad, y: top - pad };
    state.buildingCache[index] = entry;
    return entry;
  }

  function drawBuildingRows() {
    var level = state.level;
    if (!level) {
      return;
    }
    var buildings = level.buildings || [];
    var viewLeft = state.camera - 160;
    var viewRight = state.camera + W + 160;
    for (var i = 0; i < buildings.length; i += 1) {
      var building = buildings[i];
      if (building.x + building.w < viewLeft || building.x > viewRight) {
        continue;
      }
      var cache = buildingCacheEntry(building, i);
      if (cache) {
        ctx.drawImage(cache.canvas, cache.x, cache.y);
      } else {
        drawStreetFacade(building, i);
      }
    }
  }

  function drawCrosswalk(x, base) {
    // Gesicherter Übergang: Zebra nur über die Autospur, dazwischen eine
    // Verkehrsinsel als Wartefläche vor dem Gleis.
    var islandTop = LANE_BOTTOMS[1] - 2;
    var top = LANE_FEET[2] + 3;
    var height = LANE_BOTTOMS[2] - top - 1;
    fillBox(x - 24, islandTop, 48, 4, "rgba(206,201,182,0.75)");
    fillBox(x - 24, islandTop, 48, 1, "rgba(244,240,224,0.6)");
    fillBox(x - 24, islandTop + 4, 48, 1, "rgba(14,20,22,0.35)");
    for (var stripe = 0; stripe < 7; stripe += 1) {
      fillBox(x - 21 + stripe * 7, top, 4, height, "rgba(238,231,207,0.62)");
    }
    // Zwei Ampelmasten mit Gelblicht.
    for (var side = 0; side < 2; side += 1) {
      var poleX = side === 0 ? x - 26 : x + 25;
      fillBox(poleX, LANE_FEET[0] - 22, 1, 22, "#2c3436");
      fillBox(poleX - 1, LANE_FEET[0] - 25, 4, 4, "#242d2f");
      fillBox(poleX, LANE_FEET[0] - 24, 2, 2, "#f2c14e");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Straßenbahn-Linie: Gleise, Schwellen und Oberleitung                */
  /* ------------------------------------------------------------------ */

  function drawTramLine(left, right, laneTop) {
    var railFar = laneTop + 12;
    var railNear = laneTop + 18;
    var width = right - left;

    // Schotterbett und Schwellen.
    fillBox(left, railFar - 3, width, railNear - railFar + 5, "rgba(16,20,22,0.42)");
    for (var sleeper = Math.floor(left / 12) * 12; sleeper < right; sleeper += 12) {
      fillBox(sleeper, railFar - 2, 3, railNear - railFar + 4, "rgba(96,70,46,0.55)");
      fillBox(sleeper, railFar - 2, 3, 1, "rgba(132,100,66,0.4)");
    }

    // Zwei Schienen: Stahlglanz oben, Schatten darunter.
    fillBox(left, railFar - 1, width, 1, "rgba(150,158,156,0.35)");
    fillBox(left, railFar, width, 1, "rgba(226,232,228,0.85)");
    fillBox(left, railFar + 1, width, 1, "rgba(12,16,18,0.5)");
    fillBox(left, railNear - 1, width, 1, "rgba(150,158,156,0.35)");
    fillBox(left, railNear, width, 1, "rgba(240,246,242,0.95)");
    fillBox(left, railNear + 1, width, 1, "rgba(12,16,18,0.55)");

    // Oberleitung: Masten am Fahrbahnrand, zwei Fahrdrähte darüber.
    var wireTop = laneTop - 28;
    var mastStart = Math.floor(left / 300) * 300;
    for (var mast = mastStart; mast < right; mast += 300) {
      fillBox(mast, wireTop + 2, 2, laneTop - wireTop, "rgba(38,46,48,0.55)");
      fillBox(mast - 1, laneTop - 2, 4, 2, "rgba(38,46,48,0.6)");
      fillBox(mast, wireTop + 2, 16, 2, "rgba(38,46,48,0.5)");
      fillBox(mast + 14, wireTop + 2, 2, 4, "rgba(150,158,156,0.45)");
      // Spannseil zum nächsten Mast.
      fillBox(mast + 1, wireTop + 8, 300, 1, "rgba(38,46,48,0.18)");
    }
    fillBox(left, wireTop, width, 1, "rgba(30,38,40,0.42)");
    fillBox(left, wireTop + 4, width, 1, "rgba(30,38,40,0.3)");
  }

  // Reale Sehenswürdigkeiten am Straßenrand. Sie werden – anders als die
  // ferne Kulisse – vorne im Straßenraum gezeichnet, damit man im Vorbeilaufen
  // wirklich etwas von ihnen sieht (mit Namenstafel).
  var STREET_SIGHTS = {
    hbf: [
      { at: 0.14, type: "bahnhofsuhr", label: "HAUPTBAHNHOF 1845" },
      { at: 0.48, type: "pavillon", label: "PILZ 1914" },
      { at: 0.84, type: "brunnen", label: "THORMANN-BRUNNEN 1880" }
    ],
    koenigsplatz: [
      { at: 0.16, type: "brunnen", label: "MERKURBRUNNEN 1599" },
      { at: 0.5, type: "palais", label: "SCHAEZLERPALAIS 1765" },
      { at: 0.82, type: "brunnen", label: "HERKULESBRUNNEN 1602" }
    ],
    rathaus: [
      { at: 0.15, type: "brunnen", label: "AUGUSTUSBRUNNEN 1594" },
      { at: 0.5, type: "obelisk", label: "ELIAS-HOLL-OBELISK" },
      { at: 0.84, type: "haltestelle", label: "RATHAUSPLATZ" }
    ],
    dom: [
      { at: 0.2, type: "brunnen", label: "DOMVIERTEL" },
      { at: 0.66, type: "haltestelle", label: "HOHER WEG" }
    ],
    fuggerei: [
      { at: 0.35, type: "brunnen", label: "FUGGEREIBRUNNEN" },
      { at: 0.72, type: "palais", label: "FUGGEREI 1521" }
    ],
    lechkanaele: [
      { at: 0.3, type: "brunnen", label: "LECHKANAL" },
      { at: 0.7, type: "haltestelle", label: "LECHVIERTEL" }
    ],
    zeughaus: [
      { at: 0.28, type: "palais", label: "ZEUGHAUS 1607" },
      { at: 0.74, type: "brunnen", label: "ZEUGPLATZ" }
    ],
    sheridanpark: [
      { at: 0.4, type: "brunnen", label: "SHERIDAN-PARK" }
    ]
  };

  function drawSightLabel(x, top, label, colors) {
    if (!label) {
      return;
    }
    var width = Math.min(124, 14 + label.length * 4.4);
    ctx.save();
    ctx.font = "bold 5px 'Trebuchet MS', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.92;
    fillBox(x - width / 2, top, width, 11, "rgba(16,30,42,0.84)");
    fillBox(x - width / 2, top, width, 1, "rgba(226,238,240,0.6)");
    ctx.fillStyle = "#e9f2ec";
    ctx.fillText(label.slice(0, 22), x, top + 6);
    ctx.restore();
  }

  function drawSight(type, x, base, label, colors) {
    var stone = "rgba(228,224,206,0.92)";
    var shadow = "rgba(24,32,38,0.35)";
    var top = base;
    if (type === "brunnen") {
      // Achteckiges Brunnenbecken mit Säule und Figur.
      fillBox(x - 22, base - 3, 44, 4, shadow);
      fillBox(x - 20, base - 12, 40, 9, stone);
      fillBox(x - 22, base - 14, 44, 3, "rgba(240,236,220,0.95)");
      fillBox(x - 17, base - 11, 34, 2, "rgba(140,196,208,0.75)");
      fillBox(x - 4, base - 32, 8, 20, stone);
      fillBox(x - 7, base - 24, 14, 3, "rgba(240,236,220,0.9)");
      fillBox(x - 5, base - 37, 10, 6, stone);
      drawPixelDisc(x, base - 41, 4, stone);
      fillBox(x - 1, base - 47, 3, 6, stone);
      fillBox(x - 3, base - 49, 7, 3, stone);
      top = base - 56;
    } else if (type === "obelisk") {
      fillBox(x - 14, base - 5, 28, 6, stone);
      fillBox(x - 10, base - 10, 20, 5, stone);
      for (var step = 0; step < 12; step += 1) {
        var shaft = Math.max(3, 8 - Math.floor(step / 2));
        fillBox(x - Math.floor(shaft / 2), base - 14 - step * 4, shaft, 4, stone);
      }
      fillBox(x - 1, base - 66, 3, 6, "rgba(240,236,220,0.95)");
      top = base - 74;
    } else if (type === "pavillon") {
      // Der flache Warte-Pavillon "Pilz" (Otto Holzer, 1913/14): runde
      // Kragplatte auf vier dünnen Stützen, kein Ballon.
      fillBox(x - 24, base - 3, 48, 4, shadow);
      fillBox(x - 26, base - 34, 52, 3, stone);
      fillBox(x - 22, base - 38, 44, 4, stone);
      fillBox(x - 16, base - 42, 32, 4, "rgba(240,236,220,0.95)");
      fillBox(x - 8, base - 45, 16, 3, "rgba(226,220,200,0.95)");
      fillBox(x - 20, base - 31, 2, 28, stone);
      fillBox(x - 6, base - 31, 2, 28, stone);
      fillBox(x + 8, base - 31, 2, 28, stone);
      fillBox(x + 18, base - 31, 2, 28, "rgba(240,236,220,0.95)");
      fillBox(x - 21, base - 18, 42, 2, "rgba(240,236,220,0.7)");
      fillBox(x - 3, base - 27, 7, 5, "rgba(200,90,60,0.8)");
      top = base - 52;
    } else if (type === "palais") {
      fillBox(x - 26, base - 3, 52, 4, shadow);
      fillBox(x - 24, base - 26, 48, 23, stone);
      fillBox(x - 26, base - 29, 52, 4, "rgba(240,236,220,0.95)");
      fillBox(x - 8, base - 36, 16, 8, stone);
      fillBox(x - 10, base - 39, 20, 3, "rgba(240,236,220,0.95)");
      for (var palaceColumn = 0; palaceColumn < 5; palaceColumn += 1) {
        fillBox(x - 20 + palaceColumn * 10, base - 22, 4, 8, "rgba(96,104,104,0.55)");
        fillBox(x - 20 + palaceColumn * 10, base - 11, 4, 7, "rgba(96,104,104,0.45)");
      }
      top = base - 44;
    } else if (type === "bahnhofsuhr") {
      fillBox(x - 1, base - 34, 3, 34, "#3a4448");
      fillBox(x - 5, base - 38, 11, 11, "#e8e2d0");
      fillBox(x - 4, base - 37, 9, 9, "#f7f2e0");
      fillBox(x, base - 36, 1, 4, "#22303a");
      fillBox(x, base - 33, 3, 1, "#22303a");
      fillBox(x - 8, base - 42, 17, 3, "#3a4448");
      top = base - 48;
    } else {
      // Haltestelle mit Tram-Schild.
      fillBox(x - 1, base - 32, 3, 32, "#3a4448");
      fillBox(x - 9, base - 40, 19, 10, "rgba(214,178,76,0.95)");
      fillBox(x - 8, base - 39, 17, 8, "rgba(232,230,214,0.95)");
      fillBox(x - 6, base - 37, 13, 4, "rgba(70,90,70,0.85)");
      fillBox(x - 3, base - 30, 7, 2, "#3a4448");
      top = base - 48;
    }
    drawSightLabel(x, top - 12, label, colors);
  }

  function drawStreetSights() {
    var level = state.level;
    if (!level) {
      return;
    }
    var sights = STREET_SIGHTS[level.id];
    if (!sights) {
      return;
    }
    var viewLeft = state.camera - 140;
    var viewRight = state.camera + W + 140;
    for (var i = 0; i < sights.length; i += 1) {
      var sight = sights[i];
      var x = Math.round(level.startX + (level.finishX - level.startX) * sight.at);
      if (x < viewLeft || x > viewRight) {
        continue;
      }
      drawSight(sight.type, x, STREET_Y, sight.label, state.colors);
    }
  }

  var MARKET_STALLS = [
    { label: "OBST", awning: ["#b63b2f", "#f2e6c4"], goods: ["#d94a3f", "#e8a92f", "#6f9d54"] },
    { label: "BLUMEN", awning: ["#3f7f4f", "#f2e6c4"], goods: ["#d96c8a", "#f2c14e", "#6f9d54"] },
    { label: "BROT", awning: ["#a8613d", "#f2e6c4"], goods: ["#c68a4a", "#e0b56f", "#8f5a32"] },
    { label: "KAESE", awning: ["#3f6f9f", "#f2e6c4"], goods: ["#e8c14e", "#f4d97a", "#d8a93d"] },
    { label: "MARKT", awning: ["#8a5a3c", "#f2e6c4"], goods: ["#b63b2f", "#6f9d54", "#e0a458"] }
  ];

  function drawMarketStall(x, base, seed, maxWidth) {
    var stall = MARKET_STALLS[Math.floor(hash01(seed) * MARKET_STALLS.length) % MARKET_STALLS.length];
    var width = Math.min(maxWidth || 64, 46 + Math.floor(hash01(seed + 2) * 18));
    width = Math.max(38, width);
    var left = Math.round(x);
    var top = base - 36;
    var wood = "#7a5134";
    var woodDark = "#543521";

    // Zwei Stützen und Theke.
    fillBox(left + 4, top + 10, 3, 26, woodDark);
    fillBox(left + width - 7, top + 10, 3, 26, woodDark);
    fillBox(left + 1, base - 13, width - 2, 5, wood);
    fillBox(left + 1, base - 13, width - 2, 1, "rgba(255,236,194,0.3)");
    fillBox(left + 2, base - 8, width - 4, 6, "rgba(40,26,18,0.35)");

    // Gestreiftes Marktdach.
    for (var stripe = 0; stripe < width + 8; stripe += 8) {
      fillBox(left - 4 + stripe, top, 8, 6, stall.awning[stripe % 16 === 0 ? 0 : 1]);
    }
    fillBox(left - 5, top + 6, width + 10, 2, "rgba(30,24,18,0.28)");
    fillBox(left - 3, top - 2, width + 6, 3, stall.awning[0]);
    fillBox(left - 3, top - 2, width + 6, 1, "rgba(255,250,230,0.35)");

    // Warenkisten mit Obst, Blumen oder Brot.
    for (var crate = 0; crate < 3; crate += 1) {
      var cx = left + 7 + crate * Math.floor((width - 18) / 3);
      fillBox(cx, base - 20, 10, 7, "#6a452c");
      fillBox(cx + 1, base - 19, 8, 2, "#8a5e3a");
      for (var item = 0; item < 3; item += 1) {
        fillBox(cx + 1 + item * 3, base - 20 + (item % 2), 3, 3, stall.goods[(crate + item) % stall.goods.length]);
      }
    }

    // Schild mit Marktname, bewusst groß und kontrastreich.
    var label = stall.label;
    var signWidth = Math.max(24, label.length * 4 + 8);
    var signX = left + Math.round((width - signWidth) / 2);
    fillBox(signX, top - 12, signWidth, 8, "#20282c");
    fillBox(signX, top - 12, signWidth, 1, "#f2e6c4");
    ctx.save();
    ctx.font = "5px 'Lucida Console', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff7dc";
    ctx.fillText(label, signX + signWidth / 2, top - 8);
    ctx.restore();
  }

  function drawStreetMarket() {
    var level = state.level;
    if (!level || !state.colors) {
      return;
    }
    var buildings = (level.buildings || []).slice().sort(function (a, b) {
      return a.x - b.x;
    });
    var viewLeft = state.camera - 120;
    var viewRight = state.camera + W + 120;
    for (var i = 0; i < buildings.length - 1; i += 1) {
      var gapStart = buildings[i].x + buildings[i].w;
      var gapEnd = buildings[i + 1].x;
      var gapWidth = gapEnd - gapStart;
      if (gapWidth < 56) {
        continue;
      }
      var stallWidth = Math.min(64, gapWidth - 12);
      var x = gapStart + (gapWidth - stallWidth) / 2;
      if (x + stallWidth < viewLeft || x > viewRight) {
        continue;
      }
      var seed = Math.round(x) + level.num * 991;
      drawMarketStall(x, STREET_Y, seed, stallWidth);
    }
  }

  function drawStreetLamp(x, base) {
    var night = state.nightFactor || 0;
    fillBox(x - 1, base - 42, 3, 42, "#2a3437");
    fillBox(x, base - 41, 1, 39, "rgba(190,204,196,0.22)");
    fillBox(x - 2, base - 42, 5, 2, "#20282c");
    fillBox(x + 2, base - 43, 11, 2, "#2a3437");
    var lampX = x + 11;
    var lampY = base - 45;
    fillBox(lampX, lampY, 6, 4, night > 0.15 ? "#ffe3a0" : "#cfc9b4");
    fillBox(lampX + 1, lampY + 1, 4, 2, night > 0.15 ? "#fff6cc" : "#e6e0c8");
    fillBox(lampX, lampY + 4, 6, 1, "#20282c");
  }

  // Ein paar hohe Häuser hinter der flachen Häuserzeile. Sie sind sparsam
  // verteilt, damit die Stadt nicht leer wirkt, aber nicht überladen.
  function drawTallSkyline() {
    var level = state.level;
    if (!level) {
      return;
    }
    var night = state.nightFactor || 0;
    var left = Math.round(state.camera) - 160;
    var right = Math.round(state.camera) + W + 160;
    var spacing = 238;
    var base = STREET_Y - 5;
    var startSlot = Math.floor(left / spacing) - 1;
    var endSlot = Math.ceil(right / spacing) + 1;
    var body = mixRgb([88, 108, 132], [22, 30, 48], night * 0.72);
    var bodyDark = mixRgb([64, 80, 100], [16, 22, 36], night * 0.72);
    var roof = mixRgb([52, 65, 82], [14, 20, 34], night * 0.7);

    for (var slot = startSlot; slot <= endSlot; slot += 1) {
      var seed = slot * 733 + level.num * 211;
      var width = 54 + Math.floor(hash01(seed + 1) * 26);
      var x = Math.round(slot * spacing + (hash01(seed + 2) - 0.5) * 20);
      var height = 78 + Math.floor(hash01(seed + 3) * 46);
      var top = base - height;

      ctx.globalAlpha = 0.88;
      fillBox(x, top, width, height, rgb(bodyDark));
      fillBox(x, top, width - 5, height, rgb(body));
      fillBox(x, top, width - 5, 2, "rgba(220,232,244,0.14)");
      fillBox(x - 1, top - 2, width + 1, 2, rgb(roof));

      var cols = width > 70 ? 3 : 2;
      var rows = height > 105 ? 5 : 4;
      var ww = 5;
      var wh = 6;
      var gapX = 8;
      var totalW = cols * ww + (cols - 1) * gapX;
      var startX = x + Math.max(4, Math.floor((width - totalW) / 2));
      var startY = top + 12;
      for (var r = 0; r < rows; r += 1) {
        for (var c = 0; c < cols; c += 1) {
          var wx = startX + c * (ww + gapX);
          var wy = startY + r * (wh + 8);
          var winSeed = seed + r * 17 + c * 31;
          var lit = night > 0.2 && hash01(winSeed + 9) > 0.55;
          fillBox(wx, wy, ww, wh, lit ? "#ffd98a" : "#2b4356");
          if (lit) {
            state.nightWindows.push({ x: wx, y: wy, w: ww, h: wh });
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // Eine einzige, flache Häuserzeile: alle Häuser stehen nebeneinander auf
  // derselben Standlinie, kein Hintereinanderstaffeln und keine Stockwerke.
  function drawSimpleHouses() {
    var level = state.level;
    if (!level) {
      return;
    }
    var palette = state.palette || PALETTES.hbf;
    var walls = palette.walls || ["#e7d6b8"];
    var night = state.nightFactor || 0;
    var base = STREET_Y - 1;
    var left = Math.round(state.camera) - 140;
    var right = Math.round(state.camera) + W + 140;
    var spacing = 104;
    var startSlot = Math.floor(left / spacing) - 1;
    var endSlot = Math.ceil(right / spacing) + 1;

    for (var slot = startSlot; slot <= endSlot; slot += 1) {
      var seed = slot * 311 + level.num * 97;
      var width = 70 + Math.floor(hash01(seed + 1) * 20);
      var x = Math.round(slot * spacing + (hash01(seed + 2) - 0.5) * 8);
      var height = 48 + Math.floor(hash01(seed + 3) * 18);
      var top = base - height;
      var wall = walls[Math.floor(hash01(seed + 4) * walls.length) % walls.length];

      fillBox(x - 1, top - 1, width + 2, height + 2, "rgba(20,24,28,0.18)");
      fillBox(x, top, width, height, wall);
      fillBox(x - 2, top - 4, width + 4, 4, "#4b5157");
      fillBox(x - 2, top - 4, width + 4, 1, "rgba(255,255,245,0.18)");
      fillBox(x, base - 2, width, 2, "rgba(20,24,28,0.16)");

      var doorW = 10;
      var doorX = x + Math.round((width - doorW) / 2);
      fillBox(doorX, base - 17, doorW, 16, "#6b4a2f");
      fillBox(doorX + doorW - 2, base - 10, 1, 2, "#e8c46a");

      var winCount = width > 80 ? 3 : 2;
      var winW = 10;
      var winH = 9;
      var gap = Math.max(6, Math.floor((width - winCount * winW) / (winCount + 1)));
      var startX = x + gap;
      var wy = top + 10;
      for (var w = 0; w < winCount; w += 1) {
        var wx = startX + w * (winW + gap);
        var winSeed = seed + w * 37;
        var lit = night > 0.18 && hash01(winSeed + 7) > 0.32;
        fillBox(wx - 1, wy - 1, winW + 2, winH + 2, "rgba(26,30,32,0.42)");
        fillBox(wx, wy, winW, winH, lit ? "#ffd98a" : "#3f6575");
        fillBox(wx, wy, winW, 1, lit ? "#fff0b5" : "#7fa2ad");
        fillBox(wx + Math.floor(winW / 2), wy, 1, winH, "rgba(24,30,32,0.4)");
        fillBox(wx, wy + Math.floor(winH / 2), winW, 1, "rgba(24,30,32,0.3)");
        if (lit) {
          state.nightWindows.push({ x: wx, y: wy, w: winW, h: winH });
        }
      }

      fillBox(x, base - 1, width, 1, "rgba(255,252,235,0.18)");
    }
  }

  function drawStartStreetSign(level) {
    var names = {
      hbf: "BAHNHOFSTRASSE",
      koenigsplatz: "MAXIMILIANSTRASSE",
      rathaus: "RATHAUSPLATZ",
      dom: "HOHE WEG",
      fuggerei: "FUGGEREISTRASSE",
      lechkanaele: "LECHVIERTEL",
      zeughaus: "ZEUGPLATZ",
      sheridanpark: "SHERIDANWEG"
    };
    var name = names[level.id] || "AUGSBURG";
    var x = Math.max(46, Math.round(level.startX) - 140);
    var base = STREET_Y;
    fillBox(x, base - 46, 2, 46, "#3b4548");
    fillBox(x - 2, base - 48, 6, 3, "#2d3638");
    fillBox(x - 2, base - 64, 64, 16, "#28577d");
    fillBox(x - 2, base - 64, 64, 1, "#e8f0ee");
    fillBox(x - 2, base - 50, 64, 1, "rgba(12,20,24,0.35)");
    ctx.save();
    ctx.font = "bold 6px 'Trebuchet MS', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f1f6f2";
    ctx.fillText(name.slice(0, 15), x + 30, base - 56);
    ctx.restore();
  }

  // Die Straße ist absichtlich schlicht: Gehweg, Asphalt und eine
  // gestrichelte Mittellinie. Mehr braucht die Kulisse nicht.
  function drawContinuousStreet() {
    var level = state.level;
    var colors = state.colors;
    if (!level || !colors) {
      return;
    }
    var base = STREET_Y;
    var left = Math.round(state.camera) - 60;
    var right = Math.round(state.camera) + W + 60;
    var width = right - left;
    var sidewalkHeight = LANE_HEIGHTS[0];
    var roadTop = base + sidewalkHeight;
    var roadDark = rgb(mixRgb(colors.street, [10, 12, 16], 0.3));

    // Gehweg mit schmalem grünem Rand wie im Referenz-Look.
    fillBox(left, base, width, sidewalkHeight, rgb(colors.sidewalk));
    fillBox(left, base, width, 2, "#7fbf4d");
    fillBox(left, base, width, 1, "rgba(214,255,168,0.55)");
    fillBox(left, base + sidewalkHeight - 2, width, 2, rgb(colors.curb));

    // Einfache Fahrbahn
    fillBox(left, roadTop, width, H - roadTop, rgb(colors.street));
    fillBox(left, roadTop, width, 1, "rgba(235,242,238,0.12)");
    fillBox(left, roadTop + 20, width, 1, roadDark);

    // Eine einzige gestrichelte Mittellinie.
    var dashStart = Math.floor(left / 46) * 46;
    ctx.globalAlpha = 0.42;
    for (var dash = dashStart; dash < right; dash += 46) {
      fillBox(dash, roadTop + 21, 20, 2, rgb(colors.streetLine));
    }
    ctx.globalAlpha = 1;

    // Ein einziges Straßenschild, ganz am Anfang der Etappe.
    drawStartStreetSign(level);

    fillBox(left, H - 4, width, 4, "rgba(6,11,14,0.2)");
  }

  function drawProp(prop, index) {
    var x = Math.round(prop.x);
    var platform = platformUnder(x);
    var base = platform ? Math.round(platform.roofY) : Math.round(prop.y) + 16;
    var seed = index * 41 + Math.round(x * 0.13);

    if (prop.type === "chimney") {
      // Straßenlaterne mit warmem Licht.
      fillBox(x - 1, base - 36, 3, 36, "#2f3a3b");
      fillBox(x, base - 35, 1, 34, "rgba(190,204,196,0.3)");
      fillBox(x - 4, base - 2, 9, 2, "rgba(16,24,24,0.28)");
      fillBox(x - 6, base - 36, 7, 2, "#2f3a3b");
      fillBox(x - 7, base - 34, 9, 3, "#f2d38a");
      fillBox(x - 6, base - 33, 7, 1, "#fff4c4");
      ctx.globalAlpha = 0.16 + Math.sin(state.worldTime * 2.4 + index) * 0.03;
      fillBox(x - 13, base - 38, 21, 11, "#f2d38a");
      ctx.globalAlpha = 1;
    } else if (prop.type === "antenna") {
      // Ampel oder Straßenschild.
      fillBox(x - 1, base - 31, 2, 31, "#2c3436");
      fillBox(x - 6, base - 2, 13, 2, "rgba(16,24,24,0.24)");
      fillBox(x - 5, base - 33, 11, 15, "#243033");
      fillBox(x - 4, base - 32, 9, 13, "#39484a");
      var phase = Math.floor((state.worldTime * 1.4 + index) % 3);
      fillBox(x - 2, base - 30, 5, 3, phase === 0 ? "#e4593f" : "#4b2a28");
      fillBox(x - 2, base - 26, 5, 3, phase === 1 ? "#f2c14e" : "#4d4428");
      fillBox(x - 2, base - 22, 5, 3, phase === 2 ? "#7ec47a" : "#2c4430");
      if (hash01(seed + 5) > 0.5) {
        fillBox(x + 5, base - 26, 9, 3, "#e8e2d0");
        fillBox(x + 6, base - 25, 7, 1, "rgba(60,60,54,0.55)");
      }
    } else {
      // Wartehäuschen / Kiosk mit Bank.
      fillBox(x - 11, base - 25, 22, 2, "#3b4747");
      fillBox(x - 10, base - 24, 2, 24, "#3b4747");
      fillBox(x + 8, base - 24, 2, 24, "#3b4747");
      fillBox(x - 11, base - 25, 22, 7, "rgba(160,190,190,0.28)");
      fillBox(x - 8, base - 24, 16, 2, "#e8e2cf");
      fillBox(x - 7, base - 22, 14, 1, "rgba(50,50,44,0.38)");
      fillBox(x - 7, base - 8, 14, 2, "#6b4a2f");
      fillBox(x - 7, base - 6, 1, 5, "#4a3322");
      fillBox(x + 6, base - 6, 1, 5, "#4a3322");
    }
  }

  function drawCoin(nut, index) {
    var bob = Math.sin(state.worldTime * 3.1 + index * 1.7) * 1.6;
    var x = Math.round(nut.x);
    var y = Math.round(nut.y + bob);
    var hidden = Boolean(nut.hidden);
    var spin = Math.sin(state.worldTime * 4.4 + index * 1.3);
    var squash = 0.36 + Math.abs(spin) * 0.64;
    var alpha = hidden && state.player && Math.abs(state.player.x - nut.x) > 74 ? 0.5 : 1;

    ctx.globalAlpha = 0.18 * alpha;
    fillBox(x - 5, Math.round(nut.y + 10 - bob * 0.3), 10, 2, "#101b1e");
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(squash, 1);
    drawPixelDisc(0, 0, 7, "#8a5a14");
    drawPixelDisc(0, 0, 6, "#f2c14e");
    drawPixelDisc(-1, -1, 4, "#ffd96a");
    drawPixelDisc(1, 1, 2, "#e8a92f");
    fillBox(-1, -4, 2, 8, "rgba(168,106,18,0.8)");
    fillBox(1, -3, 1, 6, "rgba(255,248,205,0.55)");
    ctx.restore();

    // Glanz und kleiner Funke.
    if (Math.abs(spin) > 0.72) {
      fillBox(x + Math.round(5 * squash), y - 4, 1, 5, "rgba(255,250,220,0.75)");
      fillBox(x - Math.round(5 * squash), y + 1, 1, 3, "rgba(255,240,180,0.4)");
    }
    if (Math.sin(state.worldTime * 5 + index * 2.2) > 0.82) {
      fillBox(x + 5, y - 7, 1, 3, "#fff6ca");
      fillBox(x + 4, y - 6, 3, 1, "#fff6ca");
    }
    if (hidden) {
      ctx.globalAlpha = 1;
      if (Math.sin(state.worldTime * 4 + index) > 0.5) {
        fillBox(x - 8, y - 10, 1, 3, "rgba(255,246,202,0.55)");
        fillBox(x - 9, y - 9, 3, 1, "rgba(255,246,202,0.55)");
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCheckpoint(checkpoint, index) {
    var x = Math.round(checkpoint.x);
    var ground = Math.round(checkpoint.y);
    var active = index <= state.activeCheckpoint;
    var flagColor = active ? "#f2c14e" : "#5e8199";
    var poleColor = active ? "#54351b" : "#2c3b42";

    fillBox(x - 2, ground - 2, 7, 2, "rgba(15,21,20,0.34)");
    fillBox(x, ground - 30, 2, 30, poleColor);
    fillBox(x - 1, ground - 31, 4, 2, "#e6d5ac");
    fillBox(x + 2, ground - 29, 13, 8, flagColor);
    fillBox(x + 2, ground - 27, 10, 1, active ? "#fff1ba" : "#91b3c6");
    fillBox(x + 2, ground - 24, 7, 1, active ? "#bd7b25" : "#3e5a6d");
    // Kleiner Wimpel
    fillBox(x + 2, ground - 18, 8, 2, active ? "#b63b2f" : "#3e5a6d");
    if (active) {
      ctx.globalAlpha = 0.18 + Math.sin(state.worldTime * 4 + index) * 0.05;
      fillBox(x - 5, ground - 35, 22, 30, "#f2c14e");
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.font = "4px 'Lucida Console', monospace";
    ctx.fillStyle = active ? "#2b1a0a" : "#dceaf1";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(index + 1), x + 8, ground - 28);
    ctx.restore();
  }

  function drawFinishGate() {
    var level = state.level;
    if (!level) {
      return;
    }
    var x = Math.round(level.finishX);
    var base = STREET_Y;
    var top = base - 54;
    fillBox(x - 24, top, 3, 54, "#3a2a1a");
    fillBox(x + 21, top, 3, 54, "#3a2a1a");
    fillBox(x - 24, top, 48, 13, "#f2c14e");
    fillBox(x - 24, top, 48, 1, "#fff1ba");
    fillBox(x - 24, top + 13, 48, 1, "rgba(40,28,12,0.28)");
    ctx.save();
    ctx.font = "bold 7px 'Lucida Console', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2a1909";
    ctx.fillText("ZIEL", x, top + 7);
    ctx.restore();
    for (var col = 0; col < 10; col += 1) {
      fillBox(x - 20 + col * 4, base, 4, 4, col % 2 ? "#f5e9c9" : "#3a3a3a");
    }
  }

  function currentBoyFrame() {
    var player = state.player;
    if (!player) {
      return 0;
    }
    if (state.mode === "intro") {
      if (state.introPlayerAction === "wave") {
        return 11;
      }
      if (state.introPlayerAction === "run") {
        return 2 + Math.floor(player.animTime * 13) % 6;
      }
      return Math.floor(state.worldTime * 2) % 2;
    }
    if (state.mode === "outro") {
      if (state.outroTime < 1.2) {
        return 10;
      }
      return 2 + Math.floor(player.animTime * 13) % 6;
    }
    if (state.bumpTimer > 0) {
      return 9;
    }
    if (!player.onGround) {
      return player.vy < 0 ? 8 : 9;
    }
    if (Math.abs(player.vx) > 0.35) {
      var rate = Math.abs(player.vx) > 2.3 ? 18 : 12;
      return 2 + Math.floor(player.animTime * rate) % 6;
    }
    // Ganz einfacher Zwei-Frame-Idle.
    return Math.floor(state.worldTime * 2) % 2;
  }

  function drawPlayerShadow() {
    var player = state.player;
    if (!player) {
      return;
    }
    var groundY = laneFeet(player.lane);
    var distance = Math.max(0, groundY - (player.y + player.h));
    var scale = clamp(1 - distance / 170, 0.35, 1);
    var width = Math.round(14 * scale);
    var alpha = clamp(0.23 - distance / 700, 0.05, 0.22);
    ctx.globalAlpha = alpha;
    fillBox(player.x - width / 2, groundY - 2, width, 2, "#0a1418");
    if (width > 8) {
      fillBox(player.x - width / 2 + 2, groundY - 3, width - 4, 1, "#0a1418");
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    var player = state.player;
    if (!player || !state.playerVisible || state.playerInCar) {
      return;
    }
    drawPlayerShadow();
    if (state.mode === "dying") {
      var deathFrame = 9;
      var deathWidth = BOY_W;
      var deathHeight = BOY_H;
      var centerX = player.x;
      var centerY = player.y + player.h * 0.5;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(state.deathSpin);
      ctx.globalAlpha = clamp(1 - state.deathTime * 0.28, 0.35, 1);
      if (images.boy.complete && images.boy.naturalWidth) {
        ctx.drawImage(images.boy, deathFrame * BOY_W, 0, BOY_W, BOY_H,
          -deathWidth / 2, -deathHeight / 2, deathWidth, deathHeight);
      } else {
        fillBox(-deathWidth / 2 + 5, -deathHeight / 2 + 5, 14, 22, "#3076b8");
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    var crouching = Boolean(player.crouching);
    var frame = crouching ? 9 : currentBoyFrame();
    var laneOffset = state.laneDrawOffset || 0;
    var visualHeight = crouching ? BOY_H * 0.68 : BOY_H;
    var spriteX = Math.round(player.x - (BOY_W - player.w) / 2);
    var spriteY = Math.round(player.y + player.h - visualHeight + laneOffset);
    var squash = state.landSquash || 0;
    var drawWidth = BOY_W * (1 + squash * 0.12) * (crouching ? 1.08 : 1);
    var drawHeight = visualHeight * (1 - squash * 0.22);
    var drawX = spriteX - (drawWidth - BOY_W) / 2;
    var drawY = spriteY + (visualHeight - drawHeight);

    if (!images.boy.complete || !images.boy.naturalWidth) {
      fillBox(spriteX + 5, spriteY + 4, 14, 12, "#25435d");
      fillBox(spriteX + 7, spriteY + 16, 10, 11, "#3076b8");
      fillBox(spriteX + 8, spriteY, 8, 7, "#e8b07a");
      fillBox(spriteX + 4, spriteY + 27, 6, 3, "#f1e6cf");
      fillBox(spriteX + 14, spriteY + 27, 6, 3, "#f1e6cf");
      return;
    }

    if (player.facing < 0) {
      ctx.save();
      ctx.translate(drawX + drawWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(images.boy, frame * BOY_W, 0, BOY_W, BOY_H, 0, drawY, drawWidth, drawHeight);
      ctx.restore();
    } else {
      ctx.drawImage(images.boy, frame * BOY_W, 0, BOY_W, BOY_H, drawX, drawY, drawWidth, drawHeight);
    }
  }

  function drawBumpEffect() {
    if (!state.player || state.bumpTimer <= 0) {
      return;
    }
    var x = state.player.x + state.bumpDirection * 9;
    var y = state.player.y - 3 - (0.42 - state.bumpTimer) * 18;
    ctx.globalAlpha = clamp(state.bumpTimer * 2.6, 0, 0.9);
    fillBox(x - 5, y, 3, 1, "#ffe28d");
    fillBox(x + 3, y, 3, 1, "#ffe28d");
    fillBox(x, y - 5, 1, 3, "#ffe28d");
    fillBox(x, y + 3, 1, 3, "#ffe28d");
    fillBox(x - 1, y - 1, 3, 3, "#f2c14e");
    fillBox(x, y, 1, 1, "#2a1a0b");
    ctx.globalAlpha = 1;
  }

  function drawCarShadow() {
    var car = state.car;
    var center = car.x + 36;
    var ground = laneTrafficGround(1);
    var distance = Math.max(0, ground - (car.y + 31));
    var scale = clamp(1 - distance / 150, 0.45, 1);
    var width = Math.round(52 * scale);
    ctx.globalAlpha = 0.22;
    fillBox(center - width / 2, ground - 3, width, 3, "#0a1418");
    ctx.globalAlpha = 0.12;
    fillBox(center - width / 2 + 6, ground - 5, width - 12, 2, "#0a1418");
    ctx.globalAlpha = 1;
  }

  function drawCar() {
    var car = state.car;
    if (!car.visible) {
      return;
    }
    drawCarShadow();
    var image = Math.floor(state.worldTime * 17) % 2 === 0 ? images.car : images.carB;
    if (!image.complete || !image.naturalWidth) {
      fillBox(car.x + 4, car.y + 9, 64, 18, "#d8a33c");
      fillBox(car.x + 16, car.y + 4, 32, 8, "#6eb2cc");
      fillBox(car.x + 11, car.y + 25, 12, 6, "#201f26");
      fillBox(car.x + 49, car.y + 25, 12, 6, "#201f26");
      return;
    }
    var bob = car.moving ? Math.round(Math.sin(state.worldTime * 28 + car.x * 0.1) * 0.7) : 0;
    var x = Math.round(car.x);
    var y = Math.round(car.y) + bob;
    if (car.direction < 0) {
      ctx.save();
      ctx.translate(x + 72, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, 72, 32, 0, y, 72, 32);
      ctx.restore();
    } else {
      ctx.drawImage(image, 0, 0, 72, 32, x, y, 72, 32);
    }
  }

  /* ================================================================== */
  /* Passanten und E-Scooter                                             */
  /* ================================================================== */

  function drawPedestrian(npc) {
    var x = Math.round(npc.x);
    var ground = Math.round(npc.y);
    var moving = npc.turnTimer <= 0 && npc.stunned <= 0;
    var gait = moving ? Math.sin(npc.animTime * 7.5 + npc.seed) : 0;
    var bob = moving ? Math.abs(Math.sin(npc.animTime * 7.5 + npc.seed)) : 0;
    var stride = Math.round(gait * 2);
    var coat = npc.coat;
    var skin = npc.skin;

    ctx.globalAlpha = 0.2;
    fillBox(x - 6, ground - 2, 12, 2, "#081418");
    ctx.globalAlpha = 1;

    // Legs and shoes.
    fillBox(x - 4 + stride, ground - 9, 3, 7, "#2e3540");
    fillBox(x + 1 - stride, ground - 9, 3, 7, "#2e3540");
    fillBox(x - 5 + stride, ground - 3, 4, 2, "#181d24");
    fillBox(x + 1 - stride, ground - 3, 4, 2, "#181d24");

    // Winter coat, scarf and swinging arms.
    fillBox(x - 5, ground - 24 - bob, 10, 15, coat);
    fillBox(x - 4, ground - 23 - bob, 8, 12, "rgba(255,247,220,0.13)");
    fillBox(x - 5, ground - 10 - bob, 10, 2, "rgba(13,21,24,0.24)");
    fillBox(x - 7, ground - 21 - bob, 2, 7, coat);
    fillBox(x + 5, ground - 21 - bob, 2, 7, coat);
    fillBox(x - 1, ground - 22 - bob, 3, 2, npc.scarf ? npc.cap : coat);
    if (npc.scarf) {
      fillBox(x + (npc.dir > 0 ? -6 : 3), ground - 21 - bob, 4, 1, npc.cap);
    }

    // Head, hair or hat. Three simple silhouettes keep the crowd readable.
    fillBox(x - 3, ground - 31 - bob, 7, 8, skin);
    fillBox(x - 3, ground - 32 - bob, 7, 2, npc.hair);
    if (npc.hat) {
      var hatStyle = npc.seed % 3;
      if (hatStyle === 0) {
        fillBox(x - 4, ground - 35 - bob, 9, 4, npc.hat);
        fillBox(x - 4, ground - 36 - bob, 9, 1, "rgba(255,248,226,0.22)");
      } else if (hatStyle === 1) {
        fillBox(x - 3, ground - 34 - bob, 8, 3, npc.hat);
        fillBox(x + (npc.dir > 0 ? 1 : -6), ground - 32 - bob, 8, 1, npc.hat);
      } else {
        fillBox(x - 5, ground - 34 - bob, 9, 2, npc.hat);
        fillBox(x - 10, ground - 33 - bob, 18, 1, "rgba(28,24,22,0.55)");
        fillBox(x - 3, ground - 36 - bob, 6, 2, npc.hat);
      }
      fillBox(x - 4, ground - 31 - bob, 9, 1, "rgba(20,24,25,0.28)");
    }
    fillBox(x + (npc.dir > 0 ? 1 : -2), ground - 27 - bob, 1, 1, "#241a16");
    fillBox(x + (npc.dir > 0 ? 2 : -1), ground - 25 - bob, 1, 1, "#b9785f");

    // Bag, backpack, newspaper or phone keeps the silhouettes varied.
    if (npc.bag && npc.bagType === "backpack") {
      fillBox(x - 4, ground - 23 - bob, 8, 10, "#4f6b55");
      fillBox(x - 2, ground - 22 - bob, 4, 2, "#6f8b6c");
      fillBox(x - 1, ground - 13 - bob, 2, 1, "#2e4235");
    } else if (npc.bag && npc.bagType === "tote") {
      fillBox(x + (npc.dir > 0 ? 5 : -9), ground - 17 - bob, 4, 5, "#6b4a2f");
      fillBox(x + (npc.dir > 0 ? 6 : -8), ground - 16 - bob, 2, 1, "#d8b46b");
      fillBox(x + (npc.dir > 0 ? 6 : -8), ground - 22 - bob, 1, 5, "#3c2c20");
    } else if (npc.bag && npc.bagType === "newspaper") {
      fillBox(x + (npc.dir > 0 ? 5 : -8), ground - 18 - bob, 4, 5, "#e8dfc4");
      fillBox(x + (npc.dir > 0 ? 6 : -7), ground - 17 - bob, 2, 1, "#8c8371");
    } else if (npc.seed % 3 === 0) {
      fillBox(x + (npc.dir > 0 ? 5 : -7), ground - 21 - bob, 2, 3, "#9fd3e6");
      fillBox(x + (npc.dir > 0 ? 5 : -7), ground - 21 - bob, 2, 1, "#e8fbff");
    }

    if (npc.stunned > 0) {
      var wobble = Math.sin(state.worldTime * 17) * 2;
      fillBox(x - 9, ground - 39 + wobble, 2, 2, "#f2c14e");
      fillBox(x + 8, ground - 37 - wobble, 1, 1, "#fff1ba");
    }
  }

  function drawScooter(npc) {
    var x = Math.round(npc.x);
    var ground = Math.round(npc.y);
    var dir = npc.dir >= 0 ? 1 : -1;
    var moving = npc.stunned <= 0 && npc.turnTimer <= 0;
    var bob = moving ? Math.round(Math.sin(npc.animTime * 12 + npc.seed) * 0.7) : 0;
    var front = x + dir * 8;
    var rear = x - dir * 8;
    var scooterColors = npc.scooterColor || SCOOTER_COLORS[0];

    ctx.globalAlpha = 0.26;
    fillBox(x - 11, ground - 2, 22, 2, "#081418");
    ctx.globalAlpha = 1;

    // Speed lines catch the eye before the scooter reaches the boy.
    if (moving) {
      ctx.globalAlpha = 0.16;
      fillBox(x - dir * 19, ground - 15, 8, 1, "#f4e6bd");
      fillBox(x - dir * 24, ground - 11, 12, 1, "#f4e6bd");
      fillBox(x - dir * 15, ground - 7, 6, 1, "#f4e6bd");
      ctx.globalAlpha = 1;
    }

    // Deck, wheels, fenders and neon underglow.
    fillBox(x - 9, ground - 7, 18, 2, "#263237");
    fillBox(x - 7, ground - 8, 14, 1, scooterColors.deck);
    fillBox(x - 9, ground - 6, 18, 1, "rgba(35,44,45,0.7)");
    fillBox(x - 2, ground - 6, 4, 2, "#536569");
    ctx.globalAlpha = 0.22;
    fillBox(x - 8, ground - 4, 16, 1, scooterColors.glow);
    ctx.globalAlpha = 1;
    fillBox(x - dir * 9, ground - 9, 2, 1, "#d95a45");
    fillBox(rear - 2, ground - 6, 5, 5, "#191d22");
    fillBox(front - 2, ground - 6, 5, 5, "#191d22");
    fillBox(rear - 1, ground - 5, 3, 3, "#68777b");
    fillBox(front - 1, ground - 5, 3, 3, "#68777b");
    var spoke = Math.floor(npc.animTime * 18) % 2;
    fillBox(rear - 1, ground - 4 + spoke, 1, 1, "#d6ded6");
    fillBox(front - 1, ground - 4 - spoke, 1, 1, "#d6ded6");
    fillBox(rear - 3, ground - 8, 6, 1, "#3b4a4d");
    fillBox(front - 3, ground - 8, 6, 1, "#3b4a4d");

    // Stem, headlight and handlebar.
    drawPixelLine(front, ground - 8, front + dir * 2, ground - 22, "#41565a", 2);
    drawPixelLine(front + dir * 1, ground - 10, front + dir * 2, ground - 21, "#8ba6a6", 1);
    fillBox(front + dir * 2 - 4, ground - 23, 9, 1, "#1f292b");
    fillBox(front + dir * 2 - 4, ground - 24, 2, 2, "#c4d1c9");
    fillBox(front + dir * 2 + 3, ground - 24, 2, 2, "#c4d1c9");
    fillBox(front + dir * 1, ground - 21, 2, 2, scooterColors.light);
    fillBox(front + dir * 1, ground - 21, 1, 1, "#fff7d2");

    // Rider: dark jacket, cap, messenger bag and a forward lean.
    fillBox(x - dir * 5, ground - 20 - bob, 4, 6, "#3a2d24");
    fillBox(x - dir * 5, ground - 18 - bob, 4, 1, "#8c6a39");
    drawPixelLine(x - 2, ground - 10, x - 5, ground - 7, "#20262c", 3);
    drawPixelLine(x + 2, ground - 10, x + 4, ground - 7, "#20262c", 2);
    fillBox(x - 3, ground - 9, 3, 2, "#1b2024");
    fillBox(x + 1, ground - 9, 3, 2, "#1b2024");
    fillBox(x - 5 + dir, ground - 22 - bob, 10, 12, npc.jacket);
    fillBox(x - 4 + dir, ground - 21 - bob, 6, 3, "rgba(255,248,222,0.13)");
    fillBox(x - 5 + dir, ground - 11 - bob, 10, 2, "#151a1e");
    fillBox(x - 4 + dir, ground - 23 - bob, 8, 2, "#1a1f24");
    fillBox(x + (dir > 0 ? 2 : -4), ground - 19 - bob, 2, 7, npc.cap);
    drawPixelLine(x + (dir > 0 ? 4 : -4), ground - 18 - bob, front + dir * 2, ground - 21, npc.jacket, 2);
    fillBox(x - 4 + dir, ground - 30 - bob, 8, 8, npc.skin);
    fillBox(x - 5 + dir, ground - 32 - bob, 10, 3, npc.cap);
    fillBox(x + (dir > 0 ? 5 : -9), ground - 31 - bob, 4, 1, npc.cap);
    fillBox(x - 3 + dir, ground - 27 - bob, 6, 1, "#1b2023");
    fillBox(x + (dir > 0 ? 1 : -2), ground - 25 - bob, 1, 1, "#b9785f");
    fillBox(x - dir * 6, ground - 21 - bob, 4, 1, npc.cap);

    // Some riders wear a bright helmet and check their phone while steering.
    if (npc.helmet) {
      fillBox(x - 5 + dir, ground - 34 - bob, 10, 3, npc.helmetColor);
      fillBox(x - 4 + dir, ground - 36 - bob, 8, 2, npc.helmetColor);
      fillBox(x + (dir > 0 ? 2 : -6), ground - 32 - bob, 4, 1, "#26343c");
      fillBox(x - 4 + dir, ground - 30 - bob, 7, 1, "#2a2f33");
    }
    if (npc.phone) {
      var phoneX = x + (dir > 0 ? 5 : -8);
      fillBox(phoneX, ground - 19 - bob, 2, 4, "#141a1e");
      fillBox(phoneX, ground - 18 - bob, 2, 2, "#7fd0d8");
      ctx.globalAlpha = 0.18;
      fillBox(phoneX - 1, ground - 20 - bob, 4, 6, "#9be6e0");
      ctx.globalAlpha = 1;
    }

    if (npc.stunned > 0) {
      var wobble = Math.sin(state.worldTime * 18) * 2;
      fillBox(x - 10, ground - 39 + wobble, 2, 2, "#f2c14e");
      fillBox(x + 9, ground - 37 - wobble, 2, 2, "#fff1ba");
    } else if (state.mode === "playing" && state.player && Math.abs(state.player.x - npc.x) < 135) {
      if (Math.sin(state.worldTime * 8) > -0.15) {
        fillBox(x - 1, ground - 49, 3, 7, "#f2c14e");
        fillBox(x - 1, ground - 41, 3, 3, "#f2c14e");
      }
    }
  }

  function drawTram(npc) {
    var width = CAR_TYPES.tram.w;
    var height = CAR_TYPES.tram.h;
    var ground = Math.round(npc.y);
    var left = Math.round(npc.x - width / 2);
    var top = ground - height;
    var dir = npc.dir >= 0 ? 1 : -1;
    var body = npc.body || "#e8e2d0";
    var red = "#b83e35";
    var trim = "#f4efe2";
    var wheel = 4;

    // Schatten und Gleisbettkontakt.
    ctx.globalAlpha = 0.24;
    fillBox(left + 3, ground + 1, width - 6, 2, "#070d10");
    ctx.globalAlpha = 1;

    // Fahrwerk/Bogie statt Autoreifen.
    fillBox(left + 14, ground - 6, 18, 5, "#20282c");
    fillBox(left + width - 32, ground - 6, 18, 5, "#20282c");
    fillBox(left + 18, ground - 5, 10, 2, "#59666b");
    fillBox(left + width - 28, ground - 5, 10, 2, "#59666b");
    fillBox(left + 20, ground - 3, 6, 3, "#121a1e");
    fillBox(left + width - 26, ground - 3, 6, 3, "#121a1e");

    // Wagenkasten: heller Aufbau, rote Schürze, abgerundete Front.
    fillBox(left + 4, top + 7, width - 8, height - 12, body);
    fillBox(left + 4, top + 7, width - 8, 2, "rgba(255,253,242,0.72)");
    fillBox(left + 4, ground - 9, width - 8, 6, red);
    fillBox(left + 4, ground - 9, width - 8, 1, "rgba(255,245,230,0.35)");
    if (dir > 0) {
      fillBox(left + width - 9, top + 9, 7, height - 14, body);
      fillBox(left + width - 7, top + 12, 5, height - 18, "#d7e5e8");
      fillBox(left + width - 6, ground - 9, 4, 5, red);
    } else {
      fillBox(left + 2, top + 9, 7, height - 14, body);
      fillBox(left + 2, top + 12, 5, height - 18, "#d7e5e8");
      fillBox(left + 2, ground - 9, 4, 5, red);
    }

    // Fensterband, Türen und Zierlinie.
    for (var win = 0; win < 7; win += 1) {
      var wx = left + 9 + win * 11;
      fillBox(wx, top + 11, 8, 7, "#294657");
      fillBox(wx, top + 11, 8, 2, "#8fc3d4");
      fillBox(wx + 1, top + 12, 1, 3, "rgba(255,255,255,0.35)");
      fillBox(wx, top + 18, 8, 1, "rgba(20,32,36,0.4)");
    }
    fillBox(left + 30, top + 9, 10, height - 15, "rgba(150,45,42,0.9)");
    fillBox(left + 31, top + 10, 8, 10, "#3c5864");
    fillBox(left + width - 30, top + 9, 10, height - 15, "rgba(150,45,42,0.9)");
    fillBox(left + width - 29, top + 10, 8, 10, "#3c5864");
    fillBox(left + 4, top + 26, width - 8, 2, red);
    fillBox(left + 4, top + 28, width - 8, 1, "rgba(24,32,34,0.35)");

    // Zielschild vorn und Wagennummer.
    fillBox(left + (dir > 0 ? width - 27 : 8), top + 2, 19, 6, "#20282c");
    fillBox(left + (dir > 0 ? width - 26 : 9), top + 3, 17, 4, "#f2c14e");
    ctx.save();
    ctx.font = "4px 'Lucida Console', 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2b2113";
    ctx.fillText("1", left + (dir > 0 ? width - 17.5 : 17.5), top + 5);
    ctx.restore();

    // Stromabnehmer und Dachgerät.
    fillBox(left + width * 0.36, top + 1, 2, 6, "#2f3538");
    fillBox(left + width * 0.64, top + 1, 2, 6, "#2f3538");
    drawPixelLine(left + width * 0.38, top + 1, left + width * 0.46, top - 10, "#2f3538", 2);
    drawPixelLine(left + width * 0.62, top + 1, left + width * 0.54, top - 10, "#2f3538", 2);
    fillBox(left + width * 0.44, top - 11, width * 0.12, 2, "#232a2d");
    fillBox(left + width * 0.5 - 5, top - 2, 10, 2, "#48565a");

    // Scheinwerfer und Rücklicht.
    fillBox(dir > 0 ? left + width - 5 : left + 2, top + 20, 3, 3, "#fff1b0");
    fillBox(dir > 0 ? left + width - 5 : left + 2, top + 20, 3, 1, "#fffbe2");
    fillBox(dir > 0 ? left + 2 : left + width - 5, top + 20, 3, 3, "#c94436");

    // Kleine Bewegungsunschärfe an den Rädern.
    if (npc.speed > 40) {
      ctx.globalAlpha = 0.18;
      fillBox(left + 6, ground - 6, 10, 1, "#e8e2d0");
      fillBox(left + width - 18, ground - 6, 10, 1, "#e8e2d0");
      ctx.globalAlpha = 1;
    }
  }

  function drawVehicle(npc) {
    if (npc.carType === "tram") {
      drawTram(npc);
      return;
    }
    var spec = CAR_TYPES[npc.carType] || CAR_TYPES.sedan;
    var width = spec.w;
    var height = spec.h;
    var ground = Math.round(npc.y);
    var left = Math.round(npc.x - width / 2);
    var top = ground - height;
    var dir = npc.dir >= 0 ? 1 : -1;
    var body = npc.body || spec.bodies[0];
    var type = npc.carType;
    var isBus = type === "bus";
    var isVan = type === "van";
    var isTaxi = type === "taxi";
    var isPolice = type === "police";
    var wheel = isBus ? 7 : (isVan ? 6 : 5);
    var wheelXs = isBus ? [left + 13, left + width - 20] : [left + 9, left + width - 16];
    var wheelY = ground - wheel - 2;
    var front = dir > 0 ? left + width - 4 : left + 2;
    var rear = dir > 0 ? left + 3 : left + width - 6;
    var bodyBottom = ground - 4;

    // Schatten und Radkästen.
    ctx.globalAlpha = 0.28;
    fillBox(left + 2, ground + 1, width - 4, 3, "#070d10");
    ctx.globalAlpha = 0.13;
    fillBox(left + width * 0.24, ground + 4, width * 0.52, 2, "#070d10");
    ctx.globalAlpha = 1;

    // Hauptkarosserie mit Sicken und Schweller.
    fillBox(left + 2, top + (isBus ? 5 : 8), width - 4, bodyBottom - top - (isBus ? 5 : 8), body);
    fillBox(left + 3, top + (isBus ? 6 : 9), width - 6, 2, "rgba(255,252,238,0.28)");
    fillBox(left + 3, bodyBottom - 4, width - 6, 3, "rgba(16,22,25,0.32)");
    fillBox(left + 2, bodyBottom - 1, width - 4, 3, "#20272b");
    fillBox(left + 4, bodyBottom, width - 8, 1, "rgba(190,200,198,0.22)");
    fillBox(left + 3, top + (isBus ? 10 : 13), width - 6, 1, "rgba(255,255,245,0.16)");

    if (isBus) {
      // Stadtbus: Fensterband, Türen und Zielanzeige.
      fillBox(left + 3, top + 1, width - 6, 10, body);
      fillBox(left + 4, top + 2, width - 8, 2, "rgba(255,252,238,0.34)");
      for (var busWin = 0; busWin < 5; busWin += 1) {
        var bx = left + 6 + busWin * 11;
        fillBox(bx, top + 5, 8, 5, "#294a5a");
        fillBox(bx, top + 5, 8, 2, "#8dc3d3");
        fillBox(bx + 1, top + 6, 1, 2, "rgba(255,255,255,0.32)");
      }
      fillBox(left + 24, top + 4, 11, 9, "#294a5a");
      fillBox(left + 25, top + 5, 9, 7, "#355e70");
      fillBox(left + 25, top + 5, 9, 1, "rgba(255,255,255,0.25)");
      fillBox(left + 39, top + 4, 11, 9, "#294a5a");
      fillBox(left + 40, top + 5, 9, 7, "#355e70");
      fillBox(left + 40, top + 5, 9, 1, "rgba(255,255,255,0.25)");
      fillBox(left + 3, top + 12, width - 6, 1, "rgba(255,252,238,0.22)");
    } else if (isVan) {
      // Van: hohes Dach, große Frontscheibe, Kastenaufbau.
      fillBox(left + 3, top + 1, width - 6, 10, body);
      fillBox(left + 4, top + 2, width - 8, 2, "rgba(255,252,238,0.32)");
      fillBox(left + 5, top + 4, width - 12, 6, "#2c4d5c");
      fillBox(left + 5, top + 4, width - 12, 2, "#89bccc");
      fillBox(left + 6, top + 5, 1, 3, "rgba(255,255,255,0.28)");
      fillBox(left + width - 13, top + 4, 7, 6, "#2c4d5c");
      fillBox(left + width - 12, top + 4, 5, 2, "#89bccc");
      fillBox(left + 3, top + 14, width - 6, 1, "rgba(255,255,255,0.18)");
      fillBox(left + width - 15, top + 16, 1, 6, "rgba(30,38,40,0.3)");
    } else {
      // Pkw/Taxi/Polizei: gestufte Motorhaube, Dach und Heck.
      var cabinWidth = Math.round(width * 0.56);
      var cabinX = left + Math.round((width - cabinWidth) * 0.5) + dir * 1;
      fillBox(cabinX - 1, top + 2, cabinWidth + 2, 10, body);
      fillBox(cabinX, top, cabinWidth, 2, body);
      fillBox(cabinX + 1, top + 3, cabinWidth - 2, 6, "#2c4d5c");
      fillBox(cabinX + 2, top + 4, cabinWidth - 4, 2, "#89bccc");
      fillBox(cabinX + 2, top + 6, cabinWidth - 4, 2, "#1f3a47");
      fillBox(cabinX + 3, top + 4, 2, 2, "rgba(255,255,255,0.36)");
      fillBox(cabinX + Math.floor(cabinWidth / 2), top + 3, 1, 6, "rgba(20,32,38,0.5)");
      // Motorhaube/Heckfläche leicht abschrägen.
      fillBox(dir > 0 ? left + width - 10 : left + 2, top + 7, 8, 2, body);
      fillBox(dir > 0 ? left + 2 : left + width - 10, top + 7, 8, 2, "rgba(255,255,255,0.12)");
    }

    // Radkästen schneiden in die Karosserie ein.
    for (var arch = 0; arch < wheelXs.length; arch += 1) {
      fillBox(wheelXs[arch] - 2, wheelY - 3, wheel + 4, wheel + 4, "#151d21");
    }

    // Räder mit Reifen, Felge und Felgenspeiche.
    for (var w = 0; w < wheelXs.length; w += 1) {
      var wx = wheelXs[w];
      fillBox(wx - 1, wheelY - 1, wheel + 2, wheel + 3, "#0d1317");
      fillBox(wx + 1, wheelY + 1, wheel - 1, wheel - 1, "#6a7478");
      fillBox(wx + 2, wheelY + 2, wheel - 3, wheel - 3, "#2b3438");
      var spin = Math.floor(npc.animTime * 15 + w) % 2;
      fillBox(wx + 2, wheelY + 2 + spin, 1, 1, "#dce3dc");
      fillBox(wx + wheel - 3, wheelY + wheel - 3 - spin, 1, 1, "#dce3dc");
    }

    // Stoßstangen, Kühlergrill, Scheinwerfer und Rücklichter.
    fillBox(front, top + (isBus ? 11 : 9), 3, 4, "#fff1b0");
    fillBox(front, top + (isBus ? 11 : 9), 3, 1, "#fffbe2");
    fillBox(rear, top + (isBus ? 11 : 9), 3, 3, "#c94436");
    fillBox(rear, top + (isBus ? 11 : 9), 3, 1, "#f08a72");
    fillBox(dir > 0 ? left + width - 3 : left + 1, bodyBottom - 4, 2, 3, "#2a3235");
    fillBox(dir > 0 ? left + 1 : left + width - 3, bodyBottom - 4, 2, 3, "#2a3235");
    if (!isBus) {
      // Außenspiegel und kleines Nummernschild am Heck.
      fillBox(front - dir * 4, top + 3, 3, 2, body);
      fillBox(front - dir * 5, top + 3, 1, 2, "rgba(255,255,245,0.25)");
      fillBox(dir > 0 ? left + 4 : left + width - 11, bodyBottom - 3, 7, 2, "#e8dfc2");
      fillBox(dir > 0 ? left + 5 : left + width - 10, bodyBottom - 3, 5, 1, "rgba(60,60,54,0.45)");
    }

    if (isTaxi) {
      // Schachbrett-Zierlinie und Taxischild.
      for (var checker = 0; checker < width - 8; checker += 8) {
        fillBox(left + 4 + checker, top + 11, 4, 2, checker % 16 === 0 ? "#20282c" : "#f7f2e0");
      }
      fillBox(left + width * 0.5 - 9, top - 5, 18, 5, "#2b2113");
      fillBox(left + width * 0.5 - 8, top - 4, 16, 1, "#ffe6a0");
      ctx.save();
      ctx.font = "4px 'Lucida Console', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffe6a0";
      ctx.fillText("TAXI", left + width * 0.5, top - 1.7);
      ctx.restore();
    }
    if (isPolice) {
      fillBox(left + 3, top + 11, width - 6, 2, "#3f6f9f");
      var blink = Math.floor(npc.animTime * 8) % 2;
      fillBox(left + width * 0.5 - 8, top - 4, 16, 3, "#253246");
      fillBox(left + width * 0.5 - 6, top - 4, 5, 2, blink ? "#3f7fc1" : "#17324d");
      fillBox(left + width * 0.5 + 1, top - 4, 5, 2, blink ? "#17324d" : "#d94a3f");
    }

    // Scheinwerferkegel bei Abendlicht und Regen.
    var weather = state.level ? state.level.weather : "clear";
    if (weather === "dusk" || weather === "rain") {
      ctx.globalAlpha = 0.09;
      fillBox(dir > 0 ? left + width : left - 30, top + 8, 30, 6, "#fff0b0");
      ctx.globalAlpha = 1;
    }
  }

  function drawCyclist(npc) {
    var x = Math.round(npc.x);
    var ground = Math.round(npc.y);
    var dir = npc.dir >= 0 ? 1 : -1;
    var moving = npc.stunned <= 0 && npc.turnTimer <= 0;
    var bob = moving ? Math.round(Math.sin(npc.animTime * 10 + npc.seed) * 0.8) : 0;
    var bike = npc.bikeColor || "#b63b2f";
    var rear = x - dir * 10;
    var front = x + dir * 11;

    ctx.globalAlpha = 0.24;
    fillBox(x - 14, ground - 2, 28, 2, "#081418");
    ctx.globalAlpha = 1;

    if (moving) {
      ctx.globalAlpha = 0.14;
      fillBox(x - dir * 24, ground - 18, 10, 1, "#f4e6bd");
      fillBox(x - dir * 30, ground - 12, 14, 1, "#f4e6bd");
      fillBox(x - dir * 20, ground - 7, 8, 1, "#f4e6bd");
      ctx.globalAlpha = 1;
    }

    // Räder und Speichen.
    var wheelRadius = 5;
    for (var w = 0; w < 2; w += 1) {
      var wx = w === 0 ? rear : front;
      fillBox(wx - wheelRadius, ground - wheelRadius * 2, wheelRadius * 2 + 1, wheelRadius * 2, "#162026");
      fillBox(wx - wheelRadius + 1, ground - wheelRadius * 2 + 1, wheelRadius * 2 - 1, wheelRadius * 2 - 2, "#5f6a6e");
      fillBox(wx - wheelRadius + 2, ground - wheelRadius * 2 + 2, wheelRadius * 2 - 3, wheelRadius * 2 - 4, "#232d31");
      var spoke = Math.floor(npc.animTime * 16) % 2;
      fillBox(wx, ground - wheelRadius * 2 + 2 + spoke, 1, 4, "#d6ded6");
      fillBox(wx - 2, ground - wheelRadius, 5, 1, "#d6ded6");
    }

    // Rahmen, Gabel und Kette.
    drawPixelLine(rear, ground - 7, x, ground - 17 - bob, bike, 2);
    drawPixelLine(x, ground - 17 - bob, front, ground - 8, bike, 2);
    drawPixelLine(rear, ground - 7, x + dir * 3, ground - 8, "#2c3438", 2);
    drawPixelLine(x + dir * 3, ground - 8, front, ground - 8, "#2c3438", 2);
    drawPixelLine(x, ground - 17 - bob, x + dir * 3, ground - 8, "#4a5559", 1);
    fillBox(rear - 1, ground - 8, 4, 2, "#20282c");
    fillBox(front - 2, ground - 9, 5, 2, "#20282c");
    fillBox(x - 3, ground - 20 - bob, 7, 3, "#1e2428");
    drawPixelLine(front, ground - 9, front + dir * 2, ground - 21, "#3c4548", 2);
    fillBox(front + dir * 2 - 4, ground - 22, 9, 1, "#20282c");
    fillBox(front + dir * 2 - 4, ground - 23, 2, 2, "#c4d1c9");
    fillBox(front + dir * 2 + 3, ground - 23, 2, 2, "#c4d1c9");

    // Fahrer mit Helm, Jacke und Rucksack.
    fillBox(x - 4 + dir, ground - 32 - bob, 9, 9, npc.skin);
    if (npc.helmet) {
      fillBox(x - 5 + dir, ground - 35 - bob, 11, 4, npc.helmetColor);
      fillBox(x - 3 + dir, ground - 36 - bob, 7, 2, npc.helmetColor);
      fillBox(x + (dir > 0 ? 5 : -7), ground - 34 - bob, 3, 1, "#26343c");
    } else {
      fillBox(x - 4 + dir, ground - 34 - bob, 9, 3, npc.hair);
    }
    fillBox(x - 5 + dir, ground - 24 - bob, 11, 10, npc.jacket);
    fillBox(x - 4 + dir, ground - 23 - bob, 6, 3, "rgba(255,248,222,0.12)");
    fillBox(x - 5 + dir, ground - 25 - bob, 11, 2, "#1a1f24");
    drawPixelLine(x + dir * 4, ground - 23 - bob, front + dir * 2, ground - 20, npc.jacket, 2);
    fillBox(x - 8 + dir, ground - 23 - bob, 4, 7, "#3d4c3c");
    fillBox(x - 7 + dir, ground - 22 - bob, 2, 2, "#6f8b6c");

    if (npc.stunned > 0) {
      fillBox(x - 10, ground - 41, 2, 2, "#f2c14e");
      fillBox(x + 8, ground - 39, 1, 1, "#fff1ba");
    }
  }

  function updateTraffic(dt) {
    if (!state.traffic || !state.level) {
      return;
    }
    var windowLeft = state.camera - 280;
    var windowRight = state.camera + W + 280;
    for (var i = 0; i < state.traffic.length; i += 1) {
      var car = state.traffic[i];
      car.animTime += dt;
      car.x += car.dir * car.speed * dt;
      if (car.x > windowRight) {
        car.x = windowLeft - (i % 4) * 42;
      } else if (car.x < windowLeft) {
        car.x = windowRight + (i % 4) * 42;
      }
    }
  }

  function drawTraffic() {
    if (!state.traffic || !state.traffic.length) {
      return;
    }
    var viewLeft = state.camera - 120;
    var viewRight = state.camera + W + 120;
    for (var i = 0; i < state.traffic.length; i += 1) {
      var car = state.traffic[i];
      if (car.x < viewLeft - 60 || car.x > viewRight + 60) {
        continue;
      }
      drawVehicle(car);
    }
  }

  function drawNpcs() {
    if (!state.npcs.length) {
      return;
    }
    var viewLeft = state.camera - 70;
    var viewRight = state.camera + W + 70;
    for (var i = 0; i < state.npcs.length; i += 1) {
      var npc = state.npcs[i];
      if (npc.x < viewLeft - 30 || npc.x > viewRight + 30) {
        continue;
      }
      if (npc.type === "cyclist") {
        drawCyclist(npc);
      } else if (npc.type === "scooter") {
        drawScooter(npc);
      } else {
        drawPedestrian(npc);
      }
    }
  }

  function drawBirdObstacles() {
    if (!state.birds.length) {
      return;
    }
    var viewLeft = state.camera - 50;
    var viewRight = state.camera + W + 50;
    for (var i = 0; i < state.birds.length; i += 1) {
      var bird = state.birds[i];
      if (!bird.active || bird.x < viewLeft || bird.x > viewRight) {
        continue;
      }
      var x = Math.round(bird.x);
      var y = Math.round(bird.y);
      var dir = bird.dir >= 0 ? 1 : -1;
      var low = Boolean(bird.low);
      if (low) {
        // Schatten auf dem Gehweg macht die tiefe Flugbahn sofort lesbar.
        ctx.globalAlpha = 0.18;
        fillBox(x - 7, laneFeet(LANE_SIDEWALK) - 2, 14, 2, "#081418");
        ctx.globalAlpha = 1;
        if (state.player && Math.abs(state.player.x - bird.x) < 110) {
          fillBox(x - 1, y - 17, 2, 7, "#f2c14e");
          fillBox(x - 1, y - 8, 2, 2, "#f2c14e");
        }
      }
      var platform = state.level.platforms[bird.platformIndex];
      if (platform && bird.x >= platform.x && bird.x <= platform.x + platform.w) {
        ctx.globalAlpha = 0.15;
        fillBox(x - 5, platform.roofY - 2, 10, 2, "#081418");
        ctx.globalAlpha = 1;
      }

      var flap = Math.sin(bird.animTime * 19 + bird.phase) > 0;
      var body = "#59676e";
      var bodyLight = "#d6dbd4";
      var wing = "#8d9aa0";
      var wingDark = "#49575e";

      // Tail, body, head and beak.
      fillBox(x - dir * 6, y - 1, 4, 2, body);
      fillBox(x - dir * 5, y, 3, 1, wingDark);
      fillBox(x - 4, y - 2, 8, 5, "#202a2e");
      fillBox(x - 3, y - 2, 6, 3, bodyLight);
      fillBox(x - 3, y - 1, 5, 2, body);
      fillBox(x + dir * 3 - 1, y - 4, 4, 4, "#202a2e");
      fillBox(x + dir * 3, y - 4, 3, 3, body);
      fillBox(x + dir * 5, y - 2, 2, 1, "#d9a45b");
      fillBox(x + dir * 3, y - 3, 1, 1, "#f7f3df");
      fillBox(x + dir * 4, y - 3, 1, 1, "#202a2e");

      // Flapping wing, offset to the near side.
      if (flap) {
        fillBox(x - 3, y - 6, 6, 2, wingDark);
        fillBox(x - 2, y - 7, 4, 2, wing);
        fillBox(x - 1, y - 8, 2, 2, bodyLight);
      } else {
        fillBox(x - 3, y + 2, 6, 2, wingDark);
        fillBox(x - 2, y + 3, 4, 2, wing);
        fillBox(x - 1, y + 5, 2, 1, bodyLight);
      }

      // Soft motion streak.
      ctx.globalAlpha = 0.12;
      fillBox(x - dir * 10, y - 1, 5, 1, "#f4e6bd");
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================== */
  /* Partikel                                                            */
  /* ================================================================== */

  function pushParticle(particle) {
    if (state.particles.length > 240) {
      state.particles.shift();
    }
    state.particles.push(particle);
  }

  function spawnDustPuff(x, y, count) {
    if (reduceMotion) {
      count = Math.max(1, Math.ceil(count / 3));
    }
    for (var i = 0; i < count; i += 1) {
      var life = 0.28 + Math.random() * 0.34;
      pushParticle({
        type: "dust",
        x: x + (Math.random() - 0.5) * 9,
        y: y - 1 - Math.random() * 2,
        vx: (Math.random() - 0.5) * 24,
        vy: -8 - Math.random() * 18,
        gravity: 24,
        size: 1 + Math.floor(Math.random() * 2),
        color: Math.random() > 0.45 ? "#e7d8b9" : "#b6a68e",
        life: life,
        maxLife: life
      });
    }
  }

  function spawnCarSmoke(x, y) {
    var direction = state.car && state.car.direction ? state.car.direction : 1;
    var life = 0.55 + Math.random() * 0.45;
    pushParticle({
      type: "smoke",
      x: x + (Math.random() - 0.5) * 5,
      y: y - Math.random() * 4,
      vx: -direction * (7 + Math.random() * 17),
      vy: -9 - Math.random() * 15,
      gravity: -3,
      size: 2 + Math.floor(Math.random() * 4),
      color: Math.random() > 0.5 ? "#aeb8ba" : "#697a7c",
      life: life,
      maxLife: life
    });
  }

  function spawnBurst(x, y, colors, count, speed) {
    if (reduceMotion) {
      count = Math.max(2, Math.ceil(count / 3));
    }
    for (var i = 0; i < count; i += 1) {
      var life = 0.34 + Math.random() * 0.5;
      var power = (speed || 2.4) * 30;
      pushParticle({
        type: "spark",
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * power,
        vy: -20 - Math.random() * power,
        gravity: 210,
        size: 1 + Math.floor(Math.random() * 2),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: life,
        maxLife: life
      });
    }
  }

  function spawnConfetti(x, y, count) {
    var colors = ["#f2c14e", "#fff1c1", "#b63b2f", "#3f7fc1", "#6f9d54"];
    if (reduceMotion) {
      count = Math.max(6, Math.ceil(count / 4));
    }
    for (var i = 0; i < count; i += 1) {
      var life = 2.2 + Math.random() * 2.1;
      pushParticle({
        type: "confetti",
        x: x + (Math.random() - 0.5) * W * 1.15,
        y: y - Math.random() * 90,
        vx: (Math.random() - 0.5) * 58,
        vy: 25 + Math.random() * 55,
        gravity: 23,
        size: 2 + Math.floor(Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: life,
        maxLife: life,
        spin: Math.random() * 6.28,
        spinSpeed: (Math.random() - 0.5) * 7
      });
    }
  }

  function updateParticles(dt) {
    for (var i = state.particles.length - 1; i >= 0; i -= 1) {
      var particle = state.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.type === "smoke") {
        particle.size += dt * 5;
        particle.vx *= 1 - dt * 1.2;
      } else if (particle.type === "confetti" && particle.spinSpeed) {
        particle.spin += particle.spinSpeed * dt;
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < state.particles.length; i += 1) {
      var particle = state.particles[i];
      var alpha = clamp(particle.life / particle.maxLife, 0, 1);
      if (particle.type === "smoke") {
        ctx.globalAlpha = alpha * 0.34;
        fillBox(particle.x, particle.y, particle.size, particle.size, particle.color);
        if (particle.size > 3) {
          fillBox(particle.x - particle.size * 0.35, particle.y + 1, particle.size * 0.65, particle.size * 0.65, particle.color);
        }
      } else if (particle.type === "confetti") {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(particle.x), Math.round(particle.y));
        ctx.rotate(particle.spin);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -1, particle.size, 2);
        ctx.restore();
      } else {
        ctx.globalAlpha = alpha * (particle.type === "spark" ? 0.96 : 0.56);
        fillBox(particle.x, particle.y, particle.size, particle.size, particle.color);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawAutoTarget() {
    if (state.autoTarget == null || state.mode !== "playing") {
      return;
    }
    var targetX = state.autoTarget;
    var platform = platformUnder(targetX);
    var targetY = platform ? platform.roofY - 13 : state.player.y + 4;
    var pulse = 1 + Math.sin(state.worldTime * 6) * 1.5;
    ctx.globalAlpha = 0.8;
    fillBox(targetX - 6 - pulse, targetY, 3, 1, "#ffe28d");
    fillBox(targetX + 1 + pulse, targetY, 3, 1, "#ffe28d");
    fillBox(targetX, targetY - 7 - pulse, 1, 3, "#ffe28d");
    fillBox(targetX, targetY + 2 + pulse, 1, 3, "#ffe28d");
    fillBox(targetX - 1, targetY - 1, 3, 3, "#f2c14e");
    fillBox(targetX, targetY, 1, 1, "#2a1a0b");
    fillBox(targetX - 1, targetY - 12 - pulse, 3, 2, "#fff1bd");
    fillBox(targetX - 2, targetY - 10 - pulse, 5, 1, "#f2c14e");
    ctx.globalAlpha = 1;
  }

  /* ================================================================== */
  /* Die Spielwelt zeichnen                                              */
  /* ================================================================== */

  // Nachts: bläuliches Mondlicht über der Szene, dazu warme Fenster,
  // Straßenlaternen und Fahrzeuglichter. Die Lichtquellen werden erst nach
  // dem Abdunkeln gezeichnet, damit sie wirklich zu leuchten scheinen.
  function drawNightVehicleLights() {
    var night = state.nightFactor || 0;
    if (night < 0.12) {
      return;
    }
    var viewLeft = state.camera - 140;
    var viewRight = state.camera + W + 140;
    for (var i = 0; i < state.traffic.length; i += 1) {
      var car = state.traffic[i];
      if (car.x < viewLeft - car.w || car.x > viewRight + car.w) {
        continue;
      }
      var left = Math.round(car.x - car.w / 2);
      var top = Math.round(car.y - car.h);
      var dir = car.dir >= 0 ? 1 : -1;
      if (car.carType === "tram") {
        for (var win = 0; win < 7; win += 1) {
          ctx.globalAlpha = 0.16 + night * 0.42;
          fillBox(left + 9 + win * 11, top + 11, 8, 7, "#ffd98a");
        }
        ctx.globalAlpha = 0.08 + night * 0.16;
        fillBox(dir > 0 ? left + car.w : left - 36, top + 18, 36, 6, "#ffe9a8");
      } else {
        var cabinWidth = Math.round(car.w * 0.56);
        var cabinX = left + Math.round((car.w - cabinWidth) * 0.5) + dir;
        ctx.globalAlpha = 0.14 + night * 0.4;
        fillBox(cabinX + 2, top + 3, cabinWidth - 4, 5, "#ffe0a0");
        ctx.globalAlpha = 0.08 + night * 0.16;
        fillBox(dir > 0 ? left + car.w : left - 32, top + 8, 32, 5, "#ffe9a8");
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawNightLighting() {
    var night = state.nightFactor || 0;
    if (night < 0.02) {
      return;
    }
    ctx.fillStyle = "rgba(8,14,32," + (0.34 * night).toFixed(3) + ")";
    ctx.fillRect(state.camera - 30, -30, W + 60, H + 60);

    var i;
    for (i = 0; i < state.nightWindows.length; i += 1) {
      var win = state.nightWindows[i];
      ctx.globalAlpha = 0.1 + night * 0.24;
      fillBox(win.x - 2, win.y - 2, win.w + 4, win.h + 4, "#ffcf78");
      ctx.globalAlpha = 0.22 + night * 0.5;
      fillBox(win.x, win.y, win.w, win.h, "#ffdf9a");
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < state.nightLamps.length; i += 1) {
      var lamp = state.nightLamps[i];
      ctx.globalAlpha = 0.1 + night * 0.18;
      fillBox(lamp.x - 23, lamp.groundY - 2, 46, 5, "#f6cf82");
      ctx.globalAlpha = 0.08 + night * 0.14;
      fillBox(lamp.x - 15, lamp.groundY - 3, 30, 2, "#ffe6a8");
      ctx.globalAlpha = 0.16 + night * 0.28;
      fillBox(lamp.x - 4, lamp.y - 2, 14, 9, "#ffd98a");
      ctx.globalAlpha = 0.1 + night * 0.18;
      fillBox(lamp.x - 2, lamp.y + 7, 10, 22, "#ffd98a");
      ctx.globalAlpha = 1;
    }

    drawNightVehicleLights();
  }

  function renderWorld() {
    if (!state.level || !state.colors) {
      return;
    }
    drawBackdrop();

    var shakeX = 0;
    var shakeY = 0;
    if (!reduceMotion && state.shake > 0.05) {
      shakeX = Math.round((Math.random() * 2 - 1) * state.shake);
      shakeY = Math.round((Math.random() * 2 - 1) * state.shake * 0.65);
    }
    ctx.save();
    ctx.translate(Math.round(-state.camera) + shakeX, shakeY);

    var viewLeft = state.camera - 140;
    var viewRight = state.camera + W + 140;
    var level = state.level;
    state.nightWindows.length = 0;
    state.nightLamps.length = 0;

    // Einfache Kulisse: ein paar hohe Häuser, eine flache Häuserzeile und
    // eine schlichte Straße.
    drawTallSkyline();
    drawSimpleHouses();
    drawContinuousStreet();

    // Passengers walk on the pavement; traffic runs on the road below.
    drawNpcs();
    drawTraffic();

    for (var nutIndex = 0; nutIndex < level.nuts.length; nutIndex += 1) {
      if (state.collected.has(nutIndex)) {
        continue;
      }
      var nut = level.nuts[nutIndex];
      if (nut.x < viewLeft || nut.x > viewRight) {
        continue;
      }
      drawCoin(nut, nutIndex);
    }

    for (var cpIndex = 0; cpIndex < level.checkpoints.length; cpIndex += 1) {
      var checkpoint = level.checkpoints[cpIndex];
      if (checkpoint.x < viewLeft || checkpoint.x > viewRight) {
        continue;
      }
      drawCheckpoint(checkpoint, cpIndex);
    }

    if (level.finishX > viewLeft - 120 && level.finishX < viewRight + 120) {
      drawFinishGate();
    }

    // Weicher Schatten am unteren Bildrand.
    var bottomFade = cachedGradient("bottomFade", function () {
      var gradient = ctx.createLinearGradient(0, H - 38, 0, H);
      gradient.addColorStop(0, "rgba(4,10,16,0)");
      gradient.addColorStop(1, "rgba(4,10,16,0.34)");
      return gradient;
    });
    ctx.fillStyle = bottomFade;
    ctx.fillRect(state.camera - 20, H - 38, W + 40, 38);

    // Erst abdunkeln, dann die Lichter darüberlegen. Spieler und Auto
    // bleiben danach bewusst etwas heller und besser lesbar.
    drawNightLighting();

    drawBirdObstacles();
    drawCar();
    drawPlayer();
    drawBumpEffect();
    drawParticles();
    drawAutoTarget();

    ctx.restore();

    if (!reduceMotion && state.flash > 0.01) {
      ctx.globalAlpha = clamp(state.flash * 0.6, 0, 0.5);
      ctx.fillStyle = "#fff3d1";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================== */
  /* Schleife, Zustand und Eingaben                                      */
  /* ================================================================== */

  /* ================================================================== */
  /* Bildschirmanpassung: jede Groesse, jede Ausrichtung                 */
  /* ================================================================== */

  function applyRenderScale() {
    var width = 0;
    var height = 0;
    if (canvas.getBoundingClientRect) {
      var rect = canvas.getBoundingClientRect();
      width = rect.width || 0;
      height = rect.height || 0;
    }
    if (!width) {
      width = window.innerWidth || BASE_W;
    }
    if (!height) {
      height = width * BASE_H / BASE_W;
    }
    var ratio = Math.min(width / BASE_W, height / BASE_H);
    var dpr = window.devicePixelRatio || 1;
    if (!isFinite(dpr) || dpr <= 0) {
      dpr = 1;
    }
    // Ganzzahliges Vielfaches: 1 Spielepixel = n Geraetepixel. Gerundet
    // (nicht aufgerundet), damit der Browser die Pixelkunst hoechstens leicht
    // vergroessert - beim Verkleinern gingen sonst duenne Linien verloren.
    var wanted = Math.round(ratio * dpr);
    var next = Math.max(1, Math.min(3, wanted));
    if (next === renderScale && canvas.width === BASE_W * next) {
      return;
    }
    renderScale = next;
    canvas.width = BASE_W * next;
    canvas.height = BASE_H * next;
    // Nach jeder Groessenaenderung ist der Kontext zurueckgesetzt.
    ctx.setTransform(next, 0, 0, next, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function applyViewport() {
    viewportQueued = false;
    var vw = window.innerWidth || BASE_W;
    var vh = window.innerHeight || BASE_H;
    var vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) {
      vw = vv.width;
      vh = vv.height;
    }
    var root = document.documentElement;
    if (root && root.style && root.style.setProperty) {
      root.style.setProperty("--app-vw", Math.round(vw) + "px");
      root.style.setProperty("--app-vh", Math.round(vh) + "px");
      root.style.setProperty("--app-portrait", vh >= vw ? "1" : "0");
    }
    fitStage(vw, vh);
    applyRenderScale();
  }

  // Buehne so gross wie moeglich, aber immer komplett sichtbar: 16:9 in
  // Breite und Hoehe einpassen, abzueglich Playbar und Aussenrand.
  function fitStage(vw, vh) {
    var shell = document.querySelector ? document.querySelector(".play-shell") : null;
    if (!shell || !shell.style || !shell.style.setProperty) {
      return;
    }
    var chrome = 0;
    var bar = document.querySelector ? document.querySelector(".playbar") : null;
    if (bar && bar.offsetHeight) {
      chrome = bar.offsetHeight;
    } else {
      chrome = 62;
    }
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var touchReserve = (coarse || vw <= 760) ? 92 : 0;
    var reserve = chrome + 26 + touchReserve;
    var maxW = Math.min(1180, vw - 22);
    var maxH = Math.max(180, vh - reserve);
    var width = Math.min(maxW, maxH * BASE_W / BASE_H);
    shell.style.setProperty("--stage-w", Math.max(220, Math.round(width)) + "px");
    var docRoot = document.documentElement;
    if (docRoot && docRoot.style && docRoot.style.setProperty) {
      docRoot.style.setProperty("--app-hud", Math.round(reserve) + "px");
    }
  }

  function queueViewport() {
    if (viewportQueued) {
      return;
    }
    viewportQueued = true;
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(applyViewport);
    } else {
      applyViewport();
    }
  }

  function installViewportListeners() {
    window.addEventListener("resize", queueViewport, { passive: true });
    window.addEventListener("orientationchange", queueViewport, { passive: true });
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener("resize", queueViewport, { passive: true });
      window.visualViewport.addEventListener("scroll", queueViewport, { passive: true });
    }
    if (window.matchMedia) {
      var portrait = window.matchMedia("(orientation: portrait)");
      if (portrait && portrait.addEventListener) {
        portrait.addEventListener("change", queueViewport);
      }
    }
    if (document.addEventListener) {
      document.addEventListener("fullscreenchange", queueViewport);
      document.addEventListener("webkitfullscreenchange", queueViewport);
    }
  }

  function updateEffects(dt) {
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 10.5);
    }
    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt * 2.4);
    }
  }

  function updateFrameState(dt) {
    updateDayNight(dt);
    if (state.mode === "intro") {
      state.worldTime += dt;
      updateNpcs(dt);
      updateTraffic(dt);
      updateBirds(dt);
      updateIntro(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateEffects(dt);
      return;
    }
    if (state.mode === "playing") {
      state.worldTime += dt;
      updateNpcs(dt);
      updateTraffic(dt);
      updateBirds(dt);
      updatePlaying(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateEffects(dt);
      if (state.mode === "playing") {
        state.hudTick = (state.hudTick + 1) % 3;
        if (state.hudTick === 0) {
          updateHud(false);
        }
      }
      return;
    }
    if (state.mode === "dying") {
      state.worldTime += dt;
      updateNpcs(dt);
      updateTraffic(dt);
      updateBirds(dt);
      updateDeath(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateEffects(dt);
      state.hudTick = (state.hudTick + 1) % 4;
      if (state.hudTick === 0) {
        updateHud(false);
      }
      return;
    }
    if (state.mode === "outro") {
      state.worldTime += dt;
      updateNpcs(dt);
      updateTraffic(dt);
      updateBirds(dt);
      updateOutro(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateEffects(dt);
      return;
    }
    // Pause, Karte und Sieg lassen die Welt bewusst stehen.
    accumulator = 0;
  }

  function gameLoop(timestamp) {
    if (!running) {
      return;
    }
    var now = typeof timestamp === "number" ? timestamp : performance.now();
    if (!lastTimestamp) {
      lastTimestamp = now;
    }
    var delta = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    delta = clamp(delta || 0, 0, 0.1);

    if (state.mode === "intro" || state.mode === "playing" || state.mode === "dying" || state.mode === "outro") {
      accumulator += delta;
      var steps = 0;
      while (accumulator >= STEP && steps < 7) {
        updateFrameState(STEP);
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === 7) {
        accumulator = 0;
      }
    } else {
      accumulator = 0;
    }

    renderWorld();
    rafId = window.requestAnimationFrame(gameLoop);
  }

  function startLoop() {
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    running = true;
    lastTimestamp = performance.now();
    accumulator = 0;
    rafId = window.requestAnimationFrame(gameLoop);
  }

  function stopLoop() {
    running = false;
    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    accumulator = 0;
  }

  function toggleSound() {
    if (!window.RunnerAudio) {
      return;
    }
    window.RunnerAudio.toggle();
  }

  function onWindowBlur() {
    if (state.mode === "playing") {
      pauseGame();
    }
  }

  function bindGameEvents() {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("keydown", trapModalFocus);

    if (els.stage) {
      els.stage.addEventListener("pointerdown", onStagePointerDown);
    }

    var hudMap = document.getElementById("hud-map");
    var hudPause = document.getElementById("hud-pause");
    var minimapOpen = document.getElementById("minimap-open");
    var backBrowser = document.getElementById("back-browser");
    var resumeButton = document.getElementById("resume-btn");
    var pauseMapButton = document.getElementById("pause-map-btn");
    var restartButton = document.getElementById("restart-btn");
    var pauseBrowserButton = document.getElementById("pause-browser-btn");
    var pauseSound = document.getElementById("pause-sound");
    var winNext = document.getElementById("win-next");
    var winRestart = document.getElementById("win-restart");
    var winBrowser = document.getElementById("win-browser");
    var mapClose = document.getElementById("map-close");
    var mapResume = document.getElementById("map-resume");

    if (hudMap) {
      hudMap.addEventListener("click", openMap);
    }
    if (hudPause) {
      hudPause.addEventListener("click", pauseGame);
    }
    if (minimapOpen) {
      minimapOpen.addEventListener("click", openMap);
    }
    if (backBrowser) {
      backBrowser.addEventListener("click", function () {
        goBrowser(state.levelIndex);
      });
    }
    if (resumeButton) {
      resumeButton.addEventListener("click", resumeGame);
    }
    if (pauseMapButton) {
      pauseMapButton.addEventListener("click", openMap);
    }
    if (restartButton) {
      restartButton.addEventListener("click", restartLevel);
    }
    if (pauseBrowserButton) {
      pauseBrowserButton.addEventListener("click", function () {
        goBrowser(state.levelIndex);
      });
    }
    if (pauseSound) {
      pauseSound.addEventListener("click", toggleSound);
    }
    if (winNext) {
      winNext.addEventListener("click", function () {
        var next = winNext.dataset.next;
        if (next) {
          startLevel(Number(next));
        } else {
          goBrowser(LEVELS.length - 1);
        }
      });
    }
    if (winRestart) {
      winRestart.addEventListener("click", restartLevel);
    }
    if (winBrowser) {
      winBrowser.addEventListener("click", function () {
        goBrowser(Math.min(LEVELS.length - 1, state.levelIndex + 1));
      });
    }
    if (mapClose) {
      mapClose.addEventListener("click", closeMap);
    }
    if (mapResume) {
      mapResume.addEventListener("click", closeMap);
    }
    if (els.mapModal) {
      els.mapModal.addEventListener("click", function (event) {
        if (event.target === els.mapModal) {
          closeMap();
        }
      });
    }

    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        onWindowBlur();
      }
    });

    bindTouchControls();
  }

  function initGame() {
    installViewportListeners();
    applyViewport();
    bindGameEvents();
    if (reducedMotionQuery) {
      var onMotionPreference = function (event) {
        reduceMotion = Boolean(event.matches);
        if (reduceMotion) {
          state.shake = 0;
          state.flash = 0;
        }
      };
      if (reducedMotionQuery.addEventListener) {
        reducedMotionQuery.addEventListener("change", onMotionPreference);
      } else if (reducedMotionQuery.addListener) {
        reducedMotionQuery.addListener(onMotionPreference);
      }
    }
  }

  window.RunnerGame = {
    start: function (index) {
      var safeIndex = Number(index);
      if (!isFinite(safeIndex)) {
        safeIndex = 0;
      }
      safeIndex = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(safeIndex)));
      var level = LEVELS[safeIndex];
      if (!level) {
        return;
      }
      if (window.RunnerStore && !window.RunnerStore.isUnlocked(level)) {
        return;
      }
      state.endless = false;
      window.clearTimeout(state.endlessAdvanceTimer);
      state.endlessAdvanceTimer = null;
      window.RunnerAudio.ensure();
      startLevel(safeIndex);
    },
    startEndless: function () {
      if (!LEVELS.length) {
        return;
      }
      window.RunnerAudio.ensure();
      startEndless();
    },
    stop: function () {
      stopLoop();
    },
    goBrowser: goBrowser,
    pause: pauseGame,
    restart: restartLevel,
    forceFall: function () {
      if (state.player && state.level && state.mode === "playing") {
        state.player.y = H + 90;
        respawnPlayer();
      }
    },
    debug: function () {
      return {
        mode: state.mode,
        endless: state.endless,
        autoRun: state.autoRun,
        autoTarget: state.autoTarget,
        elapsed: state.elapsed,
        hits: state.hits,
        falls: state.falls,
        carHits: state.carHits,
        coins: state.collected.size,
        coinIds: Array.from(state.collected),
        lane: state.player ? state.player.lane : 0,
        scooterHits: state.scooterHits,
        player: state.player ? {
          x: state.player.x,
          y: state.player.y,
          vx: state.player.vx,
          vy: state.player.vy,
          h: state.player.h,
          crouching: state.player.crouching,
          onGround: state.player.onGround,
          standing: state.player.standing
        } : null,
        standing: state.standing,
        activeCheckpoint: state.activeCheckpoint,
        lastCheckpoint: state.lastCheckpoint,
        lastSafe: state.lastSafe,
        meters: metersLeft(),
        camera: Math.round(state.camera),
        levelId: state.level ? state.level.id : null,
        platformCount: state.level ? state.level.platforms.length : 0,
        npcs: state.npcs.map(function (npc) {
          return { type: npc.type, x: Math.round(npc.x), y: Math.round(npc.y) };
        }),
        traffic: state.traffic.map(function (car) {
          return { type: car.carType, x: Math.round(car.x), y: Math.round(car.y), lane: car.lane, dir: car.dir };
        }),
        birds: state.birds.map(function (bird) {
          return { x: Math.round(bird.x), y: Math.round(bird.y), low: Boolean(bird.low), active: bird.active };
        }),
        jumpLog: state.jumpLog.slice()
      };
    }
  };

  initGame();
})();





