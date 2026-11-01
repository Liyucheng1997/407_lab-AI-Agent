// 十个章节：文字、镜头、可见图层、交互小部件、动画脚本
import * as THREE from 'three';
import { COLOR } from '../core/fx.js';
import { iconSvg } from '../core/icons.js';
import { makeFlows } from './flows.js';
import { h } from '../ui/dom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------- 小部件 ---------------- */

function replayButton(el, ctx, text = '重新播放') {
  const btn = h('button', { class: 'btn btn-sm', onclick: () => ctx.restart() }, [h('span', { html: iconSvg('replay', 14) }), text]);
  el.append(h('div', { class: 'w-row' }, [btn]));
}

function meter(el, label = '上下文占用') {
  const fill = h('div', { class: 'meter-fill' });
  const num = h('span', { class: 'tabular' }, '0');
  const root = h('div', { class: 'meter' }, [h('div', { class: 'meter-head' }, [h('span', {}, label), num]), h('div', { class: 'meter-track' }, [fill])]);
  el.append(root);
  return {
    set(used, limit) {
      fill.style.width = `${Math.min(100, (used / limit) * 100)}%`;
      num.textContent = `${(used / 1000).toFixed(1)}K / ${Math.round(limit / 1000)}K tokens`;
    },
  };
}

function logPanel(el) {
  const list = h('div', { class: 'log' });
  el.append(list);
  return {
    add(kind, text) {
      const row = h('div', { class: `log-row k-${kind}` }, [h('i', { class: 'dot' }), h('span', { html: text })]);
      list.append(row);
      requestAnimationFrame(() => row.classList.add('in'));
      list.scrollTop = list.scrollHeight;
      return row;
    },
    clear() {
      list.innerHTML = '';
    },
  };
}

function chatPanel(el) {
  const list = h('div', { class: 'chat' });
  el.append(list);
  return {
    add(who, text, cls = '') {
      const b = h('div', { class: `bubble ${who} ${cls}` }, [h('span', { html: text })]);
      list.append(b);
      requestAnimationFrame(() => b.classList.add('in'));
      list.scrollTop = list.scrollHeight;
      return b;
    },
    typing() {
      return this.add('bot', '<i class="typing"><b></b><b></b><b></b></i>');
    },
    clear() {
      list.innerHTML = '';
    },
  };
}

/* ---------------- 章节 ---------------- */

