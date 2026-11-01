// 上下文窗口：一叠"纸"。每次调用模型，整叠都会被送进去
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { COLOR, makeLabel, makeHtml, refreshFade } from '../core/fx.js';

const GAP = 0.15;

export function createContextStack(stage, anchor) {
  const group = new THREE.Group();
  group.name = 'context';
  group.position.copy(anchor);
  stage.scene.add(group);

  const slabGeo = new RoundedBoxGeometry(1.25, 0.07, 0.85, 3, 0.03);
  const edgeGeo = new THREE.BoxGeometry(1.1, 0.012, 0.012);

  const title = makeLabel({ text: '上下文窗口', en: 'Context', icon: 'layers', cls: 'lbl-main', center: [0.5, 0] });
  group.add(title);

  const capacity = makeHtml('', 'ctx-cap', [0.5, 0]);
  group.add(capacity);

  const slabs = [];
  let used = 0;
  const LIMIT = 200000;

  function layout(animate = true) {
    slabs.forEach((s, i) => {
      const y = i * GAP;
      if (animate) gsap.to(s.mesh.position, { y, duration: 0.6, ease: 'power3.out' });
      else s.mesh.position.y = y;
    });
    capacity.position.set(0, slabs.length * GAP + 0.2, 0);
    title.position.set(0, slabs.length * GAP + 0.62, 0);
    capacity.inner.innerHTML = `<b>${fmt(used)}</b> / ${fmt(LIMIT)} tokens`;
  }

  function add({ text, tokens = 1000, kind = 'msg', animate = true }) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: kind === 'system' ? 0x3a3a3c : 0x2c2c2e,
      metalness: 0.3,
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.25,
      emissive: COLOR.blue,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(slabGeo, mat);
    mesh.userData.info = 'context';
    const edgeMat = new THREE.MeshBasicMaterial({ color: kind === 'result' ? COLOR.white : COLOR.blue, transparent: true, opacity: kind === 'system' ? 0.35 : 0.8 });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.0, 0.43);
    mesh.add(edge);
    const lbl = makeLabel({ text, cls: 'lbl-slab', center: [0, 0.5] });
    lbl.position.set(0.72, 0, 0);
    mesh.add(lbl);
    group.add(mesh);
    const slab = { mesh, mat, lbl, tokens };
    slabs.forEach((x) => x.lbl.inner.classList.remove('latest'));
    lbl.inner.classList.add('latest');
    slabs.push(slab);
    used += tokens;
    const y = (slabs.length - 1) * GAP;
    if (animate) {
      mesh.position.set(0, y + 1.6, 0);
      mesh.scale.setScalar(0.6);
      gsap.to(mesh.position, { y, duration: 0.8, ease: 'power3.out' });
      gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.6)' });
      mat.emissiveIntensity = 1.6;
      gsap.to(mat, { emissiveIntensity: 0, duration: 1.6, delay: 0.4 });
    } else mesh.position.set(0, y, 0);
    refreshFade(group);
    layout(animate);
    return slab;
  }

  function clear() {
    for (const s of slabs) {
      gsap.killTweensOf(s.mesh.position);
      group.remove(s.mesh);
      s.lbl.element.remove();
      s.mat.dispose();
    }
    slabs.length = 0;
    used = 0;
    refreshFade(group);
    layout(false);
  }

  // 整叠一起亮一下（表示"被整体读入"）
  function flash() {
    slabs.forEach((s, i) => {
      gsap.fromTo(s.mat, { emissiveIntensity: 1.4 }, { emissiveIntensity: 0, duration: 1.1, delay: i * 0.04 });
    });
  }

  // 压缩：把多张合成一张摘要
  function compact(keep = 2, text = '历史摘要') {
    if (slabs.length <= keep + 1) return;
    const removed = slabs.splice(keep);
    const sum = removed.reduce((a, s) => a + s.tokens, 0);
    removed.forEach((s) => {
      gsap.to(s.mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, onComplete: () => (group.remove(s.mesh), s.lbl.element.remove()) });
    });
    used -= sum;
    setTimeout(() => add({ text, tokens: Math.round(sum * 0.12), kind: 'result' }), 520);
  }

  const world = new THREE.Vector3();
  return {
    group,
    add,
    clear,
    flash,
    compact,
    get used() {
      return used;
    },
    limit: LIMIT,
    count: () => slabs.length,
    // 世界坐标：顶部 / 中部，用于数据包的起止点
    top() {
      return group.localToWorld(world.set(0, slabs.length * GAP + 0.05, 0)).clone();
    },
    slabPositions() {
      return slabs.map((s) => s.mesh.getWorldPosition(new THREE.Vector3()));
    },
    pickables: () => slabs.map((s) => s.mesh),
  };
}

function fmt(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : String(n);
}
