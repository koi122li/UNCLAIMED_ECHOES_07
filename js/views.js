/* ============================================================
   UNCLAIMED_ECHOES_07  ·  views.js  (part 1/3)
   收件箱 / 登记簿 / 监控
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var DATA = global.DATA;

  /* UI 临时状态（不入存档） */
  var VS = {
    tab: 'inbox',
    selMail: null,
    rulePage: 0,
    search: '',
    charcText: '',
    charcResult: null
  };

  function s() { return global.Store.s; }

  function charName(from) {
    if (from === 'SYS') return '归巢系统';
    var c = DATA.characters[from];
    return c ? c.name : from;
  }

  function shallowMerge(base, patch) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    }
    return out;
  }

  function mailMeta(id) {
    var m = global.MAILS[id];
    if (!m) {
      var r = global.REACTIONS.list.filter(function (x) { return x.id === id; })[0];
      return r || null;
    }

    /*
     * 条件分支：按玩家前一天对某封邮件的处理方式（reply/ignore/spam/none）
     * 选择正文版本，避免角色说出与实际操作不符的台词。
     * cond 格式：'d1_M:reply'
     */
    if (m.variants && m.variants.length) {
      var stv = s();
      var picked = null;
      for (var vi = 0; vi < m.variants.length; vi++) {
        var v = m.variants[vi];
        var seg = String(v.cond || '').split(':');
        var rec = stv.mails ? stv.mails[seg[0]] : null;
        var got = (rec && rec.action) ? rec.action : 'none';
        if (got === seg[1]) { picked = v; break; }
      }
      if (picked) m = shallowMerge(m, picked);
    }

    /* I 的每一封邮件都带小游戏入口。
       否则只写在 d4_I 里，后面 I 再发信时按钮就消失了，
       玩家会以为邮件坏了。 */
    if (m.from === 'I' && !m.extra) {
      m = shallowMerge(m, {
        extra: { label: '打开小游戏「点我五次」', key: 'iGame' }
      });
    }

    /*
     * 系统邮件的附件与拾取信息存放在 DATA.days 里（按天的谜题数据），
     * 这里合并给视图层用，避免同一份数据写两处。
     */
    var dm = /^d(\d+)_sys$/.exec(id);
    if (dm) {
      var day = DATA.days[parseInt(dm[1], 10) - 1];
      if (day) {
        var merged = {};
        for (var k in m) {
          if (Object.prototype.hasOwnProperty.call(m, k)) merged[k] = m[k];
        }
        merged.attach = day.attach;
        merged.attachTitle = day.attachTitle;
        merged.featureNote = day.featureNote;
        merged.item = day.item;
        merged.code = day.code;
        merged.place = day.place;
        merged.found = day.found;
        return merged;
      }
    }
    return m;
  }

  /* ==================== 收件箱 ==================== */
  function inboxList() {
    var st = s();
    return (st.mailOrder || []).map(function (id) {
      var meta = mailMeta(id);
      if (!meta) return null;
      var rec = st.mails[id] || {};

      /* 谁动过这封邮件：
         H 真的删（正文被取出）；
         M 只标记已读（正文保留，否则玩家会丢线索而卡关） */
      var deletedBy = null;
      var tampered = false;
      if (st.inv && st.inv.hDeleted && st.inv.hDeleted.indexOf(id) >= 0) {
        deletedBy = 'H';
      } else if (st.inv.mTerritory && meta.from !== 'M' && meta.from !== 'SYS') {
        tampered = true;
      }

      return {
        id: id,
        meta: meta,
        from: meta.from,
        fromName: meta.fromName || charName(meta.from),
        subject: meta.subject || '(无主题)',
        time: rec.time || '--:--',
        read: !!rec.read,
        action: rec.action || null,
        spam: rec.action === 'spam',
        deleted: !!deletedBy,
        deletedBy: deletedBy,
        tampered: tampered
      };
    }).filter(Boolean);
  }

  function renderInbox() {
    var st = s();
    var list = inboxList();
    var sel = list.filter(function (m) { return m.id === VS.selMail; })[0];
    if (!sel && list.length) {
      /* 默认选中第一封未读，否则最新一封 */
      var unread = list.filter(function (m) { return !m.read; })[0];
      sel = unread || list[list.length - 1];
      VS.selMail = sel ? sel.id : null;
    }

    var items = list.map(function (m) {
      var cls = 'mail-item';
      if (!m.read) cls += ' unread';
      if (m.id === VS.selMail) cls += ' active';
      if (m.spam) cls += ' spam';
      if (m.deleted) cls += ' deleted';
      if (m.tampered) cls += ' tampered';
      var sub = m.subject.slice(0, 12);
      if (m.action === 'reply') sub = '↩ ' + sub;
      if (m.deleted) sub = '[已删除] ' + sub;
      if (m.tampered) sub = '[M.读过] ' + sub;
      return '<button class="' + cls + '" data-mail="' + esc(m.id) + '" type="button">' +
        '<span class="mi-from"><span>' + esc(m.fromName) + '</span>' +
          '<span class="mi-time">' + esc(m.time) + '</span></span>' +
        '<span class="mi-sub">' + esc(sub) + '</span>' +
      '</button>';
    }).join('');

    if (!items) {
      return '<div class="tab"><div class="mail-empty">' +
        '收件箱为空。<br><br>' +
        '<span class="mono dim">尚未收到任何登记任务。</span>' +
        '</div></div>';
    }

    var unreadCount = list.filter(function (m) { return !m.read; }).length;

    return '<div class="tab"><div class="inbox">' +
      '<div class="mail-list-col">' +
        '<div class="mail-list-head">' +
          '<span>收件箱</span>' +
          '<span class="mono">' + list.length + ' 封 / 未读 ' + unreadCount + '</span>' +
        '</div>' +
        '<div class="mail-list scroll">' + items + '</div>' +
      '</div>' +
      '<div class="mail-read-col">' + renderMailBody(sel) + '</div>' +
    '</div></div>';
  }

  function renderMailBody(m) {
    if (!m) {
      return '<div class="mail-empty">选择一封邮件</div>';
    }
    var meta = m.meta;
    var st = s();

    var bodyHtml = esc(meta.body || '');

    /* M 篡改：只留标记，不删正文（否则玩家拿不到行为数字会卡关） */
    if (m.tampered) {
      bodyHtml = '<div class="notice warn" style="margin-bottom:6px">' +
        '[ M. 已经读过这封邮件。原文没有被改动。 ]</div>' + bodyHtml;
    }

    /* 附件 */
    if (meta.attach) {
      bodyHtml += '\n\n<div class="attach"><span class="att-h">' + esc(meta.attachTitle || '附件') + '</span>' +
        esc(meta.attach) + '</div>';
    }

    /* 行为数字（角色邮件必须显眼，玩家要外部记录） */
    if (meta.numbers) {
      bodyHtml += '\n<span class="bignum">[记录：' + esc(meta.numbers) + ']</span>';
    }

    if (meta.sign) {
      bodyHtml += '<span class="sig">—— ' + esc(meta.sign) + '</span>';
    }

    /* 已记录确认的反馈 */
    if (st.recorded && st.recorded[m.id] && meta.record) {
      bodyHtml += '\n<div class="notice ok" style="margin-top:8px">' +
        esc(meta.record) + '</div>';
    }

    /* 被角色取走的邮件 */
    if (m.deleted) {
      var note;
      if (m.deletedBy === 'H') {
        note = '这封邮件的内容已被取出。\n\n' +
               '发件人还在。\n时间还在。\n正文是空的。\n\n' +
               '他说他删掉了。他确实删掉了。';
      } else {
        note = 'M. 已处理。\n\n' +
               '这封邮件的内容不在你手上。';
      }
      bodyHtml = '<div class="mail-empty"><div>' +
        '<span class="tag tag-solid">已删除</span><br><br>' +
        '<span style="white-space:pre-wrap;font-size:12px;line-height:1.7">' + esc(note) + '</span>' +
        '<br><span class="mono dim" style="font-size:10.5px">—— ' + (m.deletedBy || 'M') + '.</span>' +
        '</div></div>';
    }

    /* 附件动作（T 的补丁 / I 的小游戏） */
    var extraBtn = '';
    if (meta.extra && !m.deleted) {
      extraBtn = '<button class="btn btn-sm btn-ghost" data-extra="' + esc(m.id) + '" type="button" style="margin:8px 0 0">' +
        esc(meta.extra.label) + '</button>';
    }

    /* ---- 操作按钮：正文底部固定四项（文档 4.4） ---- */
    var isSys = (m.from === 'SYS');
    var answered = !!m.action;
    var isRecorded = !!(st.recorded && st.recorded[m.id]);

    function slot(action, label, doneLabel, cls) {
      var done =
        (action === 'reply' && m.action === 'reply') ||
        (action === 'ignore' && m.action === 'ignore') ||
        (action === 'spam' && m.action === 'spam') ||
        (action === 'record' && isRecorded);
      /* 系统邮件无法回复/标记：置灰但保留位置，保证四项始终固定 */
      var dis = done || (action !== 'record' && (answered || isSys));
      var c = 'btn ' + cls;
      if (done) c += ' done';
      if (dis) c += ' disabled';
      return '<button class="' + c + '" data-act="' + action +
        '" data-mail="' + esc(m.id) + '" type="button"' + (dis ? ' disabled' : '') + '>' +
        (done ? doneLabel : label) + '</button>';
    }

    var acts = [
      slot('reply', '回复', '已回复', 'btn-primary'),
      slot('ignore', '不回复', '已选择', ''),
      slot('spam', '标记垃圾邮件', '已标记', 'btn-danger'),
      slot('record', '已记录确认', '已记录', 'btn-ghost')
    ];

    /* 第 7 天：进入最终登记（放在正文滚动区末尾，不挤占底部四按钮） */
    var finalBtn = '';
    if (st.day === 7 && m.id === 'd7_sys') {
      finalBtn = '<button class="btn btn-primary" data-act="final" type="button" ' +
        'style="margin-top:10px;min-height:38px;width:100%">进入 7 号柜 · 最终登记</button>';
    }

    return '<div class="mail-head selectable">' +
      '<div class="mh-row"><span class="mh-k">发件</span><span class="mh-v">' +
        esc(meta.addr || (DATA.characters[m.from] ? DATA.characters[m.from].mail : 'system@guichao.net')) +
      '</span></div>' +
      '<div class="mh-row"><span class="mh-k">时间</span><span class="mh-v">' + esc(m.time) + '</span></div>' +
      '<div class="mh-sub">' + esc(m.subject) + '</div>' +
    '</div>' +
    '<div class="mail-body selectable scroll">' + bodyHtml + extraBtn + finalBtn + '</div>' +
    '<div class="mail-actions">' + acts.join('') + '</div>';
  }

  /* ==================== 登记簿 ==================== */
  function renderLedger() {
    var st = s();
    var rows = DATA.days.map(function (d) {
      var reg = st.reg[d.day];
      var future = d.day > st.day;
      var checksum = '';
      if (reg) checksum = reg.checksum || '';
      return '<tr>' +
        '<td>' + esc(d.code) + '</td>' +
        '<td>' + esc('07-' + global.Store.pad2(13 + d.day)) + '</td>' +
        '<td>' + esc(d.place) + '</td>' +
        '<td class="' + (reg ? 'fill' : 'empty') + '">' +
          (future ? '—' : (reg ? esc(reg.answer) : '待登记')) + '</td>' +
        '<td class="' + (reg ? 'fill' : 'empty') + '">' +
          (future ? '—' : (reg ? esc(checksum) : '未提交')) + '</td>' +
      '</tr>';
    }).join('');

    var cur = DATA.days[st.day - 1];
    var done = !!st.reg[st.day];

    var formHtml;
    if (st.day === 7) {
      /* 第 7 天不再接受失物登记，只在等一个值 */
      formHtml =
        '<div class="notice" style="margin:0">' +
          '7 号柜不再接受失物登记。它在等一个值。' +
        '</div>' +
        '<button class="btn btn-block btn-primary" data-act="final" type="button">' +
          '进入 7 号柜 · 最终登记' +
        '</button>';
    } else if (done) {
      formHtml =
        '<div class="notice ok" style="margin:0">' +
          'D' + st.day + ' 已登记：' + esc(st.reg[st.day].answer) + ' / 校验 ' + esc(st.reg[st.day].checksum) +
        '</div>' +
        (cur.cabinet ? '<button class="btn btn-block btn-ghost" data-act="cabinet" type="button">打开柜位图 · 取旧工牌</button>' : '') +
        '<button class="btn btn-block btn-primary" data-act="offduty" type="button">下班 · 结算本日</button>';
    } else if (cur.choices) {
      /* 处置方式：不做文本填空，改成明确的选项（D3 / D5） */
      var picked = VS.ledgerChoice;
      formHtml =
        '<div class="ledger-form-row">' +
          '<span class="lf-k">' + esc(cur.answer.label) + '</span>' +
          '<span class="dim" style="font-size:10px">先选择，再填校验码</span>' +
        '</div>' +
        '<div class="choice-grid">' +
          cur.choices.map(function (c) {
            var on = (picked === c.key);
            return '<button class="btn choice-btn' + (on ? ' on' : '') + '" ' +
              'data-act="choose" data-key="' + esc(c.key) + '" type="button">' +
              (on ? '✓ ' : '') + esc(c.label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="ledger-form-row">' +
          '<span class="lf-k">校验码</span>' +
          '<input class="input" id="ledger-checksum" placeholder="数字" autocomplete="off" ' +
            'inputmode="text" style="flex:0 0 90px">' +
          '<button class="btn btn-primary" data-act="submit-choice" type="button">提交登记</button>' +
        '</div>' +
        '<div class="ledger-form-row">' +
          '<span class="lf-k dim" style="font-size:10px">' + esc('D' + st.day + ' · ' + cur.item) + '</span>' +
        '</div>';
    } else {
      formHtml =
        '<div class="ledger-form-row">' +
          '<span class="lf-k">' + esc(cur.answer.label) + '</span>' +
          '<input class="input" id="ledger-answer" placeholder="解码结果" autocomplete="off" ' +
            'autocorrect="off" autocapitalize="off" spellcheck="false">' +
        '</div>' +
        '<div class="ledger-form-row">' +
          '<span class="lf-k">校验码</span>' +
          '<input class="input" id="ledger-checksum" placeholder="数字" autocomplete="off" ' +
            'inputmode="text" style="flex:0 0 90px">' +
          '<button class="btn btn-primary" data-act="submit-ledger" type="button">提交登记</button>' +
        '</div>' +
        '<div class="ledger-form-row">' +
          '<span class="lf-k dim" style="font-size:10px">' + esc('D' + st.day + ' · ' + cur.item) + '</span>' +
        '</div>';
    }

    return '<div class="tab"><div class="ledger">' +
      '<div class="ledger-scroll scroll">' +
        '<table>' +
          '<thead><tr><th>编号</th><th>日期</th><th>地点</th><th>特征</th><th>校验码</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="ledger-form">' + formHtml + '</div>' +
    '</div></div>';
  }

  /* ==================== 监控日志 ==================== */
  function renderMonitor() {
    var st = s();
    var out = [];
    for (var d = 1; d <= st.day; d++) {
      var day = DATA.days[d - 1];
      out.push('<div class="ml sys">── D0' + d + ' · ' + esc(day.title) + ' ──</div>');
      (day.monitor || []).forEach(function (m) {
        if (m.failOnly && !st.flags.d5Failed) return;
        var cls = 'ml' + (m.abn ? ' abn' : '');
        var line = m.line ? '行 ' + m.line + '  ' : '';
        out.push('<div class="' + cls + '"><span class="ts">' + esc(line + m.t) + '</span>' + esc(m.x) + '</div>');
      });
    }

    /* 第 5 天：监控慢 24 小时的提示（在完成登记后出现） */
    if (st.day >= 5) {
      out.push('<div class="ml sys">── 系统 ──</div>');
      out.push('<div class="ml own">[时钟偏差] 本机时间 与 摄像头时间 相差 24 小时</div>');
      out.push('<div class="ml">[提示] 你看到的「明天」，是今晚。</div>');
    }

    /* 第 6/7 天的显示异常修复记录（叙事伪装） */
    Object.keys(st.glitch || {}).forEach(function (k) {
      if (k === 'D6_MAIL_FLASH') out.push('<div class="ml sys">[显示异常] 已修复（1/1）</div>');
    });

    /* 切出记录（只记时长） */
    if (st.awayLast > 0) {
      out.push('<div class="ml sys">[系统日志] 连接中断 ' + st.awayLast + ' 秒。</div>');
      out.push('<div class="ml sys">[系统日志] 已恢复。</div>');
    }

    return '<div class="tab"><div class="monitor">' +
      '<div class="monitor-head">' +
        '<span>监控日志 · 防空洞走廊</span>' +
        '<span class="mono">D0' + st.day + '</span>' +
      '</div>' +
      '<div class="monitor-lines scroll">' + out.join('') + '</div>' +
    '</div></div>';
  }

  global.Views = {
    VS: VS,
    charName: charName,
    mailMeta: mailMeta,
    inboxList: inboxList,
    inbox: renderInbox,
    ledger: renderLedger,
    monitor: renderMonitor
  };
})(window);

/* ============================================================
   UNCLAIMED_ECHOES_07  ·  views.js  (part 2/3)
   规则手册 / 校验器
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var DATA = global.DATA;

  function s() { return global.Store.s; }

  /* ==================== 规则手册 ==================== */
  /* 每页 6 条。D1 解锁 1—7 条 → 第 7 条（校验码公式）在第 2 页，
     玩家必须自己翻。这是地狱模式的一部分，不要为了"好找"而放宽。 */
  var PAGE_SIZE = 6;

  function visibleRules() {
    var st = s();
    var list = DATA.rules.filter(function (r) { return r.unlock <= st.day; });
    if (st.inv.hRule15) {
      list = list.concat([DATA.rule15]);
    }
    return list;
  }

  function rulesPageCount() {
    return Math.max(1, Math.ceil(visibleRules().length / PAGE_SIZE));
  }

  function renderRules() {
    var st = s();
    var all = visibleRules();
    var pages = rulesPageCount();
    if (global.Views.VS.rulePage >= pages) global.Views.VS.rulePage = pages - 1;
    var page = global.Views.VS.rulePage;
    var slice = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    var body = slice.map(function (r) {
      var cls = 'rule' + (r.no === 14 ? ' rule-14' : '') + (r.forced ? ' rule-15' : '');
      var text = esc(r.text);
      var extra = '';

      if (r.formula) {
        extra += '<span class="formula">' + esc(r.formula) + '</span>';
      }
      if (r.zw) {
        extra += '<div class="zw-hint">' + esc(r.zwHint || '') + '</div>';
        extra += '<div class="btn-row" style="margin-top:5px">' +
          '<button class="btn btn-sm" data-act="rule14-copy" type="button">复制此条</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="rule14-edit" type="button">编辑此条</button>' +
          '</div>';
      }
      if (r.forced) {
        extra += '<div class="zw-hint">[ 此条为外部写入，无法删除 ]</div>';
      }

      return '<div class="' + cls + '">' +
        '<p><span class="rule-no">第' + r.no + '条</span>' + text + '</p>' +
        extra +
      '</div>';
    }).join('');

    /* 第 13 条解锁后提示可编辑 */
    var editNote = '';
    if (st.day >= 6) {
      editNote = '<div class="notice">' +
        '本手册允许修改。修改后须保存，否则不生效。' +
        (st.rulesEdited ? '<br><span class="mono">状态：已修改并保存</span>' : '<br><span class="mono">状态：未修改</span>') +
        '</div>';
    }

    var pageBtns = '';
    for (var i = 0; i < pages; i++) {
      pageBtns += '<button class="page-btn' + (i === page ? ' on' : '') +
        '" data-page="' + i + '" type="button">' + (i + 1) + '</button>';
    }

    return '<div class="tab"><div class="rules">' +
      '<div class="rules-page scroll">' + editNote + body + '</div>' +
      '<div class="rules-foot">' +
        pageBtns +
        '<span class="spacer"></span>' +
        '<span class="dim mono" style="font-size:11px">' + (page + 1) + '/' + pages + '</span>' +
      '</div>' +
    '</div></div>';
  }

  /* ==================== 校验器 ==================== */
  function renderVerify() {
    var st = s();
    var hist = (st.vfLog || []).slice(-12).reverse();
    var logHtml = hist.map(function (h) {
      return '<div class="vl">' +
        '<span class="vl-t">' + esc(h.t) + '</span>' +
        '<span class="vl-i">' + esc(h.i) + '</span>' +
        '<span class="vl-r ' + (h.ok ? 'ok' : 'ng') + '">' + (h.ok ? '正确' : '错误') + '</span>' +
      '</div>';
    }).join('');

    return '<div class="tab"><div class="verify">' +
      '<div class="verify-form">' +
        '<div class="field" style="margin-bottom:4px">' +
          '<label>输入中间结果或最终答案。本器只回答正确或错误，不代算。</label>' +
          '<input class="input" id="verify-input" placeholder="在此输入" autocomplete="off" ' +
            'autocorrect="off" autocapitalize="off" spellcheck="false">' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary" data-act="verify" type="button">校验</button>' +
          '<button class="btn btn-ghost" data-act="verify-clear" type="button">清空历史</button>' +
        '</div>' +
      '</div>' +
      '<div class="verify-result idle" id="verify-result">等待输入</div>' +
      '<div class="verify-log scroll">' + (logHtml || '<div class="vl"><span class="vl-i dim">暂无记录</span></div>') + '</div>' +
    '</div></div>';
  }

  global.Views.rules = renderRules;
  global.Views.rulesPageCount = rulesPageCount;
  global.Views.visibleRules = visibleRules;
  global.Views.verify = renderVerify;
})(window);

