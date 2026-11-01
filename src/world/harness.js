// Harness：围绕 LLM 的一圈模块 + 循环轨道 + 数据总线 + 边界网壳
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { COLOR, makeLabel, makeGlow, iconTexture, refreshFade } from '../core/fx.js';

export const RING_R = 3.8;

export const MODULES = [
  { id: 'loop', name: '智能体循环', en: 'Agent Loop', icon: 'loop', angle: 90 },
  { id: 'runtime', name: '工具执行器', en: 'Tool Runtime', icon: 'wrench', angle: 30 },
  { id: 'guard', name: '权限与沙箱', en: 'Guardrails', icon: 'shield', angle: -30 },
  { id: 'skills', name: '技能与钩子', en: 'Skills & Hooks', icon: 'zap', angle: -90 },
  { id: 'memory', name: '记忆', en: 'Memory', icon: 'database', angle: -150 },
  { id: 'ctxm', name: '上下文管理', en: 'Context', icon: 'layers', angle: 150 },
];

export function modulePosition(angleDeg, r = RING_R, y = 0) {
  const a = THREE.MathUtils.degToRad(angleDeg);
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
}

export function createHarness(stage) {
  const group = new THREE.Group();
  group.name = 'harness';
  stage.scene.add(group);

  // 底座：极淡的圆盘 + 刻度
  const deck = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 5.0, 160, 1),
    new THREE.MeshBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -0.42;
  group.add(deck);

  const ticks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.02, 0.01, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35 }),
    144,
  );
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    const r = 4.85;
    m4.makeRotationY(-a);
    m4.setPosition(Math.cos(a) * r, -0.41, Math.sin(a) * r);
    ticks.setMatrixAt(i, m4);
  }
  group.add(ticks);

  // 循环轨道
  const trackMat = new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const track = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.012, 8, 256), trackMat);
  track.rotation.x = Math.PI / 2;
  track.position.y = -0.3;
  group.add(track);
  const track2 = new THREE.Mesh(
    new THREE.TorusGeometry(RING_R + 0.18, 0.005, 6, 256),
    new THREE.MeshBasicMaterial({ color: 0xc7d6ea, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  track2.rotation.x = Math.PI / 2;
  track2.position.y = -0.3;
  group.add(track2);

  // 在轨道上奔跑的"循环光点"
  const runner = makeGlow(COLOR.blue, 0.9, 0);
  group.add(runner);
  const runnerCore = makeGlow(0xffffff, 0.25, 0);
  runner.add(runnerCore);
  const runnerState = { a: 90, on: 0 };

  // 模块
  const bodyGeo = new RoundedBoxGeometry(1.3, 0.52, 0.8, 4, 0.12);
  const stripGeo = new THREE.BoxGeometry(0.9, 0.035, 0.02);
  const modules = {};
  const busMat = new THREE.LineBasicMaterial({ color: 0x6f8aa8, transparent: true, opacity: 0.22, depthWrite: false });

  for (const def of MODULES) {
    const pos = modulePosition(def.angle);
    const holder = new THREE.Group();
    holder.position.copy(pos);
    holder.lookAt(0, 0, 0);
    group.add(holder);

    const inner = new THREE.Group();
    holder.add(inner);

    const mat = new THREE.MeshPhysicalMaterial({ color: 0x1f1f22, metalness: 0.75, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.userData.info = def.id;
    inner.add(body);

    // 朝外一面的图标屏
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({ map: iconTexture(def.icon, { color: '#e8eef6' }), transparent: true, depthWrite: false }),
    );
    screen.position.set(0, 0.02, -0.405);
    screen.rotation.y = Math.PI;
    inner.add(screen);

    // 状态灯条（朝外、朝内各一条）
    const stripMat = new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.55 });
    const s1 = new THREE.Mesh(stripGeo, stripMat);
    s1.position.set(0, -0.2, -0.41);
    inner.add(s1);
    const s2 = new THREE.Mesh(stripGeo, stripMat);
    s2.position.set(0, -0.2, 0.41);
    inner.add(s2);

    const glow = makeGlow(COLOR.blue, 2.2, 0);
    glow.position.set(0, 0, 0);
    inner.add(glow);

    const label = makeLabel({ text: def.name, en: def.en, icon: def.icon, center: [0.5, 0] });
    label.position.set(0, -0.4, 0);
    inner.add(label);

    // 数据总线：模块 → 核心
    const busGeo = new THREE.BufferGeometry().setFromPoints([pos.clone().multiplyScalar(0.84), pos.clone().normalize().multiplyScalar(1.4)]);
    const bus = new THREE.Line(busGeo, busMat);
    group.add(bus);

    modules[def.id] = { def, holder, inner, body, mat, stripMat, glow, label, position: pos.clone(), bus };
  }

  // 边界网壳：Harness 的"边界"
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(5.6, 1)),
    new THREE.LineBasicMaterial({ color: 0x6f8aa8, transparent: true, opacity: 0.045, depthWrite: false }),
  );
  group.add(cage);

  const title = makeLabel({ text: 'Harness 运行框架', en: 'Harness', cls: 'lbl-title', center: [0.5, 1] });
  title.position.set(0, 1.9, -RING_R - 0.6);
  group.add(title);

  refreshFade(group);

  stage.onFrame((dt, t) => {
    cage.rotation.y += dt * 0.02;
    for (const m of Object.values(modules)) m.inner.position.y = Math.sin(t * 0.8 + m.def.angle) * 0.04;
    const a = THREE.MathUtils.degToRad(runnerState.a);
    runner.position.set(Math.cos(a) * RING_R, -0.3, Math.sin(a) * RING_R);
    const f = group.userData.fade ?? 1;
    runner.material.opacity = runnerState.on * f;
    runnerCore.material.opacity = runnerState.on * f;
  });

  function setActive(id, on, color = COLOR.blue) {
    const m = modules[id];
    if (!m) return;
    m.label.setOn(on);
    m.stripMat.color.set(color);
    m.glow.material.color.set(color);
    gsap.to(m.glow.material, { opacity: on ? 0.75 : 0, duration: 0.35 });
    gsap.to(m.stripMat, { opacity: on ? 1 : 0.55, duration: 0.35 });
    gsap.to(m.inner.scale, { x: on ? 1.08 : 1, y: on ? 1.08 : 1, z: on ? 1.08 : 1, duration: 0.4, ease: 'back.out(2)' });
  }

  function pulse(id, color = COLOR.blue, hold = 0.6) {
    setActive(id, true, color);
    gsap.delayedCall(hold, () => setActive(id, false));
  }

  // 跑一圈：表示"进入下一轮循环"
  function lap(duration = 1.4) {
    runnerState.a = 90;
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: resolve })
        .to(runnerState, { on: 1, duration: 0.2 })
        .to(runnerState, { a: 90 + 360, duration, ease: 'power2.inOut' }, 0)
        .to(runnerState, { on: 0, duration: 0.3 }, duration - 0.2);
    });
  }

  // 组装动画：模块从远处飞回轨道
  function assemble() {
    Object.values(modules).forEach((m, i) => {
      const from = m.position.clone().multiplyScalar(2.6).setY(m.position.y + 3 - i);
      m.holder.position.copy(from);
      m.inner.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      gsap.to(m.holder.position, { x: m.position.x, y: m.position.y, z: m.position.z, duration: 1.6, delay: 0.25 + i * 0.16, ease: 'expo.out' });
      gsap.to(m.inner.rotation, { x: 0, y: 0, z: 0, duration: 1.8, delay: 0.25 + i * 0.16, ease: 'expo.out' });
      gsap.delayedCall(0.9 + i * 0.16, () => pulse(m.def.id, COLOR.blue, 0.5));
    });
    track.scale.setScalar(0.01);
    gsap.to(track.scale, { x: 1, y: 1, z: 1, duration: 1.6, delay: 0.4, ease: 'expo.out' });
  }

  function resetAll() {
    for (const m of Object.values(modules)) {
      gsap.killTweensOf(m.holder.position);
      gsap.killTweensOf(m.inner.rotation);
      m.holder.position.copy(m.position);
      m.inner.rotation.set(0, 0, 0);
      setActive(m.def.id, false);
    }
    track.scale.setScalar(1);
    runnerState.on = 0;
  }

  return {
    group,
    modules,
    setActive,
    pulse,
    lap,
    assemble,
    resetAll,
    pos: (id) => modules[id].position.clone(),
    setLoopLabel: (t) => modules.loop.label.setText(t),
    pickables: Object.values(modules).map((m) => m.body),
  };
}
