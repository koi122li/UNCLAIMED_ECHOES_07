/* ============================================================
   UNCLAIMED_ECHOES_07  ·  audio.js
   音效引擎：全部实时合成，无外部音频文件
   ------------------------------------------------------------
   设计原则（依据音效设计文档）：
   1. 全部用 Web Audio 合成（方波 / 正弦 / 三角 / 噪声 + 滤波）
      —— 不采样、不引用任何受版权保护的素材。
   2. 分组增益：master → sfx / ambient / glitch。
   3. AudioContext 在首次用户交互后建立，规避自动播放限制。
   4. 切后台 suspend()，返回 resume()。
   5. 同一 UI 音效同时最多 2 个；崩坏音效不叠加。
   6. 手机端单音短于 2 秒，全部低通，避免刺耳。
   7. 不假定玩家记录方式：没有纸张翻动音。
   ============================================================ */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null, sfx = null, ambient = null, glitchBus = null;
  var noiseBuf = null;
  var ambientNodes = [];
  var ambientOn = false;
  var counts = {};
  var glitchBusy = false;

  function opt() {
    var s = global.Store && global.Store.s;
    return (s && s.opt) || { sound: true, volume: 2, ambient: true };
  }

  /* 0=关 1=低 2=中 3=高 */
  function masterLevel() {
    var v = opt().volume;
    return [0, 0.18, 0.36, 0.6][v == null ? 2 : v];
  }

  function enabled() {
    return !!(ctx && opt().sound && opt().volume !== 0);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }

    master = ctx.createGain();
    master.gain.value = masterLevel();
    master.connect(ctx.destination);

    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
    ambient = ctx.createGain(); ambient.gain.value = 0.75; ambient.connect(master);
    glitchBus = ctx.createGain(); glitchBus.gain.value = 0.85; glitchBus.connect(master);

    /* 2 秒白噪缓冲，供所有噪声类音效复用 */
    var len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    return ctx;
  }

  function setVolume() {
    if (master) master.gain.value = masterLevel();
  }

  /* ---------------- 基础发声 ---------------- */
  function tone(o) {
    if (!enabled()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.08;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    var dest = o.dest || sfx;

    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq || 800, t0);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol == null ? 0.14 : o.vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (o.lowpass) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(o) {
    if (!enabled() || !noiseBuf) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.06;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq || 1400;
    f.Q.value = o.q == null ? 1 : o.q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.vol == null ? 0.1 : o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* ---------------- 音效表 ---------------- */
  var SFX = {
    /* --- UI --- */
    click: function () {
      tone({ freq: 1244, dur: 0.028, vol: 0.1 });
    },
    tab: function () {
      noise({ freq: 2400, dur: 0.028, vol: 0.07, q: 2 });
      tone({ freq: 880, dur: 0.035, vol: 0.07, delay: 0.022 });
    },
    mailOpen: function () {
      tone({ freq: 520, dur: 0.04, vol: 0.11 });
      tone({ freq: 1046, dur: 0.06, vol: 0.09, delay: 0.035 });
    },
    send: function () {
      tone({ freq: 392, dur: 0.04, vol: 0.11 });
      noise({ freq: 1800, dur: 0.07, vol: 0.08, delay: 0.025, q: 0.8 });
    },
    ok: function () {
      tone({ freq: 880, dur: 0.075, vol: 0.13 });
      tone({ freq: 1318, dur: 0.11, vol: 0.13, delay: 0.085 });
    },
    err: function () {
      tone({ freq: 190, dur: 0.14, vol: 0.16, type: 'sawtooth', lowpass: 620 });
    },
    submit: function () {
      noise({ freq: 900, dur: 0.11, vol: 0.1, q: 0.6, filter: 'lowpass' });
      tone({ freq: 660, dur: 0.03, vol: 0.07, delay: 0.02 });
    },
    newMail: function () {
      tone({ freq: 1046, dur: 0.065, vol: 0.11 });
      tone({ freq: 1318, dur: 0.08, vol: 0.11, delay: 0.075 });
    },
    punch: function () {
      tone({ freq: 300, dur: 0.03, vol: 0.13 });
      tone({ freq: 1568, dur: 0.18, vol: 0.1, delay: 0.055 });
    },
    netOff: function () {
      tone({ freq: 980, dur: 0.09, vol: 0.1, type: 'sine', freqTo: 640 });
      tone({ freq: 1200, dur: 0.09, vol: 0.09, type: 'sine', freqTo: 720, delay: 0.11 });
      tone({ freq: 300, dur: 0.1, vol: 0.09, type: 'sine', freqTo: 200, delay: 0.24 });
    },
    netOn: function () {
      noise({ freq: 1600, dur: 0.1, vol: 0.07, q: 0.5 });
      tone({ freq: 1400, dur: 0.13, vol: 0.1, type: 'sine', delay: 0.06 });
    },

    /* --- 字符检查器 --- */
    charcType: function () {
      noise({ freq: 3200, dur: 0.012, vol: 0.035, q: 3 });
    },
    charcPaste: function () {
      noise({ freq: 1100, dur: 0.09, vol: 0.07, q: 0.4 });
      tone({ freq: 220, dur: 0.14, vol: 0.09, delay: 0.09, lowpass: 700 });
    },
    charcDetect: function () {
      tone({ freq: 2800, dur: 0.022, vol: 0.06, type: 'sine' });
    },

    /* --- 小游戏 --- */
    igOpen: function () {
      tone({ freq: 523, dur: 0.07, vol: 0.1 });
      tone({ freq: 659, dur: 0.07, vol: 0.1, delay: 0.08 });
      tone({ freq: 784, dur: 0.1, vol: 0.1, delay: 0.16 });
    },
    igResult: function () {
      tone({ freq: 784, dur: 0.09, vol: 0.1 });
      tone({ freq: 988, dur: 0.09, vol: 0.1, delay: 0.1 });
      tone({ freq: 1318, dur: 0.16, vol: 0.1, delay: 0.2 });
    },

    /* --- 崩坏 --- */
    gFlash: function () {
      noise({ dur: 0.08, vol: 0.16, freq: 4000, q: 0.3, dest: glitchBus });
      tone({ freq: 1800, dur: 0.16, vol: 0.1, type: 'sawtooth',
             freqTo: 240, lowpass: 3000, dest: glitchBus, delay: 0.05 });
    },
    gRepeat: function () {
      for (var i = 0; i < 3; i++) {
        tone({ freq: 660 - i * 40, dur: 0.05, vol: 0.1, dest: glitchBus, delay: i * 0.12 });
      }
    },
    gHalf: function () {
      /* 正确音只播半声就被切断 */
      tone({ freq: 880, dur: 0.04, vol: 0.12, dest: glitchBus });
    },
    gRumble: function () {
      tone({ freq: 55, dur: 0.8, vol: 0.18, type: 'sawtooth',
             lowpass: 180, dest: glitchBus });
      noise({ dur: 0.8, vol: 0.1, freq: 400, q: 0.4, dest: glitchBus });
      tone({ freq: 880, dur: 0.5, vol: 0.06, type: 'sawtooth',
             freqTo: 660, lowpass: 2500, dest: glitchBus, delay: 0.2 });
    },
    gRelay: function () {
      for (var i = 0; i < 4; i++) {
        noise({ freq: 2600, dur: 0.02, vol: 0.07, q: 3, dest: glitchBus, delay: i * 0.06 });
      }
    },
    gSilence: function () {
      /* 全静音 200ms，然后极轻「咔」 */
      setTimeout(function () {
        noise({ freq: 1800, dur: 0.025, vol: 0.07, q: 2, dest: glitchBus });
      }, 200);
    },
    gGhost: function () {
      var fs = [1046, 880, 1174, 784];
      fs.forEach(function (f, i) {
        tone({ freq: f, dur: 0.05, vol: 0.06, dest: glitchBus, delay: i * 0.05 });
      });
    },

    /* --- 角色入侵 --- */
    invM: function () { tone({ freq: 300, dur: 0.05, vol: 0.1, dest: glitchBus }); },
    invH: function () { noise({ freq: 900, dur: 0.04, vol: 0.08, q: 2, dest: glitchBus }); },
    invT: function () { noise({ freq: 2200, dur: 0.06, vol: 0.07, q: 0.5, dest: glitchBus }); },
    invI: function () { tone({ freq: 2093, dur: 0.04, vol: 0.07, type: 'sine', dest: glitchBus }); }
  };

  /* ---------------- 角色动机（≤1.5s，低音量） ---------------- */
  var MOTIF = {
    /* M：低音铜管式长音，略失真，像远处号角 */
    M: function () {
      tone({ freq: 110, dur: 1.2, vol: 0.1, type: 'sawtooth',
             freqTo: 165, lowpass: 420 });
      tone({ freq: 165, dur: 1.0, vol: 0.05, type: 'sawtooth',
             lowpass: 500, delay: 0.15 });
    },
    /* H：温暖磁带合成器，柔和三度 */
    H: function () {
      tone({ freq: 261, dur: 1.2, vol: 0.07, type: 'triangle' });
      tone({ freq: 329, dur: 1.2, vol: 0.06, type: 'triangle', delay: 0.02 });
      tone({ freq: 392, dur: 1.1, vol: 0.05, type: 'triangle', delay: 0.06 });
    },
    /* T：规整的脉冲数据滴答 */
    T: function () {
      for (var i = 0; i < 8; i++) {
        tone({ freq: 1400, dur: 0.02, vol: 0.055, delay: i * 0.09 });
      }
    },
    /* I：玩具钢琴上行三音，可爱但略走调 */
    I: function () {
      var f = [523, 659, 784];
      for (var i = 0; i < 3; i++) {
        tone({ freq: f[i] * (1 - (i === 2 ? 0.018 : 0)), dur: 0.11, vol: 0.07, delay: i * 0.1 });
      }
    }
  };

  /* ---------------- 播放控制 ---------------- */
  function play(name, arg) {
    if (!init()) return;
    if (!enabled()) return;

    /* 崩坏音效不叠加 */
    if (name.charAt(0) === 'g' && name !== 'gHalf') {
      if (glitchBusy) return;
      glitchBusy = true;
      setTimeout(function () { glitchBusy = false; }, 950);
    }

    /* 同一音效最多 2 个同时 */
    var c = counts[name] || 0;
    if (c >= 2) return;
    counts[name] = c + 1;
    setTimeout(function () { counts[name] = Math.max(0, (counts[name] || 1) - 1); }, 700);

    var fn = SFX[name];
    if (!fn) return;
    try { fn(arg); } catch (e) {}
  }

  function motif(key) {
    if (!init() || !enabled()) return;
    var fn = MOTIF[key];
    if (!fn) return;
    try { fn(); } catch (e) {}
  }

  /* 小游戏点击：音高随计数微升 */
  function igClick(n) {
    if (!init() || !enabled()) return;
    var base = 523 * Math.pow(1.0595, Math.min(n, 12));
    tone({ freq: base, dur: 0.045, vol: 0.1 });
  }

  /* 小游戏结果：按点击数走调 */
  function igResultByCount(n) {
    if (!init() || !enabled()) return;
    var third = (n === 0) ? 740 : 784;     /* X=0 走调下行 */
    var detune = (n > 15) ? 0.96 : 1;
    tone({ freq: 784 * detune, dur: 0.09, vol: 0.1 });
    tone({ freq: 988 * detune, dur: 0.09, vol: 0.1, delay: 0.1 });
    tone({ freq: third * detune, dur: 0.16, vol: 0.1, delay: 0.2 });
  }

  /* ---------------- 环境底噪 ---------------- */
  function startAmbient() {
    if (!init() || ambientOn) return;
    if (!opt().ambient) return;
    ambientOn = true;

    /* 空调低频噪声 */
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    var g = ctx.createGain();
    g.gain.value = 0.6;
    src.connect(f); f.connect(g); g.connect(ambient);
    src.start();
    ambientNodes.push(src, f, g);

    /* CRT 嗡 */
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    var og = ctx.createGain();
    og.gain.value = 0.12;
    osc.connect(og); og.connect(ambient);
    osc.start();
    ambientNodes.push(osc, og);
  }

  function stopAmbient() {
    ambientNodes.forEach(function (n) {
      try { n.stop && n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    ambientNodes = [];
    ambientOn = false;
  }

  function setAmbient(on) {
    if (on) startAmbient();
    else stopAmbient();
  }

  /* ---------------- 生命周期 ---------------- */
  function suspend() {
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
  }
  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function isOn() { return enabled(); }

  /* ============================================================
     结局音效（增补包第 2 / 3 节）
     原则：禁止淡入，起音 ≤5ms，全部 setValueAtTime 硬切
     ============================================================ */
  var endingBus = null;
  var staticGain = null;
  var staticSrcs = [];
  var staticJitter = null;

  function bus() {
    if (!ctx) return null;
    if (!endingBus) {
      endingBus = ctx.createGain();
      endingBus.gain.value = 1;
      endingBus.connect(master);
    }
    return endingBus;
  }

  function reduced() {
    var s = global.Store && global.Store.s;
    return !!(s && s.opt && s.opt.reducedMotion);
  }

  /* 好结局耳鸣：7800Hz 正弦 + 15600Hz 泛音 + 窄带噪，5ms 硬切，1000ms */
  function tinnitus() {
    if (!init() || !enabled()) return;
    if (reduced()) { endingLowBeep(); return; }
    var b = bus();
    var now = ctx.currentTime;
    var MAIN = 0.5;      /* -6dB */

    /* 主频 */
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(7800, now);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(MAIN, now + 0.005);   /* 5ms 硬切 */
    g.gain.setValueAtTime(0, now + 1.0);        /* 1000ms 后硬切静音 */
    osc.connect(g); g.connect(b);
    osc.start(now); osc.stop(now + 1.02);

    /* 泛音 15% */
    var osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(15600, now);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.setValueAtTime(MAIN * 0.15, now + 0.005);
    g2.gain.setValueAtTime(0, now + 1.0);
    osc2.connect(g2); g2.connect(b);
    osc2.start(now); osc2.stop(now + 1.02);

    /* 窄带白噪 6–8kHz */
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(7000, now);
    bp.Q.value = 6;
    var g3 = ctx.createGain();
    g3.gain.setValueAtTime(0, now);
    g3.gain.setValueAtTime(MAIN * 0.08, now + 0.005);
    g3.gain.setValueAtTime(0, now + 1.0);
    src.connect(bp); bp.connect(g3); g3.connect(b);
    src.start(now); src.stop(now + 1.02);

    /* 每 100ms 音量抖动 ±1dB，模拟耳鸣脉动 */
    var pulses = 0;
    var iv = setInterval(function () {
      pulses++;
      if (pulses > 9 || !ctx) { clearInterval(iv); return; }
      var f = 1 + (Math.random() * 0.24 - 0.12);
      try { g.gain.setValueAtTime(MAIN * f, ctx.currentTime + 0.005); } catch (e) {}
    }, 100);
  }

  /* 减少刺激：400Hz 低频提示 500ms */
  function endingLowBeep() {
    if (!init() || !enabled()) return;
    var b = bus();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(0.22, now + 0.005);
    g.gain.setValueAtTime(0, now + 0.5);
    osc.connect(g); g.connect(b);
    osc.start(now); osc.stop(now + 0.52);
  }

  /* 坏结局雪花：highpass 2kHz 白噪 + 50Hz 嗡，3ms 硬切，1200ms 主体后降底噪 */
  function staticNoise() {
    if (!init() || !enabled()) return;
    stopStatic();
    var b = bus();
    var now = ctx.currentTime;
    var soft = reduced();
    var MAIN = soft ? 0.25 : 0.7;      /* -3dB ≈ 0.7 */
    var FLOOR = soft ? 0.06 : 0.12;

    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2000, now);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(MAIN, now + 0.003);      /* 3ms 硬切 */
    g.gain.setValueAtTime(MAIN, now + 1.2);
    g.gain.setValueAtTime(FLOOR, now + 1.203);     /* 降为底噪，无渐弱曲线 */
    src.connect(hp); hp.connect(g); g.connect(b);
    src.start(now);
    staticSrcs.push(src);
    staticGain = g;

    /* 50Hz 电源嗡 */
    var hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(50, now);
    var hg = ctx.createGain();
    hg.gain.setValueAtTime(0, now);
    hg.gain.setValueAtTime(soft ? 0.03 : 0.1, now + 0.003);
    hg.gain.setValueAtTime(soft ? 0.03 : 0.1, now + 1.2);
    hg.gain.setValueAtTime(0.02, now + 1.203);
    hum.connect(hg); hg.connect(b);
    hum.start(now);
    staticSrcs.push(hum);

    /* 每 50ms 音量抖动 ±3dB，模拟雪花电视 */
    if (!soft) {
      staticJitter = setInterval(function () {
        if (!ctx || !staticGain) return;
        var f = 1 + (Math.random() * 0.6 - 0.3);
        try {
          staticGain.gain.setValueAtTime(Math.max(0.02, FLOOR * f), ctx.currentTime + 0.01);
        } catch (e) {}
      }, 50);
    }
  }

  /* 字幕结束时硬切静音，不留尾音 */
  function stopStatic() {
    if (staticJitter) { clearInterval(staticJitter); staticJitter = null; }
    if (staticGain && ctx) {
      try { staticGain.gain.setValueAtTime(0, ctx.currentTime); } catch (e) {}
    }
    staticGain = null;
    staticSrcs.forEach(function (n) {
      try { n.stop(0); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    staticSrcs = [];
  }

  /* 字幕每行：80Hz 短咚 50ms，5ms 硬切 */
  function thud() {
    if (!init() || !enabled()) return;
    var b = bus();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(0.32, now + 0.005);
    g.gain.setValueAtTime(0, now + 0.05);
    osc.connect(g); g.connect(b);
    osc.start(now); osc.stop(now + 0.07);
  }

  global.Audio7 = {
    init: init,
    play: play,
    motif: motif,
    igClick: igClick,
    igResultByCount: igResultByCount,
    setAmbient: setAmbient,
    startAmbient: startAmbient,
    stopAmbient: stopAmbient,
    setVolume: setVolume,
    suspend: suspend,
    resume: resume,
    isOn: isOn,
    /* 结局音效 */
    tinnitus: tinnitus,
    endingLowBeep: endingLowBeep,
    staticNoise: staticNoise,
    stopStatic: stopStatic,
    thud: thud
  };
})(window);
