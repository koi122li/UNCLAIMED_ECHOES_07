/* ============================================================
   UNCLAIMED_ECHOES_07  ·  game.js  (part 1/3)
   启动流程 / 横屏 / 渲染 / 事件委托 / 状态栏
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var $ = UI.$;
  var D = global.DATA;

  var contentEl = null;
  var clockTimer = null;
  var awayTs = 0;
  var booted = false;

  function S() { return global.Store.s; }
  function V() { return global.Views.VS; }
  function A(n, a) { if (global.Audio7) global.Audio7.play(n, a); }

  /* ==================== 视口 / 横屏 ==================== */
  function setVh() {
    /* visualViewport 能正确排除手势条 / 键盘区域，优先使用 */
    var vv = window.visualViewport;
    var h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight;
    document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
  }

  function tryLandscape() {
    /*
     * 网页版：不强制全屏、不锁屏幕方向。
     * 桌面浏览器窗口本身就是横向的；手机上竖屏打开时由 CSS 的
     * 「请旋转设备」提示兜底，不需要调用 orientation.lock
     * （桌面浏览器会抛错，部分手机浏览器会弹权限提示）。
     */
  }

  /* ==================== 时钟 ==================== */
  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    var el = $('titlebar-clock');
    function tick() {
      if (!el) return;
      var d = new Date();
      el.textContent = global.Store.pad2(d.getHours()) + ':' +
                       global.Store.pad2(d.getMinutes()) + ':' +
                       global.Store.pad2(d.getSeconds());
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ==================== 标题栏 ==================== */
  function updateTitle() {
    var el = $('titlebar-text');
    if (!el) return;
    var st = S();
    if (st.inv.mTerritory) {
      el.textContent = '归巢失物招领 - M的领地';
    } else if (st.inv.tPatch) {
      el.textContent = '归巢失物招领 v1.3  [T. 已优化]';
      document.documentElement.style.setProperty('--accent', '#002FA7');
    } else {
      el.textContent = '归巢失物招领 v1.3';
    }
  }

  /* ==================== 状态栏 ==================== */
  function updateStatusBar() {
    var st = S();
    var wrap = $('aff-pixels');
    if (wrap) {
      var keys = ['M', 'H', 'T', 'I'];
      var html = '';
      keys.forEach(function (k) {
        html += '<span class="aff-group"><span class="aff-label">' + k + '</span>';
        for (var i = 0; i < 5; i++) {
          html += '<i class="aff-cell' + (i < (st.aff[k] || 0) ? ' on' : '') + '"></i>';
        }
        html += '</span>';
      });
      wrap.innerHTML = html;
    }
    var off = $('btn-offduty');
    if (off) {
      off.disabled = !!st.endings && !!st.ending;
    }
  }

  function updateBadge() {
    var st = S();
    var badge = $('badge-inbox');
    if (!badge) return;
    var unread = (st.mailOrder || []).filter(function (id) {
      var m = st.mails[id];
      return m && !m.read;
    }).length;
    badge.textContent = unread;
    badge.classList.toggle('zero', unread === 0);
    if (unread && V().tab !== 'inbox') {
      var tb = $('titlebar-text');
      if (tb) tb.classList.add('flash');
      setTimeout(function () {
        var t = $('titlebar-text');
        if (t) t.classList.remove('flash');
      }, 1600);
    }
  }

  /* ==================== 渲染 ==================== */
  function refresh(keepScroll) {
    if (!contentEl) contentEl = $('content');
    if (!contentEl) return;

    /*
     * 渲染兜底：任何一页抛异常都不能让整个界面卡死。
     * 出错时显示系统故障页，其他标签仍可切换。
     */
    try {
      contentEl.innerHTML = global.Views.render(V().tab);
    } catch (err) {
      if (global.console) console.error('[UE07] render failed:', err);
      contentEl.innerHTML = '<div class="tab"><div class="mail-empty"><div>' +
        '<span class="tag tag-solid">SYSTEM FAULT</span><br><br>' +
        '<span class="mono" style="font-size:11px;white-space:pre-wrap;word-break:break-all">' +
        esc(String((err && err.message) || err)) +
        '</span><br><br>' +
        '<span class="dim" style="font-size:10.5px">这一页坏了。点其他标签试试。</span>' +
        '</div></div></div>';
    }

    /* 高亮左侧当前标签 */
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === V().tab);
    });

    updateStatusBar();
    updateBadge();
    updateTitle();

    if (keepScroll) {
      var sc = contentEl.querySelector('.scroll');
      if (sc) sc.scrollTop = 0;
    }
    if (global.Game.onAfterRender) global.Game.onAfterRender();
  }

  function setTab(tab) {
    if (V().tab === tab) return;
    V().tab = tab;
    global.Store.logTab(tab);
    global.Store.save();
    A('tab');

    /*
     * 补偿：当天已登记但角色邮件没投放（旧版本里关掉结算弹窗就会漏）。
     * deliverCharMails 内部有去重，重复调用安全。
     */
    var stc = S();
    if (stc.started && stc.reg[stc.day] && global.Game.deliverCharMails) {
      global.Game.deliverCharMails();
    }

    refresh();
    contentEl = $('content');
    if (contentEl) contentEl.scrollTop = 0;
  }

  /* ==================== 事件委托 ==================== */
  function bindEvents() {
    var nav = $('navbar');
    if (nav) {
      nav.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tab]');
        if (!b) return;
        UI.haptic(20);
        setTab(b.getAttribute('data-tab'));
      });
    }

    contentEl = $('content');
    if (contentEl) {
      contentEl.addEventListener('click', function (e) {
        var t;

        /* 邮件列表 */
        t = e.target.closest('[data-mail]');
        if (t && !t.getAttribute('data-act')) {
          global.Game.openMail(t.getAttribute('data-mail'));
          return;
        }

        /* 邮件动作 */
        t = e.target.closest('[data-act]');
        if (t) {
          var act = t.getAttribute('data-act');
          var id = t.getAttribute('data-mail');
          handleAction(act, id, t);
          return;
        }

        /* 附件动作 */
        t = e.target.closest('[data-extra]');
        if (t) {
          global.Game.openExtra(t.getAttribute('data-extra'));
          return;
        }

        /* 规则分页 */
        t = e.target.closest('[data-page]');
        if (t) {
          V().rulePage = parseInt(t.getAttribute('data-page'), 10) || 0;
          refresh();
          return;
        }

        /* 更多面板 */
        t = e.target.closest('[data-panel]');
        if (t) {
          global.Game.openPanel(t.getAttribute('data-panel'));
          return;
        }

        /* 提示层级 */
        t = e.target.closest('[data-hint]');
        if (t) {
          global.Game.useHint(parseInt(t.getAttribute('data-hint'), 10));
          return;
        }

        /* 柜位格子 */
        t = e.target.closest('[data-cab]');
        if (t) {
          var inp = document.getElementById('cab-input');
          if (inp) {
            if (inp.value.length < 6) inp.value += t.getAttribute('data-cab');
          }
          return;
        }

        /* 设置开关 */
        t = e.target.closest('[data-toggle]');
        if (t) {
          global.Game.toggleOpt(t.getAttribute('data-toggle'));
          return;
        }
      });
    }

    /* 覆盖层内的事件委托（柜位图 / 设置开关 / 提示层级 / data-act） */
    var ovRoot = $('overlay-root');
    if (ovRoot) {
      ovRoot.addEventListener('click', function (e) {
        var t;
        t = e.target.closest('[data-act]');
        if (t) {
          handleAction(t.getAttribute('data-act'), t.getAttribute('data-mail'), t);
          return;
        }
        t = e.target.closest('[data-cab]');
        if (t) {
          var ci = document.getElementById('cab-input');
          if (ci && ci.value.length < 6) ci.value += t.getAttribute('data-cab');
          return;
        }
        t = e.target.closest('[data-toggle]');
        if (t) {
          global.Game.toggleOpt(t.getAttribute('data-toggle'));
          return;
        }
        t = e.target.closest('[data-hint]');
        if (t) {
          global.Game.useHint(parseInt(t.getAttribute('data-hint'), 10));
          return;
        }
      });
    }

    /* 状态栏 */
    var net = $('btn-net');
    if (net) {
      net.addEventListener('click', function () {
        global.Game.toggleNet();
      });
    }
    var off = $('btn-offduty');
    if (off) {
      off.addEventListener('click', function () {
        global.Game.offDuty();
      });
    }
    var search = $('btn-search');
    if (search) {
      search.addEventListener('click', function () {
        global.Game.openSearch();
      });
    }

    /* 返回键 / 手势 */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (UI.hasOverlay()) {
          UI.closeOverlay(true);
        } else {
          global.Game.askOffDuty();
        }
      }
    });
    if (global.webcat && global.webcat.onBackPressed) {
      try {
        global.webcat.onBackPressed(function () {
          if (UI.hasOverlay()) {
            UI.closeOverlay(true);
            return true;
          }
          global.Game.askOffDuty();
          return true;
        });
      } catch (e) {}
    }

    /* 切出检测：只记时长（文档 6.4 / 13.6） */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        awayTs = Date.now();
        if (global.Audio7) global.Audio7.suspend();
        return;
      }
      if (global.Audio7) global.Audio7.resume();
      if (!awayTs) return;
      var sec = Math.round((Date.now() - awayTs) / 1000);
      awayTs = 0;
      if (sec >= 2 && S().started) {
        global.Store.addAway(sec);
        /* 第 6—7 天：角色引用离开时长 */
        if (S().day >= 6) {
          UI.toast('连接中断 ' + sec + ' 秒。已恢复。');
        }
        if (V().tab === 'monitor') refresh();
      }
    });

    /* 屏幕常亮 */
    applyWakeLock();

    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', function () {
      setTimeout(setVh, 120);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh);
    }
  }

  var wakeLock = null;
  function applyWakeLock() {
    var want = S().opt.keepAwake;
    if (want && navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
      }).catch(function () {});
    } else if (!want && wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  /* ==================== 动作分发 ==================== */
  function handleAction(act, id, el) {
    A('click');
    switch (act) {
      case 'reply': global.Game.replyMail(id); break;
      case 'ignore': global.Game.ignoreMail(id); break;
      case 'spam': global.Game.spamMail(id); break;
      case 'record': global.Game.recordMail(id); break;
      case 'final': global.Game.openFinal(); break;
      case 'submit-ledger': global.Game.submitLedger(); break;
      case 'choose': global.Game.chooseLedger(el.getAttribute('data-key')); break;
      case 'submit-choice': global.Game.submitChoiceLedger(); break;
      case 'cabinet': global.Game.openCabinet(); break;
      case 'offduty': global.Game.offDuty(); break;
      case 'cab-open': global.Game.openCabinetCell(); break;
      case 'cab-clear':
        var ci = document.getElementById('cab-input');
        if (ci) ci.value = '';
        break;
      case 'verify': global.Game.doVerify(); break;
      case 'verify-clear':
        S().vfLog = [];
        global.Store.save();
        refresh();
        break;
      case 'rule14-copy': global.Game.copyRule14(); break;
      case 'rule14-edit': global.Game.editRule14(); break;
      case 'reset-save': global.Game.confirmReset(); break;
      case 'reset-endingfx': global.Game.resetEndingFx(); break;
      case 'volume-cycle':
        var vol = (S().opt.volume == null ? 2 : S().opt.volume);
        S().opt.volume = (vol + 1) % 4;
        global.Store.save();
        if (global.Audio7) {
          global.Audio7.setVolume();
          global.Audio7.play('ok');
        }
        UI.closeOverlay(true);
        global.Game.openPanel('setting');
        break;
      default: break;
    }
  }

  /* ==================== 启动 ==================== */
  function showBoot() {
    var boot = $('boot');
    if (boot) boot.classList.remove('hidden');
    var app = $('app');
    if (app) app.classList.add('hidden');
    var cont = $('boot-continue');
    if (cont) {
      cont.classList.toggle('hidden', !global.Store.hasSave());
    }
  }

  function enterApp() {
    var boot = $('boot');
    if (boot) boot.classList.add('hidden');
    var app = $('app');
    if (app) app.classList.remove('hidden');

    /*
     * 音效系统在这里统一启动。
     * 之前只在「我已知晓，开始值班」的点击里初始化，
     * 走「继续上次值班」路径的玩家永远听不到环境底噪。
     */
    if (global.Audio7) {
      global.Audio7.init();
      global.Audio7.startAmbient();
    }

    setVh();
    refresh();
    startClock();
  }

  function askCodename(onDone) {
    UI.input({
      title: '值班登记',
      label: '请设置值班代号 · 不要用真实姓名',
      placeholder: '2—8 个字符',
      maxlength: 8,
      keys: ['A','B','C','D','E','F','N','O','R','T','0','1','2','3','-','⌫'],
      note: '全程称你为「登记员[代号]」。这个代号会出现在结局里。<br>' +
            '本程序不读取你的真实姓名。',
      okText: '登记',
      onOk: function (v) {
        var code = String(v || '').trim();
        if (code.length < 2 || code.length > 8) {
          UI.toast('代号需 2—8 个字符');
          return false;
        }
        var bad = ['M.', 'H.', 'T.', 'I.', 'M', 'H', 'T', 'I', 'DELETE', 'CLOSE', 'ZERO', 'NONE'];
        if (bad.indexOf(code.toUpperCase()) >= 0) {
          UI.toast('该代号已被占用');
          return false;
        }
        UI.closeOverlay(true);
        global.Game.startGame(code);
        onDone && onDone();
      }
    });
  }

  /* ==================== 对外接口 ==================== */
  global.Game = {
    init: function () {
      global.Store.load();
      booted = true;
      setVh();
      bindEvents();
      showBoot();

      var start = $('boot-start');
      if (start) {
        start.addEventListener('click', function () {
          UI.haptic(30);
          /* 首次用户交互后建立 AudioContext（规避自动播放限制） */
          if (global.Audio7) {
            global.Audio7.init();
            global.Audio7.startAmbient();
          }
          tryLandscape();
          /* 已有存档时先确认，避免误清进度 */
          if (global.Store.hasSave()) {
            UI.confirm('开始新的值班？',
              '当前有一份未完成的存档。\n\n开始新值班会清除它。',
              function () { askCodename(); },
              '清除并重新开始', '继续上次');
            return;
          }
          askCodename();
        });
      }
      var cont = $('boot-continue');
      if (cont) {
        cont.addEventListener('click', function () {
          UI.haptic(30);
          tryLandscape();
          enterApp();
          global.Game.resume();
        });
      }

      /* 阻止长按菜单，但放行可选中区域（文档 4.4：长按正文可复制） */
      document.addEventListener('contextmenu', function (e) {
        var t = e.target;
        if (!t) return;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        if (t.closest && t.closest('.selectable')) return;
        e.preventDefault();
      });

      /* 复制正文时提醒：隐藏字符可能已丢失（文档 6.2） */
      document.addEventListener('copy', function () {
        var sel = '';
        try { sel = String(window.getSelection()); } catch (e) {}
        if (sel && sel.trim().length > 0) {
          UI.toast('[复制不完整：隐藏字符可能已丢失]');
        }
      });
    },

    enterApp: enterApp,
    setTab: setTab,
    refresh: refresh,
    updateBadge: updateBadge,
    updateStatusBar: updateStatusBar,
    updateTitle: updateTitle,
    startClock: startClock,
    S: S,
    V: V
  };
})(window);

