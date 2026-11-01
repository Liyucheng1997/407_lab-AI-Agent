// 第 1 章道具：上方的 token 序列 + 右侧"下一个 token"的概率柱
import * as THREE from 'three';
import gsap from 'gsap';
import { COLOR, makeHtml, refreshFade } from '../core/fx.js';

export function createTokenDemo(stage) {
  const group = new THREE.Group();
  group.name = 'tokens';
  stage.scene.add(group);

  // token 序列：一个 DOM 行，挂在 LLM 上方
  const row = makeHtml('', 'tok-row', [0.5, 1]);
  row.position.set(0, 2.15, 0);
  group.add(row);

  const caption = makeHtml('', 'tok-caption', [0.5, 0]);
  caption.position.set(0, 2.2, 0);
  group.add(caption);

  // 概率柱
  const bars = new THREE.Group();
  bars.position.set(2.05, 0, 0);
  group.add(bars);
  const BAR_N = 5;
  const barItems = [];
  for (let i = 0; i < BAR_N; i++) {
    const y = 0.92 - i * 0.46;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, emissive: COLOR.blue, emissiveIntensity: 0, metalness: 0.1, roughness: 0.6 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.06), mat);
    mesh.position.set(0.5, y, 0);
    const pivot = new THREE.Group();
    pivot.add(mesh);
    pivot.position.y = 0;
    pivot.scale.x = 0.001;
    bars.add(pivot);
    const word = makeHtml('', 'bar-word', [1, 0.5]);
    word.position.set(-0.12, y, 0);
    bars.add(word);
    const pct = makeHtml('', 'bar-pct', [0, 0.5]);
    pct.position.set(0.1, y, 0);
    bars.add(pct);
    barItems.push({ pivot, mesh, mat, word, pct, y });
  }
  refreshFade(group);

  const MAXLEN = 3.2;
  let tokens = [];

  function renderRow() {
    row.inner.innerHTML = tokens.map((t) => `<span class="tok ${t.gen ? 'gen' : ''} ${t.fresh ? 'fresh' : ''}">${t.text}</span>`).join('');
    tokens.forEach((t) => (t.fresh = false));
  }

  return {
    group,
    setCaption(text) {
      caption.inner.textContent = text;
    },
    reset(list) {
      tokens = list.map((text) => ({ text, gen: false }));
      renderRow();
      this.hideBars(0);
    },
    append(text) {
      tokens.push({ text, gen: true, fresh: true });
      renderRow();
    },
    // 每个 token 的世界坐标（用于发射数据包）
    tokenPositions() {
      const els = row.inner.querySelectorAll('.tok');
      return [...els].map((el) => {
        const r = el.getBoundingClientRect();
        return stage.screenToWorld(r.left + r.width / 2, r.top + r.height / 2, row.position);
      });
    },
    rowEndPosition() {
      const r = row.inner.getBoundingClientRect();
      return stage.screenToWorld(r.right + 18, r.top + r.height / 2, row.position);
    },
    showBars(cands) {
      cands.forEach((c, i) => {
        const b = barItems[i];
        b.word.inner.textContent = c.t;
        b.pct.inner.textContent = '';
        b.word.inner.classList.remove('on');
        b.pct.inner.classList.remove('on');
        b.mat.color.set(0x5a5a5e);
        b.mat.emissiveIntensity = 0;
        b.pivot.visible = true;
        const len = Math.max(c.p * MAXLEN, 0.02);
        const st = { s: 0.001 };
        gsap.to(st, {
          s: len,
          duration: 0.9,
          delay: i * 0.08,
          ease: 'expo.out',
          onUpdate: () => {
            b.pivot.scale.x = st.s;
            b.pct.position.x = st.s + 0.1;
            b.pct.inner.textContent = `${Math.round((st.s / MAXLEN) * 100)}%`;
          },
        });
        b.word.inner.style.opacity = '1';
        b.pct.inner.style.opacity = '1';
      });
    },
    pick(i) {
      const b = barItems[i];
      gsap.to(b.mat, { emissiveIntensity: 0.9, duration: 0.4 });
      b.mat.color.set(COLOR.blue);
      b.word.inner.classList.add('on');
      b.pct.inner.classList.add('on');
      return new THREE.Vector3(2.05 + b.pivot.scale.x, b.y, 0);
    },
    hideBars(duration = 0.4) {
      barItems.forEach((b) => {
        gsap.to(b.pivot.scale, { x: 0.001, duration, ease: 'power2.in', onComplete: () => (b.pivot.visible = false) });
        if (!duration) b.pivot.visible = false;
        b.word.inner.style.opacity = '0';
        b.pct.inner.style.opacity = '0';
      });
    },
  };
}
