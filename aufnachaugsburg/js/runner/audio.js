/* Chiptune-Soundtrack + NES-Soundeffekte - komplett synthetisiert, keine Musikdateien. */
(function () {
  "use strict";

  var STORAGE_KEY = "aufnachaugsburg.runner.muted";
  var MUSIC_KEY = "aufnachaugsburg.runner.music";
  var ctx = null;
  var master = null;
  var musicBus = null;
  var musicNoiseBuffer = null;
  var musicTimer = null;
  var musicPlaying = false;
  var musicStep = 0;
  var musicNextTime = 0;
  var muted = false;
  var musicEnabled = true;

  var musicDelay = null;
  var musicDelayFilter = null;
  var musicFeedback = null;
  var musicReverb = null;
  var musicTone = null;

  // Acht Etappen, acht kleine Chiptune-Stücke. Jedes Stück hat eigenes
  // Tempo, Tonart, Akkordfolge, Melodie und Schlagzeugmuster. Alles wird
  // weiterhin live mit der Web Audio API erzeugt.
  var MOODS = {
    hbf: {
      bpm: 132, root: 48, scale: [0, 2, 4, 5, 7, 9, 11],
      prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
      melody: [
        [7, -1, 9, -1, 11, 9, 7, -1, 4, -1, 7, 9, 11, -1, 9, 7],
        [9, -1, 11, 12, 11, 9, 7, -1, 6, 7, 9, -1, 7, 6, 4, -1],
        [4, 6, 7, 9, 11, -1, 9, 7, 6, -1, 4, 6, 7, -1, 6, 4],
        [7, 9, 11, 12, 14, -1, 12, 11, 9, 7, 6, 4, 7, -1, 9, 7]
      ],
      drums: "city", lead: "square", bass: "triangle", swing: 0.03, drive: 0.5
    },
    koenigsplatz: {
      bpm: 120, root: 50, scale: [0, 2, 3, 5, 7, 8, 10],
      prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [6, 8, 10]],
      melody: [
        [4, -1, 7, 4, 9, -1, 7, 4, 6, 4, 2, -1, 4, 6, 7, -1],
        [9, 7, 6, 4, 7, -1, 9, 11, 9, 7, 6, 4, 2, -1, 4, -1],
        [6, 4, 2, 4, 6, 7, 9, -1, 7, 6, 4, 2, 4, -1, 2, -1],
        [7, 9, 11, -1, 9, 7, 6, 4, 6, 7, 9, 7, 4, 2, 4, -1]
      ],
      drums: "tram", lead: "triangle", bass: "triangle", swing: 0.04, drive: 0.45
    },
    rathaus: {
      bpm: 138, root: 45, scale: [0, 2, 3, 5, 7, 8, 10],
      prog: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]],
      melody: [
        [7, 9, 11, 12, 11, 9, 7, -1, 4, 7, 9, -1, 7, 4, 2, -1],
        [9, -1, 12, 11, 9, 7, 6, 4, 2, -1, 4, 6, 7, -1, 9, 11],
        [12, 11, 9, 7, 6, 4, 2, 4, 6, 7, 9, 11, 9, 7, 4, -1],
        [7, 4, 2, 4, 6, 7, 9, 11, 12, -1, 11, 9, 7, 6, 4, 2]
      ],
      drums: "drive", lead: "square", bass: "triangle", swing: 0.02, drive: 0.65
    },
    dom: {
      bpm: 112, root: 43, scale: [0, 2, 3, 5, 7, 8, 10],
      prog: [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]],
      melody: [
        [4, -1, 7, -1, 9, 7, 6, 4, 2, -1, 4, 6, 7, -1, 4, -1],
        [9, 11, 12, -1, 11, 9, 7, 6, 4, -1, 6, 7, 9, -1, 7, 4],
        [7, 6, 4, 2, 4, 6, 7, 9, -1, 11, 9, 7, 6, 4, 2, -1],
        [4, 7, 9, 11, 12, -1, 11, 9, 7, 6, 4, 2, 4, -1, 6, 4]
      ],
      drums: "half", lead: "sine", bass: "triangle", swing: 0.05, drive: 0.3
    },
    fuggerei: {
      bpm: 136, root: 47, scale: [0, 2, 4, 5, 7, 9, 11],
      prog: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]],
      melody: [
        [7, -1, 4, 7, 9, -1, 7, 4, 2, 4, 7, -1, 9, 7, 4, -1],
        [11, 9, 7, 9, 11, 12, -1, 11, 9, 7, 4, -1, 7, 9, 11, -1],
        [4, 2, 4, 7, 9, 7, 4, 2, -1, 4, 6, 7, 9, -1, 7, 4],
        [7, 9, 11, 9, 7, 4, 2, -1, 4, 6, 7, 9, 11, 12, 11, 9]
      ],
      drums: "shuffle", lead: "square", bass: "triangle", swing: 0.07, drive: 0.55
    },
    lechkanaele: {
      bpm: 110, root: 46, scale: [0, 2, 3, 5, 7, 9, 10],
      prog: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [1, 3, 5]],
      melody: [
        [7, -1, 9, 10, 12, -1, 10, 9, 7, 5, 3, -1, 5, 7, 9, -1],
        [12, 10, 9, 7, 5, -1, 7, 9, 10, 12, 14, -1, 12, 10, 9, 7],
        [5, 7, 9, 10, 9, 7, 5, 3, -1, 5, 7, 9, 10, -1, 9, 7],
        [7, 9, 10, 12, 10, 9, 7, 5, 3, 5, 7, 9, 7, 5, 3, -1]
      ],
      drums: "half", lead: "triangle", bass: "triangle", swing: 0.04, drive: 0.35
    },
    zeughaus: {
      bpm: 136, root: 44, scale: [0, 2, 3, 5, 7, 8, 10],
      prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [6, 8, 10]],
      melody: [
        [7, 9, 11, 12, 11, 9, 7, 4, 6, -1, 7, 9, 11, -1, 9, 7],
        [9, 11, 12, 14, 12, 11, 9, 7, 6, 4, 6, 7, 9, -1, 7, 4],
        [4, 6, 7, 9, 11, 9, 7, 6, 4, 2, 4, 6, 7, -1, 9, 11],
        [12, 11, 9, 7, 6, 4, 6, 7, 9, 11, 9, 7, 4, 2, 4, -1]
      ],
      drums: "drive", lead: "square", bass: "triangle", swing: 0.03, drive: 0.7
    },
    sheridanpark: {
      bpm: 110, root: 53, scale: [0, 2, 4, 5, 7, 9, 11],
      prog: [[0, 2, 4], [4, 6, 8], [3, 5, 7], [5, 7, 9]],
      melody: [
        [7, -1, 9, -1, 11, 12, 11, 9, 7, -1, 4, 6, 7, -1, 9, -1],
        [11, 9, 7, 9, 11, -1, 12, 11, 9, 7, 6, 4, 6, -1, 7, 9],
        [4, 6, 7, 9, 7, 6, 4, 2, 4, -1, 6, 7, 9, 11, 9, 7],
        [7, 9, 11, 12, 11, 9, 7, 6, 4, 6, 7, 9, 7, 4, 2, -1]
      ],
      drums: "park", lead: "sine", bass: "triangle", swing: 0.05, drive: 0.25
    }
  };

  var DRUM_STYLES = {
    city: {
      k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1]
    },
    tram: {
      k: [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,0,1]
    },
    drive: {
      k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1]
    },
    half: {
      k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      h: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0]
    },
    shuffle: {
      k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      h: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,1,0]
    },
    park: {
      k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      h: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
    }
  };

  var currentMood = "hbf";
  var musicIntensity = 0.42;
  var musicStepTime = 60 / MOODS.hbf.bpm / 4;
  var MUSIC_STEPS = 32 * 16;

  function scaleMidi(mood, degree, octave) {
    var length = mood.scale.length;
    var octaveShift = Math.floor(degree / length);
    var index = ((degree % length) + length) % length;
    return mood.root + (octave || 0) * 12 + octaveShift * 12 + mood.scale[index];
  }

  function hashNoise(value) {
    var n = value | 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      return ctx;
    }
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);

    // Sanfter Kompressor hält den Chiptune-Loop zusammen, ohne die
    // Soundeffekte platt zu drücken.
    var compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;
    compressor.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicTone = ctx.createBiquadFilter();
    musicTone.type = "lowpass";
    musicTone.frequency.value = 4200;
    musicTone.Q.value = 0.4;
    musicBus.connect(musicTone);
    musicTone.connect(compressor);

    // Warmes Echo für Lead und Arpeggio.
    musicDelay = ctx.createDelay(0.8);
    musicDelay.delayTime.value = 0.18;
    musicDelayFilter = ctx.createBiquadFilter();
    musicDelayFilter.type = "lowpass";
    musicDelayFilter.frequency.value = 2400;
    musicDelayFilter.Q.value = 0.7;
    musicFeedback = ctx.createGain();
    musicFeedback.gain.value = 0.24;
    musicDelay.connect(musicDelayFilter);
    musicDelayFilter.connect(musicFeedback);
    musicFeedback.connect(musicDelay);
    musicDelay.connect(musicBus);

    // Kurzer, selbst gebauter Hall. Kein Sample, keine Datei.
    var reverb = ctx.createConvolver();
    var impulseLength = Math.floor(ctx.sampleRate * 0.7);
    var impulse = ctx.createBuffer(2, impulseLength, ctx.sampleRate);
    for (var channel = 0; channel < 2; channel += 1) {
      var data = impulse.getChannelData(channel);
      for (var i = 0; i < impulseLength; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2.8);
      }
    }
    reverb.buffer = impulse;
    var reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.24;
    reverb.connect(reverbReturn);
    reverbReturn.connect(musicBus);
    musicReverb = reverb;

    musicNoiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
    var noiseData = musicNoiseBuffer.getChannelData(0);
    for (var noiseIndex = 0; noiseIndex < noiseData.length; noiseIndex += 1) {
      noiseData[noiseIndex] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  function tone(options) {
    if (muted) {
      return;
    }
    var audio = ensureContext();
    if (!audio) {
      return;
    }
    var now = audio.currentTime + (options.delay || 0);
    var duration = options.duration || 0.09;
    var oscillator = audio.createOscillator();
    var gain = audio.createGain();
    oscillator.type = options.type || "square";
    oscillator.frequency.setValueAtTime(Math.max(20, options.from || 440), now);
    if (options.to) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), now + duration);
    }
    var volume = options.volume == null ? 0.14 : options.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function noise(options) {
    if (muted) {
      return;
    }
    var audio = ensureContext();
    if (!audio) {
      return;
    }
    var duration = options.duration || 0.18;
    var frameCount = Math.floor(audio.sampleRate * duration);
    var buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    var source = audio.createBufferSource();
    var gain = audio.createGain();
    var filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.cutoff || 800;
    gain.gain.value = options.volume == null ? 0.13 : options.volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function musicVoice(type, note, when, duration, volume, opts) {
    if (!ctx || !musicBus) {
      return;
    }
    opts = opts || {};
    var frequency = typeof note === "number" && note < 128 ? midiToFrequency(note) : note;
    if (!frequency || frequency < 20) {
      return;
    }
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), when);
    if (opts.detune) {
      oscillator.detune.setValueAtTime(opts.detune, when);
    }
    if (opts.glideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), when + duration);
    }
    if (opts.vibrato) {
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = opts.vibratoRate || 5.5;
      lfoGain.gain.value = frequency * (opts.vibratoDepth || 0.006);
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start(when);
      lfo.stop(when + duration + 0.05);
    }
    filter.type = opts.filterType || "lowpass";
    filter.frequency.setValueAtTime(opts.filterFreq || 2600, when);
    if (opts.filterSweep) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(100, opts.filterSweep), when + duration);
    }
    filter.Q.value = opts.Q == null ? 0.8 : opts.Q;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + (opts.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    if (opts.echo && musicDelay) {
      gain.connect(musicDelay);
    }
    if (opts.reverb && musicReverb) {
      gain.connect(musicReverb);
    }
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function musicNoise(when, duration, volume, cutoff, filterType, opts) {
    if (!ctx || !musicBus) {
      return;
    }
    opts = opts || {};
    var frameCount = Math.floor(ctx.sampleRate * duration);
    var buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = filterType || "highpass";
    filter.frequency.value = cutoff || 4400;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    if (opts.echo && musicDelay) {
      gain.connect(musicDelay);
    }
    if (opts.reverb && musicReverb) {
      gain.connect(musicReverb);
    }
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  function musicKick(when, punch) {
    musicVoice("sine", 48, when, 0.15, punch ? 0.32 : 0.27, {
      glideTo: 32,
      filterFreq: 900,
      filterSweep: 130,
      attack: 0.003
    });
    musicNoise(when, 0.02, 0.05, 700, "lowpass");
  }

  function musicSnare(when, volume) {
    musicNoise(when, 0.11, volume == null ? 0.13 : volume, 1900, "bandpass");
    musicVoice("triangle", 186, when, 0.045, 0.05, {
      glideTo: 116,
      filterFreq: 1200
    });
  }

  function musicHat(when, volume, open) {
    musicNoise(when, open ? 0.14 : 0.035, volume, open ? 5000 : 7200, "highpass");
  }

  function musicTom(when, note, volume) {
    musicVoice("sine", note, when, 0.11, volume, {
      glideTo: note * 0.55,
      filterFreq: 1500,
      filterSweep: 340,
      attack: 0.003
    });
  }

  function musicCrash(when) {
    musicNoise(when, 0.52, 0.1, 3000, "highpass", { echo: true, reverb: true });
    musicVoice("sine", 84, when, 0.4, 0.04, { glideTo: 42, filterFreq: 1800 });
  }

  function musicShaker(when, volume) {
    musicNoise(when, 0.025, volume, 7600, "highpass");
  }

  function playMusicStep(step, when) {
    var mood = MOODS[currentMood] || MOODS.hbf;
    var bar = Math.floor(step / 16);
    var beat = step % 16;
    var chord = mood.prog[bar % mood.prog.length];
    var section = Math.floor(bar / 8) % 4;
    var heat = clampNumber(musicIntensity + (section === 1 || section === 3 ? 0.12 : 0), 0, 1);
    var style = DRUM_STYLES[mood.drums] || DRUM_STYLES.city;
    var patBar = bar % 4;
    var humanize = (hashNoise(step * 17 + bar * 31) - 0.5) * 0.006;
    var noteWhen = when + humanize + (beat % 2 === 1 ? (mood.swing || 0) * musicStepTime : 0);

    if (step % (16 * 8) === 0) {
      musicCrash(when);
    }
    if (bar % 8 === 7 && beat >= 12) {
      var fillNotes = [62, 59, 55, 50];
      musicTom(when, fillNotes[beat - 12], 0.14 + (beat - 12) * 0.012);
    } else {
      if (style.k[(beat + patBar * 0) % 16]) {
        musicKick(when, beat === 0 || beat === 8);
      }
      if (style.s[beat]) {
        musicSnare(when, heat > 0.6 && beat === 14 ? 0.18 : 0.13);
      }
      if (style.h[beat]) {
        musicHat(when, beat === 14 ? 0.035 : (0.012 + heat * 0.009), beat === 14 || beat === 6);
      }
      if (heat > 0.62 && beat % 4 === 3) {
        musicShaker(when, 0.006);
      }
    }

    // Bass: root, fifth and octave. The pattern gets busier in the B section.
    var bassRoot = scaleMidi(mood, chord[0], -1);
    var bassNote = bassRoot;
    if (beat === 0 || beat === 8) {
      musicVoice(mood.bass, bassNote, when, musicStepTime * 1.7, 0.22 + heat * 0.05, {
        filterFreq: 620, filterSweep: 280, attack: 0.005
      });
    } else if (beat === 3 || beat === 6 || beat === 11 || beat === 14) {
      if (beat === 6) {
        bassNote = scaleMidi(mood, chord[1], -1);
      } else if (beat === 14) {
        bassNote = bassRoot + 12;
      }
      musicVoice(mood.bass, bassNote, when, musicStepTime * 0.85, 0.13 + heat * 0.03, {
        filterFreq: 720
      });
    }

    // Pad: sustained chord at the start of each bar.
    if (beat === 0) {
      for (var p = 0; p < chord.length; p += 1) {
        musicVoice("sine", scaleMidi(mood, chord[p], 1), noteWhen, musicStepTime * 15.4,
          0.02 + heat * 0.004, {
            attack: 0.28, filterFreq: 1300, filterSweep: 900,
            vibrato: true, vibratoRate: 3.6, vibratoDepth: 0.0025, reverb: true
          });
      }
    }

    // Arpeggio: a light pulse between melody notes.
    if (beat % 2 === 1) {
      var arpDegree = chord[(beat >> 1) % chord.length] + (heat > 0.55 ? 7 : 7);
      musicVoice(heat > 0.6 ? "square" : "triangle", scaleMidi(mood, arpDegree, 1),
        noteWhen, musicStepTime * 0.55, 0.017 + heat * 0.008, {
          filterFreq: 2600, filterSweep: 1500, echo: true, attack: 0.003
        });
    }

    // Lead melody, with a third above on the first beat of every other bar.
    var melodyLine = mood.melody[bar % mood.melody.length];
    var melodyDegree = melodyLine ? melodyLine[beat] : -1;
    if (melodyDegree >= 0) {
      musicVoice(mood.lead, scaleMidi(mood, melodyDegree, 1), noteWhen,
        musicStepTime * 1.6, 0.072 + heat * 0.024, {
          filterFreq: 2400, filterSweep: 1600, vibrato: true,
          vibratoRate: 5.6, vibratoDepth: 0.0045, echo: true, reverb: true,
          attack: 0.005
        });
      if (beat === 0 && bar % 4 === 0) {
        musicVoice("triangle", scaleMidi(mood, melodyDegree - 2, 1), when,
          musicStepTime * 1.4, 0.045, { filterFreq: 2200, echo: true });
      }
    }

    // Little music-box answer at the end of each four-bar phrase.
    if (bar % 4 === 3 && beat === 14) {
      musicVoice("sine", scaleMidi(mood, chord[chord.length - 1], 2), when,
        musicStepTime * 2.5, 0.03, {
          filterFreq: 4200, echo: true, reverb: true, attack: 0.003
        });
    }
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function musicSchedule() {
    if (!musicPlaying || !ctx) {
      return;
    }
    while (musicNextTime < ctx.currentTime + 0.18) {
      playMusicStep(musicStep, musicNextTime);
      musicNextTime += musicStepTime;
      musicStep = (musicStep + 1) % MUSIC_STEPS;
    }
  }

  function startMusic() {
    if (musicPlaying || !musicEnabled || muted) {
      return null;
    }
    var audio = ensureContext();
    if (!audio) {
      return null;
    }
    var mood = MOODS[currentMood] || MOODS.hbf;
    musicStepTime = 60 / mood.bpm / 4;
    musicPlaying = true;
    musicStep = 0;
    musicNextTime = audio.currentTime + 0.06;
    musicSchedule();
    musicTimer = window.setInterval(musicSchedule, 25);
    return audio;
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimer != null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setLevelMood(id) {
    if (!MOODS[id] || currentMood === id) {
      return;
    }
    currentMood = id;
    var mood = MOODS[id];
    musicStepTime = 60 / mood.bpm / 4;
    musicStep = 0;
    if (musicPlaying && ctx) {
      musicNextTime = ctx.currentTime + 0.08;
    }
  }

  function setIntensity(value) {
    musicIntensity = Math.max(0, Math.min(1, Number(value) || 0));
  }

  function ensureAudio() {
    var audio = ensureContext();
    if (audio && musicEnabled && !muted) {
      startMusic();
    }
    return audio;
  }

  function persistMusic() {
    try {
      window.localStorage.setItem(MUSIC_KEY, musicEnabled ? "1" : "0");
    } catch (error) {
      /* localStorage kann in privaten Fenstern fehlen */
    }
  }

  function setMusicEnabled(next) {
    musicEnabled = Boolean(next);
    persistMusic();
    if (musicEnabled) {
      ensureAudio();
    } else {
      stopMusic();
    }
    document.dispatchEvent(new CustomEvent("augsburg:music", { detail: { enabled: musicEnabled } }));
  }

  function setMuted(next) {
    muted = Boolean(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch (error) {
      /* localStorage kann in privaten Fenstern fehlen */
    }
    if (muted) {
      stopMusic();
      if (ctx) {
        ctx.suspend();
      }
    } else {
      ensureAudio();
      if (ctx) {
        ctx.resume();
      }
    }
    document.dispatchEvent(new CustomEvent("augsburg:sound", { detail: { muted: muted } }));
  }

  var sfx = {
    click: function () {
      tone({ from: 330, to: 300, duration: 0.035, type: "square", volume: 0.05 });
    },
    jump: function () {
      tone({ from: 230, to: 480, duration: 0.1, type: "square", volume: 0.1 });
    },
    doubleJump: function () {
      tone({ from: 360, to: 640, duration: 0.12, type: "triangle", volume: 0.1 });
    },
    land: function () {
      tone({ from: 95, to: 60, duration: 0.07, type: "triangle", volume: 0.1 });
    },
    step1: function () {
      tone({ from: 112, to: 76, duration: 0.028, type: "triangle", volume: 0.028 });
    },
    step2: function () {
      tone({ from: 96, to: 64, duration: 0.03, type: "triangle", volume: 0.026 });
    },
    scrape: function () {
      noise({ duration: 0.08, cutoff: 520, volume: 0.04 });
    },
    bump: function () {
      tone({ from: 172, to: 62, duration: 0.13, type: "square", volume: 0.11 });
      noise({ duration: 0.11, cutoff: 760, volume: 0.06 });
    },
    bird: function () {
      tone({ from: 520, to: 330, duration: 0.08, type: "triangle", volume: 0.08 });
      tone({ from: 410, to: 280, duration: 0.09, type: "triangle", volume: 0.07, delay: 0.07 });
      noise({ duration: 0.07, cutoff: 1200, volume: 0.035 });
    },
    scooter: function () {
      tone({ from: 1180, to: 1180, duration: 0.055, type: "sine", volume: 0.07 });
      tone({ from: 1480, to: 1480, duration: 0.045, type: "sine", volume: 0.06, delay: 0.07 });
      tone({ from: 1180, to: 1180, duration: 0.05, type: "sine", volume: 0.05, delay: 0.14 });
    },
    scooterCrash: function () {
      tone({ from: 140, to: 48, duration: 0.22, type: "sawtooth", volume: 0.16 });
      tone({ from: 1180, to: 1180, duration: 0.05, type: "sine", volume: 0.06 });
      tone({ from: 1480, to: 1480, duration: 0.045, type: "sine", volume: 0.05, delay: 0.06 });
      noise({ duration: 0.18, cutoff: 900, volume: 0.1 });
    },
    bikeBell: function () {
      tone({ from: 1568, to: 1568, duration: 0.07, type: "sine", volume: 0.055 });
      tone({ from: 2093, to: 2093, duration: 0.05, type: "sine", volume: 0.04, delay: 0.08 });
    },
    bikeCrash: function () {
      tone({ from: 120, to: 52, duration: 0.18, type: "sawtooth", volume: 0.13 });
      noise({ duration: 0.14, cutoff: 1100, volume: 0.08 });
      tone({ from: 1568, to: 1568, duration: 0.06, type: "sine", volume: 0.04, delay: 0.02 });
    },
    nut: function () {
      tone({ from: 880, to: 1046, duration: 0.07, type: "square", volume: 0.09 });
      tone({ from: 1318, to: 1318, duration: 0.07, type: "square", volume: 0.06, delay: 0.055 });
    },
    checkpoint: function () {
      tone({ from: 523, to: 523, duration: 0.09, type: "square", volume: 0.09 });
      tone({ from: 659, to: 659, duration: 0.09, type: "square", volume: 0.09, delay: 0.08 });
      tone({ from: 784, to: 784, duration: 0.14, type: "square", volume: 0.09, delay: 0.16 });
    },
    fail: function () {
      tone({ from: 170, to: 55, duration: 0.34, type: "sawtooth", volume: 0.12 });
      noise({ duration: 0.2, cutoff: 420, volume: 0.06 });
    },
    death: function () {
      tone({ from: 660, to: 660, duration: 0.12, type: "square", volume: 0.09 });
      tone({ from: 523, to: 523, duration: 0.14, type: "square", volume: 0.09, delay: 0.13 });
      tone({ from: 392, to: 392, duration: 0.16, type: "square", volume: 0.09, delay: 0.28 });
      tone({ from: 262, to: 110, duration: 0.42, type: "sawtooth", volume: 0.1, delay: 0.46 });
      noise({ duration: 0.3, cutoff: 520, volume: 0.07, delay: 0.46 });
    },
    car: function () {
      tone({ from: 72, to: 118, duration: 0.45, type: "sawtooth", volume: 0.1 });
      tone({ from: 96, to: 74, duration: 0.35, type: "square", volume: 0.05, delay: 0.2 });
    },
    horn: function () {
      tone({ from: 392, to: 392, duration: 0.11, type: "square", volume: 0.07 });
      tone({ from: 523, to: 523, duration: 0.16, type: "square", volume: 0.07, delay: 0.12 });
    },
    carHorn: function () {
      tone({ from: 320, to: 320, duration: 0.09, type: "square", volume: 0.055 });
      tone({ from: 405, to: 405, duration: 0.12, type: "square", volume: 0.05, delay: 0.1 });
    },
    carCrash: function () {
      tone({ from: 118, to: 42, duration: 0.24, type: "sawtooth", volume: 0.15 });
      noise({ duration: 0.2, cutoff: 760, volume: 0.11 });
      tone({ from: 320, to: 320, duration: 0.07, type: "square", volume: 0.04, delay: 0.03 });
    },
    win: function () {
      tone({ from: 523, to: 523, duration: 0.12, type: "square", volume: 0.1 });
      tone({ from: 659, to: 659, duration: 0.12, type: "square", volume: 0.1, delay: 0.13 });
      tone({ from: 784, to: 784, duration: 0.14, type: "square", volume: 0.1, delay: 0.26 });
      tone({ from: 1047, to: 1047, duration: 0.34, type: "square", volume: 0.1, delay: 0.42 });
    },
    unlock: function () {
      tone({ from: 659, to: 659, duration: 0.1, type: "triangle", volume: 0.1 });
      tone({ from: 880, to: 880, duration: 0.1, type: "triangle", volume: 0.1, delay: 0.11 });
      tone({ from: 1318, to: 1318, duration: 0.28, type: "triangle", volume: 0.09, delay: 0.22 });
    }
  };

  window.RunnerAudio = {
    isMuted: function () {
      return muted;
    },
    setMuted: setMuted,
    toggle: function () {
      setMuted(!muted);
      if (!muted) {
        sfx.click();
      }
    },
    isMusicEnabled: function () {
      return musicEnabled;
    },
    isMusicPlaying: function () {
      return musicPlaying;
    },
    setMusicEnabled: setMusicEnabled,
    toggleMusic: function () {
      setMusicEnabled(!musicEnabled);
      if (musicEnabled) {
        sfx.click();
      }
    },
    setLevelMood: setLevelMood,
    setIntensity: setIntensity,
    mood: function () {
      return currentMood;
    },
    ensure: ensureAudio,
    sfx: sfx
  };

  ["pointerdown", "keydown", "touchstart"].forEach(function (eventName) {
    window.addEventListener(
      eventName,
      function once() {
        ensureAudio();
        window.removeEventListener(eventName, once);
      },
      { once: true, passive: true }
    );
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopMusic();
    } else if (musicEnabled && !muted && ctx) {
      ensureAudio();
    }
  });
})();
