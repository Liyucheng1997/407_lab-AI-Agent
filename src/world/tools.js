// 工具：环绕在 Harness 外侧的一圈"外部能力"
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { COLOR, makeLabel, makeGlow, iconTexture, refreshFade } from '../core/fx.js';

export const TOOLS = [
  { id: 'files', name: '文件读写', en: 'read / edit', icon: 'file', angle: 62, y: 0.5 },
  { id: 'search', name: '代码搜索', en: 'grep', icon: 'search', angle: 36, y: -0.6 },
  { id: 'shell', name: '终端命令', en: 'shell', icon: 'terminal', angle: 10, y: 0.6 },
  { id: 'browser', name: '浏览器', en: 'web', icon: 'globe', angle: -16, y: -0.5 },
  { id: 'code', name: '代码执行', en: 'python', icon: 'code', angle: -42, y: 0.55 },
  { id: 'mcp', name: 'MCP 服务', en: '日历 / 数据库 …', icon: 'plug', angle: -68, y: -0.4 },
];
const R = 7.4;

export function createTools(stage) {
  const group = new THREE.Group();
  group.name = 'tools';
  stage.scene.add(group);

  const tileGeo = new RoundedBoxGeometry(0.95, 0.95, 0.16, 4, 0.14);
  const ringGeo = new THREE.TorusGeometry(0.78, 0.008, 6, 96);
  const items = {};
  const linkMat = new THREE.LineDashedMaterial({ color: 0x6f8aa8, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.3, depthWrite: false });

  for (const def of TOOLS) {
    const a = THREE.MathUtils.degToRad(def.angle);
    const pos = new THREE.Vector3(Math.cos(a) * R, def.y, Math.sin(a) * R);
    const holder = new THREE.Group();
    holder.position.copy(pos);
    group.add(holder);

    const mat = new THREE.MeshPhysicalMaterial({ color: 0x232326, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, emissive: COLOR.blue, emissiveIntensity: 0 });
    const tile = new THREE.Mesh(tileGeo, mat);
    tile.userData.info = def.id;
    holder.add(tile);

    const iconMat = new THREE.MeshBasicMaterial({ map: iconTexture(def.icon, { color: '#f5f5f7', stroke: 1.5 }), transparent: true, depthWrite: false });
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), iconMat);
    icon.position.z = 0.085;
    holder.add(icon);
    const iconBack = icon.clone();
    iconBack.rotation.y = Math.PI;
    iconBack.position.z = -0.085;
    holder.add(iconBack);

    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xc7d6ea, transparent: true, opacity: 0.18, depthWrite: false }));
    holder.add(ring);

    const glow = makeGlow(COLOR.blue, 2.6, 0);
    holder.add(glow);

    const label = makeLabel({ text: def.name, en: def.en, center: [0.5, 0] });
    label.position.set(0, -0.72, 0);
    holder.add(label);

    // 连向工具执行器的虚线
    const start = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(30)) * 4.5, 0, Math.sin(THREE.MathUtils.degToRad(30)) * 4.5);
    const mid = start.clone().lerp(pos, 0.5).multiplyScalar(1.05);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, pos.clone().multiplyScalar(0.92));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), linkMat);
    line.computeLineDistances();
    group.add(line);

    items[def.id] = { def, holder, tile, mat, glow, ring, label, position: pos };
  }

  const title = makeLabel({ text: '工具 Tools', en: '模型的"手"', cls: 'lbl-title', center: [0.5, 1] });
  title.position.set(R + 1.4, 2.0, 0);
  group.add(title);

  refreshFade(group);

  const camPos = new THREE.Vector3();
  stage.onFrame((dt, t) => {
    stage.camera.getWorldPosition(camPos);
    for (const it of Object.values(items)) {
      // 只绕竖轴朝向相机，保持端正
      const dx = camPos.x - it.holder.position.x;
      const dz = camPos.z - it.holder.position.z;
      it.holder.rotation.y = Math.atan2(dx, dz);
      it.holder.position.y = it.def.y + Math.sin(t * 0.9 + it.def.angle) * 0.08;
      it.ring.rotation.x = Math.sin(t * 0.5 + it.def.angle) * 0.6;
      it.ring.rotation.y = t * 0.4;
    }
    linkMat.dashOffset = -t * 0.3;
  });

  function setActive(id, on, color = COLOR.blue) {
    const it = items[id];
    if (!it) return;
    it.label.setOn(on);
    it.mat.emissive.set(color);
    it.glow.material.color.set(color);
    gsap.to(it.mat, { emissiveIntensity: on ? 0.9 : 0, duration: 0.3 });
    gsap.to(it.glow.material, { opacity: on ? 0.8 : 0, duration: 0.3 });
    gsap.to(it.holder.scale, { x: on ? 1.15 : 1, y: on ? 1.15 : 1, z: on ? 1.15 : 1, duration: 0.45, ease: 'back.out(2.2)' });
  }

  return {
    group,
    items,
    setActive,
    pos: (id) => items[id].holder.position.clone(),
    resetAll: () => Object.keys(items).forEach((id) => setActive(id, false)),
    pickables: Object.values(items).map((i) => i.tile),
  };
}