/* ============================================================
   UNCLAIMED_ECHOES_07  ·  views.js  (part 3/3)
   更多（打卡机 / 传真机 / 字符检查器 / 提示 / 设置 / 帮助）
   柜位图 · 主渲染分发
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;
  var DATA = global.DATA;

  function s() { return global.Store.s; }
  function VS() { return global.Views.VS; }

  /* ==================== 更多 ==================== */
  function renderMore() {
    var st = s();
    var cards = [
      { k: 'punch', t: '打卡机', d: '上下班打卡。工时将计入你的记录。' },
      { k: 'fax', t: '传真机', d: '前任登记员留下的传真。字迹潦草，有涂改。' },
      { k: 'charc', t: '字符检查器', d: '查看字符数、可见数、隐藏数与码点。不代为翻译。' },
      { k: 'hint', t: '提示系统', d: '_已禁用:D', disabled: true },
      { k: 'setting', t: '设置', d: '减少闪烁 / 震动 / 屏幕常亮 / 重置。' },
      { k: 'help', t: '帮助', d: '操作说明与隐私边界声明。' },
      { k: 'decode', t: '解码工作台', d: '已禁用。请使用你习惯的外部记录方式自行解码。', disabled: true }
    ];

    var html = cards.map(function (c) {
      return '<button class="more-card' + (c.disabled ? ' disabled' : '') + '" ' +
        (c.disabled ? '' : 'data-panel="' + c.k + '"') + ' type="button">' +
        '<span class="mc-t">' + esc(c.t) + '</span>' +
        '<span class="mc-d">' + esc(c.d) + '</span>' +
      '</button>';
    }).join('');

    var stat = '<div class="notice" style="margin-bottom:8px">' +
      '登记员 <b class="mono">' + esc(st.codename || '未登记') + '</b> ｜ ' +
      '值班日 <b class="mono">D0' + st.day + '</b> ｜ ' +
      '遗忘值 <b class="mono">' + st.forget + '</b> ｜ ' +
      '切出累计 <b class="mono">' + st.awayTotal + 's</b>' +
      '</div>';

    return '<div class="tab"><div class="more scroll">' + stat +
      '<div class="more-grid">' + html + '</div>' +
    '</div></div>';
  }

  /* ---------------- 打卡机 ---------------- */
  function punchHtml() {
    var st = s();
    var p = st.punch[st.day] || {};
    var now = new Date();
    var hh = global.Store.pad2(now.getHours());
    var mm = global.Store.pad2(now.getMinutes());
    var out = '';
    out += '<div class="punch">';
    out += '<div class="p-time">' + hh + ':' + mm + '</div>';
    out += '<div class="p-meta">打卡机 · 值班室 门口</div>';
    out += '<div class="mono" style="font-size:12px">';
    out += '上班：' + (p.in ? p.inLabel : '未打卡') + '<br>';
    out += '下班：' + (p.out ? p.outLabel : '未打卡');
    out += '</div>';
    if (p.in && p.out) {
      var mins = Math.max(0, Math.round((p.out - p.in) / 60000));
      out += '<div class="p-hint">本次工时 ' + mins + ' 分钟</div>';
    }
    out += '</div>';
    return out;
  }

  /* ---------------- 传真机 ---------------- */
  function faxHtml() {
    var st = s();
    var list = DATA.faxes.filter(function (f) { return f.day <= st.day; });
    if (!list.length) return '<div class="dim">传真机没有新纸。</div>';
    return list.map(function (f) {
      return '<div class="fax" style="margin-bottom:12px">' +
        '<div class="fax-head">' + esc(f.head) + '</div>' +
        '<span class="hand">' + esc(f.body) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------------- 字符检查器 ---------------- */
  var INVISIBLE = [0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF, 0x00AD, 0x180E];

  function isInvisible(cp) { return INVISIBLE.indexOf(cp) >= 0; }

  function charcAnalyze(text) {
    var chars = Array.from(String(text || ''));
    var rows = [];
    var inv = 0;
    chars.forEach(function (ch, i) {
      var cp = ch.codePointAt(0);
      var invisible = isInvisible(cp);
      if (invisible) inv++;
      rows.push({
        i: i + 1,
        ch: ch,
        cp: cp,
        hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
        invisible: invisible
      });
    });
    return { total: chars.length, invisible: inv, visible: chars.length - inv, rows: rows };
  }

  function charcHtml(text) {
    var r = charcAnalyze(text);
    var rowsHtml = r.rows.slice(0, 120).map(function (row) {
      var shown = row.invisible ? '·' : (row.ch === ' ' ? '␠' : row.ch);
      return '<tr>' +
        '<td>' + row.i + '</td>' +
        '<td' + (row.invisible ? ' style="color:#002FA7;font-weight:bold"' : '') + '>' + esc(shown) + '</td>' +
        '<td class="cp">' + esc(row.hex) + '</td>' +
        '<td>' + (row.invisible ? '隐藏' : '可见') + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="charc">' +
      '<div class="charc-summary">' +
        '<span>总字符 <b>' + r.total + '</b></span>' +
        '<span>可见 <b>' + r.visible + '</b></span>' +
        '<span>隐藏 <b>' + r.invisible + '</b></span>' +
      '</div>' +
      '<div class="notice warn" style="margin-top:6px">[警告：隐藏字符可能已丢失]</div>' +
      '<div style="max-height:34vh;overflow:auto" class="scroll">' +
        '<table><thead><tr><th>#</th><th>字符</th><th>码点</th><th>类型</th></tr></thead>' +
          '<tbody>' + (rowsHtml || '<tr><td colspan="4" class="dim">—</td></tr>') + '</tbody></table>' +
      '</div>' +
      '<div class="dim" style="font-size:10.5px;margin-top:4px">' +
        '本器不自动翻译，不代为计算。你记录，你判断。' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 提示系统 ---------------- */
  function hintLevelCost(lv) {
    /* L1+0 / L2+1 / L3+1 / L4+2 */
    return [0, 0, 1, 1, 2][lv] || 0;
  }

  function hintHtml() {
    var st = s();
    var day = DATA.days[st.day - 1];
    var used = global.Store.hintLevels(st.day);
    var out = '<div class="notice">' +
      '使用提示会累积「遗忘值」。遗忘值越高，某些结局越近。<br>' +
      '当前遗忘值：<b class="mono">' + st.forget + '</b> / 3' +
      '</div>';

    (day.hints || []).forEach(function (h, i) {
      var lv = i + 1;
      var label = ['L1 编码类型', 'L2 转换示例', 'L3 第一步结果', 'L4 最终答案'][i];
      var opened = used[i] > 0;
      var cost = hintLevelCost(lv);
      out += '<div style="border:1px solid #000;margin-bottom:6px">';
      out += '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:var(--bg-alt)">' +
        '<span class="mono" style="font-size:12px">' + esc(label) + '</span>' +
        (opened
          ? '<span class="tag tag-accent">已使用</span>'
          : '<button class="btn btn-sm" data-hint="' + lv + '" type="button">使用 · 遗忘+' + cost + '</button>') +
      '</div>';
      if (opened) {
        out += '<div style="padding:6px 8px;font-size:12px;line-height:1.6">' + esc(h) + '</div>';
      }
      out += '</div>';
    });

    if (st.forget > 0) {
      out += '<div class="dim" style="font-size:11px">你用了提示。' +
        '有人看到了。明天他会说出来。</div>';
    }
    return out;
  }

  /* ---------------- 设置 ---------------- */
  function settingHtml() {
    var o = s().opt;
    function sw(on, key, label) {
      return '<div class="setting-row">' +
        '<span>' + esc(label) + '</span>' +
        '<button class="switch' + (on ? ' on' : '') + '" data-toggle="' + key + '" type="button">' +
          '<span class="sw-t">' + (on ? 'ON' : 'OFF') + '</span>' +
        '</button>' +
      '</div>';
    }
    return '<div>' +
      sw(o.reducedMotion, 'reducedMotion', '减少闪烁 · 闪屏改为静态乱码 1 秒') +
      sw(o.haptics, 'haptics', '崩坏时短震 100ms') +
      sw(o.keepAwake, 'keepAwake', '游玩时屏幕常亮') +
      sw(o.sound, 'sound', '音效 · 全部实时合成') +
      '<div class="setting-row">' +
        '<span>音量</span>' +
        '<button class="btn btn-sm" data-act="volume-cycle" type="button">' +
          ['关', '低', '中', '高'][o.volume == null ? 2 : o.volume] +
        '</button>' +
      '</div>' +
      sw(o.ambient, 'ambient', '环境底噪 · 空调 / CRT') +
      '<div class="notice" style="margin-top:8px">' +
        '本程序不读取你的真实姓名、摄像头、麦克风、剪贴板历史，也不读取其他应用的内容。<br>' +
        '所有 meta 效果均在游戏内实现。' +
      '</div>' +
      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn btn-danger" data-act="reset-save" type="button">清除存档，重新开始</button>' +
        '<button class="btn btn-ghost" data-act="reset-endingfx" type="button">重置结局特效</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 帮助 ---------------- */
  function helpHtml() {
    return '<div style="font-size:12px;line-height:1.65">' +
      '<b>每晚流程</b><br>' +
      '1. 收件箱收到失物登记任务。<br>' +
      '2. 用你习惯的外部记录方式处理编码线索。<br>' +
      '3. 校验器验证中间结果或最终答案。<br>' +
      '4. 在登记簿填写特征与校验码。<br>' +
      '5. 监控日志核对异常。<br>' +
      '6. 收到一封角色骚扰邮件，末尾带行为数字。<br>' +
      '7. 选择：回复 / 不回复 / 标记垃圾 / 已记录确认。<br>' +
      '8. 下班，结算。<br><br>' +
      '<b>地狱模式</b><br>' +
      '· 没有解码工作台。程序不替你算。<br>' +
      '· 复制文本可能丢失隐藏字符。<br>' +
      '· 校验码错误三次触发监控异常。<br>' +
      '· 登记簿必须填校验码。<br><br>' +
      '<b>记录模板</b><br>' +
      '<span class="mono">日期 | 发件人 | 行为数字 | 签名 | 柜号 | 中间解码 | 校验码 | 是否回复 | 备注</span><br><br>' +
      '<b>隐私边界</b><br>' +
      '切出游戏只记录时长，不读取内容。' +
      '</div>';
  }

  /* ---------------- 柜位图 ---------------- */
  function cabinetHtml(day) {
    var st = s();
    var got = st.cabinet[day];
    var cells = '';
    for (var i = 0; i < 100; i++) {
      var label = i < 10 ? '0' + i : '' + i;
      var cls = 'cabinet-cell';
      if (got && String(got) === label) cls += ' hot';
      cells += '<div class="' + cls + '" data-cab="' + label + '">' + label + '</div>';
    }
    var clue = '';
    if (got) {
      var d = DATA.days[day - 1];
      clue = '<div class="notice ok" style="white-space:pre-wrap">' + esc(d.cabinet.clue) + '</div>';
    }
    /* 横屏下左网格右操作：网格铺满可用高度，不再按 1:1 撑出屏幕 */
    return '<div class="cabinet-wrap">' +
      '<div class="cabinet-grid">' + cells + '</div>' +
      '<div class="cabinet-side scroll">' +
        '<div class="dim" style="font-size:11px;line-height:1.5">' +
          '柜位图 · 0—99。<br>点击格子累加数字，或直接输入柜号。' +
        '</div>' +
        '<div class="field" style="margin-top:6px">' +
          '<label>柜号</label>' +
          '<input class="input" id="cab-input" placeholder="例如 43" autocomplete="off" ' +
            'inputmode="text" autocapitalize="off" spellcheck="false">' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary" data-act="cab-open" type="button">开柜</button>' +
          '<button class="btn btn-ghost" data-act="cab-clear" type="button">清空</button>' +
        '</div>' +
        clue +
      '</div>' +
    '</div>';
  }

  /* ==================== 主渲染分发 ==================== */
  function render(tab) {
    var V = global.Views;
    if (tab) V.VS.tab = tab;
    switch (V.VS.tab) {
      case 'ledger': return V.ledger();
      case 'monitor': return V.monitor();
      case 'rules': return V.rules();
      case 'verify': return V.verify();
      case 'more': return renderMore();
      case 'inbox':
      default: return V.inbox();
    }
  }

  var V = global.Views || {};
  V.more = renderMore;
  V.punchHtml = punchHtml;
  V.faxHtml = faxHtml;
  V.charcHtml = charcHtml;
  V.charcAnalyze = charcAnalyze;
  V.hintHtml = hintHtml;
  V.hintLevelCost = hintLevelCost;
  V.settingHtml = settingHtml;
  V.helpHtml = helpHtml;
  V.cabinetHtml = cabinetHtml;
  V.render = render;
  global.Views = V;
})(window);