import './styles/tokens.css';
import './styles/app.css';
import { createStage } from './core/stage.js';
import { Run, Cancelled } from './core/fx.js';
import { iconSvg } from './core/icons.js';
import { createWorld } from './world/index.js';
import { CHAPTERS } from './story/chapters.js';
import { createUI } from './ui/ui.js';

const stage = createStage(document.getElementById('stage'));
const world = createWorld(stage);

// 不自己管理上下文叠层的章节，显示一叠默认内容
function defaultStack() {
  world.stack.clear();
  world.stack.add({ text: '系统提示词 + 工具说明', tokens: 9600, kind: 'system', animate: false });
  world.stack.add({ text: '对话历史', tokens: 14000, animate: false });
  world.stack.add({ text: '工具结果', tokens: 3200, kind: 'result', animate: false });
}
const OWNS_STACK = new Set(['context', 'loop', 'bot', 'multi']);

let index = -1;
let run = null;
const states = CHAPTERS.map((c) => ({ ...(c.initialState || {}) }));
let autoRotate = true;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ui = createUI({ chapters: CHAPTERS, onGo: (i) => go(i) });

function makeCtx(i) {
  const ctx = {
    world,
    ui,
    run,
    state: states[i],
    restart: () => start(i, { keepCamera: true }),
    setState: (patch) => {
      Object.assign(states[i], patch);
      start(i, { keepCamera: true });
    },
  };
  return ctx;
}

function start(i, { keepCamera = false } = {}) {
  const c = CHAPTERS[i];
  run?.cancel();
  world.reset();
  run = new Run();
  const ctx = makeCtx(i);

  world.show(c.layers);
  if (!OWNS_STACK.has(c.id)) defaultStack();
  if (c.id !== 'llm') world.tokens.reset([]);
  if (c.id !== 'bot') world.bot.setMode('all');

  if (keepCamera) ui.renderWidget(i, ctx);
  else ui.renderChapter(i, ctx);
  c.enter?.(ctx);
  stage.controls.autoRotate = !!c.rotate && autoRotate && !reduceMotion;

  const myRun = run;
  c.run?.(ctx).catch((e) => {
    if (!(e instanceof Cancelled)) console.error(e);
  });
  return myRun;
}

function go(i) {
  if (i < 0 || i >= CHAPTERS.length || i === index) return;
  index = i;
  const c = CHAPTERS[i];
  ui.hideInfo();
  stage.flyTo(cameraFor(c), c.camera.target, index === 0 && !go.started ? 3.2 : 2.2);
  go.started = true;
  document.body.dataset.ch = c.id;
  start(i);
  history.replaceState(null, '', `#${c.id}`);
}

// 竖屏时画面更窄，镜头相应后退
function cameraFor(c) {
  const [px, py, pz] = c.camera.pos;
  const [tx, ty, tz] = c.camera.target;
  const k = window.innerWidth < 760 ? 1.9 : 1;
  return [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k];
}

/* 侧栏宽度 → 画面中心偏移 */
function layoutShift() {
  const w = window.innerWidth;
  if (w < 760) return stage.setShift(0, window.innerHeight * 0.18);
  const left = w >= 1180 ? 88 : 0;
  const right = 412;
  stage.setShift((left - right) / 2);
}
window.addEventListener('resize', layoutShift);
layoutShift();

/* 点击 / 悬停三维部件 */
const canvas = stage.renderer.domElement;
let downAt = null;
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const hit = stage.pick(e.clientX, e.clientY, world.pickables()) || stage.pick(e.clientX, e.clientY, [world.aura]);
  if (hit?.object.userData.info) ui.showInfo(hit.object.userData.info);
  else ui.hideInfo();
});
let hoverRaf = 0;
canvas.addEventListener('pointermove', (e) => {
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    const hit = stage.pick(e.clientX, e.clientY, world.pickables());
    canvas.style.cursor = hit?.object.userData.info ? 'pointer' : '';
  });
});
// 用户手动拖动时暂停自动旋转，松手几秒后恢复
stage.controls.addEventListener('start', () => {
  stage.controls.autoRotate = false;
  clearTimeout(layoutShift.t);
});
stage.controls.addEventListener('end', () => {
  clearTimeout(layoutShift.t);
  layoutShift.t = setTimeout(() => {
    stage.controls.autoRotate = !!CHAPTERS[index]?.rotate && autoRotate && !reduceMotion;
  }, 4000);
});

/* 键盘 */
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') go(index + 1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(index - 1);
  if (e.key === 'Escape') ui.hideInfo();
});

/* 顶栏按钮 */
const btnRotate = document.getElementById('btn-rotate');
const btnLabels = document.getElementById('btn-labels');
btnRotate.innerHTML = iconSvg('rotate', 17);
btnLabels.innerHTML = iconSvg('tag', 17);
btnRotate.classList.toggle('on', autoRotate);
btnLabels.classList.add('on');
btnRotate.addEventListener('click', () => {
  autoRotate = !autoRotate;
  btnRotate.classList.toggle('on', autoRotate);
  stage.controls.autoRotate = !!CHAPTERS[index]?.rotate && autoRotate;
});
btnLabels.addEventListener('click', () => {
  const on = !document.body.classList.toggle('no-labels');
  btnLabels.classList.toggle('on', on);
});

/* 启动 */
const fromHash = CHAPTERS.findIndex((c) => `#${c.id}` === location.hash);
go(fromHash >= 0 ? fromHash : 0);
stage.firstFrame.then(() => {
  document.getElementById('loading').classList.add('done');
  const hint = document.getElementById('hint');
  hint.classList.add('show');
  setTimeout(() => hint.classList.remove('show'), 6500);
});

// 调试用
window.__agentViz = {
  stage,
  world,
  go,
  // 快进：逐帧推进，并让章节脚本的 await 有机会继续执行
  async ff(seconds, fps = 30) {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) {
      stage.advance(1 / fps, fps);
      for (let k = 0; k < 12; k++) await 0;
    }
  },
};
