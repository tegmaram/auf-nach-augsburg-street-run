/* Etappenauswahl: echte Karten, gesperrte Etappen, Bestzeiten. */
(function () {
  "use strict";

  var LEVELS = window.AUGSBURG_ACTIVE_LEVELS || window.AUGSBURG_LEVELS || [];
  var store = window.RunnerStore;
  var selectedIndex = 0;
  var cards = [];
  var resetTimer = null;
  var helpFocusReturn = null;

  var els = {
    browser: document.getElementById("browser"),
    play: document.getElementById("play"),
    levelList: document.getElementById("level-list"),
    progressCount: document.getElementById("progress-count"),
    unlockLabel: document.getElementById("unlock-label"),
    selectedMap: document.getElementById("selected-map"),
    selectedKicker: document.getElementById("selected-kicker"),
    selectedCoords: document.getElementById("selected-coords"),
    selectedTagline: document.getElementById("selected-tagline"),
    selectedDistance: document.getElementById("selected-distance"),
    selectedRoofs: document.getElementById("selected-roofs"),
    selectedNuts: document.getElementById("selected-nuts"),
    selectedBest: document.getElementById("selected-best"),
    mapPinStart: document.getElementById("map-pin-start"),
    mapPinFinish: document.getElementById("map-pin-finish"),
    startTitle: document.getElementById("start-title"),
    startHint: document.getElementById("start-hint"),
    startCaveat: document.getElementById("start-caveat"),
    startButton: document.getElementById("start-level"),
    endlessStart: document.getElementById("endless-start"),
    footerMaps: document.getElementById("footer-gmaps"),
    soundButton: document.getElementById("browser-sound"),
    musicButton: document.getElementById("browser-music"),
    pauseMusic: document.getElementById("pause-music"),
    helpOpen: document.getElementById("help-open"),
    helpModal: document.getElementById("help-modal"),
    helpClose: document.getElementById("help-close"),
    helpOk: document.getElementById("help-ok"),
    helpReset: document.getElementById("help-reset"),
    resetProgress: document.getElementById("reset-progress")
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(seconds) {
    if (seconds == null || !isFinite(seconds)) {
      return "—";
    }
    var totalTenths = Math.max(0, Math.round(seconds * 10));
    var minutes = Math.floor(totalTenths / 600);
    var rest = totalTenths % 600;
    var secs = Math.floor(rest / 10);
    var tenths = rest % 10;
    return minutes + ":" + String(secs).padStart(2, "0") + "." + tenths;
  }

  function starText(count) {
    return "★★★".slice(0, count) + "☆☆☆".slice(0, Math.max(0, 3 - count));
  }

  function streetCount(level) {
    return (level.buildings || level.platforms || []).length;
  }

  function levelLocked(level) {
    return !store.isUnlocked(level);
  }

  function updateSoundButtons() {
    var muted = window.RunnerAudio.isMuted();
    var label = muted ? "TON AUS" : "TON AN";
    [els.soundButton, document.getElementById("pause-sound")].forEach(function (button) {
      if (!button) {
        return;
      }
      button.textContent = label;
      button.setAttribute("aria-pressed", muted ? "false" : "true");
    });
  }

  function updateMusicButtons() {
    var enabled = window.RunnerAudio.isMusicEnabled
      ? window.RunnerAudio.isMusicEnabled()
      : true;
    var label = enabled ? "MUSIK AN" : "MUSIK AUS";
    [els.musicButton, els.pauseMusic].forEach(function (button) {
      if (!button) {
        return;
      }
      button.textContent = label;
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
  }

  function updateProgressLabels() {
    var cleared = store.clearedCount();
    var unlocked = store.unlockedCount();
    els.progressCount.textContent = cleared + " / " + LEVELS.length;
    els.unlockLabel.textContent = unlocked + " VON " + LEVELS.length + " FREIGESCHALTET";
    if (els.endlessStart) {
      var mainCleared = LEVELS.filter(function (level) {
        return Boolean(store.get().cleared[level.id]);
      }).length;
      var unlockedEndless = LEVELS.length > 0 && mainCleared >= LEVELS.length;
      els.endlessStart.classList.toggle("hidden", !unlockedEndless);
      var endless = store.get().endless || { bestStage: 0 };
      els.endlessStart.textContent = endless.bestStage
        ? "ENDLOS-MODUS · REKORD " + endless.bestStage + " ETAPPEN"
        : "ENDLOS-MODUS";
    }
  }

  function makeCard(level, index) {
    var locked = levelLocked(level);
    var best = store.best(level);
    var stars = store.stars(level);
    var card = document.createElement("button");
    card.type = "button";
    card.className = "level-card" + (locked ? " locked" : "");
    card.setAttribute("data-index", String(index));
    card.setAttribute("aria-label", "Etappe " + pad(level.num) + ": " + level.name + (locked ? " (gesperrt)" : ""));
    card.innerHTML =
      '<span class="card-thumb">' +
      '<img src="' + escapeHtml(level.map) + '" width="512" height="320" alt="" loading="lazy">' +
      '<span class="card-number">' + pad(level.num) + "</span>" +
      (locked ? '<span class="card-lock" aria-hidden="true">🔒</span>' : "") +
      "</span>" +
      '<span class="card-main">' +
      '<span class="card-title-row"><span class="card-title">' + escapeHtml(level.name) + "</span></span>" +
      '<span class="card-subtitle">' + escapeHtml(level.subtitle) + "</span>" +
      '<span class="card-meta">' +
      "<span>" + level.distance + " M</span>" +
      "<span>" + streetCount(level) + " HÄUSER</span>" +
      "<span>STUFE " + level.num + "</span>" +
      (best ? '<span class="best">BESTZEIT ' + formatTime(best.time) + "</span>" : "") +
      (stars ? '<span class="card-stars" aria-label="' + stars + ' von 3 Sternen">' + starText(stars) + "</span>" : "") +
      "</span>" +
      "</span>" +
      '<span class="card-arrow" aria-hidden="true">→</span>';

    card.addEventListener("click", function () {
      selectLevel(index);
    });
    card.addEventListener("dblclick", function () {
      if (!levelLocked(level)) {
        launch(index);
      }
    });
    return card;
  }

  function renderCards() {
    if (!els.levelList) {
      return;
    }
    els.levelList.innerHTML = "";
    cards = LEVELS.map(function (level, index) {
      var card = makeCard(level, index);
      els.levelList.appendChild(card);
      return card;
    });
  }

  function setPins(level) {
    if (level.startPct) {
      els.mapPinStart.style.left = level.startPct[0] + "%";
      els.mapPinStart.style.top = level.startPct[1] + "%";
    }
    if (level.finishPct) {
      els.mapPinFinish.style.left = level.finishPct[0] + "%";
      els.mapPinFinish.style.top = level.finishPct[1] + "%";
    }
  }

  function googleDirections(level) {
    if (!level.origin || !level.destination) {
      return "https://www.google.com/maps/place/Augsburg";
    }
    return (
      "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" +
      encodeURIComponent(level.origin[0] + "," + level.origin[1]) +
      "&destination=" +
      encodeURIComponent(level.destination[0] + "," + level.destination[1])
    );
  }

  function selectLevel(index) {
    if (!LEVELS.length) {
      return;
    }
    selectedIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    var level = LEVELS[selectedIndex];
    var locked = levelLocked(level);
    var best = store.best(level);
    if (window.RunnerAudio && window.RunnerAudio.setLevelMood) {
      window.RunnerAudio.setLevelMood(level.id);
      window.RunnerAudio.setIntensity(0.34);
    }

    cards.forEach(function (card, cardIndex) {
      var active = cardIndex === selectedIndex;
      card.classList.toggle("selected", active);
      card.setAttribute("aria-current", active ? "true" : "false");
    });

    els.selectedMap.src = level.map;
    els.selectedMap.alt = "Pixelierte OpenStreetMap-Karte von Augsburg: " + level.name;
    els.selectedKicker.textContent = "ETAPPE " + pad(level.num) + " · " + level.subtitle.toUpperCase();
    els.selectedCoords.textContent =
      level.origin ? level.origin[0].toFixed(4) + " N / " + level.origin[1].toFixed(4) + " O" : "AUGSBURG";
    els.selectedTagline.textContent = level.tagline;
    els.selectedDistance.textContent = level.distance + " m";
    els.selectedRoofs.textContent = String(streetCount(level));
    els.selectedNuts.textContent = String(level.nuts.length);
    els.selectedBest.textContent = best ? formatTime(best.time) : "—";
    setPins(level);
    els.footerMaps.href = googleDirections(level);

    els.startTitle.textContent = level.name;
    if (locked) {
      els.startButton.disabled = true;
      els.startButton.querySelector("span").textContent = "NOCH GESPERRT";
      els.startHint.textContent =
        "Schließe zuerst Etappe " + pad(level.num - 1) + " ab. Dann wartet der Kadett auch hier.";
      els.startCaveat.textContent = "GESPERRT · Etappe " + pad(level.num) + " wird nach dem vorherigen Ziel freigeschaltet.";
    } else {
      var cleared = Boolean(store.get().cleared[level.id]);
      els.startButton.disabled = false;
      els.startButton.querySelector("span").textContent = cleared ? "NOCHMAL FAHREN" : "LOSFAHREN";
      els.startHint.textContent =
        "Der Kadett setzt dich am Start ab. Danach heißt es: " + level.tagline;
      var levelStars = store.stars(level);
      els.startCaveat.textContent =
        "ETAPPE " + pad(level.num) + " VON " + pad(LEVELS.length) + " · STUFE " + level.num + "/" + LEVELS.length + " · " +
        level.distance + " METER · " + streetCount(level) + " HÄUSER · " +
        (best ? "BESTZEIT " + formatTime(best.time) : "NOCH KEINE BESTZEIT") +
        (levelStars ? " · " + starText(levelStars) : "");
    }

    updateProgressLabels();
  }

  function show(preferredIndex) {
    if (els.play) {
      els.play.classList.add("hidden");
    }
    if (els.browser) {
      els.browser.classList.remove("hidden");
    }
    document.body.classList.remove("in-game");
    renderCards();
    var nextIndex = preferredIndex;
    if (nextIndex == null || nextIndex < 0 || nextIndex >= LEVELS.length) {
      nextIndex = LEVELS.findIndex(function (level) {
        return store.isUnlocked(level) && !store.get().cleared[level.id];
      });
      if (nextIndex < 0) {
        nextIndex = Math.min(LEVELS.length - 1, store.get().unlocked - 1);
      }
    }
    selectLevel(nextIndex < 0 ? 0 : nextIndex);
    window.scrollTo(0, 0);
  }

  function hide() {
    if (els.browser) {
      els.browser.classList.add("hidden");
    }
    if (els.play) {
      els.play.classList.remove("hidden");
    }
    document.body.classList.add("in-game");
  }

  function launch(index) {
    if (!LEVELS[index] || levelLocked(LEVELS[index])) {
      return;
    }
    if (!window.RunnerGame || typeof window.RunnerGame.start !== "function") {
      return;
    }
    window.RunnerAudio.ensure();
    window.RunnerAudio.sfx.click();
    hide();
    window.RunnerGame.start(index);
  }

  function openHelp() {
    helpFocusReturn = document.activeElement;
    els.helpModal.classList.remove("hidden");
    window.setTimeout(function () {
      if (els.helpClose) {
        els.helpClose.focus();
      }
    }, 0);
  }

  function closeHelp() {
    els.helpModal.classList.add("hidden");
    if (helpFocusReturn && typeof helpFocusReturn.focus === "function") {
      try {
        helpFocusReturn.focus();
      } catch (error) {
        /* Fokus fällt an den Dokumentanfang zurück. */
      }
    }
    helpFocusReturn = null;
  }

  function armReset(button) {
    if (button.classList.contains("is-confirm")) {
      window.clearTimeout(resetTimer);
      store.reset();
      button.classList.remove("is-confirm");
      button.textContent = "FORTSCHRITT LÖSCHEN";
      closeHelp();
      show(0);
      return;
    }
    button.classList.add("is-confirm");
    button.textContent = "WIRKLICH LÖSCHEN?";
    resetTimer = window.setTimeout(function () {
      button.classList.remove("is-confirm");
      button.textContent = "FORTSCHRITT LÖSCHEN";
    }, 3200);
  }

  function bindEvents() {
    els.startButton.addEventListener("click", function () {
      launch(selectedIndex);
    });

    if (els.soundButton) {
      els.soundButton.addEventListener("click", function () {
        window.RunnerAudio.toggle();
        updateSoundButtons();
      });
    }

    [els.musicButton, els.pauseMusic].forEach(function (button) {
      if (!button) {
        return;
      }
      button.addEventListener("click", function () {
        window.RunnerAudio.toggleMusic();
        updateMusicButtons();
        window.RunnerAudio.ensure();
      });
    });

    if (els.endlessStart) {
      els.endlessStart.addEventListener("click", function () {
        if (!window.RunnerGame || typeof window.RunnerGame.startEndless !== "function") {
          return;
        }
        window.RunnerAudio.ensure();
        window.RunnerAudio.sfx.click();
        hide();
        window.RunnerGame.startEndless();
      });
    }

    els.helpOpen.addEventListener("click", function () {
      window.RunnerAudio.sfx.click();
      openHelp();
    });
    els.helpClose.addEventListener("click", closeHelp);
    els.helpOk.addEventListener("click", closeHelp);
    els.helpModal.addEventListener("click", function (event) {
      if (event.target === els.helpModal) {
        closeHelp();
      }
    });

    els.helpReset.addEventListener("click", function () {
      armReset(els.helpReset);
    });
    els.resetProgress.addEventListener("click", function () {
      armReset(els.resetProgress);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.helpModal.classList.contains("hidden")) {
        closeHelp();
      }
      if (els.browser.classList.contains("hidden")) {
        return;
      }
      if (!els.helpModal.classList.contains("hidden")) {
        return;
      }
      var target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        var direction = event.key === "ArrowDown" ? 1 : -1;
        selectLevel((selectedIndex + direction + LEVELS.length) % LEVELS.length);
      }
      if (event.key === "Enter") {
        // Enter belongs to the focused control (sound, help, reset, level card).
        // Only start the selected stage when no control owns the key press.
        if (target && target.closest && target.closest("button, a, input, select, textarea, [role='button']")) {
          return;
        }
        event.preventDefault();
        launch(selectedIndex);
      }
    });

    document.addEventListener("augsburg:sound", updateSoundButtons);
    document.addEventListener("augsburg:music", updateMusicButtons);
    document.addEventListener("augsburg:complete", function () {
      renderCards();
      updateProgressLabels();
    });
  }

  function init() {
    if (!LEVELS.length) {
      els.levelList.innerHTML =
        '<p class="micro">Die Etappendaten konnten nicht geladen werden. Bitte den Ordner über einen lokalen Server öffnen.</p>';
      return;
    }
    bindEvents();
    renderCards();
    updateSoundButtons();
    updateMusicButtons();
    updateProgressLabels();
    var firstOpen = LEVELS.findIndex(function (level) {
      return store.isUnlocked(level) && !store.get().cleared[level.id];
    });
    selectLevel(firstOpen < 0 ? 0 : firstOpen);
  }

  window.RunnerBrowser = {
    show: show,
    hide: hide,
    refresh: function () {
      renderCards();
      updateProgressLabels();
      selectLevel(selectedIndex);
      updateSoundButtons();
      updateMusicButtons();
    }
  };

  init();
})();


