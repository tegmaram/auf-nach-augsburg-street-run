/* Street runner world preparation.
   Turns the generated OSM rooftop layout into one continuous street.
   The original building footprints are kept as `buildings`, so the five
   later stages stay in the data even while only the first three are shown. */
(function () {
  "use strict";

  var LEVELS = window.AUGSBURG_LEVELS || [];
  var STREET_Y = 212;
  var ACTIVE_COUNT = 3;

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
      level.nuts[n].y = STREET_Y - (level.nuts[n].hidden ? 52 : 27);
    }
    for (var c = 0; c < level.checkpoints.length; c += 1) {
      level.checkpoints[c].y = STREET_Y;
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
  window.AUGSBURG_ACTIVE_LEVEL_COUNT = Math.min(ACTIVE_COUNT, LEVELS.length);
  window.AUGSBURG_ACTIVE_LEVELS = LEVELS.slice(0, window.AUGSBURG_ACTIVE_LEVEL_COUNT);
})();
