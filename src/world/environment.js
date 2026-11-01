// 环境：星尘、地面网格、Agent 的边界光晕
import * as THREE from 'three';
import { COLOR, makeLabel, refreshFade } from '../core/fx.js';

export function createEnvironment(stage) {
  const { scene } = stage;

  // 远处星尘
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 45 + Math.random() * 90;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    seed[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: stage.pixelRatio } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.3 + aSeed) + aSeed * 40.0));
        vA *= 0.35 + aSeed * 0.65;
        gl_PointSize = (1.0 + aSeed * 1.8) * uScale;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.82, 0.92), smoothstep(0.5, 0.0, d) * vA); }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // 近处漂浮的尘埃
  const M = 500;
  const dpos = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 44;
    dpos[i * 3 + 1] = (Math.random() - 0.3) * 18;
    dpos[i * 3 + 2] = (Math.random() - 0.5) * 36;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0x8fa6c0, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(dust);

  // 地面网格
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vW;
      float grid(vec2 p, float s){ vec2 c = p / s; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){
        float d = length(vW.xz - vec2(-3.0, 0.0));
        float fade = 1.0 - smoothstep(4.0, 30.0, d);
        float a = grid(vW.xz, 1.0) * 0.03 + grid(vW.xz, 5.0) * 0.07;
        gl_FragColor = vec4(vec3(0.55, 0.62, 0.72), a * fade * uOpacity);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.2;
  scene.add(floor);

  // Agent 边界光晕：把 LLM + Harness + 工具 包成一个整体
  const auraMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 }, uColor: { value: new THREE.Color(COLOR.blue) }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 4.5);
        float bands = smoothstep(0.92, 1.0, sin(vP.y * 2.2 - uTime * 0.9));
        float a = f * 0.32 + bands * f * 0.25;
        gl_FragColor = vec4(uColor * 1.2, a * uOpacity);
      }`,
  });
  const aura = new THREE.Group();
  aura.name = 'aura';
  const auraMesh = new THREE.Mesh(new THREE.SphereGeometry(9.3, 96, 64), auraMat);
  auraMesh.scale.y = 0.55;
  auraMesh.userData.info = 'agent';
  aura.add(auraMesh);
  const auraLabel = makeLabel({ text: 'Agent 智能体', en: 'LLM + Harness + 工具', cls: 'lbl-agent', center: [0.5, 1] });
  auraLabel.position.set(0, 5.4, 0);
  aura.add(auraLabel);
  scene.add(aura);
  refreshFade(aura);

  stage.onFrame((dt, t) => {
    starMat.uniforms.uTime.value = t;
    auraMat.uniforms.uTime.value = t;
    stars.rotation.y += dt * 0.004;
    dust.rotation.y += dt * 0.01;
    dust.position.y = Math.sin(t * 0.1) * 0.3;
  });

  return { stars, dust, floor, aura, auraMesh };
}
