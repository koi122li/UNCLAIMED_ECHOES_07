/* ============================================================
   UNCLAIMED_ECHOES_07  ·  store.js
   存档（唯一真相源） + 存档读写 + 好感/遗忘/崩坏标记
   ------------------------------------------------------------
   设计约束（文档 15 / 13）：
   1. 崩坏一次性：触发瞬间先写盘再播动画，玩家中途杀进程也不会重复触发。
   2. 隐私边界：只记录「切出时长」「标签浏览顺序」，不记录任何内容。
   3. 存档名：第 7 天后变为 值班日志_[代号]_第7天（纯叙事，写入 endingName）。
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'ue07_save_v2';
  var S = null;

  function defaults() {
    return {
      v: 2,
      started: false,
      codename: '',
      day: 1,

      /* 好感度：0..5（状态栏 5 格像素块） */
      aff: { M: 0, H: 0, T: 0, I: 0 },
      /* 遗忘值：>=3 触发黄雨衣 */
      forget: 0,
      /* 回复流向 */
      replies: 0,
      streak: { M: 0, H: 0, T: 0, I: 0 },

      /* 提示使用：{ day: [L1,L2,L3,L4] 计数 } */
      hints: {},

      /* 邮件投放顺序：['d1_sys', ...] */
      mailOrder: [],
      /* 邮件状态：{ mailId: { read, action, at } } */
      mails: {},
      /* 已记录确认：{ mailId: true } */
      recorded: {},

      /* 崩坏一次性标记：{ eventId: true } */
      glitch: {},

      /* 登记：{ day: { done, answer, checksum, at } } */
      reg: {},
      /* 柜位：{ day: cabinetNo } */
      cabinet: {},
      /* 校验码错误次数：{ day: n } */
      ckFail: {},
      /* 校验器错误次数：{ day: n } */
      vfFail: {},
      /* 校验器历史 */
      vfLog: [],

      /* 打卡：{ day: { in: ts, out: ts } } */
      punch: {},

      /* 已查看过的传真（每封首次查看 +1 遗忘值） */
      readFaxes: [],

      /* 切出：只记时长 */
      awayTotal: 0,
      awayLast: 0,
      awayLog: [],

      /* 规则手册：0=原文 1=已删除隐藏句 */
      rulesEdited: 0,

      /* 登记历史（供第7天回放） */
      ledger: [],
      /* 收集到的失主姓名（《关门》结局用） */
      names: [],
      /* 值班日志：打开过的标签顺序 */
      log: [],

      /* 角色入侵状态 */
      inv: {
        mTerritory: false,
        hRule15: false,
        tPatch: false,
        iIcons: 0,
        tClockOffset: 0,
        hOffdutyBlock: 0,
        /* H 删掉的邮件 id 列表（邮件变灰、正文被取出） */
        hDeleted: [],
        /* H 的下班阻碍：随机出现，全局上限 2 次 */
        hBlock: { used: 0, day: 0 },
        /* 已用触发词解锁柜位的天数 */
        searchUnlocked: []
      },

      /* 结局 */
      endings: {},
      ending: null,
      endingName: '',

      /* 结局表现层一次性标记（增补包第 7 节） */
      endingGlitch: {
        tinnitus: false,
        bluescreen: false,
        static: false,
        seenLines: []
      },

      /* D3 应答录音后记录的真名（仅用于叙事与最终登记默认值，不做任何其他读取） */
      realName: '',

      /* 标记（黄雨衣等） */
      flags: {
        typedRealName: false,     // D3 输入真名
        burnedNote: false,        // D4 烧掉纸条
        noteChoice: '',           // D4 纸条处置：file / burn / hide
        hidNote: false,           // D4 把纸条藏进物品栏
        d5Failed: false,          // D5 未按时归还
        spamAll: false            // 全部标记垃圾邮件
      },

      /* 设置 */
      opt: {
        reducedMotion: false,
        haptics: true,
        keepAwake: true,
        sound: true,     /* 音效总开关 */
        volume: 2,       /* 0=关 1=低 2=中 3=高 */
        ambient: true    /* 环境底噪 */
      }
    };
  }

  /* 简单深度合并：以 defaults 为骨架，用已存数据覆写 */
  function merge(base, saved) {
    if (saved === null || typeof saved !== 'object') return base;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(saved).forEach(function (k) {
      var bv = out[k];
      var sv = saved[k];
      if (bv && typeof bv === 'object' && !Array.isArray(bv) &&
          sv && typeof sv === 'object' && !Array.isArray(sv)) {
        out[k] = merge(bv, sv);
      } else {
        out[k] = sv;
      }
    });
    return out;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        S = merge(defaults(), JSON.parse(raw));
        return S;
      }
    } catch (e) { /* 存档损坏则重置 */ }
    S = defaults();
    return S;
  }

  function save() {
    if (!S) return;
    try {
      global.localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) { /* 隐私模式下静默失败，游戏仍可继续 */ }
  }

  function reset() {
    S = defaults();
    try { global.localStorage.removeItem(KEY); } catch (e) {}
    return S;
  }

  function hasSave() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      return !!(d && d.started);
    } catch (e) { return false; }
  }

  /* ---------------- 邮件 ---------------- */
  function mail(id) {
    if (!S.mails[id]) S.mails[id] = { read: false, action: null, at: 0 };
    return S.mails[id];
  }
  function setMail(id, patch) {
    var m = mail(id);
    Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
    save();
    return m;
  }

  /* ---------------- 好感 / 遗忘 ---------------- */
  function affUp(k, n) {
    n = n || 1;
    S.aff[k] = Math.min(5, (S.aff[k] || 0) + n);
    save();
  }
  function affDown(k, n) {
    n = n || 1;
    S.aff[k] = Math.max(0, (S.aff[k] || 0) - n);
    save();
  }
  function addForget(n) {
    n = n || 1;
    S.forget += n;
    save();
    return S.forget;
  }

  /* ---------------- 崩坏一次性 ---------------- */
  function seenGlitch(id) { return !!S.glitch[id]; }
  function markGlitch(id) {
    if (S.glitch[id]) return false;
    S.glitch[id] = true;
    save(); /* 先写盘，再播动画 */
    return true;
  }

  /* ---------------- 提示 ---------------- */
  function hintLevels(day) {
    if (!S.hints[day]) S.hints[day] = [0, 0, 0, 0];
    return S.hints[day];
  }

  /* ---------------- 切出（只记时长） ---------------- */
  function addAway(sec) {
    if (!sec || sec < 0) return;
    S.awayLast = sec;
    S.awayTotal += sec;
    S.awayLog.push(sec);
    if (S.awayLog.length > 40) S.awayLog.shift();
    save();
  }

  /* ---------------- 值班日志（只记标签顺序） ---------------- */
  function logTab(tab) {
    if (!S.log.length || S.log[S.log.length - 1] !== tab) {
      S.log.push(tab);
      if (S.log.length > 200) S.log.shift();
    }
  }

  /* ---------------- 时间工具 ---------------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* 游戏内时间：1987-07-14 起，每晚 23:30 上班 */
  function gameClock() {
    var base = new Date();
    var h = 23, m = (30 + (S.day - 1) * 3) % 60;
    var hh = 23 + Math.floor((30 + (S.day - 1) * 3) / 60);
    if (hh > 23) hh = 23;
    return pad2(hh) + ':' + pad2(m) + ':' + pad2((base.getSeconds() + S.day * 7) % 60);
  }

  function nowStamp() {
    return '1987-07-' + pad2(13 + S.day) + ' ' + gameClock();
  }

  global.Store = {
    get s() { return S || load(); },
    KEY: KEY,
    defaults: defaults,
    load: load,
    save: save,
    reset: reset,
    hasSave: hasSave,
    mail: mail,
    setMail: setMail,
    affUp: affUp,
    affDown: affDown,
    addForget: addForget,
    seenGlitch: seenGlitch,
    markGlitch: markGlitch,
    hintLevels: hintLevels,
    addAway: addAway,
    logTab: logTab,
    gameClock: gameClock,
    nowStamp: nowStamp,
    pad2: pad2
  };
})(window);