export const CHAPTERS = [
  {
    id: 'overview',
    nav: '一张地图',
    tag: 'PROLOGUE · 总览',
    title: '五个词，其实是<em>一层套一层</em>',
    lead: 'LLM、Harness、Agent、Bot 并不在同一个层面上。它们是 <b>零件 → 系统 → 产品形态</b> 的关系。先看全貌，接下来一层层拆开。',
    points: [
      ['brain', '<b>LLM</b> 是大脑：只做一件事——读一段文字，接着往下写。'],
      ['wrench', '<b>Harness</b> 是装下大脑的身体与规矩：循环、工具、记忆、权限。'],
      ['loop', '<b>Agent</b> = LLM + Harness：能自己一步步把一件事做完。'],
      ['bot', '<b>Bot</b> 是对外的窗口：住在微信、Slack 里，有名字有头像；背后可以是规则、LLM 或 Agent。'],
    ],
    analogy: '<b>拿我自己举例：</b>Claude Opus 是 LLM；Claude Code 是 Harness；两者组合起来替你改代码时，就是一个 Agent；把它接进团队的 Slack，@ 一下就回应，它就成了 Bot。',
    camera: { pos: [-0.5, 14, 31], target: [-4.6, -0.8, 0] },
    layers: { llm: 1, context: 1, harness: 1, tools: 1, bot: 1, aura: 0.45 },
    rotate: true,
    widget(el) {
      el.append(
        h('div', { class: 'nest' }, [
          h('div', { class: 'nest-box n-bot' }, [
            h('span', { class: 'nest-tag' }, 'Bot · 对外形态（可选）'),
            h('div', { class: 'nest-box n-agent' }, [
              h('span', { class: 'nest-tag' }, 'Agent · 能干活的系统'),
              h('div', { class: 'nest-row' }, [
                h('div', { class: 'nest-box n-harness' }, [h('span', { class: 'nest-tag' }, 'Harness'), h('div', { class: 'nest-box n-llm' }, 'LLM')]),
                h('div', { class: 'nest-box n-tools' }, '工具'),
              ]),
            ]),
          ]),
        ]),
      );
    },
    async run(ctx) {
      await ambient(ctx);
    },
  },

  {
    id: 'llm',
    nav: 'LLM 大语言模型',
    tag: 'CHAPTER 01 · LLM',
    title: '一台极其强大的<em>「接龙」</em>机器',
    lead: 'LLM 的本质是一个函数：输入一串 <b>token</b>（文字碎片），输出「下一个 token」的概率分布。选一个接到末尾，再算一次——如此往复，就"写"出了整段话。',
    points: [
      ['brain', '上千亿个参数在训练结束后就固定了，里面压缩了语言、知识与推理的模式。'],
      ['rotate', '<b>自回归</b>：每生成一个 token，都要把前面所有内容重新读一遍。'],
      ['x', '<b>无状态</b>：这次调用不记得上次；它也<b>没有手</b>，不能自己上网、读文件、跑代码。'],
    ],
    analogy: '像一位读过整座图书馆、却被关在没有窗户的房间里的专家：你从门缝递进一张纸条，他写下回复递出来。仅此而已。',
    camera: { pos: [1.5, 0.9, 10.2], target: [1.35, 0.45, 0] },
    layers: { llm: 1, tokens: 1 },
    widget(el, ctx) {
      el.append(h('p', { class: 'w-note', html: '注意第 3 步：模型没有选概率最高的「适合」，而是选了「我们」。这叫<b>采样</b>，「温度」越高，越常选到不那么常见的词，输出也越有创意。' }));
      replayButton(el, ctx);
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { tokens, packets, llm, core } = world;
      const STEPS = [
        { c: [['好', 0.46], ['热', 0.21], ['冷', 0.12], ['不错', 0.09], ['差', 0.04]], pick: 0 },
        { c: [['，', 0.38], ['。', 0.27], ['啊', 0.14], ['！', 0.11], ['呀', 0.05]], pick: 0 },
        { c: [['适合', 0.34], ['我们', 0.26], ['阳光', 0.18], ['出去', 0.11], ['就', 0.06]], pick: 1, note: '采样：这次没选第一名' },
        { c: [['去', 0.41], ['一起', 0.25], ['出门', 0.16], ['可以', 0.09], ['准备', 0.05]], pick: 0 },
        { c: [['公园', 0.44], ['爬山', 0.22], ['野餐', 0.14], ['散步', 0.1], ['海边', 0.06]], pick: 0 },
      ];
      for (;;) {
        tokens.reset(['今天', '天气', '很']);
        tokens.setCaption('输入');
        await run.wait(1400);
        for (let s = 0; s < STEPS.length; s++) {
          await run.gate();
          const step = STEPS[s];
          tokens.setCaption(`第 ${s + 1} 次预测 · 把整句重新读一遍`);
          const ps = tokens.tokenPositions();
          const jobs = ps.map((p, i) => packets.send({ from: p, to: world.surface(core, p, 0.9), color: COLOR.white, duration: 0.85, delay: i * 0.05, arc: -0.2, size: 0.7 }));
          await Promise.all(jobs);
          llm.think(1.1);
          await run.wait(700);
          tokens.showBars(step.c.map(([t, p]) => ({ t, p })));
          tokens.setCaption(step.note ?? `第 ${s + 1} 次预测 · 下一个 token 的概率`);
          await run.wait(1500);
          const at = tokens.pick(step.pick);
          await run.wait(500);
          await packets.send({ from: at, to: tokens.rowEndPosition(), color: COLOR.blue, duration: 0.8, arc: 0.6 });
          tokens.append(step.c[step.pick][0]);
          tokens.hideBars();
          await run.wait(600);
        }
        tokens.setCaption('一个字一个字地「接龙」，就生成了整句话');
        await run.wait(5000);
      }
    },
  },

  {
    id: 'context',
    nav: '上下文窗口',
    tag: 'CHAPTER 02 · CONTEXT',
    title: '模型只能看见<em>桌上这叠纸</em>',
    lead: '每次调用时送进模型的全部输入，叫作<b>上下文</b>（Context）。它通常由几部分拼成：系统提示词、可用工具的说明、之前的对话、你刚说的话。',
    points: [
      ['layers', '<b>容量有限</b>：以 token 计，比如 20 万。放不下时只能压缩、摘要或丢弃。'],
      ['database', '所谓"它记得我"，其实是外部程序把旧消息、记忆文件<b>重新放回</b>这叠纸里。'],
      ['tag', '放什么、怎么排，直接决定模型表现——这门手艺叫<b>上下文工程</b>。'],
    ],
    analogy: '专家的桌子只有这么大。每次递纸条，你都得把他需要的资料一并递进去——他不会自己记得上一张纸条写过什么。',
    camera: { pos: [-1.0, 3.0, 11.2], target: [-1.75, 0.55, 0.9] },
    layers: { llm: 1, context: 1 },
    widget(el, ctx) {
      ctx.meter = meter(el);
      ctx.meter.set(0, 200000);
      el.append(h('p', { class: 'w-note', html: '观察：第二轮提问时，<b>整叠纸都会再送一次</b>。对话越长，每次调用越贵、越慢——这就是为什么需要压缩。' }));
      replayButton(el, ctx);
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { stack, packets, core, surface } = world;
      const f = makeFlows(world, run);
      const upd = () => ctx.meter.set(stack.used, stack.limit);
      for (;;) {
        stack.clear();
        upd();
        await run.wait(600);
        const parts = [
          { text: '系统提示词 · 你是一个编程助手…', tokens: 3200, kind: 'system' },
          { text: '工具说明 · read_file, run_shell…', tokens: 6400, kind: 'system' },
          { text: '对话历史 · 前面聊过的 12 条消息', tokens: 21000 },
          { text: '你的消息 · 帮我看看这个报错', tokens: 180 },
        ];
        for (const p of parts) {
          await run.gate();
          stack.add(p);
          upd();
          await run.wait(900);
        }
        await f.feedContext();
        await f.think(1300);
        const out = stack.top();
        await packets.send({ from: surface(core, out, 0.95), to: out, color: COLOR.blue, duration: 1.0, label: '模型回复：这是因为变量未定义…', labelCls: 'reply' });
        stack.add({ text: '模型回复 · 已加入历史', tokens: 900 });
        upd();
        await run.wait(1400);
        await run.gate();
        stack.add({ text: '你的新消息 · 那怎么改？', tokens: 60 });
        upd();
        await run.wait(900);
        await f.feedContext();
        await f.think(1200);
        await packets.send({ from: surface(core, stack.top(), 0.95), to: stack.top(), color: COLOR.blue, duration: 1.0, label: '模型回复：把第 3 行改成…', labelCls: 'reply' });
        stack.add({ text: '模型回复 · 又加入历史', tokens: 700 });
        upd();
        await run.wait(1600);
        await run.gate();
        stack.compact(2, '历史摘要 · 压缩后的对话');
        await run.wait(800);
        upd();
        await run.wait(5000);
      }
    },
  },

  {
    id: 'tooluse',
    nav: '工具调用',
    tag: 'CHAPTER 03 · TOOL USE',
    title: '模型只会<em>「说」</em>要用工具，不会<em>「做」</em>',
    lead: '如果在上下文里写明"你可以使用 read_file 读取文件"，模型就可能输出一段特殊格式的文字。注意——<b>这仍然只是文字</b>。',
    points: [
      ['code', '<b>工具调用</b> = 模型输出的一段结构化文本（通常是 JSON）。'],
      ['wrench', '真正去执行的不是模型，而是外面的程序。'],
      ['loop', '这就是从 LLM 走向 Agent 的缺口：<b>谁来执行？谁来循环？谁来把关？</b>'],
    ],
    analogy: '专家在纸条上写：「请帮我查一下 login.js 的内容」。如果门外没有人，这句话就永远没人去办。',
    camera: { pos: [1.1, 2.3, 11.2], target: [1.7, 0.35, 0.4] },
    layers: { llm: 1, context: 0.35 },
    widget(el, ctx) {
      el.append(
        h('div', { class: 'code-card' }, [
          h('div', { class: 'code-head' }, '模型实际输出的内容'),
          h('pre', {
            html: '<span class="c-dim">我需要先看看登录页的代码。</span>\n{\n  <span class="c-key">"type"</span>: <span class="c-str">"tool_use"</span>,\n  <span class="c-key">"name"</span>: <span class="c-str">"read_file"</span>,\n  <span class="c-key">"input"</span>: { <span class="c-key">"path"</span>: <span class="c-str">"src/login.js"</span> }\n}',
          }),
        ]),
      );
      replayButton(el, ctx);
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { packets, core, surface, llm } = world;
      const calls = ['read_file("src/login.js")', 'run_shell("npm test")', 'web_search("报错信息")'];
      let k = 0;
      for (;;) {
        await run.gate();
        llm.think(1.2);
        await run.wait(1000);
        const end = V(3.5, 0.9 - (k % 3) * 0.7, 1.0);
        await packets.send({ from: surface(core, end, 1.0), to: end, color: COLOR.blue, duration: 1.4, arc: 0.4, label: calls[k % 3], labelCls: 'code' });
        // 没有执行者：信号在半路散掉
        const spots = Array.from({ length: 7 }, () => end.clone().add(V((Math.random() - 0.3) * 1.1, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1)));
        spots.forEach((p, i) => packets.send({ from: end, to: p, color: COLOR.gray, duration: 0.9, delay: i * 0.03, arc: 0.2, size: 0.5 }));
        await packets.send({ from: end, to: end.clone().add(V(0.1, 0.8, 0)), color: COLOR.gray, duration: 1.6, arc: 0, size: 0.01, label: '…没有人执行', labelCls: 'lost' });
        k++;
        await run.wait(1400);
      }
    },
  },

  {
    id: 'harness',
    nav: 'Harness 运行框架',
    tag: 'CHAPTER 04 · HARNESS',
    title: 'Harness：给大脑装上<em>身体与规矩</em>',
    lead: 'Harness（原意是"马具/挽具"）是包在模型外面的那层软件。它组织上下文、解析并真正执行工具调用、把结果喂回去、决定何时停止、守住安全边界。<b>点击下面任一模块</b>看它在哪里。',
    points: [],
    analogy: '如果 LLM 是发动机，Harness 就是底盘、变速箱、方向盘和刹车。同一台发动机装进不同的车，跑出来的表现可以天差地别。',
    examples: '代表产品：Claude Code、Codex CLI、Cursor 的 Agent 模式。开发者框架：Claude Agent SDK、OpenAI Agents SDK、LangGraph。',
    camera: { pos: [0.4, 9.6, 14.8], target: [-0.2, -0.6, 0] },
    layers: { llm: 1, context: 1, harness: 1, tools: 0.3 },
    widget(el, ctx) {
      const mods = [
        ['loop', 'loop', '智能体循环', '反复调用模型，直到任务完成'],
        ['ctxm', 'layers', '上下文管理', '拼装提示词，压缩过长的历史'],
        ['runtime', 'wrench', '工具执行器', '解析 tool_call，真正去执行'],
        ['guard', 'shield', '权限与沙箱', '危险操作先确认，限制可触碰范围'],
        ['memory', 'database', '记忆', '把要点写进文件，下次再读回'],
        ['skills', 'zap', '技能与钩子', '按需加载的说明书与自动化规则'],
      ];
      const list = h('div', { class: 'mod-list' });
      for (const [id, icon, name, desc] of mods) {
        list.append(
          h(
            'button',
            {
              class: 'mod-item',
              onmouseenter: () => ctx.world.harness.setActive(id, true),
              onmouseleave: () => ctx.world.harness.setActive(id, false),
              onclick: () => ctx.ui.showInfo(id),
            },
            [h('span', { class: 'mod-ico', html: iconSvg(icon, 16) }), h('span', { class: 'mod-txt' }, [h('b', {}, name), h('small', {}, desc)])],
          ),
        );
      }
      el.append(list);
      el.append(h('p', { class: 'w-note', html: '同一个模型，换一个 Harness，能力可以天差地别——这也是各家 Agent 产品真正较劲的地方。' }));
    },
    enter(ctx) {
      ctx.world.harness.assemble();
    },
    async run(ctx) {
      await ctx.run.wait(3200);
      await ambient(ctx, { slow: true });
    },
  },

  {
    id: 'loop',
    nav: 'Agent 循环实况',
    tag: 'CHAPTER 05 · AGENT LOOP',
    title: '看一个 Agent <em>怎样把事做完</em>',
    lead: '任务：<b>「登录页点按钮没反应，帮我修好」</b>。观察 Harness 如何一轮轮地：组装上下文 → 让模型思考 → 执行它要的工具 → 把结果放回上下文 → 再思考……',
    points: [],
    analogy: '关键在于：<b>下一步做什么，是模型看完结果后自己决定的</b>，没有人提前写好步骤。测试失败了，它会自己读报错、再改一次。',
    camera: { pos: [1.2, 15.5, 17.0], target: [0.2, -1.0, 0.8] },
    layers: { llm: 1, context: 1, harness: 1, tools: 1 },
    widget(el, ctx) {
      const bar = h('div', { class: 'ctrl' });
      const play = h('button', { class: 'btn btn-sm btn-primary', onclick: () => toggle() });
      const step = h('button', { class: 'btn btn-sm', onclick: () => ctx.run.step(), html: `${iconSvg('step', 14)}单步` });
      const again = h('button', { class: 'btn btn-sm', onclick: () => ctx.restart(), html: `${iconSvg('replay', 14)}重播` });
      const round = h('span', { class: 'round tabular' }, '第 0 轮');
      bar.append(play, step, again, round);
      el.append(bar);
      const setPlay = () => (play.innerHTML = ctx.run.paused ? `${iconSvg('play', 14)}继续` : `${iconSvg('pause', 14)}暂停`);
      const toggle = () => {
        ctx.run.setPaused(!ctx.run.paused);
        setPlay();
      };
      setPlay();
      ctx.syncPlay = setPlay;
      ctx.round = (n) => (round.textContent = `第 ${n} 轮`);
      ctx.meter = meter(el);
      ctx.log = logPanel(el);
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { stack, harness, packets, core, surface } = world;
      const f = makeFlows(world, run);
      const upd = () => ctx.meter.set(stack.used, stack.limit);
      const log = (k, t) => ctx.log.add(k, t);
      const gate = async () => {
        await run.gate();
        ctx.syncPlay?.();
      };
      let n = 0;
      const round = async (thought) => {
        n++;
        ctx.round(n);
        harness.setLoopLabel(`智能体循环 · 第 ${n} 轮`);
        harness.setActive('loop', true);
        harness.lap(1.3);
        await f.feedContext({ fast: true });
        harness.setActive('loop', false);
        log('think', `<b>第 ${n} 轮 · 模型思考</b>　${thought}`);
        await f.think(1200);
      };

      stack.clear();
      ctx.log.clear();
      stack.add({ text: '系统提示词 + 工具说明', tokens: 9600, kind: 'system', animate: false });
      upd();
      await run.wait(700);

      await gate();
      const userAt = V(-1.5, 3.6, 7.5);
      log('user', '<b>用户</b>　登录页点按钮没反应，帮我修好');
      await packets.send({ from: userAt, to: stack.top(), color: COLOR.white, duration: 1.2, label: '登录页点按钮没反应，帮我修好', labelCls: 'reply' });
      stack.add({ text: '用户：登录页按钮没反应', tokens: 40 });
      upd();

      await gate();
      log('harness', '<b>Harness</b>　读取项目记忆 CLAUDE.md、加载相关技能');
      harness.setActive('memory', true);
      harness.setActive('skills', true);
      await Promise.all([
        packets.send({ from: harness.pos('memory'), to: stack.top(), color: COLOR.white, duration: 1.0 }),
        packets.send({ from: harness.pos('skills'), to: stack.top(), color: COLOR.white, duration: 1.3, curve: f.arcAround(harness.pos('skills'), stack.top()) }),
      ]);
      harness.setActive('memory', false);
      harness.setActive('skills', false);
      stack.add({ text: '项目记忆 + 技能说明', tokens: 2400, kind: 'system' });
      upd();

      await gate();
      await round('先看看登录页的代码');
      log('call', '→ 调用 <code>read_file("src/login.js")</code>');
      await f.callTool('files', { call: 'read_file("src/login.js")', result: '← 120 行代码', slabText: '结果：login.js 源码', resultTokens: 3800 });
      log('result', '← 返回 login.js 的 120 行代码');
      upd();

      await gate();
      await round('按钮调用了 handleSubmit，它定义在哪？');
      log('call', '→ 调用 <code>grep("handleSubmit")</code>');
      await f.callTool('search', { call: 'grep("handleSubmit")', result: '← auth.js 第 42 行', slabText: '结果：auth.js:42', resultTokens: 600 });
      log('result', '← 找到 <code>src/auth.js:42</code>');
      upd();

      await gate();
      await round('事件写成了 onclick，React 里应为 onClick');
      log('call', '→ 调用 <code>edit_file("src/auth.js")</code>');
      await f.callTool('files', {
        call: 'edit_file("src/auth.js")',
        result: '← 已修改 1 处',
        slabText: '结果：auth.js 已修改',
        resultTokens: 400,
        check: async () => {
          log('warn', '<b>权限检查</b>　修改文件需要确认……');
          await run.wait(1300);
          log('ok', '✓ 用户已允许');
        },
      });
      upd();

      await gate();
      await round('跑一下测试，确认真的修好了');
      log('call', '→ 调用 <code>run_shell("npm test")</code>');
      await f.callTool('shell', { call: 'run_shell("npm test")', result: '✗ 2 个测试失败', slabText: '结果：2 个测试失败', resultTokens: 2100, resultColor: COLOR.red, toolColor: COLOR.red });
      log('err', '← <b>2 个测试失败</b>：空表单提交时未做校验');
      upd();

      await gate();
      await round('看报错：还少了空表单校验，补上');
      log('call', '→ 调用 <code>edit_file("src/auth.js")</code>');
      await f.callTool('files', { call: 'edit_file("src/auth.js")', result: '← 已修改 2 处', slabText: '结果：补上表单校验', resultTokens: 500 });
      log('result', '← 补上了空值校验');
      upd();

      await gate();
      await round('再跑一次测试');
      log('call', '→ 调用 <code>run_shell("npm test")</code>');
      await f.callTool('shell', { call: 'run_shell("npm test")', result: '✓ 24 个测试全部通过', slabText: '结果：测试全部通过', resultTokens: 900, resultColor: COLOR.green, toolColor: COLOR.green });
      log('ok', '← <b>24 个测试全部通过</b>');
      upd();

      await gate();
      await round('任务完成，不再需要调用工具');
      const out = userAt;
      await packets.send({ from: surface(core, out, 1.0), to: out, color: COLOR.blue, duration: 1.4, label: '已修复：事件名写错 + 缺少表单校验', labelCls: 'reply' });
      log('final', '<b>回复用户</b>　已修复：事件名大小写错误，并补上了空表单校验，测试全部通过。');
      log('harness', `循环结束：共 ${n} 轮、6 次工具调用。模型没有再请求工具，Harness 就停下了。`);
      harness.setLoopLabel('智能体循环 · 已完成');
      ctx.syncPlay?.();
      await run.wait(1e9);
    },
  },

  {
    id: 'agent',
    nav: 'Agent 智能体',
    tag: 'CHAPTER 06 · AGENT',
    title: 'Agent = <em>模型 + Harness</em>，指向一个目标',
    lead: '把镜头拉远：会思考的模型、驱动它的循环、可调用的工具、记忆与规矩——合在一起，才叫 <b>Agent</b>（智能体）。',
    points: [],
    analogy: '一位能独立干活的员工：有脑子（LLM），有工位和工作流程（Harness），有电脑和各种软件（工具）。领了任务，就能自己推进，遇到问题自己想办法。',
    camera: { pos: [10, 9.5, 19], target: [0.8, -0.2, 0] },
    layers: { llm: 1, context: 1, harness: 1, tools: 1, aura: 1 },
    widget(el) {
      el.append(
        h('div', { class: 'formula' }, [
          h('span', { class: 'f-chip' }, 'LLM'),
          h('i', {}, '+'),
          h('span', { class: 'f-chip' }, 'Harness'),
          h('i', {}, '+'),
          h('span', { class: 'f-chip' }, '工具'),
          h('i', {}, '+'),
          h('span', { class: 'f-chip' }, '目标'),
          h('i', {}, '='),
          h('span', { class: 'f-chip on' }, 'Agent'),
        ]),
      );
      el.append(h('div', { class: 'w-sub' }, '三种用法，自主程度递增'));
      const rows = [
        ['单次调用', '问一句、答一句。翻译、总结、写一段文案。', 1],
        ['工作流 Workflow', '步骤由人写死：先 A 再 B 再 C，模型只负责填空。', 2],
        ['Agent', '步骤由模型自己决定，看结果再决定下一步，直到完成目标。', 3],
      ];
      for (const [name, desc, lv] of rows) {
        el.append(
          h('div', { class: `spec ${lv === 3 ? 'on' : ''}` }, [
            h('div', { class: 'spec-bars' }, [1, 2, 3].map((i) => h('i', { class: i <= lv ? 'f' : '' }))),
            h('div', {}, [h('b', {}, name), h('small', {}, desc)]),
          ]),
        );
      }
      el.append(h('p', { class: 'w-note', html: '一个 Agent 能做多好 ≈ <b>模型的智力 × Harness 的设计 × 工具的丰富程度</b>。三者缺一不可。' }));
    },
    async run(ctx) {
      await ambient(ctx);
    },
  },

  {
    id: 'bot',
    nav: 'Bot 机器人',
    tag: 'CHAPTER 07 · BOT',
    title: 'Bot：对外<em>营业的窗口</em>',
    lead: '<b>Bot</b> 强调的是"形态"而不是"原理"：它住在某个渠道里（微信、Slack、飞书、网页），有名字和头像，收到消息就回应。它背后的大脑可以是三种之一——<b>切换看看</b>：',
    points: [],
    analogy: 'Bot 像银行的营业窗口。窗口后面可能是一本操作手册（规则），可能是一位只会答疑的咨询员（LLM），也可能是一位能直接帮你把业务办完的柜员（Agent）。',
    camera: { pos: [-6.8, 10.5, 27], target: [-6.6, -0.6, 0] },
    layers: { llm: 1, context: 1, harness: 1, tools: 1, bot: 1, aura: 0.4 },
    widget(el, ctx) {
      const modes = [
        ['rule', '规则 Bot'],
        ['chat', 'LLM 聊天 Bot'],
        ['agent', 'Agent Bot'],
      ];
      const seg = h('div', { class: 'seg' });
      const desc = h('p', { class: 'w-note mode-desc' });
      const DESC = {
        rule: '<b>规则 Bot</b>：关键词匹配 + 写死的流程，不用 LLM。可控、便宜，但问题一超出规则就答不上来。',
        chat: '<b>LLM 聊天 Bot</b>：把消息直接交给 LLM，一问一答。很会聊天，但<b>不能真的办事</b>——它没有工具，也没有循环。',
        agent: '<b>Agent Bot</b>：消息交给一个完整的 Agent。它能查日历、调用系统，把事办完再回复你。',
      };
      for (const [m, name] of modes) {
        seg.append(h('button', { class: ctx.state.mode === m ? 'active' : '', onclick: () => ctx.setState({ mode: m }) }, name));
      }
      desc.innerHTML = DESC[ctx.state.mode];
      el.append(seg, desc);
      ctx.chat = chatPanel(el);
      el.append(h('p', { class: 'w-note', html: '所以 Bot 和 Agent 不是对立的：<b>Agent 讲内在能力，Bot 讲对外形态</b>。Agent 可以没有 Bot 外壳（比如在终端里跑），Bot 也可以根本没有 Agent。' }));
    },
    initialState: { mode: 'agent' },
    enter(ctx) {
      const mode = ctx.state.mode;
      ctx.world.bot.setMode(mode);
      const dim = mode === 'agent' ? 1 : 0.12;
      ctx.world.show({ llm: 1, context: dim, harness: dim, tools: dim, bot: 1, aura: mode === 'agent' ? 0.4 : 0 }, 0.8);
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { bot, packets, core, surface, harness, stack } = world;
      const f = makeFlows(world, run);
      const mode = ctx.state.mode;
      const msgs = [
        { ch: 'wechat', q: '你们几点营业？' },
        { ch: 'slack', q: '帮我订明天上午的会议室' },
      ];
      if (mode === 'agent') {
        stack.clear();
        stack.add({ text: '系统提示词 + 工具说明', tokens: 8000, kind: 'system', animate: false });
      }
      for (;;) {
        ctx.chat.clear();
        for (const m of msgs) {
          await run.gate();
          const ch = bot.channels[m.ch];
          ctx.chat.add('user', `<small>${ch.def.name}</small>${m.q}`);
          bot.pulseChannel(m.ch, true);
          await packets.send({ from: ch.position, to: bot.gate, color: COLOR.white, duration: 1.1, curve: ch.curve, label: m.q, labelCls: 'reply' });
          bot.pulseChannel(m.ch, false);
          bot.pulseGate();
          const typing = ctx.chat.typing();
          let reply;
          let cls = '';
          if (mode === 'rule') {
            await packets.send({ from: bot.gate, to: bot.rulesPos, color: COLOR.white, duration: 0.8, curve: bot.ruleCurve });
            bot.pulseRules(m.q.includes('营业') ? COLOR.blue : COLOR.orange);
            await run.wait(700);
            reply = m.q.includes('营业') ? '您好！营业时间为每天 9:00–18:00。' : '抱歉，我没有理解您的问题。您可以回复「人工」转接客服。';
            cls = m.q.includes('营业') ? '' : 'warn';
            await packets.send({ from: bot.rulesPos, to: bot.gate, color: COLOR.blue, duration: 0.8, arc: -0.4 });
          } else if (mode === 'chat') {
            await packets.send({ from: bot.gate, to: surface(core, bot.gate, 1.0), color: COLOR.white, duration: 1.3, curve: bot.llmCurve });
            await f.think(1300);
            reply = m.q.includes('营业')
              ? '一般来说营业时间以官方公布为准哦，我无法查询实时信息，建议您查看官网。'
              : '好的！你可以打开公司的会议室预订系统，选择明天上午的时段……（但我没法替你订）';
            cls = m.q.includes('营业') ? '' : 'warn';
            await packets.send({ from: surface(core, bot.gate, 1.0), to: bot.gate, color: COLOR.blue, duration: 1.3, curve: reverse(bot.llmCurve) });
          } else {
            await packets.send({ from: bot.gate, to: stack.top(), color: COLOR.white, duration: 1.4, curve: bot.agentCurve });
            stack.add({ text: `用户：${m.q}`, tokens: 60 });
            harness.setActive('loop', true);
            await f.feedContext({ fast: true });
            await f.think(1000);
            harness.setActive('loop', false);
            if (m.q.includes('营业')) {
              await f.callTool('browser', { call: 'web_search("营业时间")', result: '← 官网：9:00–21:00', slabText: '结果：营业时间', resultTokens: 800 });
              reply = '查到了：门店营业时间为每天 9:00–21:00，周末同样营业。';
            } else {
              await f.callTool('mcp', { call: 'calendar.find_free_room()', result: '← 3 号会议室空闲', slabText: '结果：空闲会议室', resultTokens: 500 });
              await f.think(800);
              await f.callTool('mcp', { call: 'calendar.book(3号, 9:00)', result: '✓ 预订成功', slabText: '结果：预订成功', resultTokens: 300, resultColor: COLOR.green, toolColor: COLOR.green });
              reply = '已为你预订明天 9:00–10:00 的 3 号会议室，并发送了日历邀请 ✓';
              cls = 'ok';
            }
            await f.think(700);
            await packets.send({ from: stack.top(), to: bot.gate, color: COLOR.blue, duration: 1.4, curve: reverse(bot.agentCurve) });
          }
          bot.pulseGate();
          typing.remove();
          ctx.chat.add('bot', reply, cls);
          await packets.send({ from: bot.gate, to: ch.position, color: COLOR.blue, duration: 1.0, curve: reverse(ch.curve) });
          await run.wait(1500);
        }
        await run.wait(3500);
        if (mode === 'agent') stack.compact(1, '历史摘要');
      }
    },
  },

  {
    id: 'multi',
    nav: '多智能体',
    tag: 'CHAPTER 08 · MULTI-AGENT',
    title: '一个 Agent 不够？<em>组个团队</em>',
    lead: '任务太大时，主 Agent 可以把子任务派给 <b>子 Agent</b>（Subagent）。每个子 Agent 都有自己独立、干净的上下文和循环，做完只交回一份摘要。',
    points: [
      ['users', '<b>并行</b>：调研、编码、测试可以同时推进。'],
      ['layers', '<b>隔离</b>：子 Agent 读了 200 个文件，主 Agent 只收到几行结论，上下文不会被撑爆。'],
      ['zap', '<b>专长</b>：不同子 Agent 可以配不同的提示词、工具，甚至不同的模型。'],
    ],
    analogy: '项目经理不会亲自读完所有资料。他把调研、开发、测试分给不同同事，最后只听每个人的汇报，再做决策。',
    camera: { pos: [0.5, 9.5, 22], target: [0, 3.2, 0] },
    layers: { llm: 1, context: 0.6, harness: 1, tools: 0.3, subagents: 1 },
    widget(el, ctx) {
      ctx.log = logPanel(el);
      replayButton(el, ctx);
    },
    enter(ctx) {
      ctx.world.subs.spawn();
    },
    async run(ctx) {
      const { world, run } = ctx;
      const { subs, packets, stack, harness } = world;
      const f = makeFlows(world, run);
      const ids = Object.keys(subs.items);
      const top = V(0, 1.5, 0);
      await run.wait(2200);
      for (;;) {
        ctx.log.clear();
        stack.clear();
        stack.add({ text: '主 Agent 上下文', tokens: 12000, kind: 'system', animate: false });
        await run.gate();
        ctx.log.add('think', '<b>主 Agent</b>　任务太大，拆成三份，交给子 Agent 并行处理');
        await f.think(1200);
        harness.setActive('loop', true);
        await Promise.all(
          ids.map((id, i) =>
            packets.send({ from: top, to: subs.pos(id).add(V(0, -0.4, 0)), color: COLOR.blue, duration: 1.3, delay: i * 0.2, curve: subs.items[id].curve, label: ['派活：调研现有实现', '派活：重写登录模块', '派活：补充测试'][i], labelCls: 'code' }),
          ),
        );
        harness.setActive('loop', false);
        ctx.log.add('call', '→ 派出 3 个子 Agent，每个都从<b>空白上下文</b>开始');
        await Promise.all(ids.map((id, i) => subs.work(id, 2.6 + i * 0.8)));
        ctx.log.add('result', '子 Agent 们各自跑了几十轮循环，读写了大量内容……');
        await Promise.all(
          ids.map((id, i) =>
            packets.send({ from: subs.pos(id).add(V(0, -0.4, 0)), to: top, color: COLOR.green, duration: 1.3, delay: i * 0.25, curve: reverse(subs.items[id].curve), label: '摘要 ✓', labelCls: 'result' }),
          ),
        );
        ids.forEach((_, i) => stack.add({ text: ['摘要：现有实现的 3 个问题', '摘要：新登录模块已完成', '摘要：新增 18 个测试，全部通过'][i], tokens: 400 }));
        ctx.log.add('ok', '← 主 Agent 只收到 3 份几百字的摘要，自己的上下文依然清爽');
        await f.think(1000);
        ctx.log.add('final', '<b>主 Agent</b>　汇总结论，回复用户');
        await run.wait(6000);
      }
    },
  },

  {
    id: 'explore',
    nav: '全景 · 自由探索',
    tag: 'EPILOGUE · 全景',
    title: '现在，<em>再看一遍这张地图</em>',
    lead: '一句话记住它们：<b>LLM 负责想，Harness 负责做，Agent 是两者合体后的「能干活」，Bot 是它面向人群的「门面」。</b>随意拖动、点击任何部件。',
    points: [],
    camera: { pos: [14, 14, 30], target: [-3.4, 1.6, 0] },
    layers: { llm: 1, context: 1, harness: 1, tools: 1, bot: 1, subagents: 1, aura: 0.35 },
    rotate: true,
    widget(el, ctx) {
      const rows = [
        ['llm', 'LLM', '预测下一个 token 的模型', '大脑'],
        ['context', '上下文', '每次调用时模型能看到的全部输入', '桌上的资料'],
        ['files', '工具', '模型可以请求调用的外部能力', '双手与工具箱'],
        ['loop', 'Harness', '驱动循环、执行工具、管理上下文与安全的软件', '身体、流程与规章'],
        ['agent', 'Agent', 'LLM + Harness，能自主完成目标', '能独立干活的员工'],
        ['bot', 'Bot', '驻留在某个渠道、对外交互的形态', '营业窗口'],
        ['subagent', '多智能体', '多个 Agent 分工协作', '一个团队'],
      ];
      const table = h('div', { class: 'sum' }, [h('div', { class: 'sum-row sum-head' }, [h('span', {}, '概念'), h('span', {}, '是什么'), h('span', {}, '类比')])]);
      for (const [id, name, what, like] of rows) {
        table.append(h('button', { class: 'sum-row', onclick: () => ctx.ui.showInfo(id) }, [h('b', {}, name), h('span', {}, what), h('span', { class: 'like' }, like)]));
      }
      el.append(table);
    },
    enter(ctx) {
      ctx.world.subs.settle();
    },
    async run(ctx) {
      await ambient(ctx);
    },
  },
];

