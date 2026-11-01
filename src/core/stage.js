// 渲染舞台：渲染器、相机、控制器、辉光后期、CSS2D 标签层
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { tickClock } from './fx.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(14, 10, 24);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3;
  controls.maxDistance = 70;
  controls.rotateSpeed = 0.6;
  controls.autoRotateSpeed = 0.35;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.7);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // 侧边面板会挡住画面，用 viewOffset 把画面中心挪到空白区域中间
  let shift = 0;
  let shiftY = 0;
  let width = 1;
  let height = 1;
  const applyView = () => {
    const s = Math.round(shift);
    const sy = Math.round(shiftY); // 正值 = 画面中心上移
    if (s === 0 && sy === 0) camera.clearViewOffset();
    else camera.setViewOffset(width + Math.abs(s) * 2, height + Math.abs(sy) * 2, s > 0 ? 0 : Math.abs(s) * 2, sy > 0 ? Math.abs(sy) * 2 : 0, width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloom.setSize(width * pixelRatio, height * pixelRatio);
    labelRenderer.setSize(width, height);
    applyView();
  };
  window.addEventListener('resize', resize);
  resize();

  const updaters = new Set();
  const clock = new THREE.Clock();
  let firstFrame = null;
  const firstFramePromise = new Promise((r) => (firstFrame = r));

  // 统一时钟：GSAP 动画、章节脚本的等待、逐帧更新都跟着这个时间走
  gsap.ticker.remove(gsap.updateRoot);
  let elapsed = 0;
  const frame = (dt, render = true) => {
    elapsed += dt;
    gsap.updateRoot(elapsed);
    tickClock(elapsed);
    for (const fn of updaters) fn(dt, elapsed);
    controls.update(dt);
    if (!render) return;
    composer.render();
    labelRenderer.render(scene, camera);
    if (firstFrame) {
      firstFrame();
      firstFrame = null;
    }
  };
  renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.05)));

  // 镜头飞行
  let flight = null;
  const flyTo = (pos, look, duration = 2.2) => {
    flight?.kill();
    controls.enabled = false;
    const from = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, tx: controls.target.x, ty: controls.target.y, tz: controls.target.z };
    const to = { px: pos[0], py: pos[1], pz: pos[2], tx: look[0], ty: look[1], tz: look[2] };
    const state = { ...from };
    flight = gsap.to(state, {
      ...to,
      duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        camera.position.set(state.px, state.py, state.pz);
        controls.target.set(state.tx, state.ty, state.tz);
      },
      onComplete: () => {
        controls.enabled = true;
        flight = null;
      },
    });
  };

  // 屏幕坐标 → 世界坐标（落在过某点、正对相机的平面上）
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const screenToWorld = (sx, sy, through = new THREE.Vector3()) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, through);
    const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : through.clone();
  };

  const pick = (sx, sy, objects) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, false).find((h) => isShown(h.object));
  };

  return {
    renderer,
    scene,
    camera,
    controls,
    bloom,
    pixelRatio,
    onFrame: (fn) => (updaters.add(fn), () => updaters.delete(fn)),
    flyTo,
    screenToWorld,
    pick,
    setShift: (s, sy = 0) => {
      shift = s;
      shiftY = sy;
      applyView();
    },
    firstFrame: firstFramePromise,
    // 调试：在后台标签页里手动推进时间
    advance(seconds, fps = 30) {
      const n = Math.max(1, Math.round(seconds * fps));
      for (let i = 0; i < n; i++) frame(1 / fps, i === n - 1);
    },
  };
}

function isShown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}
