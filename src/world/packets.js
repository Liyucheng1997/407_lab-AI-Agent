// 数据包：沿弧线飞行、带拖尾的发光粒子。所有"信息流动"都靠它表现
import * as THREE from 'three';
import { makeHtml } from '../core/fx.js';

const CAP = 96; // 同时在飞的数据包上限
const TRAIL = 22; // 每个数据包的拖尾点数

const vert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor * (1.0 + a * 1.6), a * vAlpha);
  }
`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createPackets(stage) {
  const n = CAP * TRAIL;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uScale: { value: 300 * stage.pixelRatio } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  stage.scene.add(points);

  const slots = Array.from({ length: CAP }, (_, i) => ({ i, active: false }));
  const tmp = new THREE.Vector3();
  const colorTmp = new THREE.Color();

  function send({ from, to, color = 0xf5f5f7, duration = 1.1, arc = 0.6, size = 1, delay = 0, label = null, labelCls = '', curve = null }) {
    return new Promise((resolve) => {
      const slot = slots.find((s) => !s.active);
      if (!slot) return resolve();
      const a = from.clone();
      const b = to.clone();
      let path = curve;
      if (!path) {
        const mid = a.clone().lerp(b, 0.5);
        const dist = a.distanceTo(b);
        mid.y += dist * arc * 0.35;
        path = new THREE.QuadraticBezierCurve3(a, mid, b);
      }
      Object.assign(slot, {
        active: true,
        path,
        t: -delay,
        duration,
        color: colorTmp.set(color).clone(),
        size,
        resolve,
        hist: Array.from({ length: TRAIL }, () => a.clone()),
        label: null,
      });
      if (label) {
        const l = makeHtml(label, `pkt-label ${labelCls}`, [0.5, 1.4]);
        l.position.copy(a);
        stage.scene.add(l);
        slot.label = l;
      }
    });
  }

  function finish(slot) {
    slot.active = false;
    if (slot.label) {
      stage.scene.remove(slot.label);
      slot.label.element.remove();
      slot.label = null;
    }
    const r = slot.resolve;
    slot.resolve = null;
    r?.();
  }

  function clear() {
    for (const s of slots) if (s.active) finish(s);
  }

  stage.onFrame((dt) => {
    for (const s of slots) {
      const base = s.i * TRAIL;
      if (!s.active) {
        for (let k = 0; k < TRAIL; k++) alpha[base + k] = 0;
        continue;
      }
      s.t += dt;
      const p = Math.min(Math.max(s.t / s.duration, 0), 1);
      const head = s.path.getPoint(ease(p), tmp);
      s.hist.pop();
      s.hist.unshift(head.clone());
      const visible = s.t >= 0 ? 1 : 0;
      for (let k = 0; k < TRAIL; k++) {
        const h = s.hist[k];
        const j = base + k;
        pos[j * 3] = h.x;
        pos[j * 3 + 1] = h.y;
        pos[j * 3 + 2] = h.z;
        col[j * 3] = s.color.r;
        col[j * 3 + 1] = s.color.g;
        col[j * 3 + 2] = s.color.b;
        const f = 1 - k / TRAIL;
        size[j] = (k === 0 ? 0.55 : 0.32 * f) * s.size;
        alpha[j] = visible * (k === 0 ? 1 : f * f * 0.8);
      }
      if (s.label) s.label.position.copy(head);
      // 到达后先结算，再让拖尾收拢后才真正回收
      if (p >= 1 && s.resolve) {
        const r = s.resolve;
        s.resolve = null;
        if (s.label) {
          stage.scene.remove(s.label);
          s.label.element.remove();
          s.label = null;
        }
        s.tail = TRAIL;
        r();
      } else if (p >= 1 && --s.tail <= 0) finish(s);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  });

  return { send, clear, object: points };
}
