/* ============================================================
   UNCLAIMED_ECHOES_07  ·  glitch.js
   崩坏事件引擎
   ------------------------------------------------------------
   规则（文档 12.1 / 15）：
   1. 每个事件有唯一 ID，触发前先查存档，命中则静默丢弃。
   2. 触发瞬间先写盘再播动画 —— 玩家中途杀进程也不会重复触发。
   3. 单次时长 ≤ 900ms，不打断操作，只留残影。
   4. 乱码必须含线索：每段至少一行稳定可读（十六进制/二进制）。
   5. 只在第 6、7 天出现。
   ============================================================ */
(function (global) {
  'use strict';

  var NOISE = ['█', '▓', '▒', '░', '0', '1', '7', 'F', ' ', '█', '1', '0'];
  var busy = false;

  function rnd(n) { return Math.floor(Math.random() * n); }

  function noise(len) {
    var s = '';
    for (var i = 0; i < len; i++) s += NOISE[rnd(NOISE.length)];
    return s;
  }

  function noiseLine() {
    return noise(26 + rnd(14));
  }

  /* 生成一段乱码 HTML：n 行噪声 + 中部稳定行（不可被淹没） */
  function build(stableRows, options) {
    options = options || {};
    var total = options.rows || 9;
    var mid = Math.floor(total / 2);
    var out = [];
    for (var i = 0; i < total; i++) {
      if (i === mid) {
        out.push('<span class="g-stable">' + stableRows + '</span>');
      } else if (i === mid + 1 && options.hexRow) {
        out.push('<span class="g-noise">' + options.hexRow + '</span>');
      } else if (i === mid - 1 && options.sigRow) {
        out.push('<span class="g-sig">' + options.sigRow + '</span>');
      } else {
        out.push('<span class="g-noise">' + noiseLine() + '</span>');
      }
    }
    return out.join('\n');
  }

  function layer() { return document.getElementById('glitch-layer'); }

  function hideLayer() {
    var l = layer();
    if (!l) return;
    l.classList.add('hidden');
    l.innerHTML = '';
    busy = false;
  }

  function show(html, ms, extraClass) {
    var l = layer();
    if (!l) return;
    l.innerHTML = html;
    l.className = 'glitch-layer' + (extraClass ? ' ' + extraClass : '');
    l.classList.remove('hidden');
    busy = true;
    setTimeout(hideLayer, ms);
  }

  function reduced() { return !!global.Store.s.opt.reducedMotion; }

  /* ---------------- 事件表 ---------------- */
  var EVENTS = {
    /* ===== 第 6 天 ===== */
    D6_MAIL_FLASH: {
      ms: 500,
      run: function () {
        show(
          build(
            '██ ██ ██ 6F 6E 6C 79 20 6F 6E 63 65 ██ ██ ██',
            { rows: 10, sigRow: '<span class="g-sig">M. H. T. I.</span>', hexRow: '█▓▒░ 01001111 01001110 01001100 01011001 ░▒▓█' }
          ),
          reduced() ? 1000 : 500,
          'scan'
        );
      }
    },

    D6_RULE_REPEAT: {
      ms: 400,
      run: function () {
        var root = document.getElementById('overlay-root');
        var holder = document.createElement('div');
        holder.className = 'repeat-fill';
        var line = '第15条 每天必须回复H的邮件。';
        var html = '';
        for (var i = 0; i < 18; i++) html += '<div class="rf-line">' + line + '</div>';
        holder.innerHTML = html;
        document.body.appendChild(holder);
        setTimeout(function () {
          if (holder.parentNode) holder.parentNode.removeChild(holder);
        }, reduced() ? 1000 : 400);
      }
    },

    D6_VERIFIER_HINT: {
      ms: 500,
      run: function (hintText) {
        var box = document.getElementById('verify-result');
        if (!box) return;
        var old = box.innerHTML;
        box.className = 'verify-result ok hint-flash';
        box.innerHTML = (hintText || '') + '<span class="vr-sig">—— T.</span>';
        setTimeout(function () {
          if (box) {
            box.className = 'verify-result ng';
            box.innerHTML = '校验失败';
          }
        }, reduced() ? 1000 : 500);
      }
    },

    /* ===== 第 7 天 ===== */
    D7_FINAL_GLITCH: {
      ms: 800,
      run: function () {
        show(
          build(
            '██ 7A 65 72 6F ██',
            { rows: 11, sigRow: '<span class="g-sig">M. H. T. I. M. H. T. I.</span>', hexRow: '█▓▒░ 01111010 01100101 01110010 01101111 ░▒▓█' }
          ),
          reduced() ? 1000 : 800,
          'scan'
        );
      }
    },

    D7_TITLE_SWAP: {
      ms: 600,
      run: function () {
        var el = document.getElementById('titlebar-text');
        if (!el) return;
        var a = '归巢失物招领 v1.3';
        var b = '归巢失物登记处';
        var n = 0;
        var t = setInterval(function () {
          el.textContent = (n % 2 === 0) ? b : a;
          n++;
          if (n > 11) {
            clearInterval(t);
            el.textContent = global.Store.s.inv.mTerritory ? '归巢失物招领 - M的领地' : a;
          }
        }, reduced() ? 200 : 55);
      }
    },

    D7_OFFDUTY: {
      ms: 500,
      run: function (done) {
        var black = document.createElement('div');
        black.className = 'glitch-black';
        black.textContent = '你已下班。无人接替。';
        document.body.appendChild(black);
        setTimeout(function () {
          if (black.parentNode) black.parentNode.removeChild(black);
          done && done();
        }, reduced() ? 1000 : 500);
      }
    },

    D7_INBOX_GHOST: {
      ms: 400,
      run: function () {
        var items = document.querySelectorAll('.mail-item');
        if (!items.length) return;
        items.forEach(function (el) { el.classList.add('ghost-from'); });
        setTimeout(function () {
          items.forEach(function (el) { el.classList.remove('ghost-from'); });
        }, reduced() ? 1000 : 400);
      }
    }
  };

  /* 崩坏 → 音效映射（文档第 5 节） */
  var GLITCH_SFX = {
    D6_MAIL_FLASH: 'gFlash',
    D6_RULE_REPEAT: 'gRepeat',
    D6_VERIFIER_HINT: 'gHalf',
    D7_FINAL_GLITCH: 'gRumble',
    D7_TITLE_SWAP: 'gRelay',
    D7_OFFDUTY: 'gSilence',
    D7_INBOX_GHOST: 'gGhost'
  };

  /* ---------------- 对外接口 ---------------- */
  function trigger(id, arg) {
    var ev = EVENTS[id];
    if (!ev) return false;
    /* 一次性：已触发则静默丢弃 */
    if (global.Store.seenGlitch(id)) return false;
    /* 先写盘，再播动画 */
    global.Store.markGlitch(id);

    /* 崩坏音效：短、干、不跳脸，且不叠加 */
    if (GLITCH_SFX[id] && global.Audio7) {
      global.Audio7.play(GLITCH_SFX[id]);
    }

    if (busy && !id.startsWith('D7_TITLE')) return true; /* 已有乱码在播，只记标记 */
    try { ev.run(arg); } catch (e) {}
    return true;
  }

  function forceRepairLog() {
    return '[显示异常] 已修复（1/1）';
  }

  global.Glitch = {
    trigger: trigger,
    show: show,
    build: build,
    events: EVENTS,
    forceRepairLog: forceRepairLog,
    reduced: reduced
  };
})(window);
