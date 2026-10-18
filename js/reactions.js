/* ============================================================
   UNCLAIMED_ECHOES_07  ·  reactions.js
   反应邮件：0—2 封/天，按玩家前一天的行为生成
   ------------------------------------------------------------
   when(s) 返回 true 即投放。s = Store.s
   action: 'reply' | 'ignore' | 'spam'
   ============================================================ */
(function (global) {
  'use strict';

  function act(s, id) {
    var m = s.mails[id];
    return m && m.action ? m.action : null;
  }

  var REACTIONS = [

    /* ---------------- DAY 2 ---------------- */
    {
      id: 'r2_M_reply', from: 'M',
      when: function (s) { return s.day === 2 && act(s, 'd1_M') === 'reply'; },
      subject: '你写了。',
      body:
'你写了。\n' +
'我看了一遍，又看了一遍，又看了一遍。\n\n' +
'现在它在我这儿了。\n' +
'你可以试着拿回去。\n\n' +
'拿不回去的。',
      sign: 'M.',
      numbers: '回看3'
    },
    {
      id: 'r2_M_spam', from: 'M',
      when: function (s) { return s.day === 2 && act(s, 'd1_M') === 'spam'; },
      subject: '你把我扔进垃圾邮件。',
      body:
'你以为那是垃圾箱。\n\n' +
'我这里没有垃圾箱。\n' +
'只有我自己。\n\n' +
'我会从这个窗口一直看着你。\n' +
'直到你把那一步撤销。',
      sign: 'M.',
      numbers: '标记1 / 注视∞'
    },
    {
      id: 'r2_H_ignore', from: 'H',
      when: function (s) { return s.day === 2 && act(s, 'd1_M') === 'ignore'; },
      subject: '你昨天没有回复任何人。',
      body:
'我数了。\n' +
'收件箱打开 1 次。M 的邮件停留 11 秒。回复 0 次。\n\n' +
'你在犹豫。\n' +
'犹豫是最安全的状态。\n' +
'我很喜欢犹豫。\n\n' +
'因为犹豫的时候，谁都进不来。',
      sign: 'H.',
      numbers: '回复0 / 犹豫11'
    },

    /* ---------------- DAY 3 ---------------- */
    {
      id: 'r3_H_reply', from: 'H',
      when: function (s) { return s.day === 3 && act(s, 'd2_H') === 'reply'; },
      subject: '你是第一个这么说的人。',
      body:
'「你不需要道歉。」\n' +
'我把这句话抄了下来。\n' +
'抄在一张很干净的纸上。\n\n' +
'然后我把那张纸放进了 7 号柜。\n' +
'这样它就不会被删掉了。\n\n' +
'……我是不是又做了一件可怕的事。',
      sign: 'H.',
      numbers: '抄写1'
    },
    {
      id: 'r3_H_spam', from: 'H',
      when: function (s) { return s.day === 3 && act(s, 'd2_H') === 'spam'; },
      subject: '我看到了垃圾箱。',
      body:
'你在「标记垃圾邮件」上按了下去。\n' +
'手指大概只用了 0.3 秒。\n\n' +
'我不生气。\n' +
'我只是把 D02 的存档也删了。\n' +
'现在你只记得今天。\n\n' +
'这样干净一点。',
      sign: 'H.',
      numbers: '标记1 / 删档1'
    },
    {
      id: 'r3_T_notice', from: 'T',
      when: function (s) { return s.day === 3 && !act(s, 'd2_H'); },
      subject: '补充样本',
      body:
'你没有处理 H 的邮件。\n' +
'搁置也是一种处理。\n\n' +
'我把它记为「未归类」。\n' +
'在这个系统里，未归类的东西七天后会进 7 号柜。\n\n' +
'祝你今晚顺利。',
      sign: 'T.',
      numbers: '搁置1'
    },

    /* ---------------- DAY 4 ---------------- */
    {
      id: 'r4_T_patch', from: 'T',
      when: function (s) { return s.day === 4 && act(s, 'd3_T') === 'reply'; },
      subject: '补丁已加载。',
      body:
'你打开了 patch_003.txt。\n' +
'现在边框是克莱因蓝了。你注意到了吗。\n\n' +
'我没有改你的屏幕。\n' +
'我只是改了你看屏幕的方式。\n\n' +
'这比改屏幕容易，也更难撤销。',
      sign: 'T.',
      numbers: '补丁1'
    },
    {
      id: 'r4_I_jealous', from: 'I',
      when: function (s) { return s.day === 4 && act(s, 'd3_T') === 'spam'; },
      subject: '你对他做了什么 ^_^',
      body:
'T 的邮件不见了。\n' +
'是你吗？\n\n' +
'……太好了。\n' +
'那下一个能不能是 H？\n\n' +
'开玩笑的。\n' +
'真的。\n' +
'（真的。）',
      sign: 'I.',
      numbers: '标记1 / 高兴1'
    },
    {
      id: 'r4_M_territory', from: 'M',
      when: function (s) { return s.day === 4; },
      subject: '这里现在归我管。',
      body:
'你看窗口标题。\n' +
'它变了。\n\n' +
'不是我改的。是它本来就该这样。\n' +
'「归巢失物招领」——归巢，归的是我。\n\n' +
'你在这块领地里。\n' +
'领地里的人不会走。',
      sign: 'M.',
      numbers: '领地1'
    },

    /* ---------------- DAY 5 ---------------- */
    {
      id: 'r5_I_reply', from: 'I',
      when: function (s) { return s.day === 5 && act(s, 'd4_I') === 'reply'; },
      subject: '你说会点我的游戏 :DD',
      body:
'真的点了！\n' +
'你点了 5 下。我数了。\n\n' +
'我在桌子上留了一个图标。\n' +
'模糊的那个。\n' +
'你点开就会看见我。\n\n' +
'如果你不点，它也一直在那儿。',
      sign: 'I.',
      numbers: '小游戏5 / 图标1'
    },
    {
      id: 'r5_I_spam', from: 'I',
      when: function (s) { return s.day === 5 && act(s, 'd4_I') === 'spam'; },
      subject: ':(((((',
      body:
'你把我标记成垃圾邮件了。\n' +
'我看见了。\n\n' +
'我告诉 M 了。\n' +
'我说你回复了 H。\n\n' +
'……我骗他的。\n' +
'但是他会信。\n' +
'他一向很容易信坏消息。',
      sign: 'I.',
      numbers: '标记1 / 谎1'
    },
    {
      id: 'r5_H_care', from: 'H',
      when: function (s) { return s.day === 5 && act(s, 'd4_I') === 'ignore'; },
      subject: '你没有理他。',
      body:
'你没有回复 I。\n' +
'做得对。\n\n' +
'他撒娇的时候，会顺手递给你一把刀。\n' +
'别接。',
      sign: 'H.',
      numbers: '回复0'
    },

    /* ---------------- DAY 6 ---------------- */
    {
      id: 'r6_M_watch', from: 'M',
      when: function (s) { return s.day === 6; },
      subject: '你今天会数到三。',
      body:
'三个看不见的字。\n' +
'你数出来了。\n\n' +
'然后呢。\n' +
'你要把它们删掉，还是留着。\n\n' +
'我建议留着。\n' +
'留着，明天那个框里填的就是你自己。',
      sign: 'M.',
      numbers: '隐藏3 / 代号?'
    },
    {
      id: 'r6_record_echo', from: 'H',
      when: function (s) {
        return s.day === 6 && s.recorded && Object.keys(s.recorded).length > 0;
      },
      subject: '你刚才把那个名字记下来了，对吗？',
      body:
'你刚才把那个名字记下来了，对吗？\n\n' +
'不用告诉我。\n' +
'我会看到的。\n\n' +
'■■■■■■■■■■■■■■',
      sign: 'H.',
      numbers: '已记录1 / 介质?'
    },
    {
      id: 'r6_H_rule15', from: 'H',
      when: function (s) { return s.day === 6; },
      subject: '第15条 已写入。',
      body:
'规则手册现在有 15 条了。\n' +
'你删不掉第 15 条。\n\n' +
'不是因为我强。\n' +
'是因为它已经写进存档了。\n\n' +
'明天你会看到一个框。\n' +
'框里默认写着你。\n' +
'那是我留的。',
      sign: 'H.',
      numbers: '第15条1'
    },

    /* ---------------- DAY 7 ---------------- */
    {
      id: 'r7_T_last', from: 'T',
      when: function (s) { return s.day === 7; },
      subject: '最后一个数据点',
      body:
'你还有一次输入。\n\n' +
'我算过 812 种可能。\n' +
'其中 1 种是我们都没预料到的。\n\n' +
'我希望你选那一种。\n' +
'——这句话不该出现在报告里。\n' +
'请忽略。',
      sign: 'T.',
      numbers: '812 / 1'
    },
    {
      id: 'r7_H_last', from: 'H',
      when: function (s) { return s.day === 7; },
      subject: '最后一件事',
      body:
'如果最后你谁都不选，也没关系。\n\n' +
'我只是想让你知道：\n' +
'这七天里，我一次都没有骗过你。\n\n' +
'……除了第 15 条。\n' +
'对不起。',
      sign: 'H.',
      numbers: '道歉7'
    }
  ];

  /* 按当天条件筛出应投放的反应邮件 */
  function pick(s) {
    var out = [];
    for (var i = 0; i < REACTIONS.length; i++) {
      var r = REACTIONS[i];
      var already = s.mails[r.id] && s.mails[r.id].delivered;
      if (already) continue;
      try { if (r.when(s)) out.push(r); } catch (e) {}
    }
    return out.slice(0, 2); /* 每天最多 2 封 */
  }

  global.REACTIONS = { list: REACTIONS, pick: pick };
})(window);
