// 章节脚本用到的"信息流"动作：送进模型、模型思考、调用工具、结果回填……
import * as THREE from 'three';
import { COLOR } from '../core/fx.js';

export function makeFlows(world, run) {
  const { packets, llm, stack, harness, tools, surface, core } = world;
  const wait = (ms) => run.wait(ms);

  // 上下文整叠送进模型
  async function feedContext({ fast = false } = {}) {
    const from = stack.slabPositions();
    stack.flash();
    const target = surface(core, stack.top(), 0.9);
    const jobs = from.map((p, i) => packets.send({ from: p, to: target, color: COLOR.white, duration: fast ? 0.7 : 1.0, delay: i * (fast ? 0.03 : 0.06), arc: 0.5, size: 0.8 }));
    harness.setActive('ctxm', true);
    await Promise.all(jobs);
    harness.setActive('ctxm', false);
    run.check();
  }

  async function think(ms = 1200) {
    llm.think(ms / 1000);
    await wait(ms);
  }

  // 模型 → 执行器 → (权限) → 工具 → 执行器 → 上下文
  async function callTool(toolId, { call, result, resultTokens = 1500, resultKind = 'result', check = null, resultColor = COLOR.white, slabText, toolColor = COLOR.blue } = {}) {
    const rt = harness.pos('runtime');
    await packets.send({ from: surface(core, rt, 1.0), to: rt.clone().setY(0.3), color: COLOR.blue, duration: 0.9, label: call, labelCls: 'code' });
    run.check();
    harness.setActive('runtime', true);
    if (check) {
      const g = harness.pos('guard');
      await packets.send({ from: rt, to: g, color: COLOR.orange, duration: 0.6, arc: 0.3 });
      harness.setActive('guard', true, COLOR.orange);
      await check();
      harness.setActive('guard', true, COLOR.green);
      await wait(500);
      harness.setActive('guard', false);
      await packets.send({ from: g, to: tools.pos(toolId), color: COLOR.blue, duration: 0.8, arc: 0.3 });
    } else {
      await packets.send({ from: rt, to: tools.pos(toolId), color: COLOR.blue, duration: 0.8, arc: 0.3 });
    }
    run.check();
    tools.setActive(toolId, true, toolColor);
    await wait(650);
    await packets.send({ from: tools.pos(toolId), to: rt, color: resultColor, duration: 0.8, arc: -0.2, label: result, labelCls: 'result' });
    tools.setActive(toolId, false);
    run.check();
    await packets.send({ from: rt, to: stack.top(), color: resultColor, duration: 1.1, curve: arcAround(rt, stack.top()) });
    harness.setActive('runtime', false);
    run.check();
    stack.add({ text: slabText ?? result, tokens: resultTokens, kind: resultKind });
    harness.pulse('ctxm', COLOR.blue, 0.5);
  }

  // 绕开核心、从前方经过的弧线
  function arcAround(a, b) {
    const mid = a.clone().lerp(b, 0.5);
    mid.z += 3.2;
    mid.y += 1.2;
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }

  return { wait, feedContext, think, callTool, arcAround };
}