function reverse(curve) {
  const pts = curve.getPoints(40).reverse();
  return new THREE.CatmullRomCurve3(pts);
}

// 背景活动：模型和工具之间零星的信息往来，让场景"活着"
async function ambient(ctx, { slow = false } = {}) {
  const { world, run } = ctx;
  const { packets, core, surface, harness, tools, stack } = world;
  const ids = Object.keys(tools.items);
  for (;;) {
    await run.wait(slow ? 2400 : 1500);
    if ((world.layers.harness.userData.fade ?? 0) < 0.5) continue;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const rt = harness.pos('runtime');
    llm(world);
    await packets.send({ from: surface(core, rt, 1.0), to: rt, color: COLOR.blue, duration: 0.8, size: 0.8 });
    harness.pulse('runtime', COLOR.blue, 0.4);
    await packets.send({ from: rt, to: tools.pos(id), color: COLOR.blue, duration: 0.8, arc: 0.3, size: 0.8 });
    tools.setActive(id, true);
    await run.wait(350);
    tools.setActive(id, false);
    await packets.send({ from: tools.pos(id), to: rt, color: COLOR.white, duration: 0.8, arc: -0.2, size: 0.8 });
    await packets.send({ from: rt, to: stack.top(), color: COLOR.white, duration: 1.0, size: 0.8, curve: makeFlows(world, run).arcAround(rt, stack.top()) });
    harness.pulse('ctxm', COLOR.blue, 0.4);
    await packets.send({ from: stack.top(), to: surface(core, stack.top(), 0.9), color: COLOR.white, duration: 0.8, size: 0.8 });
  }
}

function llm(world) {
  world.llm.think(0.8);
}