/* ============================================================
   UNCLAIMED_ECHOES_07  ·  game.js  (part 2/3)
   业务流：开日 / 投放 / 邮件动作 / 登记 / 校验 / 柜位 / 提示
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var $ = UI.$;
  var D = global.DATA;

  function S() { return global.Store.s; }
  function V() { return global.Views.VS; }
  function G() { return global.Game; }
  function A(n, a) { if (global.Audio7) global.Audio7.play(n, a); }

  /* ==================== 工具 ==================== */
  function norm(v) {
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[\s\.\-_\/、，,]/g, '');
  }

  function hhmm() {
    var d = new Date();
    return global.Store.pad2(d.getHours()) + ':' + global.Store.pad2(d.getMinutes());
  }

  function deliver(id) {
    var st = S();
    if (!st.mailOrder) st.mailOrder = [];
    if (st.mailOrder.indexOf(id) >= 0) return false;
    var meta = global.Views.mailMeta(id);
    if (!meta) return false;
    st.mailOrder.push(id);
    var m = global.Store.mail(id);
    m.delivered = true;
    m.time = hhmm();
    global.Store.save();

    /* 新邮件提示 + 该角色的短动机（≤1.5s，低音量） */
    A('newMail');
    if (meta.from && D.characters[meta.from] && global.Audio7) {
      global.Audio7.motif(meta.from);
    }
    return true;
  }

  function charName(k) {
    if (k === 'SYS') return '归巢系统';
    var c = D.characters[k];
    return c ? c.name : k;
  }

  /* ==================== 开始 / 继续 ==================== */
  function startGame(code) {
    /*
     * 必须整体重置。之前这里只手动清了一部分字段，漏掉了 st.mails ——
     * 上一次玩的时候点过「回复」，再点「开始值班」时
     * mails['d1_M'].action 仍然是 'reply'，于是新一局第一天就显示「已回复」。
     */
    var st = global.Store.reset();
    st.started = true;
    st.codename = code;
    st.day = 1;
    global.Store.save();

    G().enterApp();
    beginDay(1);

    UI.overlay({
      title: '入职说明',
      closable: false,
      html:
        '<p>登记员 <b class="mono">' + esc(code) + '</b>，欢迎。</p>' +
        '<p>你是「归巢失物招领平台」的夜班登记员。前任登记员于三年前失踪，档案未结。</p>' +
        '<p>每晚你会收到一件失物。请使用<strong>你习惯的记录方式</strong>处理附件里的编码线索，' +
        '然后回到登记簿提交特征与校验码。</p>' +
        '<p class="dim" style="font-size:11.5px">本程序不提供自动解码。<br>' +
        '复制文本可能丢失隐藏字符。<br>' +
        '切出游戏只会被记录时长，不会被记录内容。</p>',
      buttons: [{ t: '开始第一夜', cls: 'btn-primary', act: function () { G().refresh(); } }]
    });
  }

  function resume() {
    var st = S();
    if (!st.started) return;
    if (!st.mailOrder) st.mailOrder = [];
    /* 若当天系统邮件缺失（异常中断），补投 */
    var sysId = 'd' + st.day + '_sys';
    if (st.mailOrder.indexOf(sysId) < 0) deliver(sysId);
    /* 补偿：已登记但角色邮件未投放 */
    if (st.reg[st.day]) deliverCharMails();
    if (st.awayLast > 0) {
      UI.toast('连接中断 ' + st.awayLast + ' 秒。已恢复。');
    }
    G().refresh();
    G().updateTitle();
  }

  function beginDay(day) {
    var st = S();
    st.day = day;
    var dd = D.days[day - 1];

    /* 系统失物邮件 */
    deliver('d' + day + '_sys');

    /* 第 4 天：I 的邮件在进入当天立刻到达，不等登记 / 柜位图 */
    if (day === 4) deliver('d4_I');

    /* 第 7 天：四人同时到达，不等登记 */
    if (day === 7) {
      ['d7_M', 'd7_H', 'd7_T', 'd7_I'].forEach(function (id) { deliver(id); });
    }

    /* 反应邮件（0—2 封） */
    var reacts = global.REACTIONS.pick(st);
    reacts.forEach(function (r) {
      var m = global.Store.mail(r.id);
      m.delivered = true;
      if (!st.mailOrder) st.mailOrder = [];
      if (st.mailOrder.indexOf(r.id) < 0) st.mailOrder.push(r.id);
      m.time = hhmm();
    });

    /* 角色互相指控（每天 1—2 封，发件人避开当天主邮件） */
    if (day >= 2) deliverQuarrel();

    /* 第 5 天：监控慢 24 小时的说明由 monitor 渲染 */
    global.Store.save();

    /* 角色入侵的日常表现 */
    applyInvasionDaily();

    G().refresh();
    G().updateTitle();

    if (day > 1) {
      UI.toast('D0' + day + ' · ' + dd.title);
    }

    /* 第 7 天开场：标题闪烁崩坏的前置留白 */
    if (day === 7) {
      setTimeout(function () {
        UI.toast('系统时间已归零。这是最后一夜。', 2600);
      }, 1200);
    }
  }

  function applyInvasionDaily() {
    var st = S();
    var changed = [];
    var prevIcons = st.inv.iIcons || 0;

    if (st.aff.I >= 1 && st.inv.iIcons < 3) st.inv.iIcons = Math.min(3, st.aff.I);
    if (st.inv.iIcons > prevIcons) changed.push('I');
    if (st.aff.H >= 1 && !st.inv.hRule15) { st.inv.hRule15 = true; changed.push('H'); }
    if (st.aff.M >= 3 && !st.inv.mTerritory) { st.inv.mTerritory = true; changed.push('M'); }
    if (st.aff.T >= 1 && !st.inv.tPatch) { st.inv.tPatch = true; changed.push('T'); }

    global.Store.save();

    /* 入侵音效只播一次，不循环 */
    changed.forEach(function (k) { A('inv' + k); });
  }

  /* ==================== 邮件 ==================== */
  function openMail(id) {
    var st = S();
    var m = global.Store.mail(id);
    A('mailOpen');
    if (!m.read) {
      m.read = true;
      global.Store.save();
      /* 第 7 天收件箱幽灵 */
      if (st.day === 7 && !global.Store.seenGlitch('D7_INBOX_GHOST')) {
        setTimeout(function () { global.Glitch.trigger('D7_INBOX_GHOST'); }, 80);
      }
      /* 第 6 天邮件闪屏（第一次打开任意角色邮件） */
      var meta = global.Views.mailMeta(id);
      if (st.day === 6 && meta && meta.from !== 'SYS' &&
          !global.Store.seenGlitch('D6_MAIL_FLASH')) {
        setTimeout(function () {
          global.Glitch.trigger('D6_MAIL_FLASH');
          UI.haptic(100);
        }, 120);
      }
    }
    V().selMail = id;
    G().refresh();
  }

  function replyMail(id) {
    var st = S();
    var meta = global.Views.mailMeta(id);
    if (!meta) return;
    var opts = meta.replies || [{ t: '回复', key: 'ok', line: '……' }];

    var html = '<div style="font-size:12px;line-height:1.6;margin-bottom:8px">回复 ' +
      esc(charName(meta.from)) + '：</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      opts.map(function (o, i) {
        return '<button class="btn btn-block" data-reply="' + i + '" type="button">' +
          esc(o.t) + '</button>';
      }).join('') +
      '</div>';

    var w = UI.overlay({
      title: '写回复',
      html: html,
      buttons: [{ t: '取消', cls: 'btn-ghost' }]
    });

    w.querySelectorAll('[data-reply]').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.getAttribute('data-reply'), 10);
        UI.closeOverlay(true);
        doReply(id, meta, opts[idx]);
      });
    });
  }

  function doReply(id, meta, opt) {
    var st = S();
    A('send');
    global.Store.setMail(id, { action: 'reply' });
    if (meta.from && st.aff[meta.from] !== undefined) {
      global.Store.affUp(meta.from, 1);
      st.streak[meta.from] = (st.streak[meta.from] || 0) + 1;
      /* 其他角色的连续计数归零 */
      Object.keys(st.streak).forEach(function (k) {
        if (k !== meta.from) st.streak[k] = 0;
      });
    }
    st.replies += 1;
    global.Store.save();

    /* 好感解锁入侵行为 */
    applyInvasionDaily();

    var line = opt && opt.line ? opt.line : '……';
    UI.overlay({
      title: '已发送',
      html: '<div style="font-size:12.5px;line-height:1.7;white-space:pre-wrap">' +
        esc(line) + '</div>' +
        '<div class="dim" style="font-size:10.5px;margin-top:8px">对方已读。你不确定这是好事。</div>',
      buttons: [{ t: '关闭', cls: 'btn-primary' }]
    });

    /*
     * 注意：这里不再判定坏结局。
     * 之前每次回复都调 checkBad()，而 checkBad 里「累计回复满 9 封」这条
     * 在第 6 天四人同时发信时极易达成，导致玩家还没走到第 7 天的最终选择
     * 就被《黄雨衣》截断。判定统一放到结局阶段。
     */
    if (S().forget >= 3) {
      UI.toast('遗忘值 ' + S().forget + '。有些东西正在被忘掉。');
    }

    G().refresh();
  }

  function ignoreMail(id) {
    var st = S();
    var meta = global.Views.mailMeta(id);
    global.Store.setMail(id, { action: 'ignore' });
    if (meta && meta.from && st.streak[meta.from] !== undefined) {
      st.streak[meta.from] = 0;
    }
    global.Store.save();
    UI.toast('你什么也没有说。');
    G().refresh();
  }

  function spamMail(id) {
    var st = S();
    var meta = global.Views.mailMeta(id);
    global.Store.setMail(id, { action: 'spam' });
    if (meta && meta.from && st.aff[meta.from] !== undefined) {
      global.Store.affDown(meta.from, 1);
      st.streak[meta.from] = 0;
    }
    global.Store.save();
    UI.toast('已标记为垃圾邮件。');

    /* 判定：是否所有角色邮件都被标记垃圾 */
    checkSpamAll();
    G().refresh();
  }

  function checkSpamAll() {
    var st = S();
    var chars = (st.mailOrder || []).filter(function (id) {
      var m = global.Views.mailMeta(id);
      return m && m.from !== 'SYS';
    });
    if (chars.length < 4) return;
    var allSpam = chars.every(function (id) {
      var r = st.mails[id];
      return r && r.action === 'spam';
    });
    if (allSpam) {
      st.flags.spamAll = true;
      global.Store.save();
    }
  }

  function recordMail(id) {
    var st = S();
    if (!st.recorded) st.recorded = {};
    st.recorded[id] = true;
    global.Store.save();
    var meta = global.Views.mailMeta(id);
    UI.overlay({
      title: '已记录确认',
      html: '<div style="font-size:12.5px;line-height:1.7;white-space:pre-wrap">' +
        '你把这一封记下来了。\n\n' +
        (meta && meta.record ? esc(meta.record) : '好的。') +
        '\n\n<span style="font-size:11px;color:#5A5A5A">记录介质由你选择。本程序不读取它。</span>' +
        '</div>',
      buttons: [{ t: '关闭', cls: 'btn-primary' }]
    });
    G().refresh();
  }

  function openExtra(id) {
    var meta = global.Views.mailMeta(id);
    if (!meta || !meta.extra) return;
    var key = meta.extra.key;

    if (key === 'tPatch') {
      UI.overlay({
        title: 'patch_003.txt',
        html: '<pre style="font-size:13px">' + esc(meta.extra.result) + '</pre>',
        buttons: [{
          t: '应用补丁',
          cls: 'btn-primary',
          act: function () {
            S().inv.tPatch = true;
            global.Store.save();
            G().updateTitle();
            UI.toast('T. 已优化');
            G().refresh();
          }
        }]
      });
      return;
    }

    if (key === 'iGame') {
      var count = 0;
      A('igOpen');
      var w = UI.overlay({
        title: '小游戏 · 点我五次',
        closable: false,
        html:
          '<div style="text-align:center">' +
            '<div class="dim" style="font-size:11px;margin-bottom:6px">你又点开了它。</div>' +
            '<div class="mono" style="font-size:44px;line-height:1;margin:8px 0" id="ig-count">0</div>' +
            '<div class="dim" style="font-size:11.5px">点五下就好。</div>' +
            '<button class="btn btn-primary" id="ig-btn" type="button" ' +
              'style="margin-top:12px;min-width:120px;min-height:56px">点</button>' +
          '</div>',
        buttons: []
      });
      var cnt = w.querySelector('#ig-count');
      var btn = w.querySelector('#ig-btn');
      btn.addEventListener('click', function () {
        count++;
        cnt.textContent = count;
        UI.haptic(15);
        if (global.Audio7) global.Audio7.igClick(count);
        if (count >= 5) {
          btn.disabled = true;
          btn.textContent = '够了';
          setTimeout(function () {
            UI.closeOverlay(true);
            if (global.Audio7) global.Audio7.igResultByCount(count);
            UI.overlay({
              title: '小游戏 · 结束',
              html: '<div style="font-size:13px;line-height:1.7">' +
                '你点了 ' + count + ' 下。\n\n' +
                '<span class="mono" style="color:#002FA7">I. 记住了。</span>\n\n' +
                '<span class="dim" style="font-size:11px">这个数字会出现在你明天的邮件里。</span>' +
                '</div>',
              buttons: [{ t: '关闭', cls: 'btn-primary' }]
            });
            S().inv.iIcons = Math.max(S().inv.iIcons, 1);
            global.Store.save();
          }, 400);
        }
      });
      return;
    }
  }

  /* ==================== 登记 ==================== */
  function matchAnswer(d, ans) {
    var n = norm(ans);
    if (!n) return false;
    if (norm(d.answer.value) === n) return true;
    if (d.answerAlt) {
      for (var i = 0; i < d.answerAlt.length; i++) {
        if (norm(d.answerAlt[i]) === n) return true;
      }
    }
    return false;
  }

  function expectedChecksum(d) {
    var st = S();
    var c = d.answer.checksum;
    if (c === 'FN') {
      /* D6：（隐藏字符数 3 × 7 + 值班代号长度）mod 10 */
      var len = Array.from(st.codename || '').length;
      return String((3 * 7 + len) % 10);
    }
    if (c === 'FN7') {
      /* D7：四天权重和 29 × 7 mod 100 = 03 */
      return '03';
    }
    return c;
  }

  function matchChecksum(d, val) {
    var v = String(val || '').trim().replace(/^0+(?=\d)/, '');
    var e = String(expectedChecksum(d)).replace(/^0+(?=\d)/, '');
    return v !== '' && v === e;
  }

  /* 校验码检查（两条路径共用），失败时自己处理计数与异常 */
  function checkChecksum(d, ck, ckEl) {
    var st = S();
    if (!matchChecksum(d, ck)) {
      st.ckFail[st.day] = (st.ckFail[st.day] || 0) + 1;
      global.Store.save();
      var n = st.ckFail[st.day];
      UI.haptic(60);
        UI.toast('校验码错误 ' + n + ' / 3。');
      if (ckEl) {
        ckEl.classList.add('shake');
        setTimeout(function () { ckEl.classList.remove('shake'); }, 260);
      }
      if (n >= 3) monitorAnomaly();
      return false;
    }
    return true;
  }

  /* ---------------- 登记完成（共用出口） ---------------- */
  function completeLedger(d, shownValue) {
    var st = S();
    var val = shownValue || d.answer.value;

    st.reg[st.day] = {
      done: true,
      answer: val,
      checksum: expectedChecksum(d),
      raw: val,
      at: Date.now()
    };
    st.ledger.push({ day: st.day, code: d.code, ans: val, at: Date.now() });
    V().ledgerChoice = null;

    /* 当天可获得的失主姓名（《关门》结局需集齐七个） */
    if (d.name && st.names.indexOf(d.name) < 0) {
      st.names.push(d.name);
    }

    /* 第 5 天：归还时限（系统时间 00:00 前，折合 8 分钟游戏内时间） */
    if (st.day === 5 && st.day5Start && !st.flags.d5Failed) {
      var elapsed = Math.round((Date.now() - st.day5Start) / 1000);
      if (elapsed > 480) {
        st.flags.d5Failed = true;
        global.Store.addForget(2);
        UI.toast('归还超时。钥匙已转入7号柜。遗忘值 +2');
      }
    }

    global.Store.save();
    A('submit');

    /*
     * 先投放当天的骚扰邮件。
     * 之前这一步放在 afterLedger()（「继续」按钮的回调）里，
     * 玩家只要关掉结算弹窗（X / 返回键），邮件就永远不会来。
     * 投放是结算的一部分，不能依赖 UI 交互。
     */
    deliverCharMails();

    UI.overlay({
      title: '登记受理',
      html: '<div style="font-size:12.5px;line-height:1.7">' +
        '编号 <b class="mono">' + esc(d.code) + '</b><br>' +
        '特征 <b class="mono">' + esc(val) + '</b><br>' +
        '校验码 <b class="mono">' + esc(expectedChecksum(d)) + '</b><br><br>' +
        '已受理。失物将保留七日。<br>' +
        '<span class="dim" style="font-size:11px">七日内无人认领，转入 7 号柜。</span>' +
        (d.cabinet ? '<br><br><span style="color:#002FA7">柜位图提示：本件关联旧工牌。</span>' : '') +
        '</div>' +
        (d.nameClue
          ? '<div class="notice" style="margin-top:8px;white-space:pre-wrap;font-size:12px">' +
            esc(d.nameClue) + '</div>'
          : ''),
      buttons: [{
        t: '继续',
        cls: 'btn-primary',
        act: function () { afterLedger(d); }
      }]
    });
  }

  /* ---------------- 路径 A：文本填写（D1 / D2 / D4 / D6） ---------------- */
  function submitLedger() {
    var st = S();
    var d = D.days[st.day - 1];
    var ansEl = document.getElementById('ledger-answer');
    var ckEl = document.getElementById('ledger-checksum');
    if (!ansEl || !ckEl) return;
    var ans = String(ansEl.value || '');
    var ck = ckEl.value;

    if (!ans.trim()) { UI.toast('特征不能为空。'); return; }

    if (!matchAnswer(d, ans)) {
      UI.haptic(60);
      UI.toast('特征与你手上的记录不符。');
      ansEl.classList.add('shake');
      setTimeout(function () { ansEl.classList.remove('shake'); }, 260);
      return;
    }

    if (!checkChecksum(d, ck, ckEl)) return;

    completeLedger(d, d.answer.value);
  }

  /* ---------------- 路径 B：处置选项（D3 / D5） ---------------- */
  function chooseLedger(key) {
    var st = S();
    var d = D.days[st.day - 1];
    if (!d.choices) return;
    var c = null;
    for (var i = 0; i < d.choices.length; i++) {
      if (d.choices[i].key === key) { c = d.choices[i]; break; }
    }
    if (!c) return;

    /* 提交录音里问的那个名字 */
    if (c.special === 'name') { askRealName(d); return; }

    /* 有代价的选项：二次确认后执行 */
    if (c.fail) {
      UI.confirm('确认处置', '这个选择不可撤销。\n\n' + c.label, function () {
        if (c.forget) global.Store.addForget(c.forget);
        if (c.flag) st.flags[c.flag] = true;
        global.Store.save();
        UI.overlay({
          title: '受理结果',
          html: '<div style="font-size:12.5px;line-height:1.75;white-space:pre-wrap">' +
            esc(c.fail) + '</div>' +
            (c.forget
              ? '<div class="notice warn">遗忘值 +' + c.forget + '</div>'
              : ''),
          buttons: [{
            t: '关闭',
            cls: 'btn-primary',
            act: function () { G().refresh(); G().updateStatusBar(); }
          }]
        });
      }, '确认', '再想想');
      return;
    }

    /* 正常选项：记住选择，保留已填的校验码 */
    var ckEl = document.getElementById('ledger-checksum');
    var keep = ckEl ? ckEl.value : '';
    V().ledgerChoice = key;
    G().refresh();
    var nEl = document.getElementById('ledger-checksum');
    if (nEl) nEl.value = keep;
    UI.toast('已选择：' + c.label);
  }

  function submitChoiceLedger() {
    var st = S();
    var d = D.days[st.day - 1];
    if (!d.choices) return;
    var key = V().ledgerChoice;
    if (!key) { UI.toast('请先选择处置方式。'); return; }
    var c = null;
    for (var i = 0; i < d.choices.length; i++) {
      if (d.choices[i].key === key) { c = d.choices[i]; break; }
    }
    if (!c || c.fail || c.special) { UI.toast('请重新选择处置方式。'); return; }

    var ckEl = document.getElementById('ledger-checksum');
    if (!checkChecksum(d, ckEl ? ckEl.value : '', ckEl)) return;

    completeLedger(d, c.value);
  }

  /* 回答录音里的问题 —— 这是 D3 唯一真正危险的选项 */
  function askRealName(d) {
    var st = S();
    UI.input({
      title: '录音笔 · 第 3 段',
      label: '录音里的问题：WHAT IS YOUR NAME?\n你可以不回答。',
      placeholder: '留空 = 不回答',
      maxlength: 16,
      okText: '回答',
      note: '它问得很轻。轻到你可以假装没听见。',
      onOk: function (v) {
        var name = String(v || '').trim();
        if (!name) {
          UI.toast('你没有回答。录音笔还在播。');
          return false;
        }
        st.flags.typedRealName = true;
        st.realName = name.slice(0, 16);
        global.Store.addForget(1);
        global.Store.save();

        UI.closeOverlay(true);
        UI.overlay({
          title: '录音笔 · 已应答',
          html: '<div style="font-size:12.5px;line-height:1.8;white-space:pre-wrap">' +
            '录音笔停止播放。\n\n' +
            '屏幕上多了一行字。不是系统写的：\n\n' +
            '「' + esc(name) + '，我记住了。」\n\n' +
            '<span class="dim" style="font-size:11px">你没有输入过这句话。它自己出现的。</span>' +
            '</div>' +
            '<div class="notice warn">遗忘值 +1</div>',
          buttons: [{
            t: '继续登记',
            cls: 'btn-primary',
            act: function () { completeLedger(d, name); }
          }]
        });
        return false;
      }
    });
  }

  function afterLedger(d) {
    /* 邮件已在 completeLedger 里投放，这里只负责界面刷新与提醒 */
    G().refresh();
    setTimeout(function () {
      G().updateBadge();
      var tb = $('titlebar-text');
      if (tb) tb.classList.add('flash');
      setTimeout(function () {
        var t = $('titlebar-text');
        if (t) t.classList.remove('flash');
      }, 1800);
    }, 200);
  }

  /* 角色互相指控：每天 1—2 封
     发件人避开当天主邮件的角色，保证「一封邮件只由一个人说话」 */
  function deliverQuarrel() {
    if (!global.QUARREL || !global.QUARREL.length) return;
    var st = S();
    var d = D.days[st.day - 1];

    /* 当天主邮件的发件人 */
    var mainFrom = null;
    if (st.day <= 7 && d && d.charMail) {
      var mm = global.Views.mailMeta(d.charMail);
      if (mm) mainFrom = mm.from;
    }

    var pool = global.QUARREL.filter(function (q) {
      if (st.mailOrder.indexOf('q_' + q.id) >= 0) return false;
      if (q.from === mainFrom) return false;
      return true;
    });
    if (!pool.length) return;

    var want = Math.random() < 0.5 ? 1 : 2;
    for (var i = 0; i < want && pool.length; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      var q = pool.splice(idx, 1)[0];
      deliver('q_' + q.id);
    }
  }

  function deliverCharMails() {
    var st = S();
    var day = st.day;
    if (day === 7) {
      ['d7_M', 'd7_H', 'd7_T', 'd7_I'].forEach(deliver);
      return;
    }
    if (day === 6) {
      ['d6_T', 'd6_M', 'd6_H', 'd6_I'].forEach(deliver);
      return;
    }
    if (day === 5) {
      if (!st.day5Pick) {
        var pool = ['d5_M', 'd5_H', 'd5_T', 'd5_I'];
        st.day5Pick = pool[Math.floor(Math.random() * pool.length)];
        global.Store.save();
      }
      deliver(st.day5Pick);
      return;
    }
    var d = D.days[day - 1];
    if (d.charMail) {
      deliver(d.charMail);
      applyMailDeletion(d.charMail);
    }
  }

  /* H 的入侵：把某位角色的邮件从收件箱「取出」（变灰、正文清空） */
  function applyMailDeletion(id) {
    var st = S();
    var meta = global.Views.mailMeta(id);
    if (!meta || !meta.deleteFrom) return;
    if (!st.inv.hDeleted) st.inv.hDeleted = [];
    var from = meta.deleteFrom;
    (st.mailOrder || []).forEach(function (mid) {
      var m = global.Views.mailMeta(mid);
      if (!m || m.from !== from) return;
      if (st.inv.hDeleted.indexOf(mid) < 0) st.inv.hDeleted.push(mid);
    });
    global.Store.save();
  }

  function monitorAnomaly() {
    var st = S();
    UI.overlay({
      title: '[ 监控异常 ]',
      html: '<div class="mono" style="font-size:12.5px;line-height:1.7;color:#002FA7">' +
        '23:41:02  登记员 连续三次提交失败\n' +
        '23:41:03  值班室 摄像头 记录到第四个影子\n' +
        '23:41:04  画面无人物\n' +
        '23:41:05  有人在看你的记录' +
        '</div>' +
        '<div class="dim" style="font-size:11px;margin-top:8px">' +
        '错误已被记录。请核对你的外部记录，再试一次。' +
        '</div>',
      buttons: [{ t: '知道了', cls: 'btn-primary' }]
    });
    st.ckFail[st.day] = 0;
    global.Store.save();
  }

  /* ==================== 柜位图 ==================== */
  function cabinetUnlocked(day) {
    var st = S();
    return !!(st.inv.searchUnlocked && st.inv.searchUnlocked.indexOf(day) >= 0);
  }

  function openCabinet() {
    var st = S();
    var d = D.days[st.day - 1];
    if (!d.cabinet) { UI.toast('本日无关联柜位。'); return; }

    /* 需要触发词解锁的日子（D4）：先在搜索框输入当日解出的词 */
    if (d.needSearch && !cabinetUnlocked(st.day)) {
      UI.overlay({
        title: '柜位图 · 已锁定',
        html: '<div style="font-size:12.5px;line-height:1.85;white-space:pre-wrap">' +
          '本日柜位被二次加密。\n\n' +
          '需要先输入「触发词」才能开启。\n\n' +
          '<span class="dim" style="font-size:11px">' +
          '触发词 = 当日监控异常字节解出的大写英文单词。\n' +
          '输入位置：状态栏最右侧的「搜索」按钮。' +
          '</span></div>',
        buttons: [{ t: '关闭', cls: 'btn-ghost' }]
      });
      return;
    }

    var w = UI.overlay({
      title: '柜位图 · D' + st.day,
      className: 'cabinet-overlay',
      html: global.Views.cabinetHtml(st.day),
      buttons: [{ t: '关闭', cls: 'btn-ghost' }]
    });
  }

  function openCabinetCell() {
    var st = S();
    var d = D.days[st.day - 1];
    if (!d.cabinet) return;
    var inp = document.getElementById('cab-input');
    if (!inp) return;
    var v = String(inp.value || '').trim();
    var want = String(d.cabinet.value);
    if (norm(v) === norm(want)) {
        var cabinetFirst = !st.cabinet[st.day];
        st.cabinet[st.day] = want;
        if (d.cabinet.clueName && st.names.indexOf(d.cabinet.clueName) < 0) {
          st.names.push(d.cabinet.clueName);
        }
        /* 首次开柜：动了不属于你的遗留物，遗忘值 +1 */
        if (cabinetFirst) global.Store.addForget(1);
        global.Store.save();
      UI.closeOverlay(true);

      /* D4：纸条处置三选一 */
      var btns = [{ t: '关闭', cls: 'btn-primary' }];
      if (d.noteChoice && !st.flags.noteChoice) {
        btns = [
          { t: '把纸条登记', cls: 'btn-primary', act: function () { pickNote('file'); } },
          { t: '烧掉', cls: 'btn-danger', act: function () { pickNote('burn'); } },
          { t: '藏进物品栏', cls: 'btn-ghost', act: function () { pickNote('hide'); } }
        ];
      }

      UI.overlay({
        title: '柜 ' + want + ' · 开启',
        html: '<div style="font-size:12.5px;line-height:1.75;white-space:pre-wrap">' +
          esc(d.cabinet.clue) + '</div>' +
          (d.noteChoice && !st.flags.noteChoice
            ? '<div class="notice warn" style="margin-top:8px">' +
              '纸条只有一张。你只能选一种处理方式，且不可撤销。' +
              '</div>'
            : '<div class="notice" style="margin-top:8px">' +
              '这个名字已经记在你的记录里了。别弄丢它。' +
              '</div>'),
        buttons: btns
      });
      G().refresh();
    } else {
      inp.classList.add('shake');
      setTimeout(function () { inp.classList.remove('shake'); }, 260);
      UI.toast('柜号不符。');
    }
  }

  /* D4 · 纸条处置：登记 / 烧掉 / 藏起来 */
  function pickNote(kind) {
    var st = S();
    st.flags.noteChoice = kind;
    if (kind === 'burn') st.flags.burnedNote = true;
    if (kind === 'hide') st.flags.hidNote = true;
    global.Store.save();
    A('click');

    var title, text;
    if (kind === 'file') {
      title = '处置 · 归档';
      text = '纸条已归档。\n\n' +
        '编号与登记簿合并。纸上那行字现在出现在你的登记记录里：\n\n' +
        '    「7号柜不是柜，是名单。」\n\n' +
          '它会一直留在那儿。';
    } else if (kind === 'burn') {
      title = '处置 · 烧毁';
      text = '纸条在你手里烧完。\n\n' +
        '灰落在柜位图上，像一层很薄的雪。\n\n' +
        '你记得上面写过什么。\n' +
        '但你记不清具体是哪几个字了。\n\n' +
          '你失去了一条线索。';
    } else {
      title = '处置 · 藏匿';
      text = '你把纸条折了三折，塞进物品栏夹层。\n\n' +
        '它还在。\n' +
        '只是不在你能随时看见的地方。\n\n' +
          '它会跟着你到最后。';
    }

    UI.overlay({
      title: title,
      html: '<div style="font-size:12.5px;line-height:1.8;white-space:pre-wrap">' +
        esc(text) + '</div>',
      buttons: [{ t: '继续', cls: 'btn-primary', act: function () { G().refresh(); } }]
    });
  }

  /* ==================== 校验器 ==================== */
  function checkVerify(v) {
    var st = S();
    var d = D.days[st.day - 1];
    var n = norm(v);
    if (!n) return false;
    var list = d.verifiable || [d.answer.value];
    for (var i = 0; i < list.length; i++) {
      if (norm(list[i]) === n) return true;
    }
    /* 也接受当日校验码 */
    if (n === norm(expectedChecksum(d))) return true;
    return false;
  }

  function doVerify() {
    var st = S();
    var inp = document.getElementById('verify-input');
    if (!inp) return;
    var v = String(inp.value || '').trim();
    if (!v) { UI.toast('请输入内容。'); return; }

    var ok = checkVerify(v);
    var box = document.getElementById('verify-result');
    if (box) {
      box.className = 'verify-result ' + (ok ? 'ok' : 'ng');
      box.innerHTML = ok ? '正确' : '错误';
    }

    A(ok ? 'ok' : 'err');

    if (!ok) {
      if (!st.vfFail) st.vfFail = {};
      st.vfFail[st.day] = (st.vfFail[st.day] || 0) + 1;

      /* 第 6 天：连续错误 2 次 → 好心输出（一次性） */
      if (st.day === 6 && st.vfFail[st.day] >= 2 &&
          !global.Store.seenGlitch('D6_VERIFIER_HINT')) {
        var d = D.days[st.day - 1];
        var hint = d.answer.value;
        setTimeout(function () {
          global.Glitch.trigger('D6_VERIFIER_HINT', hint);
        }, 260);
      }
      UI.haptic(50);
    } else {
      st.vfFail[st.day] = 0;
      UI.haptic(20);
    }

    if (!st.vfLog) st.vfLog = [];
    st.vfLog.push({ i: v.slice(0, 24), ok: ok, t: hhmm() });
    if (st.vfLog.length > 60) st.vfLog.shift();
    global.Store.save();

    inp.value = '';
    /* 只刷新历史区，避免丢失结果框动画 */
    setTimeout(function () {
      var now = document.getElementById('verify-input');
      if (now) now.focus();
    }, 10);
  }

  /* ==================== 提示 ==================== */
  function useHint(lv) {
    /* 提示系统已禁用：任何入口都只回一句「_已禁用:D」 */
    G().openPanel('hint');
    return;
  }

  /* ==================== 导出 ==================== */
  var G2 = global.Game;
  G2.startGame = startGame;
  G2.resume = resume;
  G2.beginDay = beginDay;
  G2.deliver = deliver;
  G2.deliverCharMails = deliverCharMails;
  G2.openMail = openMail;
  G2.replyMail = replyMail;
  G2.ignoreMail = ignoreMail;
  G2.spamMail = spamMail;
  G2.recordMail = recordMail;
  G2.openExtra = openExtra;
  G2.submitLedger = submitLedger;
  G2.chooseLedger = chooseLedger;
  G2.submitChoiceLedger = submitChoiceLedger;
  G2.openCabinet = openCabinet;
  G2.openCabinetCell = openCabinetCell;
  G2.doVerify = doVerify;
  G2.useHint = useHint;
  G2.expectedChecksum = expectedChecksum;
  G2.norm = norm;
  G2.hhmm = hhmm;
})(window);

