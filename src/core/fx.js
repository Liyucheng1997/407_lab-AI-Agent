// 通用小工具：淡入淡出、标签、图标贴图、辉光贴图、可取消的脚本运行
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { ICONS, iconSvg } from './icons.js';

export const COLOR = {
  blue: 0x0a84ff,
  white: 0xf5f5f7,
  gray: 0x8e8e93,
  graphite: 0x1c1c1e,
  graphite2: 0x2c2c2e,
  green: 0x30d158,
  orange: 0xff9f0a,
  red: 0xff453a,
};

/* ---------- 淡入淡出：对一个组里的全部材质与标签统一缩放透明度 ---------- */

function collect(root) {
  const mats = new Set();
  const labels = [];
  root.traverse((o) => {
    if (o.isCSS2DObject) labels.push(o);
    if (o.material) for (const m of [].concat(o.material)) mats.add(m);
  });
  for (const m of mats) {
    if (m.userData.baseOpacity === undefined) {
      m.userData.baseOpacity = m.uniforms?.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
      m.userData.baseTransparent = m.transparent;
    }
  }
  return { mats: [...mats], labels };
}

export function applyFade(root, v) {
  const cache = (root.userData.fadeCache ??= collect(root));
  root.userData.fade = v;
  for (const m of cache.mats) {
    const base = m.userData.baseOpacity;
    if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = base * v;
    else m.opacity = base * v;
    m.transparent = m.userData.baseTransparent || v < 0.999;
    m.depthWrite = m.userData.baseTransparent ? m.depthWrite : v > 0.6;
  }
  for (const l of cache.labels) l.element.style.opacity = String(v);
  root.visible = v > 0.002;
}

export function refreshFade(root) {
  root.userData.fadeCache = null;
  applyFade(root, root.userData.fade ?? 1);
}

export function fadeTo(root, v, duration = 0.9, delay = 0) {
  if (root.userData.fade === undefined) applyFade(root, root.visible ? 1 : 0);
  gsap.killTweensOf(root.userData, 'fade');
  const state = root.userData;
  if (duration === 0) return applyFade(root, v);
  return gsap.to(state, { fade: v, duration, delay, ease: 'power2.inOut', onUpdate: () => applyFade(root, state.fade) });
}

/* ---------- CSS2D 标签 ---------- */

export function makeLabel({ text, en, icon, cls = '', center = [0.5, 0.5] } = {}) {
  const outer = document.createElement('div');
  outer.className = 'lbl-anchor';
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  el.innerHTML = `${icon ? iconSvg(icon, 14) : ''}<span class="lbl-t">${text ?? ''}</span>${en ? `<span class="lbl-en">${en}</span>` : ''}`;
  outer.appendChild(el);
  const obj = new CSS2DObject(outer);
  obj.center.set(center[0], center[1]);
  obj.inner = el;
  obj.setText = (t) => (el.querySelector('.lbl-t').textContent = t);
  obj.setOn = (on) => el.classList.toggle('on', !!on);
  return obj;
}

export function makeHtml(html, cls = '', center = [0.5, 0.5]) {
  const outer = document.createElement('div');
  outer.className = 'lbl-anchor';
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  outer.appendChild(el);
  const obj = new CSS2DObject(outer);
  obj.center.set(center[0], center[1]);
  obj.inner = el;
  return obj;
}

/* ---------- 贴图 ---------- */

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function makeGlow(color = COLOR.blue, scale = 2, opacity = 0.5) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

// 把 lucide 风格的 SVG 路径画到画布上，作为三维面板上的图标
export function iconTexture(name, { size = 256, color = '#f5f5f7', bg = null, stroke = 1.6, pad = 0.2 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
  }
  const s = (size * (1 - pad * 2)) / 24;
  g.translate(size * pad, size * pad);
  g.scale(s, s);
  g.strokeStyle = color;
  g.lineWidth = stroke;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const d of ICONS[name]) g.stroke(new Path2D(d));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- 可取消、可暂停的章节脚本 ---------- */

export class Cancelled extends Error {}

// 章节脚本的等待由渲染循环推进（见 stage.js），和动画保持同一条时间线
let now = 0;
let waiters = [];
export function tickClock(t) {
  now = t;
  if (!waiters.length) return;
  const keep = [];
  for (const w of waiters) {
    if (w.run.cancelled) w.reject(new Cancelled());
    else if (w.until <= now) w.resolve();
    else keep.push(w);
  }
  waiters = keep;
}

export class Run {
  constructor() {
    this.cancelled = false;
    this.paused = false;
    this.stepOnce = false;
    this._resume = [];
  }
  check() {
    if (this.cancelled) throw new Cancelled();
  }
  wait(ms) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return reject(new Cancelled());
      waiters.push({ until: now + ms / 1000, resolve, reject, run: this });
    });
  }
  // 每个"步骤"开始前调用：暂停时在这里等待
  async gate() {
    this.check();
    if (this.stepOnce) {
      this.stepOnce = false;
      this.paused = true;
      return;
    }
    while (this.paused) {
      await new Promise((r) => this._resume.push(r));
      this.check();
      if (this.stepOnce) {
        this.stepOnce = false;
        this.paused = true;
        return;
      }
    }
  }
  setPaused(p) {
    this.paused = p;
    if (!p) this._flush();
  }
  step() {
    this.stepOnce = true;
    this.paused = false;
    this._flush();
  }
  cancel() {
    this.cancelled = true;
    this._flush();
  }
  _flush() {
    const r = this._resume;
    this._resume = [];
    r.forEach((f) => f());
  }
}
