/* ============================================================
   UNCLAIMED_ECHOES_07  ·  endingfx.js
   结局表现层（增补包）
   ------------------------------------------------------------
   好结局：耳鸣 + 蓝屏闪烁（太干净，干净得像故障）
   坏结局：雪花花屏 + 强制字幕（信号断了，系统还在假装安慰你）
   原则：
   1. 音效禁止淡入，起音 ≤5ms，全部硬切。
   2. 视觉一次性触发，写入 endingGlitch，读档不重复。
   3. 只覆盖内容区，不盖系统导航与状态栏，避免误判手机故障。
   ============================================================ */
(function (global) {
  'use strict';

  /* 分类
     好结局（耳鸣 + 蓝屏）：离开 / 删除 / 关门
     坏结局（雪花 + 字幕）：其余所有——被困住的结局都算坏 */
  var GOOD = ['CLOSE', 'DELETE_END', 'NO_RELIEF'];
  var BAD = [
    'M_TERRITORY', 'H_HAVEN', 'T_SAMPLE', 'I_GAME',
    'TETRAD', 'SUBMIT_END',
    'RAINCOAT', 'SPAM', 'ANSWERER'
  ];

  /* 字幕池（文档 3.4） */
  var LINES = [
    '你本来就属于这',
    '这是最好的结局 ^ ^',
    '不要害怕',
    '我们都在这里',
    '你已经被登记了',
    '没有人在等你',
    '7号柜永远有空位',
    '你做得很好',
    '请勿关闭终端',
    '我们会记住你'
  ];

  var busy = false;

  function isGood(id) { return GOOD.indexOf(id) >= 0; }
  function isBad(id) { return BAD.indexOf(id) >= 0; }

  function store() {
    var s = global.Store.s;
    if (!s.endingGlitch) {
      s.endingGlitch = { tinnitus: false, bluescreen: false, static: false, seenLines: [] };
    }
    if (!s.endingGlitch.seenLines) s.endingGlitch.seenLines = [];
    return s.endingGlitch;
  }

  function reduced() {
    return !!global.Store.s.opt.reducedMotion;
  }

  function haptic(ms) {
    var s = global.Store.s;
    if (!s.opt.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  function rm(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* ==================== 好结局 · 蓝屏 ==================== */
  function showBlue() {
    var soft = reduced();
    var el = document.createElement('div');
    el.className = 'bluescreen' + (soft ? ' soft' : '');
    el.innerHTML =
      '<div class="bs-scan"></div>' +
      '<div class="bs-noise"></div>' +
      '<div class="bs-text">SIGNAL_OK // 一切正常</div>';
    document.body.appendChild(el);
    /* 蓝屏期间禁止操作 */
    el.addEventListener('click', function (e) { e.stopPropagation(); }, true);
    setTimeout(function () { rm(el); }, 1000);
  }

  /* ==================== 坏结局 · 红屏 ==================== */
  function showRed(done) {
    var soft = reduced();
    var el = document.createElement('div');
    el.className = 'redscreen' + (soft ? ' soft' : '');
    el.innerHTML =
      '<div class="rs-scan"></div>' +
      '<div class="rs-noise"></div>' +
      '<div class="rs-text">SIGNAL_LOST //</div>';
    document.body.appendChild(el);
    /* 红屏期间禁止操作 */
    el.addEventListener('click', function (e) { e.stopPropagation(); }, true);

    setTimeout(function () {
      rm(el);
      /* 黑屏 300ms 后进入字幕 */
      var black = document.createElement('div');
      black.className = 'redscreen black';
      document.body.appendChild(black);
      setTimeout(function () { rm(black); done && done(); }, 300);
    }, 1200);
  }

  /* ==================== 坏结局 · 强制字幕 ==================== */
  function showSubtitles(done) {
    var sg = store();

    /* 优先未看过的行；不足 5 条再从未看过的池里补 */
    var unseen = LINES.filter(function (l) { return sg.seenLines.indexOf(l) < 0; });
    var seen = LINES.filter(function (l) { return sg.seenLines.indexOf(l) >= 0; });

    /* 洗牌 */
    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    var want = 5 + Math.floor(Math.random() * 3);   /* 5—7 条 */
    var seq = shuffle(unseen.slice()).concat(shuffle(seen.slice())).slice(0, want);
    if (!seq.length) { done && done(); return; }

    var el = document.createElement('div');
    el.className = 'subscreen';
    var line = document.createElement('div');
    line.className = 'sub-line';
    el.appendChild(line);
    document.body.appendChild(el);

    function rand(a, b) { return a + Math.random() * (b - a); }

    /*
     * 字幕与结局交替闪现：
     *   字幕（黑底遮住结局）300—480ms → 空档（露出结局）180—340ms → 下一条
     * 两者互相穿插，不会只看到其中一个。
     */
    var idx = 0;
    function flash() {
      if (idx >= seq.length) {
        /* 最后停在结局上 */
        el.style.display = 'none';
        setTimeout(function () {
          rm(el);
          if (global.Audio7) global.Audio7.stopStatic();
          done && done();
        }, 320);
        return;
      }

      el.style.display = 'grid';
      line.textContent = seq[idx];
      if (global.Audio7) global.Audio7.thud();
      if (sg.seenLines.indexOf(seq[idx]) < 0) sg.seenLines.push(seq[idx]);
      idx++;

      var showMs = rand(300, 480);

      setTimeout(function () {
        el.style.display = 'none';       /* 露出结局 */
        setTimeout(flash, rand(180, 340));
      }, showMs);
    }
    flash();
  }

  /* ==================== 入口 ==================== */
  function goodEnding(render) {
    if (!busy) {
      var sg = store();
      if (!sg.bluescreen || !sg.tinnitus) {
        if (global.Audio7) global.Audio7.tinnitus();
        showBlue();
        haptic(150);
        sg.bluescreen = true;
        sg.tinnitus = true;
        global.Store.save();
      }
    }
    /* 结局 CG 与蓝屏同一帧进场 */
    render();
  }

  function badEnding(render) {
    /* 兜底：任何异常都不能让结局屏不出现 */
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      render();
    }
    setTimeout(finish, 9000);

    var sg = store();
    busy = true;

    if (!sg.static) {
      sg.static = true;
      global.Store.save();
      if (global.Audio7) global.Audio7.staticNoise();
      haptic([50, 60, 50, 60, 50]);
      showRed(function () {
        /* 红屏 + 黑屏结束，直接出结局；雪花音效在此硬切静音 */
        finish();
        if (global.Audio7) global.Audio7.stopStatic();
        busy = false;
      });
      return;
    }

    /* 已看过红屏：直接出结局，音效也不再重复 */
    finish();
    busy = false;
  }

  global.EndingFX = {
    isGood: isGood,
    isBad: isBad,
    goodEnding: goodEnding,
    badEnding: badEnding,
    showBlue: showBlue,
    showRed: showRed,
    showSubtitles: showSubtitles,
    LINES: LINES
  };
})(window);