/* ============================================================
   UNCLAIMED_ECHOES_07  ·  game.js  (part 3/3)
   下班结算 / 最终登记 / 搜索 / 面板 / 规则14 / 设置 / 重启
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var $ = UI.$;
  var D = global.DATA;

  function S() { return global.Store.s; }
  function V() { return global.Views.VS; }
  function G() { return global.Game; }
  function A(n, a) { if (global.Audio7) global.Audio7.play(n, a); }

  /* ==================== 下班 ==================== */
  /* ==================== H 的下班阻碍 ====================
     随机触发，全局上限 2 次，两次台词不同。
     点三次，每次更恳求；第三次后按钮变「…」并变灰，
     黑屏一瞬间 → 耳鸣音效 → 弹窗「_文件异常*_ _已修复」。 */
  var H_BLOCK_LINES = [
    [
      '再陪我一会儿。',
      '就一会儿。我保证什么都不删。',
      '求你了。\n别让我一个人待在这条走廊里。'
    ],
    [
      '今天也走吗。',
      '我今天一整天都在这儿等你。\n从零点等到现在。',
      '……我不知道还能说多少次。\n所以这一次，我记住了。'
    ]
  ];

  function maybeHBlock() {
    var st = S();
    if (!st.inv.hBlock) st.inv.hBlock = { used: 0, day: 0 };
    if (st.inv.hBlock.used >= 2) return false;
    if (st.inv.hBlock.day === st.day) return false;
    /* 需要 H 已经介入过（加过第 15 条，或有好感） */
    if (!(st.inv.hRule15 || (st.aff.H || 0) >= 1)) return false;
    /* 当天只掷一次骰子，约 40% */
    st.inv.hBlock.day = st.day;
    global.Store.save();
    return Math.random() < 0.4;
  }

  function runHBlockage(done) {
    var st = S();
    var idx = Math.min(1, st.inv.hBlock.used || 0);
    var lines = H_BLOCK_LINES[idx];
    st.inv.hBlock.used = (st.inv.hBlock.used || 0) + 1;
    global.Store.save();

    var step = 0;

    function bodyHtml() {
      return '<div style="font-size:13px;line-height:1.9;white-space:pre-wrap;min-height:64px">' +
        esc(lines[step]) + '</div>';
    }

    UI.overlay({
      title: 'H.',
      closable: false,
      html: bodyHtml(),
      buttons: [{
        t: '下班',
        cls: 'btn-primary',
        close: false,
        act: function (w) {
          step++;
          if (step < lines.length) {
            A('click');
            var body = w.querySelector('.ov-body');
            if (body) body.innerHTML = bodyHtml();
            return;
          }
          /* 第三次点击：按钮变省略号并变灰 */
          var btn = w.querySelector('[data-ov-btn="0"]');
          if (btn) {
            btn.textContent = '…';
            btn.disabled = true;
            btn.classList.add('disabled');
          }
          setTimeout(function () {
            UI.closeOverlay(true);
            hGlitchFlash(done);
          }, 420);
        }
      }]
    });
  }

  /* 黑屏一瞬间 → 耳鸣 → 弹窗 */
  function hGlitchFlash(done) {
    var black = document.createElement('div');
    black.className = 'glitch-black';
    black.style.zIndex = '9700';
    black.style.left = '0';
    black.style.top = '0';
    black.style.right = '0';
    black.style.bottom = '0';
    document.body.appendChild(black);

    /* 与好结局同款的耳鸣音效 */
    if (global.Audio7) global.Audio7.tinnitus();

    setTimeout(function () {
      if (black.parentNode) black.parentNode.removeChild(black);
      UI.overlay({
        title: '[ 系统 ]',
        html: '<div class="mono" style="font-size:14px;line-height:1.9;color:#002FA7">' +
          '_文件异常*_  _已修复' +
          '</div>' +
          '<div class="dim" style="font-size:10.5px;margin-top:8px">' +
            '刚才那几秒里发生了什么，没有人告诉你。' +
          '</div>',
        buttons: [{
          t: '下班',
          cls: 'btn-primary',
          act: function () { done && done(); }
        }]
      });
    }, 260);
  }

  function askOffDuty() {
    var st = S();
    if (!st.started) return;
    if (UI.hasOverlay()) { UI.closeOverlay(true); return; }

    /* 第 7 天：下班按钮是退路，而退路已经被关掉了（崩坏 7-3） */
    if (st.day >= 7) {
      if (global.Store.seenGlitch('D7_OFFDUTY')) {
        UI.toast('你已下班。无人接替。');
        return;
      }
      global.Glitch.trigger('D7_OFFDUTY', function () {
        var off = $('btn-offduty');
        if (off) { off.disabled = true; off.classList.add('off'); }
      });
      return;
    }

    if (!st.reg[st.day]) {
      UI.toast('本日尚未登记，不能下班。');
      return;
    }

    /* H 的下班阻碍：随机触发，全局上限 2 次 */
    if (maybeHBlock()) {
      runHBlockage(function () { doOffDuty(); });
      return;
    }

    UI.confirm('确认下班？', '本日结算后不可返回。\n未记录的线索不会保留。', doOffDuty, '下班', '继续值班');
  }

  function offDuty() {
    askOffDuty();
  }

  function doOffDuty() {
    var st = S();

    /* 第 7 天：下班 → 无人接替 */
    if (st.day >= 7) {
      global.Glitch.trigger('D7_OFFDUTY', function () {
        finish(true, 'NO_RELIEF');
      });
      var off = $('btn-offduty');
      if (off) { off.disabled = true; off.classList.add('off'); }
      return;
    }

    /* 全部标记垃圾邮件（明确的极端行为，仍然生效） */
    if (st.flags.spamAll) { finish(true, 'SPAM'); return; }

    /* 第 5 天超时判定 */
    if (st.day === 5 && !st.reg[5] && !st.flags.d5Failed) {
      st.flags.d5Failed = true;
      global.Store.addForget(2);
      global.Store.save();
    }

    /* 进入下一天 */
    var next = st.day + 1;
    st.inv.hOffdutyBlock = 0;
    st.day5Start = 0;
    global.Store.save();
    G().beginDay(next);

    if (next === 5) {
      st.day5Start = Date.now();
      global.Store.save();
    }
  }

  /* ==================== 最终登记 ==================== */
  var finalState = { cleared: false, back: 0, timer: null };

  function openFinal() {
    var st = S();
    if (st.day < 7) { UI.toast('还不是时候。'); return; }

    /* 崩坏 7-1：第一次打开最终登记 */
    global.Glitch.trigger('D7_FINAL_GLITCH');
    UI.haptic(100);

    /* 名单第七行：TAN XI（《关门》结局的最后一个名字） */
    var d7data = D.days[6];
    if (d7data.name) {
      if (!st.names) st.names = [];
      if (st.names.indexOf(d7data.name) < 0) {
        st.names.push(d7data.name);
        global.Store.save();
      }
      setTimeout(function () {
        UI.toast('7 号柜 第 7 行：TAN XI', 3200);
      }, 1000);
    }

    finalState = { cleared: false, back: 0, timer: null };
    /* 若 D3 回答了录音里的问题，最终登记框的默认值已被替换成那个名字 */
    var isAnswerer = !!(st.flags && st.flags.typedRealName && st.realName);
    var code = isAnswerer ? st.realName : (st.codename || '');
    var defaultLabel = isAnswerer
        ? '最终值 · 默认填入你回答过的那个名字'
        : '最终值 · 默认填入你的值班代号';

    var w = UI.overlay({
      title: '7 号柜 · 最终登记',
      closable: false,
      html:
        '<div class="dim" style="font-size:11px;margin-bottom:6px">' +
          '7 号柜 已满。名单 长度 7。等待 最终值。' +
        '</div>' +
        '<div class="field">' +
          '<label>' + esc(defaultLabel) + '</label>' +
          '<input class="input" id="final-input" value="' + esc(code) + '" ' +
            'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
        '</div>' +
        '<div class="notice" id="final-note">' +
          (isAnswerer
            ? '这个框里是你的名字。不是代号。<br>要改，得先把它删掉。'
            : '这个框默认写着你自己。要改，得先把它删掉。') +
        '</div>' +
        '<div class="rule-hint dim" style="font-size:10.5px;line-height:1.6;margin-top:6px">' +
          '最终确认码 =（M权重 + H权重 + T权重 + I权重）× 7 mod 100<br>' +
          '四位权重在你自己的记录里。<br>' +
          (st.flags && st.flags.burnedNote
              ? '你烧掉的那张纸条上，好像写过什么。'
              : '要关掉整台机器：七个名字 + 03 + CLOSE') +
        '</div>',
      buttons: [
          { t: '什么都不做', cls: 'btn-ghost', close: false, act: waitTen },
        { t: '关闭网站', cls: 'btn-danger', act: function () { finish(true, 'NO_RELIEF'); } },
        { t: '确认提交', cls: 'btn-primary', close: false, act: submitFinal }
      ]
    });

    var inp = w.querySelector('#final-input');
    var note = w.querySelector('#final-note');

    /* 前缀锁定：任何删除都会被立刻补回，直到连续三次 */
    inp.addEventListener('input', function () {
      if (finalState.cleared) return;
      if (inp.value.length < code.length) {
        inp.value = code;
        finalState.back++;
        if (finalState.back >= 3) {
          finalState.back = 0;
          UI.confirm('清除值班代号？',
            '你正在删除「' + code + '」。\n删除后无法恢复。\n\n确定吗？',
            function () {
              finalState.cleared = true;
              var i2 = document.getElementById('final-input');
              if (i2) { i2.value = ''; i2.focus(); }
              var n2 = document.getElementById('final-note');
              if (n2) n2.innerHTML = '框空了。现在等你写点什么。';
            }, '确定清除', '我再想想');
        } else {
          var n3 = document.getElementById('final-note');
            if (n3) n3.textContent = '删不掉 ' + finalState.back + ' / 3';
        }
      }
      /* D7_TITLE_SWAP：输入 DELETE 时 */
      if (inp.value.toUpperCase().indexOf('DELETE') >= 0) {
        global.Glitch.trigger('D7_TITLE_SWAP');
      }
    });
  }

  function submitFinal() {
    var st = S();
    var inp = document.getElementById('final-input');
    if (!inp) return;
    var raw = inp.value;

    /* 应答者：你在第 3 天回答了录音里那个问题，且至今没有清掉那个名字 */
    if (st.flags && st.flags.typedRealName && st.realName) {
      /* norm() 定义在 part 2，这里通过 Game.norm 取；取不到就本地兜底 */
      var nrm = G().norm || function (x) {
        return String(x == null ? '' : x).toUpperCase().replace(/[\s\.\-_\/、，,]/g, '');
      };
      if (nrm(raw) === nrm(st.realName) && nrm(raw) !== nrm(st.codename)) {
        askConfirmCode(st.realName, 'ANSWER');
        return;
      }
    }

    var res = global.Endings.resolve(raw, st.codename);

    if (!res.ok) {
      UI.haptic(60);
      /* 纸条被烧掉的专属反馈 */
      if (st.flags && st.flags.burnedNote && String(res.reason).indexOf('想不起来') >= 0) {
        UI.overlay({
          title: '7 号柜 · 拒绝',
          html: '<div style="font-size:12.5px;line-height:1.85;white-space:pre-wrap">' +
            '七个名字都在。\n' +
            'CLOSE 也写对了。\n\n' +
            '系统没有关闭。\n\n' +
            '它只回了一行：\n\n' +
            '    「缺少一项尚未归档的附件。」\n\n' +
            '你想起那张纸条。\n' +
            '和它烧完之后的样子。' +
            '</div>',
          buttons: [{ t: '关闭', cls: 'btn-primary' }]
        });
        return;
      }
      UI.toast(res.reason || '系统无法识别。');
      return;
    }

    if (res.ending === 'DELETE_PENDING') {
      askConfirmCode('DELETE', 'DELETE');
      return;
    }
    if (res.ending === 'SUBMIT_PENDING') {
      askConfirmCode(st.codename, 'SUBMIT');
      return;
    }
    if (res.ending === 'CLOSE') {
      askConfirmCode('CLOSE', 'CLOSE');
      return;
    }
    if (res.ending) {
      UI.closeOverlay(true);
      setTimeout(function () { finish(false, res.ending); }, 200);
    }
  }

  /* 二次确认码 03 */
  var codeFails = 0;
  function askConfirmCode(value, kind) {
    var st = S();
    UI.input({
      title: '最终确认码',
        label: '输入最终确认码，同一个框。错三次不可撤销。',
      placeholder: '两位数字',
      maxlength: 2,
      inputmode: 'numeric',
      note: '四天权重和 × 7 mod 100。',
      okText: '确认',
      closable: true,
      onOk: function (v) {
        var n = String(v || '').trim().replace(/^0+(?=\d)/, '');
        if (n !== '3') {
          codeFails++;
          UI.haptic(80);
            UI.toast('确认码错误 ' + codeFails + ' / 3');
          if (codeFails >= 3) {
            UI.closeOverlay();
            setTimeout(function () { finish(true, 'RAINCOAT'); }, 300);
            return false;
          }
          return false;
        }
        codeFails = 0;
        UI.closeOverlay();
        var map = {
          'DELETE': 'DELETE_END',
          'SUBMIT': 'SUBMIT_END',
          'ANSWER': 'ANSWERER',
          'CLOSE': 'CLOSE'
        };
        var id = map[kind] || 'DELETE_END';
        setTimeout(function () { finish(false, id); }, 260);
      }
    });
  }

  /* 等待 10 秒 */
  function waitTen() {
    var st = S();
    var allHigh = ['M', 'H', 'T', 'I'].every(function (k) { return (st.aff[k] || 0) >= 2; });
    var n = 10;
    var w = UI.overlay({
      title: '等待',
      closable: false,
      html: '<div style="text-align:center">' +
        '<div class="mono" id="wait-n" style="font-size:40px;line-height:1">10</div>' +
        '<div class="dim" style="font-size:11.5px;margin-top:6px">什么都不做。</div>' +
        '</div>',
      buttons: [{ t: '还是算了', cls: 'btn-ghost', act: function () { clearInterval(iv); } }]
    });
    var iv = setInterval(function () {
      n--;
      var el = document.getElementById('wait-n');
      if (el) el.textContent = n;
      if (n <= 0) {
        clearInterval(iv);
        /* 只关「等待」这一层，保留底下的最终登记面板 */
        UI.closeOverlay(true);
        setTimeout(function () {
          if (allHigh) {
            finish(false, 'TETRAD');
            return;
          }
          /* 差一个人才凑齐时给一句模糊的暗示 */
          var missing = ['M', 'H', 'T', 'I'].filter(function (k) {
            return (st.aff[k] || 0) < 2;
          });
          var hint = (missing.length === 1) ? '\n\n有一个人还在犹豫。' : '';
          UI.overlay({
            title: '什么也没有发生',
            html: '<div style="font-size:12.5px;line-height:1.8;white-space:pre-wrap">' +
              '十秒过去了。\n\n' +
              '没有人来。\n' +
              '或者说，他们还在等一个更明确的回答。' +
              hint +
              '</div>',
            buttons: [{
              t: '回到最终登记',
              cls: 'btn-primary',
              act: function () {
                /* 面板仍在栈底，关闭本窗口即可露出 */
                var inp = document.getElementById('final-input');
                if (!inp) openFinal();
              }
            }]
          });
        }, 200);
      }
    }, 1000);
  }

  /* ==================== 结局 ==================== */
  function finish(isBad, id) {
    var st = S();
    st.ending = id;
    global.Store.save();
    UI.closeOverlay();
    global.Endings.show(id);
  }

  /* ==================== 搜索 ==================== */
  function openSearch() {
    UI.input({
      title: '搜索',
      label: '在当前页面内搜索。也可以输入一个词试试。',
      placeholder: '关键词',
      keys: ['H','I','D','E','Z','R','O','N','L','Y','C','0','3',' ','⌫'],
      okText: '搜索',
      onOk: function (v) {
        var kw = String(v || '').trim();
        /* 交给下一帧，避免和自己这一层 overlay 的关闭竞争 */
        setTimeout(function () { doSearch(kw); }, 60);
      }
    });
  }

  function doSearch(kw) {
    var st = S();
    if (!kw) return;
    var up = kw.toUpperCase().replace(/\s+/g, '');
    var contentEl = $('content');

    /* 触发词：解锁当日柜位（D4 需要在搜索框输入 HIDE） */
    var dcur = D.days[st.day - 1];
    if (dcur && dcur.needSearch && up === String(dcur.needSearch).toUpperCase()) {
      if (!st.inv.searchUnlocked) st.inv.searchUnlocked = [];
      if (st.inv.searchUnlocked.indexOf(st.day) < 0) {
        st.inv.searchUnlocked.push(st.day);
        global.Store.save();
        A('ok');
        UI.overlay({
          title: '搜索结果',
          html: '<div class="mono" style="font-size:12.5px;line-height:1.75;white-space:pre-wrap">' +
            '搜索：' + esc(kw) + ' → 1 条结果。\n\n' +
            '[ 柜位图已解锁 ]\n\n' +
            '有人在日志里把 I 改成了 E。\n' +
            '你找到的是正确的那个词。\n\n' +
              '现在可以输入柜号了。' +
            '</div>',
          buttons: [{ t: '关闭', cls: 'btn-primary' }]
        });
        return;
      }
    }

    /* 特殊词：影响剧情 */
    var special = {
      'HIDE': st.day >= 4
        ? '搜索：HIDE → 0 条结果。\n\n[柜位图已解锁]\n有人在日志里把 I 改成了 E。'
        : null,
      'ONLYONCE': st.day >= 6
        ? '搜索：ONLY ONCE → 1 条结果。\n\n来源不可追溯。\n[该结果已被删除]'
        : null,
      'ZERO': st.day >= 7
        ? '搜索：ZERO → 0 条结果。\n\n零号柜不存在。\n你确定吗？'
        : null,
      'DELETE': st.day >= 7
        ? '搜索：DELETE → 1 条结果。\n\n7 号柜 读出：DELETE\n[等待最终确认码]'
        : null,
      '07': st.day >= 7
        ? '搜索：07 → 07 条结果。\n\n全部未认领。'
        : null
    };

    if (special[up]) {
      UI.overlay({
        title: '搜索结果',
        html: '<div class="mono" style="font-size:12.5px;line-height:1.75;white-space:pre-wrap">' +
          esc(special[up]) + '</div>',
        buttons: [{ t: '关闭', cls: 'btn-primary' }]
      });
      return;
    }

    var hit = UI.highlight(contentEl, kw);
    UI.toast(hit ? ('命中 ' + hit + ' 处') : '无结果。');
  }

  /* ==================== 面板 ==================== */
  function openPanel(name) {
    var st = S();
    switch (name) {
      case 'punch':
        openPunch();
        break;
      case 'fax':
        openFax();
        break;
      case 'charc':
        openCharc();
        break;
      case 'hint':
        /* 提示系统已被禁用（谁关的不重要，重要的是它不会再给你答案） */
        UI.overlay({
          title: '提示系统 · 已禁用',
          html: '<div class="mono" style="font-size:15px;line-height:1.9;color:#002FA7">' +
            '_已禁用:D' +
            '</div>' +
            '<div class="dim" style="font-size:11px;margin-top:8px">' +
            '你不知道是谁关的。' +
            '</div>',
          buttons: [{ t: '关闭', cls: 'btn-ghost' }]
        });
        break;
      case 'setting':
        UI.overlay({
          title: '设置',
          html: global.Views.settingHtml(),
          buttons: [{ t: '关闭', cls: 'btn-ghost' }]
        });
        break;
      case 'help':
        UI.overlay({
          title: '帮助',
          html: '<div style="max-height:64vh;overflow:auto" class="scroll">' +
            global.Views.helpHtml() + '</div>',
          buttons: [{ t: '关闭', cls: 'btn-ghost' }]
        });
        break;
      default:
        UI.toast('该功能不可用。');
    }
  }

  /* 传真机：每封首次查看 +1 遗忘值（前任的笔记会污染你） */
  function openFax() {
    var st = S();
    if (!st.readFaxes) st.readFaxes = [];

    var list = D.faxes.filter(function (f) { return f.day <= st.day; });
    var fresh = list.filter(function (f) { return st.readFaxes.indexOf(f.day) < 0; });

    if (fresh.length) {
      fresh.forEach(function (f) { st.readFaxes.push(f.day); });
      global.Store.addForget(fresh.length);
      global.Store.save();
      A('err');
      UI.toast('遗忘值 +' + fresh.length);
    }

    UI.overlay({
      title: '传真机',
      html: '<div style="max-height:60vh;overflow:auto" class="scroll">' +
        global.Views.faxHtml() + '</div>',
      buttons: [{ t: '关闭', cls: 'btn-ghost' }]
    });
    G().updateStatusBar();
  }

  function openPunch() {
    var st = S();
    var w = UI.overlay({
      title: '打卡机',
      html: global.Views.punchHtml(),
      buttons: [
        {
          t: '上班打卡', cls: 'btn-primary', close: false,
          act: function () {
            var p = st.punch[st.day] || {};
            if (p.in) { UI.toast('已打过上班卡。'); return; }
            var now = Date.now();
            var d = new Date();
            p.in = now;
            p.inLabel = global.Store.pad2(d.getHours()) + ':' + global.Store.pad2(d.getMinutes());
            st.punch[st.day] = p;
            global.Store.save();
            A('punch');
            UI.closeOverlay(true);
            openPunch();
            UI.toast('上班卡已记录。');
          }
        },
        {
          t: '下班打卡', cls: 'btn-ghost', close: false,
          act: function () {
            var p = st.punch[st.day] || {};
            if (!p.in) { UI.toast('还没有上班卡。'); return; }
            if (p.out) { UI.toast('已打过下班卡。'); return; }
            var now = Date.now();
            var d = new Date();
            p.out = now;
            p.outLabel = global.Store.pad2(d.getHours()) + ':' + global.Store.pad2(d.getMinutes());
            st.punch[st.day] = p;
            global.Store.save();
            A('punch');
            UI.closeOverlay(true);
            openPunch();
            UI.toast('下班卡已记录。工时已计入你的记录。');
          }
        },
        { t: '关闭', cls: 'btn-ghost' }
      ]
    });
  }

  function openCharc() {
    var w = UI.overlay({
      title: '字符检查器',
      html:
        '<div class="field">' +
          '<label>粘贴或输入文本。也可以直接从规则手册载入第 14 条。</label>' +
          '<textarea class="input" id="charc-in" placeholder="在此粘贴" rows="2" ' +
            'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-sm" id="charc-load" type="button">载入规则第14条</button>' +
          '<button class="btn btn-sm btn-ghost" id="charc-clear" type="button">清空</button>' +
        '</div>' +
        '<div id="charc-out" style="margin-top:8px"></div>',
      buttons: [{ t: '关闭', cls: 'btn-ghost' }]
    });

    var inp = w.querySelector('#charc-in');
    var out = w.querySelector('#charc-out');
    var typeTick = 0;

    function render() {
      out.innerHTML = global.Views.charcHtml(inp.value);
    }

    inp.addEventListener('input', function () {
      render();
      /* 键盘点声：节流，避免长按刷屏 */
      var now = Date.now();
      if (now - typeTick > 90) {
        typeTick = now;
        A('charcType');
      }
    });

    /* 粘贴时提示：隐藏字符可能已丢失（文档 11.2） */
    inp.addEventListener('paste', function () {
      A('charcPaste');
      setTimeout(function () {
        UI.toast('[警告：隐藏字符可能已丢失]');
        render();
      }, 40);
    });

    w.querySelector('#charc-clear').addEventListener('click', function () {
      A('click');
      inp.value = '';
      render();
    });
    w.querySelector('#charc-load').addEventListener('click', function () {
      var r14 = D.rules.filter(function (r) { return r.no === 14; })[0];
      inp.value = r14 ? r14.text : '';
      render();
      A('charcDetect');
      UI.toast('已载入。注意总字符与可见字符的差值。');
    });
    render();
  }

  /* ==================== 规则第 14 条 ==================== */
  function rule14() {
    return D.rules.filter(function (r) { return r.no === 14; })[0];
  }

  function copyRule14() {
    var r = rule14();
    if (!r) return;
    var text = r.text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        UI.toast('[复制不完整：隐藏字符可能已丢失]');
      }).catch(function () {
        UI.toast('[复制不完整：隐藏字符可能已丢失]');
      });
    } else {
      UI.toast('[复制不完整：隐藏字符可能已丢失]');
    }
  }

  function editRule14() {
    var st = S();
    var r = rule14();
    if (!r) return;
    var w = UI.overlay({
      title: '编辑 第14条',
      html:
        '<div class="field">' +
            '<label>原文 · 含不可见字符，看不见，但它在那儿</label>' +
          '<textarea class="input" id="r14-in" rows="3" ' +
            'autocomplete="off" spellcheck="false"></textarea>' +
        '</div>' +
        '<div class="notice warn">第 13 条：修改后须保存，否则不生效。</div>',
      buttons: [
        { t: '清除全部不可见字符', cls: 'btn-danger', close: false, act: function () {
            var ta = document.getElementById('r14-in');
            if (!ta) return;
            ta.value = ta.value.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '');
            UI.toast('已清除不可见字符。');
          }
        },
        { t: '取消', cls: 'btn-ghost' },
        { t: '保存', cls: 'btn-primary', act: function () {
            var ta = document.getElementById('r14-in');
            var v = ta ? ta.value : '';
            var hasZw = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/.test(v);
            if (!hasZw) {
              st.rulesEdited = 1;
              global.Store.save();
              /* 崩坏 6-2：第一次保存修改后的规则手册 */
              if (st.day === 6) {
                setTimeout(function () { global.Glitch.trigger('D6_RULE_REPEAT'); }, 120);
              }
              UI.toast('已保存。第14条现在是干净的。');
            } else {
              UI.toast('仍有不可见字符。');
            }
            G().refresh();
          }
        }
      ],
      onMount: function (wrap) {
        var ta = wrap.querySelector('#r14-in');
        ta.value = st.rulesEdited ? '不要查看7号柜。' : r.text;
      }
    });
  }

  /* ==================== 设置 ==================== */
  function toggleOpt(key) {
    var st = S();
    if (st.opt[key] === undefined) return;
    st.opt[key] = !st.opt[key];
    global.Store.save();
    document.body.classList.toggle('reduced-motion', !!st.opt.reducedMotion);
    /* 音效开关 / 环境底噪 实时生效 */
    if (global.Audio7) {
      if (key === 'sound') global.Audio7.setVolume();
      if (key === 'ambient') global.Audio7.setAmbient(st.opt.ambient);
    }
    if (key === 'keepAwake') {
      /* 重新申请/释放 */
      if (st.opt.keepAwake && navigator.wakeLock) {
        navigator.wakeLock.request('screen').catch(function () {});
      }
    }
    UI.closeOverlay(true);
    openPanel('setting');
  }

  function toggleNet() {
    var b = $('btn-net');
    if (!b) return;
    if (b.classList.contains('off')) {
      b.classList.remove('off');
      b.textContent = '网络:开';
      A('netOn');
      UI.toast('网络已恢复。');
    } else {
      b.classList.add('off');
      b.textContent = '网络:关';
      A('netOff');
      UI.toast('网络已关闭。邮件不会到达。');
    }
  }

  /* 重置结局特效的一次性标记（测试用） */
  function resetEndingFx() {
    var st = S();
    st.endingGlitch = { tinnitus: false, bluescreen: false, static: false, seenLines: [] };
    global.Store.save();
    A('ok');
    UI.closeOverlay(true);
    openPanel('setting');
    UI.toast('结局特效已重置，下次结领会重新播放。');
  }

  function confirmReset() {
    UI.confirm('清除存档', '所有进度、代号、已收集的名字都会被删除。\n\n确定？', function () {
      global.Store.reset();
      location.reload();
    }, '确定清除', '取消');
  }

  function restart() {
    global.Store.reset();
    location.reload();
  }

  /* ==================== 导出 ==================== */
  var G3 = global.Game;
  G3.askOffDuty = askOffDuty;
  G3.offDuty = offDuty;
  G3.openFinal = openFinal;
  G3.openSearch = openSearch;
  G3.openPanel = openPanel;
  G3.openCharc = openCharc;
  G3.copyRule14 = copyRule14;
  G3.editRule14 = editRule14;
  G3.toggleOpt = toggleOpt;
  G3.toggleNet = toggleNet;
  G3.confirmReset = confirmReset;
  G3.resetEndingFx = resetEndingFx;
  G3.restart = restart;
  G3.finish = finish;

  /* ==================== DOM Ready ==================== */
  function boot() {
    global.Game.init();
    document.body.classList.toggle('reduced-motion', !!S().opt.reducedMotion);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);