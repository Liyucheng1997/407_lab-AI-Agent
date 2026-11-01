// 把所有三维部件装配成一个世界，并提供常用的位置锚点
import * as THREE from 'three';
import { createLLM } from './llm.js';
import { createTokenDemo } from './tokens.js';
import { createContextStack } from './context.js';
import { createHarness } from './harness.js';
import { createTools } from './tools.js';
import { createBot } from './bot.js';
import { createSubagents } from './subagents.js';
import { createEnvironment } from './environment.js';
import { createPackets } from './packets.js';
import { applyFade, fadeTo } from '../core/fx.js';

export function createWorld(stage) {
  const env = createEnvironment(stage);
  const llm = createLLM(stage);
  const tokens = createTokenDemo(stage);
  const harness = createHarness(stage);
  // 上下文叠层悬浮在"上下文管理"模块上方
  const stack = createContextStack(stage, harness.pos('ctxm').add(new THREE.Vector3(0.2, 0.75, 0.1)));
  const tools = createTools(stage);
  const bot = createBot(stage);
  const subs = createSubagents(stage);
  const packets = createPackets(stage);

  const layers = {
    llm: llm.group,
    tokens: tokens.group,
    context: stack.group,
    harness: harness.group,
    tools: tools.group,
    bot: bot.group,
    subagents: subs.group,
    aura: env.aura,
  };
  for (const g of Object.values(layers)) applyFade(g, 0);

  // 让一组图层同时过渡到目标透明度；未列出的图层淡出
  function show(spec, duration = 1.0) {
    for (const [name, g] of Object.entries(layers)) {
      const v = spec[name] ?? 0;
      if (g.userData.fadeTarget === v) continue;
      g.userData.fadeTarget = v;
      fadeTo(g, v, duration);
    }
  }

  const core = llm.position;
  // 从 a 指向 b、落在半径 r 球面上的点（数据包从球体表面出发更好看）
  const surface = (center, toward, r = 1.0) => center.clone().add(toward.clone().sub(center).normalize().multiplyScalar(r));

  const reset = () => {
    packets.clear();
    harness.resetAll();
    tools.resetAll();
    harness.setLoopLabel('智能体循环');
  };

  return {
    stage,
    env,
    llm,
    tokens,
    stack,
    harness,
    tools,
    bot,
    subs,
    packets,
    layers,
    show,
    core,
    surface,
    reset,
    pickables: () => [...llm.pickables, ...harness.pickables, ...tools.pickables, ...bot.pickables, ...subs.pickables, ...stack.pickables()],
    aura: env.auraMesh,
  };
}
