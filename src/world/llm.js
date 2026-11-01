// LLM 核心：能量球（模型本体） + 神经晶格（参数） + 轨道环
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import gsap from 'gsap';
import { COLOR, makeGlow, makeLabel } from '../core/fx.js';

const NOISE = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

export function makeCoreMaterial(color = COLOR.blue) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity; uniform float uOpacity; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      ${NOISE}
      void main(){
        float facing = max(dot(normalize(vN), normalize(vV)), 0.0);
        float fres = pow(1.0 - facing, 2.4);
        vec3 p = normalize(vP);
        float n1 = snoise(p * 1.7 + vec3(0.0, uTime * 0.32, uTime * 0.18));
        float n2 = snoise(p * 4.2 - vec3(uTime * 0.45, 0.0, uTime * 0.3));
        float veins = 1.0 - abs(snoise(p * 3.0 + vec3(uTime * 0.2)));
        veins = pow(veins, 6.0);
        float swirl = smoothstep(-0.35, 1.0, n1 * 0.65 + n2 * 0.35);
        vec3 col = mix(uColor * 0.08, uColor * 0.9, swirl);
        col += uColor * veins * 1.6 * uIntensity;
        col += vec3(0.75, 0.86, 1.0) * pow(facing, 6.0) * 0.32 * uIntensity;
        col += uColor * fres * 2.0 * uIntensity;
        gl_FragColor = vec4(col * (0.55 + 0.45 * uIntensity), uOpacity);
      }`,
  });
}

export function createLLM(stage) {
  const group = new THREE.Group();
  group.name = 'llm';

  // 能量球
  const coreMat = makeCoreMaterial();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 96, 96), coreMat);
  core.userData.info = 'llm';
  group.add(core);

  const halo = makeGlow(COLOR.blue, 5.2, 0.32);
  group.add(halo);

  // 神经晶格：顶点 = 闪烁的"神经元"，棱 = 连接
  const lattice = new THREE.Group();
  group.add(lattice);
  let ico = new THREE.IcosahedronGeometry(1.32, 4);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  ico = mergeVertices(ico);
  const count = ico.attributes.position.count;
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phase[i] = Math.random();
    speed[i] = 0.4 + Math.random() * 1.4;
  }
  ico.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  ico.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const pointsMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRate: { value: 1 }, uOpacity: { value: 1 }, uScale: { value: 300 * stage.pixelRatio } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform float uRate; uniform float uScale;
      varying float vF;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float f = pow(max(0.0, sin(uTime * aSpeed * uRate + aPhase * 6.2831)), 18.0);
        vF = f;
        gl_PointSize = (0.035 + f * 0.07) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vF;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        vec3 c = mix(vec3(0.55, 0.62, 0.72), vec3(0.25, 0.6, 1.0) * 3.0, vF);
        gl_FragColor = vec4(c, a * (0.35 + vF) * uOpacity);
      }`,
  });
  lattice.add(new THREE.Points(ico, pointsMat));

  const edges = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.32, 2)),
    new THREE.LineBasicMaterial({ color: 0x5b6b80, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  lattice.add(edges);

  // 轨道环
  const rings = new THREE.Group();
  group.add(rings);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc7d6ea, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const tilts = [
    [1.2, 0.2, 0],
    [-0.5, 1.0, 0.4],
    [0.3, -0.7, 1.3],
  ];
  tilts.forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62 + i * 0.07, 0.0055, 8, 180), ringMat);
    ring.rotation.set(...r);
    ring.userData.spin = 0.08 + i * 0.05;
    const bead = makeGlow(COLOR.blue, 0.35, 0.9);
    bead.position.set(1.62 + i * 0.07, 0, 0);
    ring.add(bead);
    rings.add(ring);
  });

  const label = makeLabel({ text: 'LLM 大语言模型', en: 'Model', icon: 'brain', cls: 'lbl-main', center: [0.5, 0] });
  label.position.set(0, -1.95, 0);
  group.add(label);

  stage.scene.add(group);

  const state = { intensity: 1, rate: 1, spin: 1 };
  stage.onFrame((dt, t) => {
    coreMat.uniforms.uTime.value = t;
    coreMat.uniforms.uIntensity.value = state.intensity;
    pointsMat.uniforms.uTime.value = t;
    pointsMat.uniforms.uRate.value = state.rate;
    lattice.rotation.y += dt * 0.06 * state.spin;
    lattice.rotation.x = Math.sin(t * 0.1) * 0.12;
    rings.children.forEach((r) => (r.rotation.z += dt * r.userData.spin * state.spin));
    halo.material.opacity = (0.14 + 0.1 * state.intensity) * (group.userData.fade ?? 1);
    halo.scale.setScalar(4.6 + state.intensity * 0.8);
  });

  // "思考"：发光增强、神经元高频闪烁
  let thinkTween = null;
  const think = (duration = 1.2) => {
    thinkTween?.kill();
    thinkTween = gsap
      .timeline()
      .to(state, { intensity: 1.45, rate: 5, spin: 6, duration: 0.35, ease: 'power2.out' })
      .to(state, { intensity: 1, rate: 1, spin: 1, duration: 0.8, ease: 'power2.inOut' }, `+=${Math.max(duration - 0.6, 0)}`);
    return thinkTween;
  };

  return { group, core, label, think, state, position: new THREE.Vector3(0, 0, 0), radius: 1.0, pickables: [core] };
}
