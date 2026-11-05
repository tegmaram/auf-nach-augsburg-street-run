/*
 * Auf nach Augsburg
 * Pixel scenery, HUD, route logic and the pixelated Google Maps panel.
 *
 * The game itself is still the little canvas engine from reruns/mario.
 * Everything in this file is new: Augsburg landmarks, Bavarian palette,
 * route progress, start/pause/win screens and the optional Static Maps API.
 */
(function() {
  if (typeof Mario === 'undefined') window.Mario = {};

  var A = Mario.Augsburg = {};
  var W = 256;
  var H = 240;

  var MAP_CENTER = { lat: 48.3684, lng: 10.8951 };
  var MAP_ZOOM = 13;
  var MAP_STORAGE_KEY = 'aufnachaugsburg.mapsKey';
  var SOUND_STORAGE_KEY = 'aufnachaugsburg.sound';

  var ROUTE = [
    { id: 'hbf',      name: 'HAUPTBAHNHOF', short: 'HAUPTBAHNHOF', world: 0.00, lat: 48.3654, lng: 10.8859, color: '#f2c14e' },
    { id: 'koenig',   name: 'KÖNIGSPLATZ',   short: 'KÖNIGSPLATZ', world: 0.23, lat: 48.3690, lng: 10.8943, color: '#e87f4b' },
    { id: 'rathaus',  name: 'RATHAUS & PERLACHTURM', short: 'RATHAUS', world: 0.48, lat: 48.3688, lng: 10.8987, color: '#d9534f' },
    { id: 'dom',      name: 'DOM',            short: 'DOM',         world: 0.68, lat: 48.3698, lng: 10.8973, color: '#7fb7e8' },
    { id: 'fuggerei', name: 'FUGGEREI',       short: 'FUGGEREI',    world: 0.88, lat: 48.3709, lng: 10.9042, color: '#8fbc72' }
  ];

  var FALLBACK_POINTS = {
    hbf: [0.13, 0.76],
    koenig: [0.35, 0.58],
    rathaus: [0.52, 0.60],
    dom: [0.60, 0.48],
    fuggerei: [0.81, 0.40]
  };

  var MAP_STYLES = [
    'feature:landscape|element:geometry|color:0xd9cfae',
    'feature:landscape.man_made|element:geometry|color:0xc8bd99',
    'feature:water|element:geometry|color:0x3f7fbf',
    'feature:road|element:geometry|color:0xf4ead0',
    'feature:road.local|element:geometry|color:0xe8dcc0',
    'feature:road.highway|element:geometry|color:0xe0a458',
    'feature:road|element:labels|visibility:off',
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:administrative|element:labels|visibility:off',
    'feature:building|element:geometry|color:0xb7a17a'
  ];

  // 5x7 bitmap font for the in-world signs. Keeps the pixels crunchy.
  var FONT = {
    'A': [0x0E,0x11,0x11,0x1F,0x11,0x11,0x11],
    'B': [0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E],
    'C': [0x0E,0x11,0x10,0x10,0x10,0x11,0x0E],
    'D': [0x1E,0x11,0x11,0x11,0x11,0x11,0x1E],
    'E': [0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F],
    'F': [0x1F,0x10,0x10,0x1E,0x10,0x10,0x10],
    'G': [0x0E,0x11,0x10,0x17,0x11,0x11,0x0E],
    'H': [0x11,0x11,0x11,0x1F,0x11,0x11,0x11],
    'I': [0x1F,0x04,0x04,0x04,0x04,0x04,0x1F],
    'J': [0x07,0x02,0x02,0x02,0x12,0x12,0x0C],
    'K': [0x11,0x12,0x14,0x18,0x14,0x12,0x11],
    'L': [0x10,0x10,0x10,0x10,0x10,0x10,0x1F],
    'M': [0x11,0x1B,0x15,0x15,0x11,0x11,0x11],
    'N': [0x11,0x19,0x15,0x13,0x11,0x11,0x11],
    'O': [0x0E,0x11,0x11,0x11,0x11,0x11,0x0E],
    'P': [0x1E,0x11,0x11,0x1E,0x10,0x10,0x10],
    'Q': [0x0E,0x11,0x11,0x11,0x15,0x12,0x0D],
    'R': [0x1E,0x11,0x11,0x1E,0x14,0x12,0x11],
    'S': [0x0F,0x10,0x10,0x0E,0x01,0x01,0x1E],
    'T': [0x1F,0x04,0x04,0x04,0x04,0x04,0x04],
    'U': [0x11,0x11,0x11,0x11,0x11,0x11,0x0E],
    'V': [0x11,0x11,0x11,0x11,0x11,0x0A,0x04],
    'W': [0x11,0x11,0x11,0x15,0x15,0x1B,0x11],
    'X': [0x11,0x11,0x0A,0x04,0x0A,0x11,0x11],
    'Y': [0x11,0x11,0x0A,0x04,0x04,0x04,0x04],
    'Z': [0x1F,0x01,0x02,0x04,0x08,0x10,0x1F],
    '0': [0x0E,0x13,0x15,0x15,0x15,0x19,0x0E],
    '1': [0x04,0x0C,0x04,0x04,0x04,0x04,0x0E],
    '2': [0x0E,0x11,0x01,0x02,0x04,0x08,0x1F],
    '3': [0x1E,0x01,0x01,0x0E,0x01,0x01,0x1E],
    '4': [0x02,0x06,0x0A,0x12,0x1F,0x02,0x02],
    '5': [0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E],
    '6': [0x06,0x08,0x10,0x1E,0x11,0x11,0x0E],
    '7': [0x1F,0x01,0x02,0x04,0x08,0x08,0x08],
    '8': [0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E],
    '9': [0x0E,0x11,0x11,0x0F,0x01,0x02,0x0C],
    ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    '.': [0x00,0x00,0x00,0x00,0x00,0x06,0x06],
    '-': [0x00,0x00,0x00,0x1F,0x00,0x00,0x00],
    '&': [0x0C,0x12,0x14,0x08,0x15,0x12,0x0D],
    ':': [0x00,0x06,0x06,0x00,0x06,0x06,0x00],
    '!': [0x04,0x04,0x04,0x04,0x04,0x00,0x04],
    '?': [0x0E,0x11,0x01,0x02,0x04,0x00,0x04]
  };

  var el = {};
  var initialized = false;
  var started = false;
  var paused = false;
  var won = false;
  var soundOn = true;
  var elapsed = 0;
  var lastHudPaint = 0;
  var mapKey = '';
  var mapImage = null;
  var mapState = 'fallback';
  var mapRequestId = 0;
  var mapOpen = false;
  var mapWasPaused = false;
  var baseCache = {};

  window.gameStarted = false;
  window.gamePaused = false;
  window.gameWon = false;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function px(ctx, x, y, color) {
    rect(ctx, x, y, 1, 1, color);
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* file:// or private mode */ }
  }

  function drawText(ctx, text, x, y, color, scale) {
    scale = scale || 1;
    var cx = Math.round(x);
    var cy = Math.round(y);
    text = String(text).toUpperCase();
    for (var i = 0; i < text.length; i++) {
      var glyph = FONT[text.charAt(i)];
      if (!glyph) glyph = FONT['?'];
      for (var row = 0; row < 7; row++) {
        var bits = glyph[row];
        for (var col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            ctx.fillStyle = color;
            ctx.fillRect(cx + col * scale, cy + row * scale, scale, scale);
          }
        }
      }
      cx += 6 * scale;
    }
  }

  function textWidth(text, scale) {
    scale = scale || 1;
    return String(text).length * 6 * scale - scale;
  }

  function fmtTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function routeProgress() {
    if (!level || !level.exit) return 0;
    return clamp(vX / (level.exit * 16), 0, 1);
  }

  function currentLandmark(progress) {
    var found = ROUTE[0];
    for (var i = 0; i < ROUTE.length; i++) {
      if (progress >= ROUTE[i].world - 0.0001) found = ROUTE[i];
    }
    return found;
  }

  /* ------------------------------------------------------------------ */
  /* Augsburg pixel scenery                                             */
  /* ------------------------------------------------------------------ */

  function drawSky(ctx) {
    var bands = [
      [0, 36, '#4f93cf'],
      [36, 34, '#63a9dd'],
      [70, 34, '#7dbce7'],
      [104, 30, '#9ed4ef'],
      [134, 26, '#bde2f4'],
      [160, 80, '#d4ecf5']
    ];
    for (var i = 0; i < bands.length; i++) {
      rect(ctx, 0, bands[i][0], W, bands[i][1], bands[i][2]);
    }
    for (var x = 0; x < W; x += 4) {
      rect(ctx, x, 160, 2, 1, 'rgba(255,255,255,0.18)');
    }
  }

  function drawSun(ctx) {
    var x = 211, y = 40;
    rect(ctx, x - 3, y - 11, 6, 2, 'rgba(255,232,140,0.5)');
    rect(ctx, x - 3, y + 9, 6, 2, 'rgba(255,232,140,0.5)');
    rect(ctx, x - 13, y - 3, 2, 6, 'rgba(255,232,140,0.5)');
    rect(ctx, x + 11, y - 3, 2, 6, 'rgba(255,232,140,0.5)');
    rect(ctx, x - 11, y - 9, 2, 2, 'rgba(255,232,140,0.4)');
    rect(ctx, x + 9, y + 7, 2, 2, 'rgba(255,232,140,0.4)');
    rect(ctx, x - 8, y - 8, 16, 16, '#ffd95e');
    rect(ctx, x - 10, y - 5, 20, 10, '#ffd95e');
    rect(ctx, x - 5, y - 10, 10, 20, '#ffd95e');
    rect(ctx, x - 6, y - 6, 12, 12, '#ffe884');
    rect(ctx, x - 3, y - 3, 6, 6, '#fff3b0');
  }

  function drawCloud(ctx, x, y, s) {
    var w = Math.round(34 * s);
    var h = Math.round(9 * s);
    rect(ctx, x + 4, y + 4, w - 8, h, '#d3e8f5');
    rect(ctx, x, y + 2, 10, 6, '#f5fbff');
    rect(ctx, x + 7, y, 12, 5, '#f5fbff');
    rect(ctx, x + 18, y + 2, 10, 5, '#f5fbff');
    rect(ctx, x + w - 9, y + 4, 7, 4, '#eaf5fc');
    rect(ctx, x + 9, y + 7, w - 18, 2, '#eaf5fc');
  }

  function drawClouds(ctx, vX) {
    var period = 420;
    var off = (vX * 0.055) % period;
    for (var i = -period; i < W + period; i += period) {
      drawCloud(ctx, i - off + 22, 52, 1.0);
      drawCloud(ctx, i - off + 205, 31, 0.78);
      drawCloud(ctx, i - off + 338, 73, 0.62);
    }
  }

  function drawMountainRange(ctx, vX, factor, base, minH, maxH, color, snow) {
    var offset = vX * factor;
    for (var x = -4; x < W + 4; x += 4) {
      var wx = x + offset;
      var n = Math.abs(Math.sin(wx * 0.017)) * 0.62 +
              Math.abs(Math.sin(wx * 0.006 + 1.7)) * 0.38;
      var h = Math.round(minH + n * (maxH - minH));
      rect(ctx, x, base - h, 4, h, color);
      if (n > 0.73) rect(ctx, x, base - h, 4, 3, snow);
    }
  }

  function drawAlps(ctx, vX) {
    drawMountainRange(ctx, vX, 0.075, 170, 14, 30, '#9db7ce', '#edf7ff');
    drawMountainRange(ctx, vX, 0.13, 183, 20, 42, '#7f9fbd', '#dcefff');
  }

  function drawDistantBlock(ctx, x, base, w, h, color) {
    rect(ctx, x, base - h, w, h, color);
    rect(ctx, x + 2, base - h - 2, w - 4, 2, '#a88d84');
    for (var wy = base - h + 6; wy < base - 4; wy += 7) {
      for (var wx = x + 4; wx < x + w - 3; wx += 7) {
        rect(ctx, wx, wy, 2, 3, 'rgba(106,132,148,0.55)');
      }
    }
  }

  function drawDistantTower(ctx, x, base, w, h) {
    rect(ctx, x, base - h, w, h, '#aebfc8');
    rect(ctx, x + 2, base - h - 6, w - 4, 6, '#9c8d86');
    for (var y = base - h + 8; y < base - 5; y += 9) {
      rect(ctx, x + 4, y, 2, 4, 'rgba(106,132,148,0.5)');
    }
  }

  function drawDistantCity(ctx, vX) {
    var period = 460;
    var off = (vX * 0.27) % period;
    for (var i = -period; i < W + period; i += period) {
      var x = i - off;
      drawDistantBlock(ctx, x + 18, 198, 38, 28, '#b8c8cf');
      drawDistantBlock(ctx, x + 64, 198, 26, 20, '#b3c4cc');
      drawDistantTower(ctx, x + 98, 198, 16, 52);
      drawDistantBlock(ctx, x + 122, 198, 46, 25, '#b8c8cf');
      drawDistantBlock(ctx, x + 176, 198, 30, 34, '#aebfc8');
      drawDistantTower(ctx, x + 216, 198, 12, 38);
      drawDistantBlock(ctx, x + 236, 198, 54, 22, '#b8c8cf');
      drawDistantBlock(ctx, x + 300, 198, 36, 30, '#b3c4cc');
      drawDistantTower(ctx, x + 346, 198, 14, 46);
      drawDistantBlock(ctx, x + 368, 198, 58, 24, '#b8c8cf');
    }
  }

  function drawTree(ctx, x, base, s) {
    var trunkH = Math.round(8 * s);
    rect(ctx, x - 1, base - trunkH, 2, trunkH, '#5a3d2b');
    rect(ctx, x - 6, base - trunkH - 5, 12, 4, '#3c6b3f');
    rect(ctx, x - 8, base - trunkH - 2, 16, 4, '#4d8149');
    rect(ctx, x - 5, base - trunkH - 9, 10, 4, '#5b9550');
    rect(ctx, x - 10, base - trunkH - 1, 4, 3, '#3c6b3f');
    rect(ctx, x + 6, base - trunkH - 4, 4, 3, '#3c6b3f');
  }

  function drawHouseRow(ctx, x, base, w, h) {
    for (var i = 0; i < w; i += 14) {
      var hh = h - ((i / 14) % 3 === 1 ? 4 : 0);
      rect(ctx, x + i, base - hh, 14, hh, '#e6d5ae');
      rect(ctx, x + i + 10, base - hh, 4, hh, 'rgba(120,94,61,0.16)');
      rect(ctx, x + i - 1, base - hh - 3, 16, 3, '#a84635');
      rect(ctx, x + i + 3, base - hh - 5, 8, 3, '#8f382d');
      rect(ctx, x + i + 3, base - hh + 5, 3, 4, '#4a3a2a');
      rect(ctx, x + i + 8, base - hh + 5, 3, 4, '#4a3a2a');
      rect(ctx, x + i + 5, base - 6, 4, 6, '#4a3a2a');
    }
  }

  function drawCityWall(ctx, x, base, w) {
    rect(ctx, x, base - 12, w, 12, '#b7a27a');
    for (var i = 0; i < w; i += 8) {
      rect(ctx, x + i, base - 15, 5, 3, '#c7b48d');
      rect(ctx, x + i + 1, base - 8, 6, 1, 'rgba(75,60,42,0.35)');
    }
    rect(ctx, x, base - 1, w, 1, '#7e6e54');
  }

  function drawTram(ctx, x, base) {
    rect(ctx, x, base - 14, 32, 9, '#dfe9ef');
    rect(ctx, x, base - 18, 32, 4, '#2b5aa6');
    rect(ctx, x + 2, base - 13, 6, 5, '#7fb7e8');
    rect(ctx, x + 10, base - 13, 6, 5, '#7fb7e8');
    rect(ctx, x + 18, base - 13, 6, 5, '#7fb7e8');
    rect(ctx, x + 26, base - 13, 4, 5, '#7fb7e8');
    rect(ctx, x + 6, base - 5, 3, 3, '#24313d');
    rect(ctx, x + 23, base - 5, 3, 3, '#24313d');
    rect(ctx, x + 12, base - 23, 8, 1, '#24313d');
    rect(ctx, x + 15, base - 22, 2, 4, '#24313d');
  }

  function drawMidTown(ctx, vX) {
    var period = 380;
    var off = (vX * 0.5) % period;
    for (var i = -period; i < W + period; i += period) {
      var x = i - off;
      drawTree(ctx, x + 10, 208, 0.9);
      drawHouseRow(ctx, x + 26, 208, 78, 24);
      drawCityWall(ctx, x + 110, 208, 54);
      drawTree(ctx, x + 174, 208, 1.15);
      drawTram(ctx, x + 202, 208);
      drawHouseRow(ctx, x + 244, 208, 52, 21);
      drawTree(ctx, x + 304, 208, 0.8);
      drawHouseRow(ctx, x + 318, 208, 42, 26);
    }
  }

  function drawRiver(ctx, vX) {
    rect(ctx, 0, 204, W, 36, '#3f7fbf');
    rect(ctx, 0, 204, W, 2, '#2f6690');
    for (var x = -12; x < W + 12; x += 12) {
      var wx = ((x + Math.floor(vX * 0.72)) % (W + 24) + (W + 24)) % (W + 24) - 12;
      rect(ctx, wx, 210, 5, 1, '#7fc4e8');
      rect(ctx, wx + 6, 219, 4, 1, '#8fd0ef');
      rect(ctx, wx + 2, 230, 7, 1, '#6fb4dc');
    }
    for (var w = 0; w < 9; w++) {
      var rx = ((w * 47 + Math.floor(vX * 0.45)) % (W + 30)) - 15;
      rect(ctx, rx, 224, 2, 1, '#d7ecf5');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Landmarks                                                           */
  /* ------------------------------------------------------------------ */

  function drawStation(ctx, cx, base) {
    var w = 90, h = 28, x = cx - w / 2, y = base - h;

    // main hall and side wings
    rect(ctx, x + 8, y + 8, w - 16, h - 8, '#e9dab7');
    rect(ctx, x, y + 12, 14, h - 12, '#ddcba3');
    rect(ctx, x + w - 14, y + 12, 14, h - 12, '#ddcba3');

    // roof bands
    rect(ctx, x + 6, y + 4, w - 12, 4, '#a84635');
    rect(ctx, x + 4, y, w - 8, 4, '#3e4f63');

    // blue station band with the HBF lettering
    rect(ctx, cx - 24, y + 8, 48, 8, '#2b5aa6');
    rect(ctx, cx - 24, y + 8, 48, 1, '#5b8fcb');
    drawText(ctx, 'HBF', cx - 8, y + 9, '#fff4cf', 1);

    // side wing windows
    for (var i = 0; i < 2; i++) {
      rect(ctx, x + 3 + i * 6, y + 18, 4, 6, '#7fb7e8');
      rect(ctx, x + w - 7 - i * 6, y + 18, 4, 6, '#7fb7e8');
    }

    // glass facade
    for (var g = 0; g < 4; g++) {
      rect(ctx, x + 16 + g * 10, y + 18, 6, 8, '#7fb7e8');
      rect(ctx, x + 17 + g * 10, y + 19, 4, 6, '#b9e4f4');
    }

    // main entrance
    rect(ctx, cx - 8, y + 17, 16, 11, '#3a2a1c');
    rect(ctx, cx - 6, y + 18, 12, 10, '#4a6f96');
    rect(ctx, cx - 4, y + 20, 8, 8, '#7fb7e8');

    // clock tower
    rect(ctx, cx - 7, y - 12, 14, 20, '#efe0bb');
    rect(ctx, cx - 9, y - 14, 18, 3, '#a84635');
    rect(ctx, cx - 7, y - 15, 14, 1, '#6b5b46');
    rect(ctx, cx - 6, y - 9, 12, 12, '#f4e8c5');
    rect(ctx, cx - 5, y - 8, 10, 10, '#f8f0d8');
    rect(ctx, cx - 1, y - 7, 2, 4, '#2b2b2b');
    rect(ctx, cx + 1, y - 4, 3, 1, '#2b2b2b');
    rect(ctx, cx - 3, y - 7, 1, 2, '#2b2b2b');
    rect(ctx, cx - 1, y - 2, 2, 2, '#a84635');

    // platform canopy
    rect(ctx, x + w - 24, y + 14, 26, 2, '#3e4f63');
    rect(ctx, x + w - 22, y + 16, 2, 12, '#5a4a3a');
    rect(ctx, x + w - 4, y + 16, 2, 12, '#5a4a3a');

    // platform edge
    rect(ctx, x - 2, base - 1, w + 4, 1, '#6b5b46');
  }

  function drawKoenigsplatz(ctx, cx, base) {
    rect(ctx, cx - 28, base - 2, 56, 2, '#cbbd9a');
    drawTree(ctx, cx - 22, base, 0.75);
    drawTree(ctx, cx + 22, base, 0.75);
    rect(ctx, cx - 11, base - 7, 22, 5, '#7fb7e8');
    rect(ctx, cx - 9, base - 6, 18, 2, '#b9e4f4');
    rect(ctx, cx - 5, base - 10, 10, 4, '#b7a27a');
    rect(ctx, cx - 3, base - 33, 6, 24, '#e3d2ac');
    rect(ctx, cx - 4, base - 36, 8, 4, '#f2c14e');
    rect(ctx, cx - 1, base - 39, 2, 3, '#f2c14e');
    rect(ctx, cx + 2, base - 33, 2, 24, '#cbb98f');
    rect(ctx, cx - 16, base - 13, 7, 1, '#6f5f49');
    rect(ctx, cx + 10, base - 13, 7, 1, '#6f5f49');
  }

  function drawRathaus(ctx, cx, base) {
    var w = 72, h = 36, x = cx - w / 2, y = base - h;
    rect(ctx, x, y + 8, 14, h - 8, '#e3d2ac');
    rect(ctx, x + w - 14, y + 8, 14, h - 8, '#e3d2ac');
    rect(ctx, x + 14, y, 44, h, '#e9dab7');
    rect(ctx, x + 12, y - 2, 48, 4, '#a84635');
    rect(ctx, x + 2, y + 5, 12, 3, '#a84635');
    rect(ctx, x + w - 14, y + 5, 12, 3, '#a84635');

    var gable = [44, 38, 30, 22, 14, 6];
    for (var g = 0; g < gable.length; g++) {
      rect(ctx, cx - gable[g] / 2, y - 4 - g * 3, gable[g], 3, g % 2 ? '#cdbb91' : '#e9dab7');
    }
    rect(ctx, cx - 2, y - 24, 4, 6, '#f2c14e');
    rect(ctx, cx - 1, y - 27, 2, 3, '#f2c14e');

    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        rect(ctx, x + 20 + col * 13, y + 9 + row * 8, 5, 4, '#5b4632');
      }
    }
    for (var r2 = 0; r2 < 2; r2++) {
      rect(ctx, x + 3, y + 13 + r2 * 8, 5, 4, '#5b4632');
      rect(ctx, x + w - 8, y + 13 + r2 * 8, 5, 4, '#5b4632');
    }
    rect(ctx, cx - 6, base - 13, 12, 13, '#4a2f20');
    rect(ctx, cx - 4, base - 16, 8, 4, '#4a2f20');
    rect(ctx, cx - 4, y + 3, 8, 3, '#f2c14e');
    rect(ctx, cx + 2, y + 3, 2, 3, '#c28b2e');
  }

  function drawPerlachturm(ctx, cx, base) {
    var w = 16, h = 72, x = cx - w / 2, y = base - h;
    rect(ctx, x - 3, base - 10, w + 6, 10, '#d8c69e');
    rect(ctx, x, y, w, h, '#e7d7ad');
    rect(ctx, x + w - 3, y, 3, h, '#cbb98f');
    for (var i = 0; i < 5; i++) {
      rect(ctx, cx - 2, base - 17 - i * 10, 4, 6, '#5b4632');
    }
    rect(ctx, cx - 5, base - 58, 10, 10, '#f4e8c5');
    rect(ctx, cx - 4, base - 57, 8, 8, '#3c2a1c');
    rect(ctx, cx, base - 56, 1, 4, '#f4e8c5');
    rect(ctx, cx + 1, base - 54, 2, 1, '#f4e8c5');
    var widths = [16, 14, 12, 10, 8, 6, 4, 2];
    for (var r = 0; r < widths.length; r++) {
      rect(ctx, cx - widths[r] / 2, y - 4 - r * 3, widths[r], 3, r % 2 ? '#3b9482' : '#2f7d6d');
    }
    rect(ctx, cx, y - 30, 1, 8, '#f2c14e');
    rect(ctx, cx - 1, y - 33, 3, 3, '#ffe27a');
    rect(ctx, x - 1, y + 9, 3, 9, '#b63b2f');
  }

  function drawDom(ctx, cx, base) {
    var w = 54, h = 34, x = cx - w / 2, y = base - h;
    rect(ctx, x + 12, y + 8, w - 24, h - 8, '#e3d2ac');
    for (var s = 0; s < 6; s++) {
      rect(ctx, x + 14 + s * 2, y + 2 + s * 2, w - 28 - s * 4, 2, '#a84635');
    }
    var towerXs = [x, x + w - 12];
    for (var t = 0; t < 2; t++) {
      var tx = towerXs[t];
      rect(ctx, tx, y - 10, 12, h + 10, '#e9dab7');
      rect(ctx, tx + 10, y - 10, 2, h + 10, '#cbb98f');
      for (var j = 0; j < 3; j++) {
        rect(ctx, tx + 3, y + 9 + j * 9, 4, 5, '#5b4632');
      }
      var roofWidths = [12, 10, 8, 6, 4, 2];
      for (var rw = 0; rw < roofWidths.length; rw++) {
        rect(ctx, tx + 6 - roofWidths[rw] / 2, y - 14 - rw * 3, roofWidths[rw], 3, rw % 2 ? '#4f6276' : '#3e4f63');
      }
      rect(ctx, tx + 5, y - 32, 1, 4, '#f2c14e');
      rect(ctx, tx + 3, y - 30, 5, 1, '#f2c14e');
    }
    rect(ctx, cx - 5, y + 13, 10, 10, '#7fb7e8');
    rect(ctx, cx - 3, y + 15, 6, 6, '#d9edf9');
    rect(ctx, cx - 1, y + 17, 3, 3, '#f2c14e');
    rect(ctx, cx - 3, base - 13, 6, 13, '#4a2f20');
    rect(ctx, cx - 2, base - 15, 4, 3, '#4a2f20');
  }

  function drawFuggerei(ctx, cx, base) {
    var w = 84, x = cx - w / 2;
    rect(ctx, x - 4, base - 8, w + 8, 8, '#b7a27a');
    for (var i = 0; i < 5; i++) {
      var hx = x + i * 16;
      rect(ctx, hx, base - 18, 14, 18, '#e3d2ac');
      rect(ctx, hx + 10, base - 18, 4, 18, 'rgba(120,94,61,0.15)');
      rect(ctx, hx - 1, base - 21, 16, 3, '#a84635');
      rect(ctx, hx + 2, base - 23, 10, 3, '#8f382d');
      rect(ctx, hx + 2, base - 8, 4, 8, '#4a2f20');
      rect(ctx, hx + 9, base - 14, 3, 3, '#5b4632');
      drawTree(ctx, hx + 7, base - 18, 0.28);
    }
    rect(ctx, cx - 6, base - 17, 12, 17, '#4a2f20');
    rect(ctx, cx - 4, base - 21, 8, 5, '#4a2f20');
    rect(ctx, cx - 26, base - 32, 52, 9, '#2a1a12');
    rect(ctx, cx - 25, base - 31, 50, 7, '#3b2618');
    drawText(ctx, 'FUGGEREI', cx - 24, base - 30, '#f2c14e', 1);
    rect(ctx, cx - 26, base - 23, 2, 23, '#6b4a2c');
    rect(ctx, cx + 24, base - 23, 2, 23, '#6b4a2c');
  }

  function drawGoalGate(ctx, cx, base) {
    rect(ctx, cx - 46, base - 40, 92, 40, '#d8c69e');
    rect(ctx, cx - 34, base - 30, 68, 30, '#c7b284');
    rect(ctx, cx - 24, base - 26, 48, 26, '#2a1a12');
    rect(ctx, cx - 20, base - 30, 40, 4, '#b63b2f');
    rect(ctx, cx - 46, base - 44, 12, 44, '#e3d2ac');
    rect(ctx, cx + 34, base - 44, 12, 44, '#e3d2ac');
    rect(ctx, cx - 49, base - 48, 18, 5, '#a84635');
    rect(ctx, cx + 31, base - 48, 18, 5, '#a84635');
    rect(ctx, cx - 48, base - 57, 16, 9, '#e7d7ad');
    rect(ctx, cx + 32, base - 57, 16, 9, '#e7d7ad');
    rect(ctx, cx - 50, base - 61, 20, 4, '#a84635');
    rect(ctx, cx + 30, base - 61, 20, 4, '#a84635');
    rect(ctx, cx - 26, base - 52, 52, 13, '#2b5aa6');
    rect(ctx, cx - 25, base - 51, 50, 11, '#f4e8c5');
    drawText(ctx, 'AUGSBURG', cx - 24, base - 49, '#2b5aa6', 1);
    rect(ctx, cx - 2, base - 40, 4, 10, '#f2c14e');
  }

  function drawLandmarks(ctx, vX) {
    var exitPx = level.exit * 16;
    var items = [
      { world: 0.035, draw: drawStation },
      { world: 0.23, draw: drawKoenigsplatz },
      { world: 0.46, draw: drawRathaus },
      { world: 0.50, draw: drawPerlachturm },
      { world: 0.68, draw: drawDom },
      { world: 0.86, draw: drawFuggerei },
      { world: 0.99, draw: drawGoalGate }
    ];
    for (var i = 0; i < items.length; i++) {
      var screenX = items[i].world * exitPx - vX;
      if (screenX < -100 || screenX > W + 100) continue;
      items[i].draw(ctx, screenX, 208);
    }
  }

  function drawSign(ctx, x, y, text) {
    var w = textWidth(text, 1) + 8;
    var h = 13;
    rect(ctx, x + 1, y + h, 2, 208 - (y + h), '#5a3d2b');
    rect(ctx, x + w - 3, y + h, 2, 208 - (y + h), '#5a3d2b');
    rect(ctx, x - 1, y - 1, w + 2, h + 2, '#20130c');
    rect(ctx, x, y, w, h, '#3b2618');
    rect(ctx, x, y, w, 2, '#8a5a33');
    rect(ctx, x + 1, y + 2, w - 2, 1, '#24160e');
    drawText(ctx, text, x + 4, y + 4, '#f2c14e', 1);
  }

  function drawSigns(ctx, vX) {
    var exitPx = level.exit * 16;
    var signs = [
      { p: 0.09, text: 'AUGSBURG' },
      { p: 0.18, text: 'KOENIGSPLATZ' },
      { p: 0.41, text: 'RATHAUS' },
      { p: 0.62, text: 'DOM' }
    ];
    for (var i = 0; i < signs.length; i++) {
      var x = signs[i].p * exitPx - vX;
      if (x < -110 || x > W + 20) continue;
      drawSign(ctx, x, 174, signs[i].text);
    }
  }

  function drawBirds(ctx, vX) {
    var off = (vX * 0.035) % 320;
    for (var i = 0; i < 3; i++) {
      var x = (i * 94 + 250 - off) % 320;
      if (x < 0) x += 320;
      var y = 58 + i * 9;
      rect(ctx, x - 3, y, 2, 1, '#31495f');
      rect(ctx, x - 1, y + 1, 2, 1, '#31495f');
      rect(ctx, x + 1, y, 2, 1, '#31495f');
    }
  }

  function drawForegroundGlow(ctx) {
    // Warm Altstadt light near the bottom of the sky.
    for (var x = 0; x < W; x += 8) {
      rect(ctx, x, 197, 4, 1, 'rgba(255,230,170,0.12)');
    }
  }

  A.drawBackground = function(ctx, vX) {
    drawSky(ctx);
    drawSun(ctx);
    drawBirds(ctx, vX);
    drawClouds(ctx, vX);
    drawAlps(ctx, vX);
    drawDistantCity(ctx, vX);
    drawRiver(ctx, vX);
    drawMidTown(ctx, vX);
    drawLandmarks(ctx, vX);
    drawSigns(ctx, vX);
    drawForegroundGlow(ctx);
  };

  /* ------------------------------------------------------------------ */
  /* Pixel map                                                           */
  /* ------------------------------------------------------------------ */

  function project(lat, lng, size) {
    var scale = 256 * Math.pow(2, MAP_ZOOM);
    var worldX = (lng + 180) / 360 * scale;
    var sinLat = Math.sin(lat * Math.PI / 180);
    var worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    var centerX = (MAP_CENTER.lng + 180) / 360 * scale;
    var sinCenter = Math.sin(MAP_CENTER.lat * Math.PI / 180);
    var centerY = (0.5 - Math.log((1 + sinCenter) / (1 - sinCenter)) / (4 * Math.PI)) * scale;
    var factor = size / 128;
    return [
      size / 2 + (worldX - centerX) * factor,
      size / 2 + (worldY - centerY) * factor
    ];
  }

  function mapPoint(route, size) {
    if (mapImage && mapState === 'google') {
      return project(route.lat, route.lng, size);
    }
    var f = FALLBACK_POINTS[route.id];
    return [f[0] * size, f[1] * size];
  }

  function routePoint(progress, size) {
    progress = clamp(progress, 0, 1);
    var a = ROUTE[0];
    var b = ROUTE[0];
    for (var i = 0; i < ROUTE.length; i++) {
      if (progress >= ROUTE[i].world) {
        a = ROUTE[i];
        b = ROUTE[Math.min(i + 1, ROUTE.length - 1)];
      }
    }
    if (a === b || b.world === a.world) return mapPoint(a, size);
    var t = clamp((progress - a.world) / (b.world - a.world), 0, 1);
    var pa = mapPoint(a, size);
    var pb = mapPoint(b, size);
    return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
  }

  function line(ctx, x0, y0, x1, y1, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawFallbackMap(ctx, size) {
    var s = size / 128;
    var unit = Math.max(1, Math.round(size / 128));

    rect(ctx, 0, 0, size, size, '#d8cfae');

    // faint survey grid
    ctx.globalAlpha = 0.16;
    for (var g = 0; g <= size; g += Math.max(4, Math.round(8 * s))) {
      line(ctx, g, 0, g, size, '#7d735d', 1);
      line(ctx, 0, g, size, g, '#7d735d', 1);
    }
    ctx.globalAlpha = 1;

    // parks
    rect(ctx, 3 * s, 11 * s, 23 * s, 21 * s, '#a7c08a');
    rect(ctx, 94 * s, 63 * s, 22 * s, 28 * s, '#9fba83');
    rect(ctx, 36 * s, 88 * s, 16 * s, 12 * s, '#b6c996');

    // Wertach and Lech
    var i;
    for (i = 0; i < 12; i++) {
      rect(ctx, (7 + (i % 3)) * s, i * 11 * s, 6 * s, 12 * s, '#4f93c8');
      rect(ctx, (8 + (i % 3)) * s, i * 11 * s, 2 * s, 12 * s, '#7fc4e8');
    }
    for (i = 0; i < 12; i++) {
      rect(ctx, (80 + (i % 2) * 2) * s, i * 11 * s, 8 * s, 12 * s, '#3f7fbf');
      rect(ctx, (82 + (i % 2) * 2) * s, i * 11 * s, 2 * s, 12 * s, '#8fd0ef');
    }
    // Lech island
    rect(ctx, 84 * s, 48 * s, 3 * s, 9 * s, '#a7c08a');

    // main roads
    line(ctx, 13 * s, 76 * s, 36 * s, 58 * s, '#f4ead0', 2 * unit);
    line(ctx, 36 * s, 58 * s, 53 * s, 60 * s, '#f4ead0', 2 * unit);
    line(ctx, 53 * s, 60 * s, 60 * s, 48 * s, '#f4ead0', 2 * unit);
    line(ctx, 60 * s, 48 * s, 81 * s, 40 * s, '#f4ead0', 2 * unit);
    line(ctx, 13 * s, 76 * s, 13 * s, 91 * s, '#f4ead0', unit);
    line(ctx, 36 * s, 58 * s, 36 * s, 91 * s, '#f4ead0', unit);
    line(ctx, 53 * s, 60 * s, 53 * s, 91 * s, '#f4ead0', unit);

    // Altstadt wall
    ctx.globalAlpha = 0.75;
    for (i = 24; i < 74; i += 4) {
      rect(ctx, i * s, 31 * s, 2 * s, unit, '#8a3b2e');
      rect(ctx, i * s, 75 * s, 2 * s, unit, '#8a3b2e');
    }
    for (i = 31; i < 76; i += 4) {
      rect(ctx, 24 * s, i * s, unit, 2 * s, '#8a3b2e');
      rect(ctx, 72 * s, i * s, unit, 2 * s, '#8a3b2e');
    }
    ctx.globalAlpha = 1;

    // building blocks
    var blocks = [
      [30, 38, 9, 6], [43, 36, 7, 8], [40, 49, 8, 5], [55, 39, 6, 7],
      [63, 34, 7, 5], [46, 67, 10, 5], [30, 64, 8, 7], [61, 64, 8, 7],
      [20, 45, 7, 5], [16, 59, 6, 8], [68, 48, 5, 5], [72, 67, 5, 5]
    ];
    for (i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      rect(ctx, b[0] * s, b[1] * s, b[2] * s, b[3] * s, '#b9aa87');
      rect(ctx, b[0] * s, b[1] * s, b[2] * s, unit, '#a84635');
    }

    // landmark icons
    // Hauptbahnhof
    rect(ctx, 13 * s - 5 * s, 76 * s - 4 * s, 10 * s, 4 * s, '#e3d2ac');
    rect(ctx, 13 * s - 5 * s, 76 * s - 5 * s, 10 * s, unit, '#a84635');
    // Königsplatz obelisk
    rect(ctx, 35 * s, 54 * s, 2 * s, 6 * s, '#f2c14e');
    // Rathaus
    rect(ctx, 50 * s, 55 * s, 6 * s, 5 * s, '#e3d2ac');
    rect(ctx, 50 * s, 54 * s, 6 * s, unit, '#a84635');
    // Dom
    rect(ctx, 57 * s, 43 * s, 2 * s, 6 * s, '#e3d2ac');
    rect(ctx, 61 * s, 43 * s, 2 * s, 6 * s, '#e3d2ac');
    rect(ctx, 57 * s, 42 * s, 2 * s, unit, '#3e4f63');
    rect(ctx, 61 * s, 42 * s, 2 * s, unit, '#3e4f63');
    // Fuggerei
    for (i = 0; i < 3; i++) {
      rect(ctx, (76 + i * 4) * s, 38 * s, 3 * s, 3 * s, '#e3d2ac');
      rect(ctx, (76 + i * 4) * s, 37 * s, 3 * s, unit, '#a84635');
    }

    if (size >= 96) {
      drawText(ctx, 'ALTSTADT', 39 * s, 22 * s, '#6b5b41', 1);
      drawText(ctx, 'LECH', 91 * s, 16 * s, '#2f6690', 1);
      drawText(ctx, 'WERTACH', 3 * s, 99 * s, '#2f6690', 1);
    }

    // compass
    rect(ctx, size - 14 * s, 5 * s, 9 * s, 9 * s, 'rgba(255,248,225,0.72)');
    drawText(ctx, 'N', size - 11 * s, 6 * s, '#3a2a1c', 1);
    rect(ctx, size - 10 * s, 2 * s, unit, 2 * s, '#3a2a1c');

    // scale bar
    rect(ctx, 5 * s, size - 7 * s, 20 * s, unit, '#3a2a1c');
    rect(ctx, 5 * s, size - 9 * s, unit, 3 * s, '#3a2a1c');
    rect(ctx, 24 * s, size - 9 * s, unit, 3 * s, '#3a2a1c');
    if (size >= 96) drawText(ctx, '1 KM', 8 * s, size - 14 * s, '#5d4c36', 1);

    // frame
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = Math.max(1, unit);
    ctx.strokeRect(1, 1, size - 2, size - 2);
    rect(ctx, 2, 2, 2, 2, '#f2c14e');
    rect(ctx, size - 4, 2, 2, 2, '#f2c14e');
    rect(ctx, 2, size - 4, 2, 2, '#f2c14e');
    rect(ctx, size - 4, size - 4, 2, 2, '#f2c14e');
  }

  function drawStaticRoute(ctx, size) {
    var pts = [];
    for (var i = 0; i < ROUTE.length; i++) pts.push(mapPoint(ROUTE[i], size));
    var unit = Math.max(1, Math.round(size / 128));

    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
    ctx.strokeStyle = 'rgba(58,42,28,0.7)';
    ctx.lineWidth = 3 * unit;
    ctx.stroke();
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = unit;
    ctx.stroke();

    for (var d = 0; d < ROUTE.length; d++) {
      var pt = pts[d];
      rect(ctx, pt[0] - 1.5 * unit, pt[1] - 1.5 * unit, 3 * unit, 3 * unit, '#3a2a1c');
      rect(ctx, pt[0] - 0.5 * unit, pt[1] - 0.5 * unit, unit * 2, unit * 2, ROUTE[d].color);
    }
  }

  function drawMarker(ctx, size, progress) {
    var pt = routePoint(progress, size);
    var unit = Math.max(1, Math.round(size / 128));
    var x = Math.round(pt[0]);
    var y = Math.round(pt[1]);
    var pulse = Math.floor(elapsed * 4) % 2 === 0;

    if (pulse) {
      rect(ctx, x - 4 * unit, y - 4 * unit, 8 * unit, unit, '#fff4cf');
      rect(ctx, x - 4 * unit, y + 3 * unit, 8 * unit, unit, '#fff4cf');
      rect(ctx, x - 4 * unit, y - 4 * unit, unit, 8 * unit, '#fff4cf');
      rect(ctx, x + 3 * unit, y - 4 * unit, unit, 8 * unit, '#fff4cf');
    }
    rect(ctx, x - 2 * unit, y - 2 * unit, 5 * unit, 5 * unit, '#0a101b');
    rect(ctx, x - unit, y - unit, 3 * unit, 3 * unit, '#f2c14e');
    rect(ctx, x, y, unit, unit, '#fff4cf');
  }

  function buildBase(size) {
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    if (mapImage && mapState === 'google') {
      g.drawImage(mapImage, 0, 0, size, size);
      // A couple of pixel-map flourishes on top of the live map.
      g.strokeStyle = 'rgba(58,42,28,0.75)';
      g.lineWidth = Math.max(1, Math.round(size / 128));
      g.strokeRect(1, 1, size - 2, size - 2);
    } else {
      drawFallbackMap(g, size);
    }
    drawStaticRoute(g, size);
    return c;
  }

  function getBase(size) {
    if (!baseCache[size]) baseCache[size] = buildBase(size);
    return baseCache[size];
  }

  function paintMap(canvas, size, progress) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(getBase(size), 0, 0);
    drawMarker(ctx, size, progress);
  }

  function invalidateMaps() {
    baseCache = {};
  }

  function paintMaps(progress) {
    paintMap(el.startMap, 128, progress);
    paintMap(el.modalMap, 128, progress);
    paintMap(el.minimap, 64, progress);
  }

  function staticMapUrl(key) {
    var params = [
      'center=' + MAP_CENTER.lat + ',' + MAP_CENTER.lng,
      'zoom=' + MAP_ZOOM,
      'size=128x128',
      'scale=1',
      'maptype=roadmap',
      'format=png',
      'language=de',
      'key=' + encodeURIComponent(key),
      'markers=' + encodeURIComponent('color:0xb63b2f|48.3688,10.8987')
    ];
    for (var i = 0; i < MAP_STYLES.length; i++) {
      params.push('style=' + encodeURIComponent(MAP_STYLES[i]));
    }
    return 'https://maps.googleapis.com/maps/api/staticmap?' + params.join('&');
  }

  function mapStatusText() {
    if (mapState === 'loading') return 'Google-Maps-Karte wird geladen …';
    if (mapState === 'google') return 'Google Maps Static API · 128×128 px · nearest-neighbor pixeliert.';
    if (mapState === 'error') return 'Google-Maps-Karte konnte nicht geladen werden. Key/API prüfen – der lokale Plan bleibt aktiv.';
    return 'Lokaler Pixel-Stadtplan aktiv. Für die Live-Karte einen Google-Maps-Key eintragen.';
  }

  function updateMapStatus() {
    var label = mapState === 'google' ? 'GOOGLE' : mapState === 'loading' ? 'LÄDT' : mapState === 'error' ? 'FEHLER' : 'LOKAL';
    if (el.mapSource) el.mapSource.textContent = label;
    if (el.mapStatus) el.mapStatus.textContent = mapStatusText();
    if (el.modalStatus) el.modalStatus.textContent = mapStatusText();
  }

  function loadGoogleMap() {
    if (!mapKey) return;
    mapState = 'loading';
    updateMapStatus();
    invalidateMaps();

    var request = ++mapRequestId;
    var img = new Image();
    img.onload = function() {
      if (request !== mapRequestId) return;
      mapImage = img;
      mapState = 'google';
      invalidateMaps();
      paintMaps(routeProgress());
      updateMapStatus();
    };
    img.onerror = function() {
      if (request !== mapRequestId) return;
      mapImage = null;
      mapState = 'error';
      invalidateMaps();
      paintMaps(routeProgress());
      updateMapStatus();
    };
    img.src = staticMapUrl(mapKey);
  }

  /* ------------------------------------------------------------------ */
  /* Crest                                                               */
  /* ------------------------------------------------------------------ */

  function drawCrest() {
    if (!el.crest) return;
    var c = el.crest;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);

    // A crisp little shield: red above, cream below, golden pine cone.
    var rows = [
      [6, 22], [3, 28], [2, 30], [2, 30], [2, 30], [2, 30],
      [3, 28], [5, 24], [8, 18], [11, 12], [14, 6]
    ];
    var y = 1;
    for (var i = 0; i < rows.length; i++) {
      var outer = rows[i][1] + 4;
      g.fillStyle = '#1a0f08';
      g.fillRect(Math.round(17 - outer / 2), y, outer, 4);
      y += 4;
    }
    y = 2;
    for (var r = 0; r < rows.length; r++) {
      var w = rows[r][1];
      g.fillStyle = r < 5 ? '#b63b2f' : '#f4e8c5';
      g.fillRect(Math.round(17 - w / 2), y, w, 3);
      y += 4;
    }

    // pine cone (Zirbelnuss)
    g.fillStyle = '#3e6b45';
    g.fillRect(16, 8, 3, 2);
    g.fillRect(14, 10, 2, 2);
    g.fillRect(19, 10, 2, 2);
    g.fillStyle = '#f2c14e';
    g.fillRect(15, 12, 4, 2);
    g.fillRect(13, 14, 8, 2);
    g.fillRect(12, 16, 10, 2);
    g.fillRect(13, 18, 8, 2);
    g.fillRect(15, 20, 4, 2);
    g.fillRect(16, 22, 2, 2);
    g.fillStyle = '#fff0b0';
    g.fillRect(14, 15, 2, 2);
    g.fillRect(13, 17, 2, 2);
    g.fillStyle = '#b98228';
    g.fillRect(18, 15, 2, 2);
    g.fillRect(19, 17, 2, 2);
    g.fillRect(16, 19, 2, 2);
  }

  /* ------------------------------------------------------------------ */
  /* UI state                                                            */
  /* ------------------------------------------------------------------ */

  function setOverlay(node, visible) {
    if (!node) return;
    if (visible) node.classList.remove('hidden');
    else node.classList.add('hidden');
  }

  A.start = function() {
    if (started) return;
    started = true;
    window.gameStarted = true;
    window.gamePaused = false;
    window.gameWon = false;
    elapsed = 0;
    setOverlay(el.startScreen, false);
    setOverlay(el.pauseScreen, false);
    setOverlay(el.winScreen, false);
    setOverlay(el.hud, true);
    setOverlay(el.minimapWrap, true);
    if (window.input) input.reset();
    paintMaps(0);
  };

  function pauseGame() {
    if (!started || won) return;
    paused = true;
    window.gamePaused = true;
    if (el.pausePlace) {
      el.pausePlace.textContent = currentLandmark(routeProgress()).name;
    }
    setOverlay(el.pauseScreen, true);
  }

  function resumeGame() {
    if (!started || won) return;
    paused = false;
    window.gamePaused = false;
    setOverlay(el.pauseScreen, false);
  }

  function togglePause() {
    if (!started || won || mapOpen) return;
    if (paused) resumeGame();
    else pauseGame();
  }

  function openMap() {
    if (mapOpen) return;
    mapOpen = true;
    mapWasPaused = window.gamePaused;
    window.gamePaused = true;
    if (el.modalStartBtn) {
      el.modalStartBtn.textContent = started && !won ? 'WEITER SPIELEN' : 'ZURÜCK';
    }
    paintMap(el.modalMap, 128, routeProgress());
    updateMapStatus();
    setOverlay(el.mapModal, true);
    if (el.mapsKey) {
      if (mapKey) el.mapsKey.placeholder = 'Key gespeichert – neu eingeben zum Ändern';
      else el.mapsKey.placeholder = 'AIza...';
    }
  }

  function closeMap() {
    if (!mapOpen) return;
    mapOpen = false;
    setOverlay(el.mapModal, false);
    if (started && !won) {
      window.gamePaused = mapWasPaused;
      if (!mapWasPaused && el.pauseScreen && !el.pauseScreen.classList.contains('hidden')) {
        window.gamePaused = true;
      }
    } else {
      window.gamePaused = false;
    }
  }

  function reloadGame() {
    window.location.reload();
  }

  A.complete = function() {
    if (won) return;
    won = true;
    window.gameWon = true;
    window.gamePaused = true;
    setOverlay(el.hud, true);
    if (el.winCoins) el.winCoins.textContent = player ? player.coins : 0;
    if (el.winTime) el.winTime.textContent = fmtTime(elapsed);
    setOverlay(el.winScreen, true);
    setOverlay(el.minimapWrap, true);
    setOverlay(el.pauseScreen, false);
    setOverlay(el.mapModal, false);
    mapOpen = false;
  };

  function toggleSound() {
    soundOn = !soundOn;
    storageSet(SOUND_STORAGE_KEY, soundOn ? 'on' : 'off');
    applySound();
  }

  function applySound() {
    if (window.sounds) {
      for (var key in sounds) {
        if (Object.prototype.hasOwnProperty.call(sounds, key) && sounds[key]) {
          try { sounds[key].muted = !soundOn; } catch (e) { /* ignore */ }
        }
      }
    }
    if (el.soundBtn) el.soundBtn.textContent = soundOn ? 'TON AN' : 'TON AUS';
  }

  A.update = function(dt) {
    if (!level || !player) return;
    elapsed += dt;

    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - lastHudPaint < 70) return;
    lastHudPaint = now;

    var progress = routeProgress();
    var landmark = currentLandmark(progress);

    if (el.hudCoins) el.hudCoins.textContent = player.coins;
    if (el.hudProgress) el.hudProgress.textContent = Math.round(progress * 100) + '%';
    if (el.hudTime) el.hudTime.textContent = fmtTime(elapsed);
    if (el.hudLandmark) el.hudLandmark.textContent = landmark.name;
    if (el.minimapPlace) el.minimapPlace.textContent = landmark.short;

    paintMap(el.minimap, 64, progress);
    if (mapOpen) paintMap(el.modalMap, 128, progress);
  };

  /* ------------------------------------------------------------------ */
  /* Events and init                                                     */
  /* ------------------------------------------------------------------ */

  function onKeyDown(event) {
    var target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    var key = String(event.key || '').toLowerCase();

    if (key === 'escape') {
      if (mapOpen) { closeMap(); event.preventDefault(); return; }
      if (started && !won) { togglePause(); event.preventDefault(); return; }
    }
    if (key === 'm') {
      if (mapOpen) closeMap();
      else openMap();
      event.preventDefault();
      return;
    }
    if (key === 'p') {
      togglePause();
      event.preventDefault();
      return;
    }
    if ((key === 'enter' || key === ' ') && !started && !mapOpen) {
      A.start();
      event.preventDefault();
    }
  }

  function bindTouchControls() {
    var buttons = document.querySelectorAll('#touch-controls button');
    for (var i = 0; i < buttons.length; i++) {
      (function(btn) {
        var key = btn.getAttribute('data-key');
        function down(e) {
          e.preventDefault();
          if (window.input) input.press(key, true);
          btn.classList.add('pressed');
        }
        function up(e) {
          if (e) e.preventDefault();
          if (window.input) input.press(key, false);
          btn.classList.remove('pressed');
        }
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
      })(buttons[i]);
    }
  }

  function bind() {
    if (el.startBtn) el.startBtn.addEventListener('click', A.start);
    if (el.resumeBtn) el.resumeBtn.addEventListener('click', resumeGame);
    if (el.restartBtn) el.restartBtn.addEventListener('click', reloadGame);
    if (el.pauseBtn) el.pauseBtn.addEventListener('click', togglePause);
    if (el.mapBtn) el.mapBtn.addEventListener('click', openMap);
    if (el.mapClose) el.mapClose.addEventListener('click', closeMap);
    if (el.pauseMapBtn) el.pauseMapBtn.addEventListener('click', openMap);
    if (el.mapsToggle) el.mapsToggle.addEventListener('click', function() {
      openMap();
      if (el.mapsForm) el.mapsForm.scrollIntoView({ block: 'nearest' });
      if (el.mapsKey) el.mapsKey.focus();
    });
    if (el.soundBtn) el.soundBtn.addEventListener('click', toggleSound);
    if (el.winRestart) el.winRestart.addEventListener('click', reloadGame);
    if (el.modalStartBtn) el.modalStartBtn.addEventListener('click', function() {
      var wasStarted = started;
      closeMap();
      if (wasStarted && window.gamePaused && !paused) {
        window.gamePaused = false;
      }
      if (!wasStarted && el.startScreen) {
        setOverlay(el.startScreen, true);
      }
    });
    if (el.modalNewBtn) el.modalNewBtn.addEventListener('click', reloadGame);

    if (el.mapsForm) {
      el.mapsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var value = (el.mapsKey.value || '').trim();
        if (value.length < 10) {
          if (el.modalStatus) el.modalStatus.textContent = 'Bitte einen gültigen Google-Maps-API-Key eingeben.';
          return;
        }
        mapKey = value;
        storageSet(MAP_STORAGE_KEY, mapKey);
        el.mapsKey.value = '';
        loadGoogleMap();
      });
    }
    if (el.mapsClear) {
      el.mapsClear.addEventListener('click', function() {
        mapKey = '';
        mapImage = null;
        mapState = 'fallback';
        storageSet(MAP_STORAGE_KEY, null);
        if (el.mapsKey) el.mapsKey.value = '';
        invalidateMaps();
        paintMaps(routeProgress());
        updateMapStatus();
      });
    }

    document.addEventListener('keydown', onKeyDown);
    bindTouchControls();
  }

  A.init = function() {
    if (initialized) return;
    initialized = true;

    el.startScreen = document.getElementById('start-screen');
    el.pauseScreen = document.getElementById('pause-screen');
    el.winScreen = document.getElementById('win-screen');
    el.mapModal = document.getElementById('map-modal');
    el.hud = document.getElementById('hud');
    el.minimapWrap = document.getElementById('minimap-wrap');
    el.startMap = document.getElementById('start-map');
    el.modalMap = document.getElementById('modal-map');
    el.minimap = document.getElementById('minimap');
    el.crest = document.getElementById('crest');
    el.mapSource = document.getElementById('map-source');
    el.mapStatus = document.getElementById('map-status');
    el.modalStatus = document.getElementById('modal-status');
    el.hudCoins = document.getElementById('hud-coins');
    el.hudProgress = document.getElementById('hud-progress');
    el.hudTime = document.getElementById('hud-time');
    el.hudLandmark = document.getElementById('hud-landmark');
    el.minimapPlace = document.getElementById('minimap-place');
    el.pausePlace = document.getElementById('pause-place');
    el.winCoins = document.getElementById('win-coins');
    el.winTime = document.getElementById('win-time');
    el.startBtn = document.getElementById('start-btn');
    el.resumeBtn = document.getElementById('resume-btn');
    el.restartBtn = document.getElementById('restart-btn');
    el.pauseBtn = document.getElementById('pause-btn');
    el.mapBtn = document.getElementById('map-btn');
    el.mapClose = document.getElementById('map-close');
    el.pauseMapBtn = document.getElementById('pause-map-btn');
    el.mapsToggle = document.getElementById('maps-toggle');
    el.mapsForm = document.getElementById('maps-form');
    el.mapsKey = document.getElementById('maps-key');
    el.mapsClear = document.getElementById('maps-clear');
    el.soundBtn = document.getElementById('sound-btn');
    el.winRestart = document.getElementById('win-restart');
    el.modalStartBtn = document.getElementById('modal-start-btn');
    el.modalNewBtn = document.getElementById('modal-new-btn');

    soundOn = storageGet(SOUND_STORAGE_KEY) !== 'off';
    mapKey = storageGet(MAP_STORAGE_KEY) || '';

    drawCrest();
    bind();
    applySound();
    updateMapStatus();
    paintMaps(0);

    if (mapKey) loadGoogleMap();

    var params = new URLSearchParams(window.location.search || '');
    if (params.get('start') === '1') A.start();
  };

  A.isStarted = function() { return started; };
})();
