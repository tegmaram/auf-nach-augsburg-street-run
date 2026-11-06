/* Street runner world preparation.
   Turns the generated OSM rooftop layout into one continuous street with
   three lanes: sidewalk (Bürgersteig), Straße 1 and Straße 2.
   The original building footprints are kept as `buildings`, so the five
   later stages stay in the data even while only the first three are shown. */
(function () {
  "use strict";

  var LEVELS = window.AUGSBURG_LEVELS || [];
  var STREET_Y = 212;
  var ACTIVE_COUNT = 3;

  // Höhe der drei Spurbänder unter der jeweiligen Standlinie.
  var LANE_HEIGHTS = [16, 21, 21];
  var LANE_FEET = [
    STREET_Y,
    STREET_Y + LANE_HEIGHTS[0],
    STREET_Y + LANE_HEIGHTS[0] + LANE_HEIGHTS[1]
  ];

  // Münzen liegen auf allen drei Spuren: die meisten auf dem Gehweg, ein paar
  // auf der Fahrbahn, wo man sie nur mit einem Spurwechsel einsammeln kann.
  // Straßenmünzen sitzen nur in Lücken, damit der Spurwechsel keine
  // Gehwegmünze kostet.
  function coinLane(index, nut, level, all) {
    if (nut.hidden || nut.x > level.finishX - 60) {
      return 0;
    }
    var wants = index % 9 === 5 ? 2 : (index % 4 === 2 ? 1 : 0);
    if (wants === 0) {
      return 0;
    }
    for (var i = 0; i < all.length; i += 1) {
      if (i === index) {
        continue;
      }
      if (Math.abs(all[i].x - nut.x) < 120) {
        return 0;
      }
    }
    return wants;
  }

  function prepare(level) {
    if (!level || level._streetReady) {
      return;
    }
    var buildings = [];
    var platforms = level.platforms || [];
    for (var i = 0; i < platforms.length; i += 1) {
      var platform = platforms[i];
      if (platform.type === "bridge") {
        continue;
      }
      buildings.push({
        x: platform.x,
        w: platform.w,
        roofY: STREET_Y,
        levels: platform.levels,
        name: platform.name,
        type: platform.type
      });
    }

    level.buildings = buildings;
    level.streetY = STREET_Y;
    level.laneFeet = LANE_FEET.slice();
    level.platforms = [{
      type: "street",
      x: 0,
      w: level.lengthPx,
      roofY: STREET_Y,
      levels: 3,
      name: "STRASSE"
    }];
    level.finishPlatform = 0;
    level.maxGap = 0;
    level.maxDrop = 0;

    for (var n = 0; n < level.nuts.length; n += 1) {
      var nut = level.nuts[n];
      nut.lane = coinLane(n, nut, level, level.nuts);
      nut.y = LANE_FEET[nut.lane] - (nut.hidden ? 52 : 27);
    }
    for (var c = 0; c < level.checkpoints.length; c += 1) {
      level.checkpoints[c].y = STREET_Y;
      level.checkpoints[c].lane = 0;
    }
    for (var p = 0; p < level.props.length; p += 1) {
      level.props[p].y = STREET_Y - (level.props[p].h || 16);
    }
    level._streetReady = true;
  }

  for (var i = 0; i < LEVELS.length; i += 1) {
    prepare(LEVELS[i]);
  }

  window.AUGSBURG_STREET_Y = STREET_Y;
  window.AUGSBURG_LANE_HEIGHTS = LANE_HEIGHTS.slice();
  window.AUGSBURG_LANE_FEET = LANE_FEET.slice();
  window.AUGSBURG_ACTIVE_LEVEL_COUNT = Math.min(ACTIVE_COUNT, LEVELS.length);
  window.AUGSBURG_ACTIVE_LEVELS = LEVELS.slice(0, window.AUGSBURG_ACTIVE_LEVEL_COUNT);
})();
