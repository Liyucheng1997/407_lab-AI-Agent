// Bot：住在聊天渠道里的"营业窗口"。左侧是渠道，中间是 Bot 门户，背后连着某种"大脑"
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { COLOR, makeLabel, makeGlow, iconTexture, refreshFade } from '../core/fx.js';

export const GATE = new THREE.Vector3(-11.2, 0.4, 0);
export const CHANNELS = [
  { id: 'wechat', name: '微信', z: 2.1 },
  { id: 'slack', name: 'Slack', z: 0.7 },
  { id: 'feishu', name: '飞书', z: -0.7 },
  { id: 'web', name: '网页客服', z: -2.1 },
];

export function createBot(stage) {
  const group = new THREE.Group();
  group.name = 'bot';
  stage.scene.add(group);

  // 门户：竖立的双环
  const portal = new THREE.Group();
  portal.position.copy(GATE);
  portal.rotation.y = 0.55;
  group.add(portal);
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2e, metalness: 0.85, roughness: 0.25, clearcoat: 1 });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 24, 160), frameMat);
  frame.userData.info = 'bot';
  portal.add(frame);
  const innerRingMat = new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.012, 8, 160), innerRingMat);
  portal.add(innerRing);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.34, 96),
    new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  disc.userData.info = 'bot';
  portal.add(disc);

  // 头像：Bot 的"身份"
  const avatarMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, metalness: 0.5, roughness: 0.3, clearcoat: 1, emissive: COLOR.blue, emissiveIntensity: 0.15 });
  const avatar = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.95, 0.14, 4, 0.2), avatarMat);
  avatar.userData.info = 'bot';
  portal.add(avatar);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({ map: iconTexture('bot', { color: '#f5f5f7' }), transparent: true, depthWrite: false }));
  face.position.z = 0.075;
  portal.add(face);
  const faceBack = face.clone();
  faceBack.rotation.y = Math.PI;
  faceBack.position.z = -0.075;
  portal.add(faceBack);
  const portalGlow = makeGlow(COLOR.blue, 4.5, 0.18);
  portal.add(portalGlow);

  const label = makeLabel({ text: 'Bot · @小助手', en: '名字 · 头像 · 渠道', icon: 'bot', cls: 'lbl-main', center: [0.5, 0] });
  label.position.set(GATE.x, GATE.y - 2.0, GATE.z);
  group.add(label);

  // 渠道
  const chGeo = new RoundedBoxGeometry(0.85, 0.85, 0.14, 4, 0.16);
  const channels = {};
  const lineMat = new THREE.LineDashedMaterial({ color: 0x6f8aa8, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  for (const def of CHANNELS) {
    // z 字段在这里表示竖直方向上的排布
    const pos = new THREE.Vector3(GATE.x - 3.6 - Math.abs(def.z) * 0.25, GATE.y + def.z, 0.6);
    const holder = new THREE.Group();
    holder.position.copy(pos);
    group.add(holder);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x232326, metalness: 0.6, roughness: 0.3, clearcoat: 1, emissive: COLOR.blue, emissiveIntensity: 0 });
    const tile = new THREE.Mesh(chGeo, mat);
    tile.userData.info = 'channel';
    holder.add(tile);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ map: iconTexture('message', { color: '#f5f5f7' }), transparent: true, depthWrite: false }));
    icon.position.z = 0.075;
    holder.add(icon);
    const l = makeLabel({ text: def.name, center: [0.5, 0] });
    l.position.set(0, -0.62, 0);
    holder.add(l);
    const curve = new THREE.QuadraticBezierCurve3(pos.clone().add(new THREE.Vector3(0.5, 0, 0)), new THREE.Vector3(GATE.x - 1.8, GATE.y + def.z * 0.4, 0.4), GATE.clone().add(new THREE.Vector3(-0.3, def.z * 0.15, 0)));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat);
    line.computeLineDistances();
    group.add(line);
    channels[def.id] = { def, holder, tile, mat, label: l, position: pos, curve };
  }
  const chTitle = makeLabel({ text: '渠道', en: 'Channels', cls: 'lbl-title', center: [0.5, 1] });
  chTitle.position.set(GATE.x - 4.1, GATE.y + 3.3, 0.6);
  group.add(chTitle);

  // 规则表（只在"规则 Bot"时出现）
  const rules = new THREE.Group();
  rules.position.set(GATE.x, GATE.y - 3.6, 0);
  group.add(rules);
  const ruleMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.35, clearcoat: 1, emissive: COLOR.blue, emissiveIntensity: 0 });
  const ruleBox = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.5, 0.9, 4, 0.1), ruleMat);
  ruleBox.userData.info = 'rules';
  rules.add(ruleBox);
  const ruleIcon = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), new THREE.MeshBasicMaterial({ map: iconTexture('list'), transparent: true, depthWrite: false }));
  ruleIcon.rotation.y = -Math.PI / 2;
  ruleIcon.position.x = -0.76;
  rules.add(ruleIcon);
  const ruleLabel = makeLabel({ text: '规则表 if / else', en: '关键词 → 固定回复', icon: 'list', center: [0.5, 0] });
  ruleLabel.position.set(0, -0.55, 0);
  rules.add(ruleLabel);

  // 门户 → Agent 的连线（接到上下文管理模块）
  const agentCurve = new THREE.CubicBezierCurve3(GATE.clone().add(new THREE.Vector3(0.4, 0, 0)), new THREE.Vector3(-7.4, 1.6, 1.0), new THREE.Vector3(-5, 0.8, 2.2), new THREE.Vector3(-3.6, 0.1, 2.0));
  const agentLink = new THREE.Mesh(
    new THREE.TubeGeometry(agentCurve, 80, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(agentLink);
  // 门户 → LLM 的直连（"LLM 聊天 Bot" 用）
  const llmCurve = new THREE.QuadraticBezierCurve3(GATE.clone().add(new THREE.Vector3(0.4, 0, 0)), new THREE.Vector3(-5.5, 2.6, -0.4), new THREE.Vector3(-1.0, 0.2, 0));
  const llmLink = new THREE.Mesh(
    new THREE.TubeGeometry(llmCurve, 80, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color: COLOR.white, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(llmLink);
  const ruleCurve = new THREE.QuadraticBezierCurve3(GATE.clone().add(new THREE.Vector3(0, -1.6, 0)), GATE.clone().add(new THREE.Vector3(0.5, -2.5, 0)), rules.position.clone().add(new THREE.Vector3(0, 0.3, 0)));

  refreshFade(group);

  const camPos = new THREE.Vector3();
  stage.onFrame((dt, t) => {
    stage.camera.getWorldPosition(camPos);
    for (const c of Object.values(channels)) {
      c.holder.rotation.y = Math.atan2(camPos.x - c.holder.position.x, camPos.z - c.holder.position.z);
      c.holder.position.y = c.position.y + Math.sin(t * 0.9 + c.def.z * 2) * 0.05;
    }
    innerRing.rotation.z += dt * 0.4;
    avatar.rotation.y = Math.sin(t * 0.6) * 0.25;
    face.rotation.y = avatar.rotation.y;
    faceBack.rotation.y = avatar.rotation.y + Math.PI;
    lineMat.dashOffset = -t * 0.3;
  });

  function setMode(mode) {
    // rule / chat / agent：决定哪条"大脑连线"可见
    const f = (v) => ({ v });
    gsap.to(rules.scale, { x: mode === 'rule' ? 1 : 0.001, y: mode === 'rule' ? 1 : 0.001, z: mode === 'rule' ? 1 : 0.001, duration: 0.6, ease: 'back.out(1.6)' });
    ruleLabel.element.style.visibility = mode === 'rule' ? '' : 'hidden';
    agentLink.visible = mode === 'agent' || mode === 'all';
    llmLink.visible = mode === 'chat';
    return f(mode);
  }

  function pulseChannel(id, on) {
    const c = channels[id];
    c.label.setOn(on);
    gsap.to(c.mat, { emissiveIntensity: on ? 1 : 0, duration: 0.3 });
  }

  function pulseGate() {
    gsap.fromTo(avatarMat, { emissiveIntensity: 1.6 }, { emissiveIntensity: 0.15, duration: 1.0 });
    gsap.fromTo(innerRingMat, { opacity: 1 }, { opacity: 0.7, duration: 1.0 });
    gsap.fromTo(portal.scale, { x: 1.08, y: 1.08, z: 1.08 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
  }

  function pulseRules(color = COLOR.blue) {
    ruleMat.emissive.set(color);
    gsap.fromTo(ruleMat, { emissiveIntensity: 1 }, { emissiveIntensity: 0, duration: 1.0 });
    ruleLabel.setOn(true);
    gsap.delayedCall(0.8, () => ruleLabel.setOn(false));
  }

  return {
    group,
    channels,
    setMode,
    pulseChannel,
    pulseGate,
    pulseRules,
    gate: GATE.clone(),
    rulesPos: rules.position.clone(),
    agentCurve,
    llmCurve,
    ruleCurve,
    pickables: [frame, disc, avatar, ruleBox, ...Object.values(channels).map((c) => c.tile)],
  };
}
