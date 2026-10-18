/* ============================================================
   UNCLAIMED_ECHOES_07  ·  ui.js
   纯视图组件：toast / 覆盖层 / 全屏输入面板 / 搜索高亮 / 震动
   （业务逻辑一律不写在这里，见 views.js / game.js）
   ============================================================ */
(function (global) {
  'use strict';

  var overlayRoot = null;
  var toastEl = null;
  var toastTimer = null;
  var overlayStack = [];

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, ms) {
    if (!toastEl) toastEl = $('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, ms || 1800);
  }

  /* ---------------- 震动（设置可关） ---------------- */
  function haptic(ms) {
    var s = global.Store.s;
    if (!s.opt.haptics) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 100); } catch (e) {}
    }
  }

  /* ---------------- 覆盖层 ---------------- */
  function closeOverlay(topOnly) {
    if (!overlayRoot) overlayRoot = $('overlay-root');
    if (topOnly) {
      var last = overlayStack.pop();
      if (last && last.parentNode) last.parentNode.removeChild(last);
    } else {
      overlayStack.forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      overlayStack = [];
    }
    if (!overlayStack.length && overlayRoot) overlayRoot.innerHTML = '';
  }

  function hasOverlay() { return overlayStack.length > 0; }

  function overlay(opts) {
    if (!overlayRoot) overlayRoot = $('overlay-root');
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'overlay' + (opts.className ? ' ' + opts.className : '');

    var btns = (opts.buttons || []).map(function (b, i) {
      return '<button class="btn ' + (b.cls || '') + '" data-ov-btn="' + i + '" type="button">' +
        esc(b.t) + '</button>';
    }).join('');

    wrap.innerHTML =
      '<div class="ov-panel">' +
        '<div class="ov-title"><span>' + esc(opts.title || '') + '</span>' +
          (opts.closable === false ? '' : '<span class="tag tag-accent" data-ov-x="1" style="cursor:pointer">X</span>') +
        '</div>' +
        '<div class="ov-body">' + (opts.html || '') + '</div>' +
        (btns ? '<div class="ov-foot">' + btns + '</div>' : '') +
      '</div>';

    overlayRoot.appendChild(wrap);
    overlayStack.push(wrap);

    /* 按钮事件 */
    (opts.buttons || []).forEach(function (b, i) {
      var el = wrap.querySelector('[data-ov-btn="' + i + '"]');
      if (!el) return;
      el.addEventListener('click', function () {
        if (b.close === false) {
          b.act && b.act(wrap);
        } else {
          closeOverlay(true);
          b.act && b.act(wrap);
        }
      });
    });

    /* 关闭 X */
    var x = wrap.querySelector('[data-ov-x]');
    if (x) x.addEventListener('click', function () { closeOverlay(true); });

    if (opts.onMount) opts.onMount(wrap);
    return wrap;
  }

  /* ---------------- 全屏输入面板 ---------------- */
  function inputPanel(opts) {
    opts = opts || {};
    var keys = opts.keys || ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F','.','-','/',' ','⌫'];
    var keyHtml = keys.map(function (k) {
      return '<button class="btn" data-key="' + esc(k) + '" type="button">' + esc(k) + '</button>';
    }).join('');

    var wrap = overlay({
      title: opts.title || '输入',
      className: 'input-overlay',
      closable: opts.closable !== false,
      html:
        '<div class="field">' +
          '<label>' + esc(opts.label || '') +
            '<span class="dim" style="font-size:10px;letter-spacing:0"> 点输入框调出键盘</span>' +
          '</label>' +
          '<input class="input" id="ov-input" type="text" ' +
            'inputmode="' + (opts.inputmode || 'text') + '" ' +
            'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
            'placeholder="' + esc(opts.placeholder || '') + '" ' +
            (opts.maxlength ? 'maxlength="' + opts.maxlength + '"' : '') + '>' +
        '</div>' +
        (opts.note ? '<div class="notice">' + opts.note + '</div>' : '') +
        (opts.showKeys === false ? '' : '<div class="keybar">' + keyHtml + '</div>') +
        '<div class="sb-spacer"></div>',
      buttons: [
        { t: '取消', cls: 'btn-ghost', act: function () { opts.onCancel && opts.onCancel(); } },
        {
          t: opts.okText || '确定',
          cls: 'btn-primary',
          close: false,
          act: function (w) {
            var v = w.querySelector('#ov-input').value;
            var r = opts.onOk ? opts.onOk(v) : undefined;
            /* 回调返回 false 表示校验未通过，面板保持打开以便重试 */
            if (r !== false) closeOverlay(true);
          }
        }
      ],
      onMount: function (w) {
        var inp = w.querySelector('#ov-input');
        inp.value = opts.value || '';
        inp.addEventListener('input', function () {
          if (opts.onInput) opts.onInput(inp.value, inp);
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (opts.onOk) opts.onOk(inp.value);
            if (opts.closeOnEnter !== false) closeOverlay(true);
          }
        });
        w.querySelectorAll('[data-key]').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.getAttribute('data-key');
            if (k === '⌫') {
              inp.value = inp.value.slice(0, -1);
            } else {
              var max = opts.maxlength || 999;
              if (inp.value.length < max) inp.value += k;
            }
            if (opts.onInput) opts.onInput(inp.value, inp);
          });
        });
        /* 不自动 focus：横屏下键盘会挡住半屏，交给玩家自己点 */
      }
    });
    return wrap;
  }

  /* ---------------- 确认框 ---------------- */
  function confirmBox(title, text, onOk, okText, cancelText) {
    return overlay({
      title: title,
      html: '<div style="font-size:12.5px;line-height:1.6;white-space:pre-wrap">' + esc(text) + '</div>',
      buttons: [
        { t: cancelText || '取消', cls: 'btn-ghost' },
        { t: okText || '确认', cls: 'btn-primary', act: onOk }
      ]
    });
  }

  /* ---------------- 文本高亮（标签内搜索） ---------------- */
  function highlight(container, kw) {
    if (!container) return 0;
    /* 先清除上一次 */
    container.querySelectorAll('mark.hit').forEach(function (m) {
      var p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
    if (!kw) return 0;
    var low = kw.toLowerCase();
    var count = 0;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || p.nodeName === 'MARK' || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.toLowerCase().indexOf(low) >= 0) {
        targets.push(walker.currentNode);
      }
    }
    targets.forEach(function (node) {
      var txt = node.nodeValue;
      var frag = document.createDocumentFragment();
      var idx = 0, pos;
      var lower = txt.toLowerCase();
      while ((pos = lower.indexOf(low, idx)) >= 0) {
        if (pos > idx) frag.appendChild(document.createTextNode(txt.slice(idx, pos)));
        var mk = document.createElement('mark');
        mk.className = 'hit';
        mk.textContent = txt.slice(pos, pos + kw.length);
        frag.appendChild(mk);
        idx = pos + kw.length;
        count++;
      }
      if (idx < txt.length) frag.appendChild(document.createTextNode(txt.slice(idx)));
      node.parentNode.replaceChild(frag, node);
    });
    var first = container.querySelector('mark.hit');
    if (first) {
      try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }
    return count;
  }

  /* ---------------- 简短打字机（用于结局/乱码稳定行） ---------------- */
  function typeInto(el, text, speed, done) {
    el.textContent = '';
    el.classList.add('caret');
    var i = 0;
    var t = setInterval(function () {
      el.textContent += text.charAt(i);
      i++;
      if (i >= text.length) {
        clearInterval(t);
        el.classList.remove('caret');
        done && done();
      }
    }, speed || 28);
  }

  global.UI = {
    $: $,
    esc: esc,
    toast: toast,
    haptic: haptic,
    overlay: overlay,
    closeOverlay: closeOverlay,
    hasOverlay: hasOverlay,
    input: inputPanel,
    confirm: confirmBox,
    highlight: highlight,
    typeInto: typeInto
  };
})(window);
