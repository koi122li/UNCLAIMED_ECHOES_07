/* ============================================================
   UNCLAIMED_ECHOES_07  ·  endings.js
   结局树 + 最终登记解析
   ------------------------------------------------------------
   最终登记输入规则（v3.1 裁决）：
     最终值 = DELETE / 值班代号 / M. / H. / T. / I. / 七个姓名 + CLOSE
     最终确认码 = (M权重 + H权重 + T权重 + I权重) × 7 mod 100 = 03
   默认填入值班代号，需连续退格三次并确认才能清除。
   ============================================================ */
(function (global) {
  'use strict';

  var esc = UI.esc;

  var ENDINGS = {
    /* ============ 单人 ============ */
    M_TERRITORY: {
      code: 'ENDING · M',
      title: 'M的领地',
      body:
'你把代号交了出去。\n\n' +
'7 号柜的门没有开。它只是把你收了进去。\n' +
'屏幕上剩下最后一封邮件，主题是空的。\n\n' +
'「欢迎回家。\n这里只有我们。」\n\n' +
'你重启了系统。\n' +
'收件箱只有一封。发件人写着 M。\n' +
'窗口标题永久变成了三个字：M 的 领 地。',
      after: '窗口标题：归巢失物招领 - M的领地'
    },
    H_HAVEN: {
      code: 'ENDING · H',
      title: 'H的避风港',
      body:
'你选了最安静的那一个。\n\n' +
'其他三个人的邮件在同一秒消失。\n' +
'不是被删除——是被「归档」。\n' +
'监控日志开始写日记。第一句是：\n\n' +
'「今天他没有离开。」\n\n' +
'存档名变成了「H的存档」。\n' +
'底部的「下班」按钮不见了。\n' +
'你找了三遍。它真的不见了。',
      after: '存档名：H的存档 · 下班按钮已消失'
    },
    T_SAMPLE: {
      code: 'ENDING · T',
      title: 'T的样本',
      body:
'你把自己提交了。\n\n' +
'界面被补丁彻底改造：克莱因蓝的边框，微缩的字体，极细的滚动条。\n' +
'每天有一份自动生成的行为报告。\n\n' +
'报告第一条：「样本 #001 已完成。编号取代姓名。」\n' +
'报告第二条：「样本未申请退出。」\n' +
'报告第三条：\n\n' +
'「样本已无退出选项。」',
      after: '界面已被 T 的补丁完全接管'
    },
    I_GAME: {
      code: 'ENDING · I',
      title: 'I的小游戏',
      body:
'你点了他。\n\n' +
'整个桌面只剩下一个像素小游戏。\n' +
'规则很简单：点一下，数字加一。\n\n' +
'你点了一下。\n' +
'I 在旁边说：「再点一下。」\n' +
'你又点了一下。\n' +
'「再点一下。」\n\n' +
'数字已经很大了。\n' +
'他没有再长大。你也没有。',
      after: '桌面：只剩一个点击游戏'
    },

    /* ============ 共同 ============ */
    TETRAD: {
      code: 'ENDING · 四重回声',
      title: '四重回声',
      body:
'你谁都没有选。\n' +
'你等了十秒。\n\n' +
'第十一秒，四个窗口同时弹出。\n' +
'它们没有争吵。它们同时说了同一句话：\n\n' +
'「你选了我们。」\n\n' +
'存档变成四人共享。\n' +
'好感度一栏五个方块全满，并且不再是一个人的。\n' +
'你伸手去点「下班」。\n' +
'按钮下方多了一行小字：\n\n' +
'「下班需要四个人同意。」',
      after: '存档：四人共享'
    },
    CLOSE: {
      code: 'ENDING · 关门',
      title: '关门',
      body:
'七个名字。一个确认码。一个词。\n\n' +
'屏幕闪了一下，像有人从很远的地方关掉了一盏灯。\n\n' +
'「名单已满。归巢关闭。」\n\n' +
'桌面多了一个文件夹：归巢_备份。\n' +
'里面是你前六天的操作记录——每一次点击，每一次停留，每一次删掉又重打。\n\n' +
'四封角色邮件全部变成 [已读]。\n' +
'最下面一行：\n\n' +
'「谢谢你把我们记下来。」',
      after: '桌面：归巢_备份 文件夹'
    },
    NO_RELIEF: {
      code: 'ENDING · 无人接替',
      title: '无人接替',
      body:
'你关掉了网站。\n\n' +
'十秒后，窗口自己关闭了。\n' +
'不是崩溃。是下班。\n\n' +
'桌面多了一个文件夹。\n' +
'里面只有一个空文件，文件名是你的代号。\n\n' +
'文件内容一行：\n\n' +
'「你已下班。」\n\n' +
'第二天，归巢失物招领平台仍在运行。\n' +
'夜班登记员一栏写着：\n\n' +
'（空）',
      after: '桌面：一个以你代号命名的空文件'
    },

    DELETE_END: {
      code: 'ENDING · 删除',
      title: '删除',
      body:
'你输入了 DELETE，然后是 03。\n\n' +
'四个人的窗口同时变白。\n' +
'不是关闭。是被清空。\n\n' +
'7 号柜的名单长度从 7 变成 0。\n' +
'然后从 0 变成 ——\n\n' +
'系统在校验最后一个值。它找不到。\n\n' +
'你回到代号输入框。\n' +
'你的代号还在。\n' +
'只是它现在是灰的。\n\n' +
'你没有把谁留在里面。\n' +
'你把自己留在了外面。',
      after: '名单：0 ｜ 你的代号：灰色'
    },
    SUBMIT_END: {
      code: 'ENDING · 登记员',
      title: '值班登记员',
      body:
'你把自己的代号填进了 7 号柜。\n\n' +
'系统接受了。\n' +
'它甚至没有确认。\n\n' +
'第二天的排班表贴出来。\n' +
'夜班登记员一栏写着你的代号——不是灰的，是黑的。\n' +
'前任那一栏写着：已归档。\n\n' +
'你开始值第八天的班。\n' +
'第九天。\n' +
'第十天。\n\n' +
'每天早上都会有一封新邮件。\n' +
'发件人写着 M、H、T、I。\n' +
'它们都在问你同一个问题：\n\n' +
'「你还记得自己要下班吗。」',
      after: '排班表：夜班登记员 = 你的代号'
    },

    /* ============ 坏结局 ============ */
    ANSWERER: {
      code: 'BAD ENDING · 应答者',
      title: '应答者',
      body:
'你回答了那个问题。\n\n' +
'从那一刻起，录音笔里不再是一个问句。\n' +
'是一个名字。\n' +
'你的名字。\n\n' +
'第 7 天，7 号柜的名单不再是七个。\n' +
'是八个。\n' +
'第八格写着你的名字，字迹是你的。\n\n' +
'四个窗口同时打开。\n' +
'它们没有说「你选了我们」。\n' +
'它们说的是：\n\n' +
'「你早就选了自己。」\n\n' +
'系统关闭时，你听见有人在很远的地方\n' +
'把你的名字重复了一遍。\n' +
'念得很轻。像在确认。',
        after: '名单：8 人，第 8 格是你'
    },
    RAINCOAT: {
      code: 'BAD ENDING · 黄雨衣',
      title: '黄雨衣',
      body:
'监控日志里那个穿黄雨衣的人走到了镜头前。\n\n' +
'他没有脸。\n' +
'但你认出了那件雨衣——今天下雨。你带伞了吗。\n\n' +
'画面切黑。\n' +
'游戏强制关闭。\n\n' +
'你重新打开。\n' +
'代号输入框里，你的代号是灰色的。\n' +
'点不动。\n\n' +
'下方多了一行字：\n\n' +
'「该登记员已在此登记。」',
        after: '你的代号已被占用，灰色不可用'
    },
    SPAM: {
      code: 'BAD ENDING · 垃圾邮件',
      title: '垃圾邮件',
      body:
'你把他们都标记成了垃圾邮件。\n\n' +
'收件箱清空了。干净了。\n' +
'你甚至有点轻松。\n\n' +
'然后第二天，你收到一封没有主题的邮件。\n' +
'正文只有一个符号：\n\n' +
':)\n\n' +
'你删掉它。它回来了。\n' +
'你再删掉。它又回来了。\n\n' +
'现在每天一封。无法删除。\n' +
'无法标记。\n' +
'无法不看。',
      after: '每天一封无主题邮件，正文只有 :)'
    }
  };

  /* ================= 最终登记解析 ================= */
  function normalize(v) {
    return String(v || '')
      .toUpperCase()
      .replace(/[，,、;；|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(v) {
    return normalize(v).replace(/[\s.\-_]/g, '');
  }

  /**
   * 解析最终输入
   * @param {string} raw 玩家输入
   * @param {string} code 值班代号
   * @returns {{ending:string|null, ok:boolean, reason:string}}
   */
  function resolve(raw, code) {
    var st = global.Store.s;
    var n = normalize(raw);
    var c = compact(raw);

    /* 七个姓名 + 03 + CLOSE → 关门 */
    var names = global.DATA.sevenNames;
    var hitNames = names.filter(function (nm) {
      return c.indexOf(compact(nm)) >= 0;
    }).length;
    var has03 = /(^|[^0-9])0?3([^0-9]|$)/.test(n) || c.indexOf('03') >= 0;
    var hasClose = c.indexOf('CLOSE') >= 0;

      if (hitNames >= 7 && hasClose) {
        /*
         * 纸条被烧掉 → 关门这条路封死。
         * 七个名字都记齐了，也知道要写 CLOSE，
         * 但「7号柜不是柜，是名单」那半张纸上的东西你再也想不起来了。
         */
        if (st.flags && st.flags.burnedNote) {
          return {
            ending: null,
            ok: false,
            reason: '名单已满。但最后那一步你想不起来了。'
          };
        }
        return { ending: 'CLOSE', ok: true, reason: '七名已满' };
      }
      if (hasClose && hitNames < 7) {
        return { ending: null, ok: false, reason: '名单未满（' + hitNames + '/7）' };
      }

    /* 四人共同回声：由 10 秒倒计时触发，不在此处理 */

    /* 单人 */
    var solo = { 'M': 'M_TERRITORY', 'H': 'H_HAVEN', 'T': 'T_SAMPLE', 'I': 'I_GAME' };
    var soloKey = null;
    if (/^(M\.?|MAGNUS)$/.test(n)) soloKey = 'M';
    else if (/^(H\.?|HAVEN)$/.test(n)) soloKey = 'H';
    else if (/^(T\.?|TOBIAS)$/.test(n)) soloKey = 'T';
    else if (/^(I\.?|IVAN)$/.test(n)) soloKey = 'I';
    if (soloKey) return { ending: solo[soloKey], ok: true, reason: '单人' };

    /* 反抗 */
    if (c === 'DELETE' || c === 'DELETE03' || /^DELETE/.test(c)) {
      return { ending: 'DELETE_PENDING', ok: true, reason: 'DELETE' };
    }

    /* 顺从：值班代号 */
    if (code && compact(code) === c) {
      return { ending: 'SUBMIT_PENDING', ok: true, reason: '代号' };
    }

    return { ending: null, ok: false, reason: '无法识别' };
  }

  /* ================= 显示 ================= */
  function show(id, extra) {
    var e = ENDINGS[id];
    if (!e) return;
    var st = global.Store.s;

    st.endings = st.endings || {};
    st.endings[id] = true;
    st.ending = id;
    st.endingName = '值班日志_' + (st.codename || '未登记') + '_第7天';
    global.Store.save();

    function render() {
      var html =
        '<div class="ed-code">' + esc(e.code) + '</div>' +
        '<div class="ed-title">' + esc(e.title) + '</div>' +
        '<div class="ed-body">' + esc(e.body) + '</div>' +
        (extra ? '<div class="ed-body" style="color:#8fb0ff">' + esc(extra) + '</div>' : '') +
        '<div class="ed-body" style="font-size:11px;color:#888">' + esc(e.after || '') + '</div>' +
        '<div class="ed-foot">存档名：' + esc(st.endingName) + '</div>' +
        '<button class="btn btn-primary" data-ending-restart="1" type="button">重新开始</button>';

      var wrap = document.createElement('div');
      wrap.className = 'ending';
      wrap.id = 'ending-screen';
      wrap.innerHTML = '<div class="ed-inner">' + html + '</div>';
      document.body.appendChild(wrap);

      /* 好结局留下的像素小点：不可点击，不可关闭，永久存在 */
      if (global.EndingFX && global.EndingFX.isGood(id)) {
        var dot = document.createElement('i');
        dot.className = 'ending-dot';
        wrap.appendChild(dot);
      }

      var btn = wrap.querySelector('[data-ending-restart]');
      if (btn) {
        btn.addEventListener('click', function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          global.Game.restart();
        });
      }
    }

    /*
     * 表现层（增补包）：
     * 好结局 → 耳鸣 + 蓝屏，与结局 CG 同一帧硬切入场
     * 坏结局 → 雪花花屏 + 强制字幕，结束后才显示结局文本
     * 两者均一次性触发，写入存档。
     */
    try {
      if (global.EndingFX && global.EndingFX.isGood(id)) {
        global.EndingFX.goodEnding(render);
      } else if (global.EndingFX && global.EndingFX.isBad(id)) {
        global.EndingFX.badEnding(render);
      } else {
        render();
      }
    } catch (err) {
      if (global.console) console.error('[UE07] ending fx failed:', err);
      render();
    }
  }

  /* ================= 坏结局判定 ================= */
  function checkBad() {
    var st = global.Store.s;
    if (st.forget >= 3) return 'RAINCOAT';
    /* 同一角色连续回复三次 */
    var keys = ['M', 'H', 'T', 'I'];
    for (var i = 0; i < keys.length; i++) {
      if ((st.streak[keys[i]] || 0) >= 3) return 'RAINCOAT';
    }
    /* 累计回复 9 封 */
    if (st.replies >= 9) return 'RAINCOAT';
    return null;
  }

  global.Endings = {
    list: ENDINGS,
    resolve: resolve,
    show: show,
    checkBad: checkBad,
    normalize: normalize
  };
})(window);