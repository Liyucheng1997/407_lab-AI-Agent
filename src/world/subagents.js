// 多智能体：主 Agent 派出的几个"迷你 Agent"，各有独立的核心、循环与上下文
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { COLOR, makeLabel, makeGlow, refreshFade } from '../core/fx.js';
import { makeCoreMaterial } from './llm.js';

export const SUBS = [
  { id: 'sub-research', name: '子 Agent · 调研', en: '读 200 个文件', pos: [-6.2, 6.2, -1.5] },
  { id: 'sub-code', name: '子 Agent · 编码', en: '改 3 个模块', pos: [0, 7.4, -3.2] },
  { id: 'sub-test', name: '子 Agent · 测试', en: '跑 400 个用例', pos: [6.2, 6.2, -1.5] },
];

export function createSubagents(stage) {
  const group = new THREE.Group();
  group.name = 'subagents';
  stage.scene.add(group);

  const slabGeo = new RoundedBoxGeometry(0.55, 0.04, 0.38, 2, 0.015);
  const modGeo = new RoundedBoxGeometry(0.34, 0.16, 0.22, 2, 0.05);
  const items = {};
  const linkMat = new THREE.LineDashedMaterial({ color: COLOR.blue, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.45, depthWrite: false });

  for (const def of SUBS) {
    const holder = new THREE.Group();
    holder.position.set(...def.pos);
    group.add(holder);
    const inner = new THREE.Group();
    holder.add(inner);

    const coreMat = makeCoreMaterial();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 48), coreMat);
    core.userData.info = 'subagent';
    inner.add(core);
    inner.add(makeGlow(COLOR.blue, 2.0, 0.3));

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.008, 6, 128),
      new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    inner.add(ring);
    const runner = makeGlow(COLOR.blue, 0.4, 0.9);
    ring.add(runner);

    const mods = new THREE.Group();
    inner.add(mods);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const m = new THREE.Mesh(modGeo, new THREE.MeshPhysicalMaterial({ color: 0x232326, metalness: 0.7, roughness: 0.3, clearcoat: 1 }));
      m.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05);
      m.lookAt(0, 0, 0);
      m.userData.info = 'subagent';
      mods.add(m);
    }

    // 独立的上下文：一小叠
    const stack = new THREE.Group();
    stack.position.set(1.55, -0.2, 0);
    inner.add(stack);
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(slabGeo, new THREE.MeshPhysicalMaterial({ color: 0x2c2c2e, metalness: 0.3, roughness: 0.35, clearcoat: 1, emissive: COLOR.blue, emissiveIntensity: 0 }));
      s.position.y = k * 0.09;
      stack.add(s);
    }

    const label = makeLabel({ text: def.name, en: def.en, center: [0.5, 0] });
    label.position.set(0, -0.75, 0);
    inner.add(label);

    // 和主 Agent 的连线
    const from = new THREE.Vector3(0, 1.5, 0);
    const to = holder.position.clone().add(new THREE.Vector3(0, -0.45, 0));
    const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.2, 0)), to);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)), linkMat);
    line.computeLineDistances();
    group.add(line);

    items[def.id] = { def, holder, inner, coreMat, ring, mods, stack, label, curve, state: { busy: 0 } };
  }

  const title = makeLabel({ text: '多智能体 Multi-Agent', en: '每个子 Agent 都有自己的上下文', cls: 'lbl-title', center: [0.5, 1] });
  title.position.set(0, 10.0, -2.5);
  group.add(title);

  refreshFade(group);

  stage.onFrame((dt, t) => {
    linkMat.dashOffset = -t * 0.4;
    for (const it of Object.values(items)) {
      it.coreMat.uniforms.uTime.value = t;
      it.coreMat.uniforms.uIntensity.value = 1 + it.state.busy * 0.9;
      it.ring.rotation.z += dt * (0.3 + it.state.busy * 4);
      it.mods.rotation.y += dt * (0.1 + it.state.busy * 1.2);
      it.inner.position.y = Math.sin(t * 0.7 + it.def.pos[0]) * 0.12;
    }
  });

  function spawn() {
    Object.values(items).forEach((it, i) => {
      it.holder.position.set(0, 0.5, 0);
      it.holder.scale.setScalar(0.01);
      gsap.to(it.holder.position, { x: it.def.pos[0], y: it.def.pos[1], z: it.def.pos[2], duration: 1.6, delay: 0.3 + i * 0.25, ease: 'expo.out' });
      gsap.to(it.holder.scale, { x: 1, y: 1, z: 1, duration: 1.4, delay: 0.3 + i * 0.25, ease: 'back.out(1.4)' });
    });
  }

  function settle() {
    Object.values(items).forEach((it) => {
      gsap.killTweensOf(it.holder.position);
      gsap.killTweensOf(it.holder.scale);
      it.holder.position.set(...it.def.pos);
      it.holder.scale.setScalar(1);
      it.state.busy = 0;
      it.label.setOn(false);
    });
  }

  function work(id, duration = 2) {
    const it = items[id];
    it.label.setOn(true);
    const slabs = it.stack.children;
    slabs.forEach((s, k) => gsap.fromTo(s.material, { emissiveIntensity: 1.2 }, { emissiveIntensity: 0, duration: 0.8, delay: k * 0.15, repeat: Math.max(1, Math.round(duration)) - 1 }));
    return new Promise((resolve) =>
      gsap
        .timeline({ onComplete: resolve })
        .to(it.state, { busy: 1, duration: 0.3 })
        .to(it.state, { busy: 0, duration: 0.5 }, `+=${duration}`)
        .call(() => it.label.setOn(false)),
    );
  }

  return {
    group,
    items,
    spawn,
    settle,
    work,
    pos: (id) => items[id].holder.position.clone(),
    pickables: Object.values(items).flatMap((it) => [it.inner.children[0], ...it.mods.children]),
  };
}
