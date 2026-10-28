/* ============================================================
   DATA SINGULARITY
   A black hole modelled out of data.
   - event horizon + irregular photon ring
   - accretion surface made of math glyphs (instanced quads)
   - TRUE INSPIRAL: every glyph / particle / fiber slides along its own
     flow line toward the horizon, accelerates, is swallowed, and is
     re-emitted at the outer rim.
   - keplerian shear, gravity pulse, dust, stars, caustic fibers
   - custom HDR bloom + film composite
   ============================================================ */

import * as THREE from '../vendor/three.module.js';

/* ------------------------------------------------------------
   0. utils
------------------------------------------------------------ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

let _seed = 20240917;
const rnd = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};
const rr = (a, b) => a + (b - a) * rnd();

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);

/* ------------------------------------------------------------
   1. renderer / scene / camera
------------------------------------------------------------ */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
} catch (err) {
  document.body.classList.add('ready');
  const s = $('#boot-status');
  if (s) s.textContent = 'WebGL2 unavailable';
  throw err;
}

const DPR_MAX = Math.min(window.devicePixelRatio || 1, 1.7);
let dpr = DPR_MAX;
let dprScale = 1;
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 1200);

const view = {
  yaw: -0.52, pitch: 0.66, dist: 30,
  yawT: -0.06, pitchT: 0.28, distT: 18.5,
  shiftX: 0.155, shiftY: -0.035,
  panX: 0, panY: 0, panXT: 0, panYT: 0,
  intro: 0,
};

/* ------------------------------------------------------------
   2. glyph atlas: equations drawn into a canvas
------------------------------------------------------------ */
/* Each paragraph is one long statement built from several equations.
   It is drawn as a 4096px strip and folded into two atlas rows (8 cells),
   so a chain reads cell after cell and reconstructs the whole paragraph. */
const LINES = [
  'R_{μν} − ½R g_{μν} + Λ g_{μν} = (8πG/c⁴) T_{μν} ,  ∇^μT_{μν} = 0 ,  R − 4Λ = −8πG T',
  'ds² = −(1−r_s/r)c²dt² + (1−r_s/r)⁻¹dr² + r²dΩ² ,  r_s = 2GM/c² ,  r₊ = M + √(M²−a²)',
  'iℏ ∂ψ/∂t = [ −(ℏ²/2m)∇² + V(x) ] ψ ,  Ĥ|ψ⟩ = E|ψ⟩ ,  Δx·Δp ≥ ℏ/2 ,  ΔE·Δt ≥ ℏ/2',
  '∇×B = μ₀J + μ₀ε₀ ∂E/∂t ,  ∇·E = ρ/ε₀ ,  ∇·B = 0 ,  F_{μν} = ∂_μA_ν − ∂_νA_μ',
  'S = k_B ln Ω = −k_B ∑ᵢ pᵢ ln pᵢ ,  T_H = ℏc³/(8πGMk_B) ,  dM/dt = −ℏc⁴/(15360πG²M²)',
  'Γ^λ_{μν} = ½g^{λσ}( ∂_μ g_{νσ} + ∂_ν g_{μσ} − ∂_σ g_{μν} ) ,  d²x^μ/dτ² + Γ^μ_{αβ}u^αu^β = 0',
  'T_{μν} = (ε+p)u_μu_ν + p g_{μν} ,  ∂ρ/∂t + ∇·(ρv) = 0 ,  ρ(∂v/∂t + v·∇v) = −∇p + μ∇²v',
  '⟨0|φ(x)φ(y)|0⟩ = ∫ d³p/(2π)³ e^{−ip·(x−y)}/(2E_p) ,  ℒ = −¼F² + ψ̄(iγ^μD_μ − m)ψ',
];

function makeGlyphAtlas(renderer) {
  const W = 2048;
  const H = 3072;
  const COLS = 4;
  const ROWS = 24;          // 0-15 equations, 16-23 user ink
  const CW = W / COLS;
  const CH = H / ROWS;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const family = '"Cambria Math", "STIX Two Math", "Constantia", "Times New Roman", serif';
  const strip = document.createElement('canvas');
  strip.width = 4096;
  strip.height = CH;
  const sctx = strip.getContext('2d');
  sctx.textBaseline = 'middle';
  sctx.textAlign = 'left';

  for (let g = 0; g < LINES.length; g++) {
    const text = LINES[g];
    sctx.clearRect(0, 0, 4096, CH);
    let size = 100;
    sctx.font = `italic ${size}px ${family}`;
    const w = sctx.measureText(text).width;
    if (w > 4096 - 60) {
      size *= (4096 - 60) / w;
      sctx.font = `italic ${size}px ${family}`;
    }
    sctx.fillStyle = 'rgba(255,255,255,.96)';
    sctx.fillText(text, 26, CH * 0.55);
    ctx.drawImage(strip, 0, 0, W, CH, 0, g * 2 * CH, W, CH);
    ctx.drawImage(strip, W, 0, W, CH, 0, (g * 2 + 1) * CH, W, CH);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;

  return { tex, cols: COLS, rows: ROWS, groups: LINES.length, canvas: cv, ctx, cw: CW, ch: CH, inkRows: 8 };
}

/* ------------------------------------------------------------
   3. flow field
------------------------------------------------------------ */
const F = {
  rIn: 1.66,
  rOut: 24.0,
  flowIn: 1.16, // radius at which data is swallowed
  pitch: 1.02,
  lanes: 112,
  bowl: 6.0,
  tilt: 2.6,
  life: 38.0, // seconds for a glyph to fall from rim to horizon
  spin: 0.9,
};

for (const k of ['rIn', 'rOut', 'pitch', 'lanes', 'bowl', 'tilt', 'spin', 'flowIn', 'life']) {
  if (Q.has(k)) F[k] = parseFloat(Q.get(k));
}

function hgt(r, phi) {
  const t = clamp((r - F.rIn) / (F.rOut - F.rIn), 0, 1);
  const bowl = F.bowl * Math.pow(t, 1.7);
  const tilt = -F.tilt * t * t * Math.sin(phi);
  const ripple = 0.17 * t * Math.sin(phi * 3.0 + r * 0.45);
  return bowl + tilt + ripple + 0.03 * Math.sin(phi * 6.0 + r * 0.8) * (0.2 + 0.8 * t);
}

const _n = new THREE.Vector3();
const lanePhi = (r, psi, seed) =>
  psi + F.pitch * Math.log(r / F.rIn) + 0.075 * Math.sin(r * 0.42 + seed) + 0.03 * Math.sin(r * 1.35 + seed * 2.1);

// inverse of the fall curve: radius -> flow phase
const phaseOf = (r) =>
  clamp((F.rOut - r) / (F.rOut - F.flowIn), 0, 1);

function surfaceNormal(r, phi, out) {
  const dr = 0.02;
  const dp = 0.004;
  const h1 = hgt(r + dr, phi);
  const h0 = hgt(r - dr, phi);
  const hp = hgt(r, phi + dp);
  const hm = hgt(r, phi - dp);

  const cp = Math.cos(phi);
  const sp = Math.sin(phi);

  const ax = cp + F.pitch * sp;
  const ay = (h1 - h0) / (2 * dr);
  const az = sp - F.pitch * cp;

  const bx = -r * sp;
  const by = (hp - hm) / (2 * dp);
  const bz = r * cp;

  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  out.set(nx, ny, nz);
  return out;
}

/* ------------------------------------------------------------
   4. build the data surface
   every quad stores only (lane, seed, phase) - the vertex shader
   reconstructs its current radius / tangent / normal each frame,
   so the sheet is continuously falling inward.
------------------------------------------------------------ */
function buildGlyphField(atlas) {
  const flow = [];
  const par = [];
  const uvs = [];
  const offs = [];

  const cellX = 1 / atlas.cols;
  const cellY = 1 / atlas.rows;

  const MAX = 40000;
  let count = 0;
  let rows = 0;

  const add = (r, psi, seed, w, h, alpha, col, row, laneRand, laneOff) => {
    if (count >= MAX || r < F.rIn || r > F.rOut) return;

    flow.push(psi, seed, phaseOf(r), rnd());
    par.push(w, h, alpha, laneRand);
    uvs.push(col * cellX, 1 - (row + 1) * cellY);
    offs.push(laneOff);
    count++;
  };

  // one lane = one chain. Most lanes are long continuous paragraphs,
  // some break into shorter bursts so the field gets rhythm.
  for (let i = 0; i < F.lanes; i++) {
    const psi = (i / F.lanes) * TAU + rr(-0.35, 0.35) * (TAU / F.lanes);
    const seed = i * 1.37;
    const laneBright = rr(0.62, 1.12) * (i % 9 === 0 ? 1.35 : 1.0);
    const laneRand = rnd();
    const wScale = rr(0.78, 1.26);
    const laneOff = rnd();
    rows++;

    const modeRoll = rnd();
    const mode = modeRoll < 0.70 ? 0 : modeRoll < 0.92 ? 1 : 2; // 0 long, 1 medium, 2 short
    const gapMin = mode === 1 ? 2 : 4;
    const gapMax = mode === 1 ? 4 : 8;

    let g = (i * 3 + 1) % atlas.groups;
    let pos = 0;
    let segRemain = mode === 0 ? 999 : 0;
    let gapRemain = 0;

    let r = F.rIn + 0.02;
    while (r < F.rOut - 0.05) {
      const w = clamp(0.60 + 0.110 * r, 0.95, 2.7) * wScale * (0.96 + 0.07 * Math.sin(r * 0.5 + i * 2.3));
      const h = w * 0.24;
      const step = (w * 0.985) / Math.sqrt(1 + F.pitch * F.pitch);

      // a new segment begins: restart at the head of a paragraph
      if (segRemain <= 0 && gapRemain <= 0) {
        if (mode === 1) segRemain = 6 + ((rnd() * 10) | 0);
        else if (mode === 2) segRemain = 2 + ((rnd() * 5) | 0);
        g = ((i * 5 + rnd() * 8) | 0) % atlas.groups;
        pos = 0;
      }

      if (gapRemain > 0) {
        gapRemain--;
        r += step;
        continue;
      }

      const row = g * 2 + (pos >= 4 ? 1 : 0);
      const col = pos % 4;
      const fadeIn = smoothstep(0, 1.5, r - F.rIn);
      const fadeOut = smoothstep(0, 1.7, F.rOut - r);
      const a = laneBright * fadeIn * fadeOut * (0.92 + 0.08 * Math.sin(r * 0.45 + i));

      add(r, psi, seed, w, h, a, col, row, laneRand, laneOff);

      segRemain--;
      pos++;
      if (pos === 8) {
        pos = 0;
        g = (g + 1 + (i % 3)) % atlas.groups;
      }
      if (segRemain === 0 && mode !== 0) gapRemain = gapMin + ((rnd() * (gapMax - gapMin + 1)) | 0);

      r += step;
    }
  }

  const geo = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  geo.index = plane.index;
  geo.attributes.position = plane.attributes.position;
  geo.attributes.uv = plane.attributes.uv;
  geo.instanceCount = count;

  geo.setAttribute('aFlow', new THREE.InstancedBufferAttribute(new Float32Array(flow), 4));
  geo.setAttribute('aPar', new THREE.InstancedBufferAttribute(new Float32Array(par), 4));
  geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(new Float32Array(uvs), 2));
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 1));
  geo.setAttribute('aInk', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));

  return { geo, count, rows };
}

/* ------------------------------------------------------------
   5. shared uniforms
------------------------------------------------------------ */
const U = {
  uTime: { value: 0 },
  uFlow: { value: 0 },
  uSpin: { value: F.spin },
  uDensity: { value: 1.0 },
  uPulseR: { value: -20 },
  uPulseAmp: { value: 0 },
  uLens: { value: 1.0 },
  uPR: { value: dpr },
  uProj: { value: 1000 },
  uCell: { value: new THREE.Vector2(0.25, 0.0625) },
  uTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
  uRIn: { value: F.rIn },
  uROut: { value: F.rOut },
  uFlowIn: { value: F.flowIn },
  uK: { value: F.pitch },
  uBowl: { value: F.bowl },
  uTilt: { value: F.tilt },
  uLife: { value: F.life },
  uColA: { value: new THREE.Color(0.93, 0.97, 1.0) },
  uColB: { value: new THREE.Color(0.80, 0.91, 1.0) },
  uColC: { value: new THREE.Color(0.66, 0.82, 1.0) },
  uTint: { value: 0.0 },
  uColorMode: { value: 0.0 },
  uFreezeSeed: { value: -9999 },
  uFreezeFlow: { value: 0 },
  uFreezeTime: { value: 0 },
  uFreezeAmt: { value: 0 },
};

/* GLSL chunk shared by every flowing system */
const FLOW_GLSL = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uFlow;
  uniform float uSpin;
  uniform float uRIn, uROut, uFlowIn, uK, uBowl, uTilt, uLife;

  mat3 rotY(float a){
    float c = cos(a), s = sin(a);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  float hgt(float r, float phi){
    float t = clamp((r - uRIn) / (uROut - uRIn), 0.0, 1.0);
    return uBowl * pow(t, 1.7)
         - uTilt * t * t * sin(phi)
         + 0.17 * t * sin(phi * 3.0 + r * 0.45)
         + 0.03 * sin(phi * 6.0 + r * 0.8) * (0.2 + 0.8 * t);
  }

  float laneA(float r, float psi, float seed){
    return psi + uK * log(max(r, 0.08) / uRIn)
         + 0.075 * sin(r * 0.42 + seed)
         + 0.03 * sin(r * 1.35 + seed * 2.1);
  }

  float fallRadius(float phase, float lifeScale){
    float tau = fract(phase + uFlow / (uLife * lifeScale));
    return uROut - (uROut - uFlowIn) * tau;
  }

  float spinAngleT(float r, float t){
    return -uSpin * t * (0.20 + 0.55 * pow(max(r, 1.6), -0.95));
  }

  float spinAngle(float r){
    return spinAngleT(r, uTime);
  }
`;

/* ------------------------------------------------------------
   6. the data sheet
------------------------------------------------------------ */
const atlas = makeGlyphAtlas(renderer);
U.uCell.value.set(1 / atlas.cols, 1 / atlas.rows);

const glyphMat = new THREE.ShaderMaterial({
  uniforms: {
    ...U,
    uAtlas: { value: atlas.tex },
    uColor: { value: new THREE.Color(0.92, 0.965, 1.0) },
  },
  vertexShader: /* glsl */ `
    ${FLOW_GLSL}

    attribute vec4 aFlow;   // psi, seed, phase, rand
    attribute vec4 aPar;    // width, height, alpha, rand
    attribute vec2 aUv;
    attribute float aOff;
    attribute float aInk;

    uniform float uDensity;
    uniform vec2 uCell;
    uniform vec2 uTexel;
    uniform vec3 uColA, uColB, uColC;
    uniform float uTint, uColorMode;
    uniform float uFreezeSeed, uFreezeFlow, uFreezeTime, uFreezeAmt;

    varying vec2 vUv;
    varying float vA;
    varying vec3 vC;

    void main(){
      float psi = aFlow.x;
      float seed = aFlow.y;
      float phase = aFlow.z;
      float rnd = aFlow.w;

      float frozen = step(abs(seed - uFreezeSeed), 0.004) * uFreezeAmt;
      float flowT = mix(uFlow, uFreezeFlow, frozen);
      float tau = fract(phase + flowT / uLife + aOff);
      float r = uROut - (uROut - uFlowIn) * tau;

      float phi = laneA(r, psi, seed);
      float dr = 0.035;
      float pA = laneA(max(r - dr, 0.09), psi, seed);
      float pB = laneA(r + dr, psi, seed);

      vec3 A = vec3((r - dr) * cos(pA), hgt(r - dr, pA), (r - dr) * sin(pA));
      vec3 B = vec3((r + dr) * cos(pB), hgt(r + dr, pB), (r + dr) * sin(pB));
      vec3 T0 = normalize(B - A);

      float dp = 0.008;
      vec3 Cp = vec3(r * cos(phi + dp), hgt(r, phi + dp), r * sin(phi + dp));
      vec3 Cm = vec3(r * cos(phi - dp), hgt(r, phi - dp), r * sin(phi - dp));
      vec3 N0 = normalize(cross(B - A, Cp - Cm));
      if (N0.y < 0.0) N0 = -N0;

      float ang = spinAngleT(r, mix(uTime, uFreezeTime, frozen));
      mat3 R = rotY(ang);

      vec3 P = R * vec3(r * cos(phi), hgt(r, phi), r * sin(phi));
      vec3 T = R * T0;
      vec3 N = R * N0;
      vec3 Bt = normalize(cross(N, T));

      // hand written feel + thickness of the sheet
      float roll = (fract(rnd * 37.3) - 0.5) * 0.34;
      float cr = cos(roll), sr = sin(roll);
      vec3 T2 = T * cr + Bt * sr;
      vec3 B2 = Bt * cr - T * sr;

      // tidal stretching right before the horizon
      float stretch = 1.0 + 0.45 * (1.0 - smoothstep(1.5, 5.2, r));
      vec3 wp = P
        + T2 * (position.x * aPar.x * stretch)
        + B2 * (position.y * aPar.y)
        + N * (fract(rnd * 11.7) - 0.5) * 0.02 * r;

      vec4 mv = modelViewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mv;

      float depth = max(-mv.z, 0.001);
      float nearFade = smoothstep(3.0, 10.0, depth);
      float swallow = smoothstep(uFlowIn, uFlowIn + 2.35, r);
      float spawn = smoothstep(0.0, 0.028, tau);

      float hot = 0.82 + 0.34 * exp(-(r - 1.7) / 3.0);
      float tw = 0.86 + 0.14 * sin(uTime * 1.1 + rnd * 61.0);

      float angT = atan(P.z, P.x);
      float caus = 0.5 + 0.5 * sin(angT * 2.0 + r * 0.62 - uTime * 0.75 + sin(r * 0.4) * 1.8);
      caus = pow(caus, 2.6);
      float fine = 0.88 + 0.12 * sin(angT * 46.0 + r * 2.6);

      float dens = mix(0.30, 1.0, uDensity);
      float keep = step(fract(aPar.w * 7.31 + aUv.x), 0.45 + 0.55 * uDensity);

      vA = aPar.z * tw * hot * nearFade * swallow * spawn * dens * mix(1.0, keep, 0.85);
      vA *= (0.80 + 0.72 * caus) * fine;

      float cu = clamp((r - uFlowIn) / (uROut - uFlowIn), 0.0, 1.0);
      float lc = fract(seed * 0.371 + aUv.x * 3.0);
      vec3 tint;
      if (uColorMode < 0.5) {
        tint = uColA;
      } else if (uColorMode < 1.5) {
        tint = lc < 0.34 ? uColA : (lc < 0.67 ? uColB : uColC);
      } else {
        tint = mix(uColA, uColB, smoothstep(0.0, 0.78, cu));
        tint = mix(tint, uColC, smoothstep(0.55, 1.0, cu) * 0.75);
      }
      vC = mix(vec3(0.93, 0.97, 1.0), tint * 1.18, uTint);
      if (aInk > 0.5) {
        vC = mix(vC, uColA * 1.35 + vec3(0.06), 0.82);
        vA *= 1.25;
      }
      if (frozen > 0.5) {
        vC = mix(vC, vec3(0.96, 0.99, 1.0), 0.55);
        vA *= 1.35;
      }

      vUv = aUv + uv * (uCell - uTexel) + uTexel * 0.5;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D uAtlas;
    varying vec2 vUv;
    varying float vA;
    varying vec3 vC;

    void main(){
      float t = texture2D(uAtlas, vUv).a;
      float a = smoothstep(0.05, 0.34, t) * vA;
      if (a < 0.0025) discard;
      gl_FragColor = vec4(vC * a, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
});

const field = buildGlyphField(atlas);
const glyphMesh = new THREE.Mesh(field.geo, glyphMat);
glyphMesh.frustumCulled = false;
glyphMesh.renderOrder = 4;
scene.add(glyphMesh);

/* ------------------------------------------------------------
   6b. USER INK — 20% of the data cells carry the user's own words
------------------------------------------------------------ */
const INK = { pool: [], baseUv: null, uv: null, ink: null, count: 0, cells: 0 };

function fragmentText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  let buf = '';
  for (const ch of clean) {
    buf += ch;
    if (buf.length >= 13) { out.push(buf); buf = ''; }
  }
  if (buf.trim().length >= 3) out.push(buf);
  return out.slice(0, 40);
}

function drawInkAtlas(pool) {
  const { ctx, cw, ch, inkRows, cols } = atlas;
  const total = inkRows * cols;
  ctx.clearRect(0, 16 * ch, 2048, inkRows * ch);
  if (!pool.length) { atlas.tex.needsUpdate = true; return; }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let c = 0; c < total; c++) {
    const row = 16 + ((c / cols) | 0);
    const col = c % cols;
    const x = col * cw;
    const y = row * ch;
    const text = pool[c % pool.length];
    let size = 60;
    ctx.font = `italic ${size}px "Cambria Math", "Constantia", "Times New Roman", serif`;
    let w = ctx.measureText(text).width;
    if (w > cw * 0.94) {
      size *= (cw * 0.94) / w;
      ctx.font = `italic ${size}px "Cambria Math", "Constantia", "Times New Roman", serif`;
    }
    ctx.fillStyle = 'rgba(255,255,255,.97)';
    ctx.fillText(text, x + 7, y + ch * 0.55);
  }
  atlas.tex.needsUpdate = true;
}

function initInk() {
  const geo = field.geo;
  INK.uv = geo.getAttribute('aUv');
  INK.ink = geo.getAttribute('aInk');
  INK.baseUv = new Float32Array(INK.uv.array);
  INK.count = INK.uv.count;
  INK.cells = atlas.inkRows * atlas.cols;
  drawInkAtlas([]);
}

function injectInk(text) {
  const frags = fragmentText(text);
  if (!frags.length) return;
  INK.pool.push(...frags);
  if (INK.pool.length > 120) INK.pool = INK.pool.slice(-120);
  drawInkAtlas(INK.pool);

  const uvs = INK.uv.array;
  const ink = INK.ink.array;
  uvs.set(INK.baseUv);
  ink.fill(0);

  let k = 0;
  for (let i = 0; i < INK.count; i++) {
    if (i % 5 > 1) continue;                 // ~40 % of the stream
    const cell = k % INK.cells;
    k++;
    const row = 16 + ((cell / atlas.cols) | 0);
    const col = cell % atlas.cols;
    uvs[i * 2] = col / atlas.cols;
    uvs[i * 2 + 1] = 1 - (row + 1) / atlas.rows;
    ink[i] = 1;
  }
  INK.uv.needsUpdate = true;
  INK.ink.needsUpdate = true;
}

initInk();

/* ------------------------------------------------------------
   7. horizon, photon ring, glow
------------------------------------------------------------ */
const horizonMat = new THREE.ShaderMaterial({
  uniforms: { uLens: U.uLens },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec3 vN;
    varying vec3 vV;
    uniform float uLens;
    void main(){
      float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      float rim = pow(clamp(f, 0.0, 1.0), 10.0);
      vec3 col = vec3(0.86, 0.94, 1.0) * rim * 1.5 * uLens;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 48), horizonMat);
horizon.renderOrder = 1;
scene.add(horizon);

const ringMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: U.uTime,
    uLens: U.uLens,
    uSize: { value: 8.0 },
    uR: { value: 1.17 },
    uW: { value: 0.026 },
    uColA: U.uColA,
    uTint: U.uTint,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime, uSize, uR, uW, uLens;
    uniform vec3 uColA;
    uniform float uTint;

    void main(){
      vec2 p = (vUv - 0.5) * uSize;
      float r = length(p);
      float ang = atan(p.y, p.x);

      float wob = 0.022 * sin(ang * 3.0 + 1.7) + 0.012 * sin(ang * 7.0 - 0.6);
      float rr = uR + wob;

      float band = exp(-pow((r - rr) / (uW * 1.6), 2.0));
      float core = exp(-pow((r - rr) / (uW * 0.5), 2.0)) * 2.4;
      float halo = exp(-pow((r - rr) / 0.42, 2.0)) * 0.16;

      float hot = 0.38 + 0.62 * pow(0.5 + 0.5 * cos(ang - 2.15), 2.2);
      float knot = 1.1 * exp(-pow((ang - 0.05) / 0.55, 2.0)) * exp(-pow((r - rr) / 0.2, 2.0));
      float grain = 0.80 + 0.20 * sin(ang * 170.0 + uTime * 2.0) * sin(ang * 43.0 + 2.0);

      float a = (band * hot + core * hot * 0.5 + halo + knot) * uLens * grain;
      if (a < 0.002) discard;
      vec3 rc = mix(vec3(0.93, 0.97, 1.0), uColA * 1.15, uTint);
      gl_FragColor = vec4(rc * a, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});
const ring = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), ringMat);
ring.renderOrder = 6;
scene.add(ring);

const glowMat = new THREE.ShaderMaterial({
  uniforms: { uLens: U.uLens, uSize: { value: 18.0 }, uColA: U.uColA, uTint: U.uTint },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uLens, uSize;
    uniform vec3 uColA;
    uniform float uTint;
    void main(){
      vec2 p = (vUv - 0.5) * uSize;
      float r = length(p);
      float a = exp(-pow(r / 2.2, 2.0)) * 0.16 + exp(-r * 0.6) * 0.015;
      a *= smoothstep(1.05, 2.6, r);
      a *= uLens;
      vec3 gc = mix(vec3(0.58, 0.74, 1.0), uColA * 0.85, uTint);
      gl_FragColor = vec4(gc * a, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});
const glow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), glowMat);
glow.renderOrder = 2;
scene.add(glow);

/* ------------------------------------------------------------
   8. dust: falls along the same flow, faster
------------------------------------------------------------ */
function buildParticles(count) {
  const flow = new Float32Array(count * 4);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const inner = rnd() < 0.45;
    const u = Math.pow(rnd(), inner ? 2.4 : 1.0);
    const r0 = F.rIn + (F.rOut - F.rIn) * u;
    const psi = rr(0, TAU);
    flow[i * 4] = psi;
    flow[i * 4 + 1] = rnd();
    flow[i * 4 + 2] = phaseOf(r0);
    flow[i * 4 + 3] = rnd();
    size[i] = rr(0.010, 0.036) * (inner ? 1.2 : 1.0);
    alpha[i] = rr(0.2, 0.95) * (inner ? 1.3 : 0.7);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aFlow', new THREE.BufferAttribute(flow, 4));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  return g;
}

const particleMat = new THREE.ShaderMaterial({
  uniforms: {
    ...U,
    uColor: { value: new THREE.Color(0.9, 0.96, 1.0) },
  },
  vertexShader: /* glsl */ `
    ${FLOW_GLSL}

    attribute vec4 aFlow;   // psi, seed, phase, rand
    attribute float aSize, aAlpha;

    uniform float uPR, uProj, uDensity, uPulseAmp, uPulseR;
    uniform vec3 uColA;
    uniform float uTint;
    varying float vA;
    varying vec3 vC;

    void main(){
      float tau = fract(aFlow.z + uFlow / (uLife * 0.62));
      float r = uROut - (uROut - uFlowIn) * tau;
      float phi = laneA(r, aFlow.x, aFlow.y * 9.0);

      float ang = spinAngle(r);
      vec3 p = rotY(ang) * vec3(r * cos(phi), hgt(r, phi), r * sin(phi));

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float depth = max(-mv.z, 0.01);
      gl_PointSize = clamp(aSize * uPR * uProj / depth, 0.5, 2.7);

      float swallow = smoothstep(uFlowIn, uFlowIn + 1.9, r);
      float spawn = smoothstep(0.0, 0.02, tau);
      float tw = 0.55 + 0.45 * sin(uTime * 1.9 + aFlow.w * 45.0);
      float pulse = exp(-pow((r - uPulseR) * 0.5, 2.0)) * uPulseAmp;

      vA = aAlpha * tw * swallow * spawn * smoothstep(3.0, 9.0, depth)
         * (0.35 + 0.65 * uDensity) * (1.0 + pulse * 1.8) * 0.85;
      vC = mix(vec3(0.90, 0.96, 1.0), uColA * 1.25, uTint);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying float vA;
    varying vec3 vC;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      float a = exp(-d * d * 4.2) * smoothstep(1.0, 0.45, d);
      if (a * vA < 0.002) discard;
      gl_FragColor = vec4(vC * a * vA, a * vA);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(buildParticles(11000), particleMat);
particles.frustumCulled = false;
particles.renderOrder = 5;
scene.add(particles);

/* ------------------------------------------------------------
   9. stars
------------------------------------------------------------ */
function buildStars(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = rr(0, TAU);
    const ph = Math.acos(2 * rnd() - 1);
    const rad = rr(180, 420);
    pos[i * 3] = rad * Math.sin(ph) * Math.cos(theta);
    pos[i * 3 + 1] = rad * Math.cos(ph);
    pos[i * 3 + 2] = rad * Math.sin(ph) * Math.sin(theta);

    const t = rnd();
    let r = 1, g = 1, b = 1;
    if (t < 0.16) { r = 0.74; g = 0.86; b = 1.0; }
    else if (t < 0.28) { r = 1.0; g = 0.93; b = 0.82; }
    const bright = Math.pow(rnd(), 1.9) * 0.9 + 0.1;
    col[i * 3] = r * bright;
    col[i * 3 + 1] = g * bright;
    col[i * 3 + 2] = b * bright;
    size[i] = rnd() < 0.035 ? rr(2.4, 4.0) : rr(0.9, 2.0);
    seed[i] = rnd();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}

const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uPR: U.uPR },
  vertexShader: /* glsl */ `
    precision highp float;
    attribute vec3 aColor;
    attribute float aSize, aSeed;
    uniform float uTime, uPR;
    varying vec3 vC;
    varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.7 + 0.3 * sin(uTime * (0.4 + aSeed * 1.2) + aSeed * 97.0);
      gl_PointSize = aSize * uPR * (0.9 + 0.3 * tw);
      vC = aColor;
      vA = tw;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec3 vC;
    varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      float a = smoothstep(1.0, 0.1, d);
      a = pow(a, 1.4);
      gl_FragColor = vec4(vC * vA * a, a * vA);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});

const stars = new THREE.Points(buildStars(16000), starMat);
stars.frustumCulled = false;
stars.renderOrder = 0;
scene.add(stars);

/* ------------------------------------------------------------
   10. light wires: stream inward along their lanes
------------------------------------------------------------ */
function buildWires() {
  const positions = [];
  const flows = [];
  const alphas = [];
  const seeds = [];

  const N = 46;
  for (let i = 0; i < N; i++) {
    const psi = rr(0, TAU);
    const seed = i * 1.9;
    const r0 = rr(2.0, 8.0);
    const r1 = rr(F.rOut * 0.8, F.rOut);
    const segs = 64;
    const bright = rnd() < 0.16 ? 0.30 : rr(0.05, 0.16);
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs;
      const t1 = (k + 1) / segs;
      const ra = lerp(r0, r1, t0);
      const rb = lerp(r0, r1, t1);
      const pa = lanePhi(ra, psi, seed);
      const pb = lanePhi(rb, psi, seed);
      const fade = Math.sin(Math.PI * t0) * 0.85 + 0.15;
      positions.push(
        ra * Math.cos(pa), hgt(ra, pa) + 0.03, ra * Math.sin(pa),
        rb * Math.cos(pb), hgt(rb, pb) + 0.03, rb * Math.sin(pb)
      );
      flows.push(psi, seed, phaseOf(ra), 0, psi, seed, phaseOf(rb), 0);
      alphas.push(bright * fade, bright * fade);
      seeds.push(i % 11, i % 11);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 4));
  g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  return g;
}

const wireMat = new THREE.ShaderMaterial({
  uniforms: { ...U },
  vertexShader: /* glsl */ `
    ${FLOW_GLSL}

    attribute vec4 aFlow;
    attribute float aAlpha, aSeed;
    uniform float uLens;
    varying float vA;

    void main(){
      float tau = fract(aFlow.z + uFlow / (uLife * 0.85));
      float r = uROut - (uROut - uFlowIn) * tau;
      float phi = laneA(r, aFlow.x, aFlow.y);

      float ang = spinAngle(r);
      vec3 p = rotY(ang) * vec3(r * cos(phi), hgt(r, phi) + 0.03, r * sin(phi));
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);

      float swallow = smoothstep(uFlowIn - 0.02, uFlowIn + 0.6, r);
      float spawn = smoothstep(0.0, 0.03, tau);
      vA = aAlpha * (0.5 + 0.5 * sin(uTime * 1.2 + aSeed * 5.0 + r * 0.5)) * uLens * swallow * spawn;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying float vA;
    void main(){
      if (vA < 0.004) discard;
      gl_FragColor = vec4(vec3(0.76, 0.9, 1.0) * vA, vA);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});

const wires = new THREE.LineSegments(buildWires(), wireMat);
wires.frustumCulled = false;
wires.renderOrder = 3;
scene.add(wires);

/* ------------------------------------------------------------
   11. caustic fibers: bright ribbons riding the same flow
------------------------------------------------------------ */
function buildFibers() {
  const pos = [];
  const alp = [];
  const flows = [];
  const up = new THREE.Vector3();
  const T = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const N = 36;
  for (let i = 0; i < N; i++) {
    const psi = rr(0, TAU);
    const seed = rr(0, 20);
    const r0 = rr(1.68, 3.4);
    const r1 = rr(F.rOut * 0.55, F.rOut * 0.99);
    const segs = 96;
    const w = rr(0.02, 0.06);
    const bright = rr(0.22, 0.62) * (rnd() < 0.25 ? 2.1 : 1.0);
    const phase = rr(0, TAU);

    const pts = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const r = lerp(r0, r1, t);
      const phi = lanePhi(r, psi, seed);
      const p = new THREE.Vector3(r * Math.cos(phi), hgt(r, phi) + 0.04, r * Math.sin(phi));
      const dr = 0.05;
      const pa = lanePhi(r - dr, psi, seed);
      const pb = lanePhi(r + dr, psi, seed);
      const ax = (r - dr) * Math.cos(pa), az = (r - dr) * Math.sin(pa);
      const bx = (r + dr) * Math.cos(pb), bz = (r + dr) * Math.sin(pb);
      T.set(bx - ax, hgt(r + dr, pb) - hgt(r - dr, pa), bz - az).normalize();
      surfaceNormal(r, phi, nrm);
      up.crossVectors(T, nrm).normalize();

      const a = bright * Math.pow(Math.sin(Math.PI * t), 0.65) * (0.65 + 0.35 * Math.sin(t * 22 + phase));
      const ww = w * (0.55 + 0.45 * Math.sin(Math.PI * t));
      pts.push({
        l: [p.x - up.x * ww, p.y - up.y * ww, p.z - up.z * ww],
        c: [p.x, p.y, p.z],
        r: [p.x + up.x * ww, p.y + up.y * ww, p.z + up.z * ww],
        a,
        ph: phaseOf(r),
      });
    }

    const quad = (p1, a1, p2, a2, p3, a3, ph) => {
      pos.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
      alp.push(a1, a2, a3);
      flows.push(psi, seed, ph, 0, psi, seed, ph, 0, psi, seed, ph, 0);
    };

    for (let k = 0; k < segs; k++) {
      const A = pts[k], B = pts[k + 1];
      quad(A.l, 0, A.c, A.a, B.l, 0, A.ph);
      quad(A.c, A.a, B.c, B.a, B.l, 0, A.ph);
      quad(A.c, A.a, A.r, 0, B.c, B.a, A.ph);
      quad(A.r, 0, B.c, B.a, B.r, 0, A.ph);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 4));
  g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alp, 1));
  return g;
}

const fiberMat = new THREE.ShaderMaterial({
  uniforms: { ...U },
  vertexShader: /* glsl */ `
    ${FLOW_GLSL}

    attribute vec4 aFlow;
    attribute float aAlpha;
    uniform float uLens;
    uniform vec3 uColA;
    uniform float uTint;
    varying float vA;
    varying vec3 vC;

    void main(){
      float tau = fract(aFlow.z + uFlow / (uLife * 0.8));
      float r = uROut - (uROut - uFlowIn) * tau;
      float phi = laneA(r, aFlow.x, aFlow.y);

      float ang = spinAngle(r);
      vec3 p = rotY(ang) * vec3(r * cos(phi), hgt(r, phi) + 0.04, r * sin(phi));
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);

      float swallow = smoothstep(uFlowIn - 0.02, uFlowIn + 0.5, r);
      float spawn = smoothstep(0.0, 0.03, tau);
      vA = aAlpha * uLens * swallow * spawn;
      vC = mix(vec3(0.86, 0.95, 1.0), uColA * 1.2, uTint);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying float vA;
    varying vec3 vC;
    void main(){
      if (vA < 0.003) discard;
      gl_FragColor = vec4(vC * vA, vA);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
});

const fibers = new THREE.Mesh(buildFibers(), fiberMat);
fibers.frustumCulled = false;
fibers.renderOrder = 4;
scene.add(fibers);

/* ------------------------------------------------------------
   12. post: HDR bloom + film composite
------------------------------------------------------------ */
class Post {
  constructor() {
    this.sceneRT = null;
    this.mips = [];
    this.levels = 6;

    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);

    const vs = /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `;

    this.bright = new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 0.72 },
        uKnee: { value: 0.35 },
      },
      vertexShader: vs,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tSrc;
        uniform vec2 uTexel;
        uniform float uThreshold, uKnee;
        void main(){
          vec3 c = vec3(0.0);
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
          c *= 0.25;
          float br = max(max(c.r, c.g), c.b);
          float k = smoothstep(uThreshold, uThreshold + uKnee, br);
          gl_FragColor = vec4(c * k, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.down = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: vs,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tSrc;
        uniform vec2 uTexel;
        void main(){
          vec3 c = vec3(0.0);
          c += texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2( 0.5, -0.5)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(-0.5,  0.5)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
          gl_FragColor = vec4(c * 0.25, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.up = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1.0 } },
      vertexShader: vs,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tSrc;
        uniform vec2 uTexel;
        uniform float uWeight;
        void main(){
          vec3 s = vec3(0.0);
          s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 1.0;
          s += texture2D(tSrc, vUv + uTexel * vec2( 0.0, -1.0)).rgb * 2.0;
          s += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb * 1.0;
          s += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  0.0)).rgb * 2.0;
          s += texture2D(tSrc, vUv).rgb * 4.0;
          s += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  0.0)).rgb * 2.0;
          s += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb * 1.0;
          s += texture2D(tSrc, vUv + uTexel * vec2( 0.0,  1.0)).rgb * 2.0;
          s += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb * 1.0;
          gl_FragColor = vec4(s / 16.0 * uWeight, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.comp = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uRes: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uBloom: { value: 0.85 },
        uExposure: { value: 1.08 },
        uGrain: { value: 0.016 },
        uChroma: { value: 1.0 },
        uVig: { value: 0.30 },
        uHole: { value: new THREE.Vector3(0.34, 0.5, 0.05) },
        uWipe: { value: 3.0 },
        uFlash: { value: 0.0 },
        uColA: U.uColA,
        uTint: U.uTint,
      },
      vertexShader: vs,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tScene, tBloom;
        uniform vec2 uRes;
        uniform float uTime, uBloom, uExposure, uGrain, uChroma, uVig;
        uniform vec3 uHole;
        uniform float uWipe, uFlash;
        uniform vec3 uColA;
        uniform float uTint;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

        void main(){
          vec2 uv = vUv;
          vec2 d = uv - 0.5;
          float r2 = dot(d, d);
          vec2 ca = d * r2 * 0.0040 * uChroma;

          vec3 col;
          col.r = texture2D(tScene, uv - ca).r;
          col.g = texture2D(tScene, uv).g;
          col.b = texture2D(tScene, uv + ca).b;

          vec3 bl = texture2D(tBloom, uv).rgb;

          float aspect = uRes.x / uRes.y;
          float hd = length((uv - uHole.xy) * vec2(aspect, 1.0));
          float holeMask = smoothstep(uHole.z * 0.82, uHole.z * 1.04, hd);
          bl *= holeMask;
          bl *= mix(vec3(1.0), uColA, 0.30 * uTint);

          col += bl * uBloom;

          float wpos = uv.x * 0.72 + (1.0 - uv.y) * 0.52;
          float wband = exp(-pow((wpos - uWipe) * 6.0, 2.0));
          col += wband * uFlash * mix(vec3(0.85, 0.95, 1.0), uColA, 0.6 * uTint) * 1.1;

          col *= uExposure;
          col = vec3(1.0) - exp(-col * 1.35);
          col = pow(max(col, 0.0), vec3(1.0 / 2.2));

          float l = dot(col, vec3(0.333));
          col = mix(col, col * vec3(0.93, 0.975, 1.035), 0.25 * (1.0 - l));

          float v = 1.0 - r2 * uVig * 1.35;
          col *= clamp(v, 0.0, 1.0);

          float n = hash(uv * uRes + fract(uTime) * 91.0) - 0.5;
          col += n * uGrain;

          gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.resize();
  }

  makeRT(w, h, depth) {
    return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: !!depth,
      stencilBuffer: false,
      samples: 0,
    });
  }

  resize() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, Math.floor(size.x));
    const h = Math.max(2, Math.floor(size.y));

    if (this.sceneRT) this.sceneRT.dispose();
    this.sceneRT = this.makeRT(w, h, true);

    for (const m of this.mips) m.dispose();
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
      this.mips.push(this.makeRT(mw, mh, false));
    }

    this.comp.uniforms.uRes.value.set(w, h);
  }

  pass(mat, target, clear) {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    const auto = renderer.autoClear;
    renderer.autoClear = !!clear;
    if (clear) renderer.clear();
    renderer.render(this.fsScene, this.fsCam);
    renderer.autoClear = auto;
  }

  render() {
    renderer.setRenderTarget(this.sceneRT);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(scene, camera);

    this.bright.uniforms.tSrc.value = this.sceneRT.texture;
    this.bright.uniforms.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
    this.pass(this.bright, this.mips[0], true);

    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.down, this.mips[i], true);
    }

    for (let i = this.mips.length - 1; i > 0; i--) {
      const src = this.mips[i];
      this.up.uniforms.tSrc.value = src.texture;
      this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.up, this.mips[i - 1], false);
    }

    this.comp.uniforms.tScene.value = this.sceneRT.texture;
    this.comp.uniforms.tBloom.value = this.mips[0].texture;
    this.comp.uniforms.uTime.value = U.uTime.value;
    renderer.setRenderTarget(null);
    this.quad.material = this.comp;
    renderer.autoClear = true;
    renderer.render(this.fsScene, this.fsCam);
  }
}

const post = new Post();

/* ------------------------------------------------------------
   13. responsive framing
------------------------------------------------------------ */
const ui = { density: 1.0, lens: 1.0, speed: 1.0, paused: false };

function applyFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;

  const portrait = aspect < 0.85;
  const narrow = aspect < 1.35 && !portrait;

  camera.fov = portrait ? 56 : narrow ? 48 : 42;
  view.distT = portrait ? 21.0 : narrow ? 20.0 : 18.5;
  view.shiftX = portrait ? 0.09 : 0.155;
  view.shiftY = portrait ? 0.045 : -0.035;
  view.pitchT = portrait ? 0.33 : 0.28;

  camera.aspect = aspect;
  camera.setViewOffset(w, h, view.shiftX * w, view.shiftY * h, w, h);

  if (Q.has('cp')) view.pitchT = parseFloat(Q.get('cp'));
  if (Q.has('cy')) view.yawT = parseFloat(Q.get('cy'));
  if (Q.has('cd')) view.distT = parseFloat(Q.get('cd'));
  if (Q.has('sx')) view.shiftX = parseFloat(Q.get('sx'));
  if (Q.has('sy')) view.shiftY = parseFloat(Q.get('sy'));
  if (Q.has('fov')) camera.fov = parseFloat(Q.get('fov'));

  camera.setViewOffset(w, h, view.shiftX * w, view.shiftY * h, w, h);
  camera.updateProjectionMatrix();

  U.uDensity.value = ui.density * (portrait ? 0.9 : 1.0);
  U.uProj.value = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX) * dprScale;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  U.uPR.value = dpr;
  applyFraming();
  post.resize();
}

/* ------------------------------------------------------------
   14. ui wiring
------------------------------------------------------------ */
function bindUI() {
  const sD = $('#s-density'), sL = $('#s-lens'), sS = $('#s-speed');
  const vD = $('#v-density'), vL = $('#v-lens'), vS = $('#v-speed');

  const syncFill = (input) => {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', p + '%');
  };

  sD.value = ui.density;
  sL.value = ui.lens;
  sS.value = ui.speed;
  for (const s of [sD, sL, sS]) syncFill(s);
  vD.textContent = ui.density.toFixed(2);
  vL.textContent = ui.lens.toFixed(2);
  vS.textContent = ui.speed.toFixed(2);

  sD.addEventListener('input', () => {
    ui.density = parseFloat(sD.value);
    U.uDensity.value = ui.density * (window.innerWidth / window.innerHeight < 0.85 ? 0.9 : 1);
    vD.textContent = ui.density.toFixed(2);
    syncFill(sD);
  });

  sL.addEventListener('input', () => {
    ui.lens = parseFloat(sL.value);
    U.uLens.value = ui.lens;
    post.comp.uniforms.uBloom.value = 0.55 + ui.lens * 0.35;
    vL.textContent = ui.lens.toFixed(2);
    syncFill(sL);
  });

  sS.addEventListener('input', () => {
    ui.speed = parseFloat(sS.value);
    vS.textContent = ui.speed.toFixed(2);
    syncFill(sS);
  });

  $('#btn-pause').addEventListener('click', (e) => {
    ui.paused = !ui.paused;
    e.currentTarget.classList.toggle('on', ui.paused);
    e.currentTarget.textContent = ui.paused ? '继续' : '暂停';
  });

  $('#btn-reset').addEventListener('click', () => {
    view.yawT = -0.06; view.pitchT = 0.28; view.distT = 18.5;
  });

  const panel = $('#panel');
  $('#panel-min').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    $('#panel-min').textContent = panel.classList.contains('collapsed') ? '+' : '−';
    const an = document.getElementById('analysis');
    if (an) an.classList.toggle('on', panel.classList.contains('collapsed'));
  });

  panel.classList.add('collapsed');
  $('#panel-min').textContent = '+';
}

/* pointer controls */
function bindPointer() {
  let down = false, lx = 0, ly = 0, moved = 0, id = null;

  canvas.addEventListener('pointerdown', (e) => {
    down = true; moved = 0; lx = e.clientX; ly = e.clientY; id = e.pointerId;
    view.intro = 1;
    canvas.setPointerCapture(id);
    document.body.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!down) {
      view.panXT = ((e.clientX / window.innerWidth) - 0.5) * 0.05;
      view.panYT = ((e.clientY / window.innerHeight) - 0.5) * 0.035;
      return;
    }
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    view.yawT -= dx * 0.0052;
    view.pitchT = clamp(view.pitchT + dy * 0.0042, -0.25, 1.16);
  });

  const up = (e) => {
    if (!down) return;
    down = false;
    document.body.classList.remove('dragging');
    if (moved >= 6) return;

    const hit = window.innerWidth > 900 ? pickTrace(e.clientX, e.clientY) : null;
    if (hit) {
      trace.seed = hit.seed;
      trace.miss = 0;
      U.uFreezeSeed.value = hit.seed;
      U.uFreezeFlow.value = U.uFlow.value;
      U.uFreezeTime.value = U.uTime.value;
      U.uFreezeAmt.value = 1;
      showTrace(hit.seed, e.clientX, e.clientY);
      if (window.Soul) Soul.audio.tick();
    } else {
      clearTrace();
      pulse();
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = false; document.body.classList.remove('dragging'); });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.distT = clamp(view.distT * (1 + e.deltaY * 0.0011), 9.0, 40);
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    view.yawT = -0.06; view.pitchT = 0.28; view.distT = 18.5;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      ui.paused = !ui.paused;
      const b = $('#btn-pause');
      b.classList.toggle('on', ui.paused);
      b.textContent = ui.paused ? '继续' : '暂停';
    }
  });
}

let pulseTime = -99;
function pulse() {
  pulseTime = 0;
  U.uPulseR.value = 1.2;
  U.uPulseAmp.value = 1.0;
}

/* ------------------------------------------------------------
   15. animation
------------------------------------------------------------ */
let fpsEMA = 60, fpsClock = 0, lastT = performance.now() / 1000;
let quality = 2;
let entered = false;
const fx = { wipe: 3.0, flash: 0.0, kick: 0.0 };
const mood = {
  cur: [
    new THREE.Color(0.93, 0.97, 1.0),
    new THREE.Color(0.80, 0.91, 1.0),
    new THREE.Color(0.66, 0.82, 1.0),
  ],
  tgt: [
    new THREE.Color(0.93, 0.97, 1.0),
    new THREE.Color(0.80, 0.91, 1.0),
    new THREE.Color(0.66, 0.82, 1.0),
  ],
  mode: 0,
  tint: 0,
};

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _right = new THREE.Vector3();

/* ---- hover: lock one chain and read it ---- */
const trace = {
  seed: -9999,
  miss: 0,
  last: 0,
  moods: ['joy', 'calm', 'anger', 'sad', 'tense', 'cold', 'warm', 'dusk'],
};

function pickTrace(mx, my) {
  const geo = field.geo;
  const af = geo.getAttribute('aFlow').array;
  const ao = geo.getAttribute('aOff').array;
  const n = field.count;
  const flowT = U.uFlow.value;
  const time = U.uTime.value;
  const life = F.life;
  const v = _pickV;
  let best = null;
  let bestD = 42 * 42;

  for (let i = 0; i < n; i++) {
    const psi = af[i * 4];
    const seed = af[i * 4 + 1];
    const phase = af[i * 4 + 2];
    let tau = phase + flowT / life + ao[i];
    tau -= Math.floor(tau);
    const r = F.rOut - (F.rOut - F.flowIn) * tau;
    if (r < F.flowIn + 0.4) continue;
    const phi = lanePhi(r, psi, seed);
    const ang = -F.spin * time * (0.2 + 0.55 * Math.pow(Math.max(r, 1.6), -0.95));
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const x0 = r * Math.cos(phi);
    const z0 = r * Math.sin(phi);
    v.set(x0 * ca - z0 * sa, hgt(r, phi), x0 * sa + z0 * ca);
    v.project(camera);
    if (v.z > 1) continue;
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const d = (sx - mx) * (sx - mx) + (sy - my) * (sy - my);
    if (d < bestD) { bestD = d; best = { seed, sx, sy }; }
  }
  return best;
}

const _pickV = new THREE.Vector3();

function showTrace(seed, mx, my) {
  const card = document.getElementById('trace-card');
  if (!card) return;
  const key = trace.moods[(Math.abs(seed * 9301 + 49297) % trace.moods.length + trace.moods.length) % trace.moods.length];
  const labels = { joy: '喜悦', calm: '平静', anger: '愤怒', sad: '忧郁', tense: '紧张', cold: '冷静', warm: '温暖', dusk: '暮色' };
  const id = document.getElementById('tr-id');
  const moodEl = document.getElementById('tr-mood');
  const vEl = document.getElementById('tr-v');
  const aEl = document.getElementById('tr-a');
  const lineEl = document.getElementById('tr-line');
  if (id) id.textContent = 'TRACE 0x' + Math.abs(Math.floor(seed * 1000)).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  if (moodEl) moodEl.textContent = labels[key] || '平静';
  const v = (Math.sin(seed * 3.7) * 0.7).toFixed(2);
  const a = (0.2 + Math.abs(Math.cos(seed * 1.9)) * 0.7).toFixed(2);
  if (vEl) vEl.textContent = 'V ' + (v >= 0 ? '+' : '') + v;
  if (aEl) aEl.textContent = 'A ' + a;
  if (lineEl) lineEl.textContent = window.Soul ? Soul.replyFor({ moodKey: key, kind: 'trace' }) : '';
  card.classList.add('on');
  const w = 212;
  const x = Math.min(window.innerWidth - w - 16, Math.max(16, mx + 18));
  const y = Math.min(window.innerHeight - 150, Math.max(80, my - 40));
  card.style.left = x + 'px';
  card.style.top = y + 'px';
  clearTimeout(trace.timer);
  trace.timer = setTimeout(() => clearTrace(), 1600);
}

function clearTrace() {
  clearTimeout(trace.timer);
  const card = document.getElementById('trace-card');
  if (card) card.classList.remove('on');
  trace.seed = -9999;
  U.uFreezeAmt.value = 0;
}

function updateTrace(mx, my) {
  const now = performance.now();
  if (now - trace.last < 90) return;
  trace.last = now;
  const hit = pickTrace(mx, my);
  if (!hit) {
    trace.miss++;
    if (trace.miss > 6) clearTrace();
    return;
  }
  trace.miss = 0;
  if (Math.abs(hit.seed - trace.seed) > 0.001) {
    trace.seed = hit.seed;
    U.uFreezeSeed.value = hit.seed;
    U.uFreezeFlow.value = U.uFlow.value;
    U.uFreezeTime.value = U.uTime.value;
    U.uFreezeAmt.value = 1;
    showTrace(hit.seed, mx, my);
    if (window.Soul) Soul.audio.tick();
  } else {
    const card = document.getElementById('trace-card');
    if (card && card.classList.contains('on')) {
      const w = 212;
      card.style.left = Math.min(window.innerWidth - w - 16, Math.max(16, mx + 18)) + 'px';
      card.style.top = Math.min(window.innerHeight - 150, Math.max(80, my - 40)) + 'px';
    }
  }
}

function updateCamera(dt) {
  view.yaw = damp(view.yaw, view.yawT, 5.2, dt);
  view.pitch = damp(view.pitch, view.pitchT, 5.2, dt);
  view.dist = damp(view.dist, view.distT, 4.4, dt);
  view.panX = damp(view.panX, view.panXT, 3.0, dt);
  view.panY = damp(view.panY, view.panYT, 3.0, dt);

  const ie = view.intro < 1 ? 1 - Math.pow(1 - view.intro, 3) : 1;
  const introDist = lerp(view.dist * 1.75, view.dist, ie);
  const introPitch = lerp(0.62, view.pitch, ie);

  const yaw = view.yaw + view.panX + (1 - ie) * 0.14;
  const pitch = clamp(introPitch + view.panY, -0.35, 1.3);
  const cp = Math.cos(pitch);
  camera.position.set(
    Math.sin(yaw) * cp * introDist,
    Math.sin(pitch) * introDist,
    Math.cos(yaw) * cp * introDist
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  U.uProj.value = (window.innerHeight * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  ring.quaternion.copy(camera.quaternion);
  glow.quaternion.copy(camera.quaternion);

  const p0 = _v0.set(0, 0, 0).project(camera);
  _right.setFromMatrixColumn(camera.matrixWorld, 0);
  const p1 = _v1.copy(_right).project(camera);
  const rad = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  post.comp.uniforms.uHole.value.set(p0.x * 0.5 + 0.5, p0.y * 0.5 + 0.5, rad * 1.1);
}

function animate() {
  const now = performance.now() / 1000;
  let dt = now - lastT;
  lastT = now;
  if (dt > 0.25) dt = 0.25;

  fpsEMA = lerp(fpsEMA, 1 / Math.max(dt, 0.0001), 0.06);

  const speed = ui.paused ? 0 : ui.speed;
  U.uTime.value += dt * speed;

  // the pulse briefly accelerates the infall
  const boost = 1.0 + U.uPulseAmp.value * 2.4;
  U.uFlow.value += dt * speed * boost;

  if (pulseTime > -1) {
    pulseTime += dt;
    const t = pulseTime / 2.6;
    if (t >= 1) {
      pulseTime = -99;
      U.uPulseAmp.value = 0;
    } else {
      U.uPulseR.value = 1.1 + t * (F.rOut * 0.8);
      U.uPulseAmp.value = Math.pow(1 - t, 2.2) * 1.1;
    }
  }

  if (entered && view.intro < 1) view.intro = Math.min(1, view.intro + dt / 3.4);

  // palette glide + transition
  for (let i = 0; i < 3; i++) mood.cur[i].lerp(mood.tgt[i], 1 - Math.exp(-dt * 2.6));
  U.uColA.value.copy(mood.cur[0]);
  U.uColB.value.copy(mood.cur[1]);
  U.uColC.value.copy(mood.cur[2]);
  U.uTint.value = damp(U.uTint.value, mood.tint, 2.2, dt);
  U.uColorMode.value = damp(U.uColorMode.value, mood.mode, 3.0, dt);

  if (fx.wipe < 2.2) fx.wipe += dt * 1.35;
  fx.flash *= Math.exp(-dt * 3.0);
  fx.kick *= Math.exp(-dt * 2.4);
  post.comp.uniforms.uWipe.value = fx.wipe;
  post.comp.uniforms.uFlash.value = fx.flash;

  updateCamera(dt);
  camera.position.multiplyScalar(1 - fx.kick);
  post.render();

  fpsClock += dt;
  if (fpsClock > 0.5) {
    const f = Math.round(fpsEMA);
    $('#fps').textContent = String(Math.min(120, f)).padStart(2, '0');
    $('#nodes').textContent = field.count.toLocaleString('en-US');
    fpsClock = 0;

    if (quality > 0 && fpsEMA < 36) {
      quality--;
      dprScale = Math.max(0.7, dprScale * 0.85);
      onResize();
    }
  }

  requestAnimationFrame(animate);
}

/* ------------------------------------------------------------
   16. boot
------------------------------------------------------------ */
function boot() {
  bindUI();
  bindPointer();
  applyFraming();
  view.intro = 0;
  U.uLens.value = ui.lens;
  post.comp.uniforms.uBloom.value = 0.55 + ui.lens * 0.35;

  renderer.compile(scene, camera);
  post.render();

  const bar = $('#boot-bar');
  const status = $('#boot-status');
  if (bar) bar.style.width = '100%';
  if (status) status.textContent = '视界稳定';

  const enterBtn = $('#boot-enter');
  const doEnter = (withSound) => {
    if (entered) return;
    entered = true;
    if (withSound && window.Soul) {
      Soul.audio.welcome();
      Soul.audio.speak('You are welcome.', 700);
      setTimeout(() => Soul.audio.speak('All systems are nominal.'), 2950);
    }
    document.body.classList.add('ready');
    view.intro = 0;
    setTimeout(() => {
      const b = $('#boot');
      if (b) b.style.display = 'none';
    }, 1900);
  };
  if (enterBtn) enterBtn.addEventListener('click', () => doEnter(true));
  const resetBtn = $('#reset-all');
  if (resetBtn) resetBtn.addEventListener('click', resetAll);
  if (Q.has('auto')) setTimeout(() => doEnter(false), 200);
  window.__enter = doEnter;
  bindEngineeringUI();
  initColorAndWave();
  initCrawl();
  initAnalysis();

  requestAnimationFrame((t) => {
    lastT = t / 1000;
    animate();
  });

  window.addEventListener('resize', () => {
    onResize();
    setTimeout(onResize, 120);
  });
}

window.__objs = { horizon, ring, glow, glyphMesh, particles, stars, wires, fibers };
window.__toggle = (k, v) => { if (window.__objs[k]) window.__objs[k].visible = v !== false; };
window.__diag = () => ({
  fps: Math.round(fpsEMA),
  glyphs: field.count,
  rows: field.rows,
  flow: +U.uFlow.value.toFixed(1),
  cam: [+view.yaw.toFixed(2), +view.pitch.toFixed(2), +view.dist.toFixed(1)],
  dpr,
});
window.__setView = (o) => Object.assign(view, o);

/* ------------------------------------------------------------
   17. soul · 情绪摄取 / 解析流水线 / 视界染色
------------------------------------------------------------ */
const SAMPLES = {
  joy: '今天阳光很好，风从窗外吹进来，我把咖啡放在桌上，忽然觉得一切都会好起来。',
  anger: '我受够了。所有解释都被当成借口，愤怒在胸口烧，我只想把这一切都掀翻。',
  sad: '关掉灯以后，房间安静得可怕。我又想起那些再也回不来的人，沉重的夜色压下来。',
  calm: '海面很平，只有很轻的浪声。时间慢下来，什么都不必想，也不想说话。',
};

const PIPE_STEPS = [
  ['INGEST', '摄取'],
  ['SEGMENT', '切分'],
  ['LEXICON', '词典'],
  ['VALENCE', '效价'],
  ['AROUSAL', '唤醒'],
  ['PALETTE', '色彩'],
  ['BIND', '绑定'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const archiveItems = [];

function colorOf(rgb) {
  return new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

let lastReport = null;

function applyReport(rep, silent) {
  lastReport = rep;
  const lift = (c) => {
    const m = Math.max(c[0], c[1], c[2], 0.001);
    const k = Math.min(2.4, 0.86 / m);
    return c.map((x) => Math.min(1, x * k));
  };
  const cols = rep.colors.map((c) => colorOf(lift(c)));
  while (cols.length < 3) cols.push(cols[cols.length - 1].clone().multiplyScalar(0.82));
  mood.tgt[0].copy(cols[0]);
  mood.tgt[1].copy(cols[1]);
  mood.tgt[2].copy(cols[2]);
  mood.mode = rep.mode === 'mono' ? 0 : rep.mode === 'multi' ? 1 : 2;
  mood.tint = 0.92;

  fx.wipe = -0.45;
  fx.flash = 1.25;
  fx.kick = 0.085;

  if (!silent) {
    if (window.Soul) {
      const line = Soul.replyFor(rep);
      Soul.audio.air(1.1, 0.02);
      Soul.audio.say(line, 450);
      showVoice(line);
    }
    pulse();
  }
}

let voiceTimer = 0;
function showVoice(text) {
  const box = document.getElementById('voicecap');
  const t = document.getElementById('vc-text');
  if (!box || !t) return;
  t.textContent = '\u201C' + text + '\u201D';
  box.classList.add('on');
  clearTimeout(voiceTimer);
  voiceTimer = setTimeout(() => box.classList.remove('on'), Math.max(4200, text.length * 62));
}

/* ---- analysis panel ---- */
const anState = { v: [0.02, 0.06, 0.01, 0.09, 0.05], a: [0.30, 0.34, 0.28, 0.38, 0.36], rep: null };

function initAnalysis() {
  const box = document.getElementById('analysis');
  const rows = document.getElementById('an-rows');
  const pal = document.getElementById('an-pal');
  if (!box || !rows) return;

  const ROW = (k, cn, id) =>
    '<div class="an-row"><span>' + k + '<i>' + cn + '</i></span><b id="' + id + '">—</b></div>';

  rows.innerHTML =
    ROW('MOOD', '情绪', 'an-mood') +
    ROW('V', '效价', 'an-val') +
    ROW('A', '唤醒', 'an-aro') +
    ROW('HUE', '色相', 'an-hue') +
    ROW('MODE', '映射', 'an-mode') +
    ROW('TOKENS', '词元', 'an-tok') +
    ROW('HITS', '命中', 'an-hit') +
    ROW('INK', '含字率', 'an-ink');

  document.getElementById('an-close').addEventListener('click', () => {
    box.classList.remove('on');
    if (window.Soul) Soul.audio.tick();
  });

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };

  window.__updateAnalysis = (rep) => {
    anState.rep = rep;
    anState.v.push(rep.valence);
    anState.a.push(rep.arousal);
    if (anState.v.length > 22) { anState.v.shift(); anState.a.shift(); }

    const hue = (() => {
      const c = rep.colors[0];
      const max = Math.max(...c), min = Math.min(...c);
      return Math.round(((max - min) * 60) / Math.max(0.001, max - min) + (c[0] === max ? 0 : 0));
    })();
    set('an-mood', rep.label + ' <em>' + (rep.kind === 'image' ? 'IMG' : 'TXT') + '</em>');
    set('an-val', (rep.valence >= 0 ? '+' : '') + rep.valence.toFixed(3));
    set('an-aro', rep.arousal.toFixed(3));
    set('an-hue', rep.kind === 'image' ? rep.stats.hue + '°' : '—');
    set('an-mode', rep.mode.toUpperCase());
    set('an-tok', rep.kind === 'image' ? rep.stats.colors + ' col' : Math.ceil(rep.stats.chars / 2) + ' g');
    set('an-hit', rep.kind === 'image' ? rep.stats.sat : rep.stats.hits + ' / ' + rep.stats.pos + '+' + rep.stats.neg + '-');
    set('an-ink', '40%' + (INK.pool.length ? ' <em>' + INK.pool.length + ' FRAG</em>' : ''));

    if (pal) {
      pal.innerHTML = rep.colors.slice(0, 3).map((c) =>
        '<i style="background:rgb(' + c.map((x) => Math.round(x * 255)).join(',') + ')"></i>'
      ).join('');
    }
    box.classList.add('on');
    drawCharts();
  };

  const drawCharts = () => {
    draw(document.getElementById('an-v'), anState.v, 'rgba(159,232,255,0.9)', 0);
    draw(document.getElementById('an-a'), anState.a, 'rgba(210,180,255,0.9)', 0.35);
  };

  const draw = (cv, data, color, base) => {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(159,232,255,.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(0, (H / 3) * i); ctx.lineTo(W, (H / 3) * i); ctx.stroke();
    }
    const n = Math.max(2, data.length);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const v = data[i] === undefined ? base : data[i];
      const x = (i / (n - 1)) * W;
      const y = H - ((v + 1) / 2) * (H - 6) - 3;
      pts.push([x, y]);
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = color.replace('0.9', '0.08');
    ctx.fill();
    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(last[0] - 1, last[1], 2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  };

  setInterval(drawCharts, 320);
  drawCharts();
}

function renderArchive() {
  const box = $('#archive');
  if (!box) return;
  box.innerHTML = '';
  archiveItems.forEach((it, i) => {
    const seq = archiveItems.length - i;
    const b = document.createElement('button');
    b.className = 'a-chip';
    b.innerHTML =
      '<span class="dots">' +
      it.colors.slice(0, 3).map((c) =>
        '<i style="background:rgb(' + c.map((x) => Math.round(x * 255)).join(',') + ')"></i>'
      ).join('') +
      '</span><b>' + String(it.seq || seq).padStart(2, '0') + '</b>' +
      '<span>' + it.label + '</span>';
    b.title = it.kind + ' · ' + it.mode + ' · V' + it.valence.toFixed(2);
    b.addEventListener('click', () => {
      applyReport(it);
      if (window.Soul) Soul.audio.tick(3);
    });
    box.appendChild(b);
  });
}

function initSoulUI() {
  const modal = $('#ingest');
  const openBtn = $('#ingest-open');
  const closeBtn = $('#ingest-close');
  const tabs = $('#tabs');
  const runBtn = $('#ingest-run');
  const ta = $('#in-text');
  const drop = $('#drop');
  const file = $('#in-file');
  const preview = $('#preview');
  const pipeline = $('#pipeline');
  const pipeSteps = $('#pipe-steps');
  const pipeBar = $('#pipe-bar');
  const pipeState = $('#pipe-state');
  const pipeKind = $('#pipe-kind');
  const metaL = $('#pipe-meta-l');
  const metaR = $('#pipe-meta-r');

  let tab = 'text';
  let img = null;
  let busy = false;

  // step rows
  pipeSteps.innerHTML = '';
  const rows = PIPE_STEPS.map(([k, cn], i) => {
    const el = document.createElement('div');
    el.className = 'ps';
    el.innerHTML =
      '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="k">' + k + '</span>' +
      '<span class="v">—</span>';
    pipeSteps.appendChild(el);
    return el;
  });

  const open = () => {
    modal.classList.add('on');
    if (window.Soul) Soul.audio.tick(1);
    setTimeout(() => ta.focus(), 80);
  };
  const close = () => modal.classList.remove('on');

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab-body').forEach((x) => {
      x.hidden = x.dataset.body !== tab;
    });
  });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => {
      ta.value = SAMPLES[b.dataset.sample] || '';
      ta.focus();
      if (window.Soul) Soul.audio.tick(2);
    });
  });

  if (drop) {
    drop.addEventListener('click', () => file.click());
    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); })
    );
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadImage(f);
    });
  }

  file.addEventListener('change', () => {
    if (file.files && file.files[0]) loadImage(file.files[0]);
  });

  function loadImage(f) {
    if (!f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      img = im;
      preview.src = url;
      preview.hidden = false;
      drop.style.display = 'none';
      const meta = $('#img-meta');
      if (meta) meta.textContent = f.name + ' · ' + im.width + '×' + im.height;
      if (window.Soul) Soul.audio.tick(2);
    };
    im.src = url;
  }

  async function probe() {
    if (busy) return;
    busy = true;
    close();
    document.body.classList.add('scanning');
    if (window.Soul) Soul.audio.air(0.9, 0.015);

    let rep;
    try {
      if (tab === 'image') {
        if (!img) { busy = false; document.body.classList.remove('scanning'); return open(); }
        rep = Soul.analyzeImage(img);
      } else {
        if (!ta.value.trim()) { busy = false; document.body.classList.remove('scanning'); return open(); }
        rep = Soul.analyzeText(ta.value);
      }
    } catch (err) {
      busy = false;
      document.body.classList.remove('scanning');
      return;
    }

    // pipeline
    pipeline.classList.add('on');
    pipeKind.textContent = rep.kind.toUpperCase();
    pipeState.textContent = 'SCANNING';
    rows.forEach((r) => { r.classList.remove('on', 'done'); r.querySelector('.v').textContent = '—'; });
    pipeBar.style.width = '0%';
    metaL.textContent = 'V —';
    metaR.textContent = 'A —';

    const vals = [
      rep.kind === 'image' ? 'IMAGE · ' + rep.stats.px + 'px' : 'TEXT · ' + rep.stats.chars + ' ch',
      rep.kind === 'image' ? rep.stats.colors + ' colors' : Math.ceil(rep.stats.chars / 2) + ' grams',
      rep.kind === 'image' ? 'hue ' + rep.stats.hue + '°' : rep.stats.hits + ' hits · ' + rep.stats.pos + '/' + rep.stats.neg,
      (rep.valence >= 0 ? '+' : '') + rep.valence.toFixed(2),
      rep.arousal.toFixed(2),
      rep.mode.toUpperCase() + ' · 3',
      'CONFIRMED',
    ];

    for (let i = 0; i < rows.length; i++) {
      rows[i].classList.add('on');
      const vEl = rows[i].querySelector('.v');
      vEl.textContent = vals[i];
      pipeBar.style.width = Math.round(((i + 1) / rows.length) * 100) + '%';
      if (window.Soul) Soul.audio.tick();
      if (i === 1 || i === 3 || i === 5) {
        fx.flash = Math.max(fx.flash, 0.22);
        pulse();
      }
      metaL.textContent = 'V ' + (i >= 3 ? (rep.valence >= 0 ? '+' : '') + rep.valence.toFixed(2) : '—');
      metaR.textContent = 'A ' + (i >= 4 ? rep.arousal.toFixed(2) : '—');
      await sleep(i === 0 ? 260 : 190);
      rows[i].classList.add('done');
    }

    pipeState.textContent = 'BOUND';
    applyReport(rep);
    if (rep.kind === 'text') injectInk(ta.value);
    else injectInk(rep.kind === 'image' ? 'IMAGE · ' + (preview.src ? 'FRAME CAPTURED' : '') : '');

    rep.seq = (archiveItems[0] ? archiveItems[0].seq || 0 : 0) + 1;
    if (window.__setTrack) window.__setTrack(rep);
  if (window.__updateAnalysis) window.__updateAnalysis(rep);
    archiveItems.unshift(rep);
    if (archiveItems.length > 4) archiveItems.pop();
    renderArchive();

    document.body.classList.remove('scanning');
    await sleep(900);
    pipeline.classList.remove('on');
    busy = false;
  }

  runBtn.addEventListener('click', probe);

  // sound
  const snd = $('#snd-toggle');
  if (snd) {
    snd.addEventListener('click', () => {
      if (!window.Soul) return;
      Soul.audio.init();
      Soul.audio.muted = !Soul.audio.muted;
      snd.classList.toggle('off', Soul.audio.muted);
      snd.textContent = Soul.audio.muted ? '◌' : '◑';
      if (!Soul.audio.muted) Soul.audio.tick(1);
    });
  }
}

function resetAll() {
  // freeze / trace
  clearTrace();

  // palette back to neutral
  mood.tgt[0].setRGB(0.93, 0.97, 1.0, THREE.SRGBColorSpace);
  mood.tgt[1].setRGB(0.80, 0.91, 1.0, THREE.SRGBColorSpace);
  mood.tgt[2].setRGB(0.66, 0.82, 1.0, THREE.SRGBColorSpace);
  mood.mode = 0;
  mood.tint = 0;
  fx.flash = Math.max(fx.flash, 0.35);
  fx.wipe = -0.4;

  // user ink
  INK.pool = [];
  drawInkAtlas([]);
  if (INK.uv) {
    INK.uv.array.set(INK.baseUv);
    INK.uv.needsUpdate = true;
    INK.ink.array.fill(0);
    INK.ink.needsUpdate = true;
  }

  // archive + analysis
  archiveItems.length = 0;
  renderArchive();
  lastReport = null;
  anState.v = [0.02, 0.06, 0.01, 0.09, 0.05];
  anState.a = [0.30, 0.34, 0.28, 0.38, 0.36];
  const an = document.getElementById('analysis');
  if (an) an.classList.remove('on');
  const pipe = document.getElementById('pipeline');
  if (pipe) pipe.classList.remove('on');

  // sliders
  [['s-density', '1'], ['s-lens', '1'], ['s-speed', '1']].forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (el) { el.value = v; el.dispatchEvent(new Event('input')); }
  });
  ui.paused = false;
  const pb = document.getElementById('btn-pause');
  if (pb) { pb.classList.remove('on'); pb.textContent = '暂停'; }

  const modeBox = document.getElementById('color-modes');
  if (modeBox) modeBox.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
  const cap = document.getElementById('voicecap');
  if (cap) cap.classList.remove('on');

  // camera
  view.yawT = -0.06;
  view.pitchT = 0.28;
  view.distT = 18.5;
  view.panXT = 0;
  view.panYT = 0;

  if (window.Soul) {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    Soul.audio._busy = false;
    Soul.audio._q = [];
    Soul.audio.speaking = false;
    Soul.audio.tick();
  }
}

initSoulUI();

/* ---- colour track + spectrum ---- */
function initColorAndWave() {
  const track = document.getElementById('color-track');
  const knob = document.getElementById('track-knob');
  const modes = document.getElementById('color-modes');
  let hue = 205;

  const paint = () => {
    const v = lastReport ? lastReport.valence : 0.15;
    const a = lastReport ? lastReport.arousal : 0.4;
    const pal = Soul.paletteOf({ hue, key: 'custom', label: 'custom' }, v, a);
    const cols = pal.colors.map((c) => colorOf(c));
    while (cols.length < 3) cols.push(cols[cols.length - 1].clone().multiplyScalar(0.85));
    mood.tgt[0].copy(cols[0]);
    mood.tgt[1].copy(cols[1]);
    mood.tgt[2].copy(cols[2]);
    mood.tint = 0.9;
    fx.flash = Math.max(fx.flash, 0.28);
    if (knob) knob.style.left = ((hue / 360) * 100).toFixed(2) + '%';
  };

  const setHue = (clientX) => {
    const r = track.getBoundingClientRect();
    hue = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 360;
    paint();
  };

  if (track) {
    let drag = false;
    track.addEventListener('pointerdown', (e) => { drag = true; track.setPointerCapture(e.pointerId); setHue(e.clientX); });
    track.addEventListener('pointermove', (e) => { if (drag) setHue(e.clientX); });
    track.addEventListener('pointerup', () => { drag = false; if (window.Soul) Soul.audio.tick(); });
    track.addEventListener('pointercancel', () => { drag = false; });
  }

  if (modes) {
    modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      const map = { mono: 0, multi: 1, gradient: 2 };
      mood.mode = map[b.dataset.mode];
      modes.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      fx.flash = Math.max(fx.flash, 0.2);
      if (window.Soul) Soul.audio.tick();
    });
  }

  // collapsibles
  [['color-toggle', 'sub-color'], ['wave-toggle', 'sub-wave']].forEach(([btn, sec]) => {
    const b = document.getElementById(btn);
    const el = document.getElementById(sec);
    if (!b || !el) return;
    b.addEventListener('click', () => {
      el.classList.toggle('collapsed');
      b.querySelector('i').textContent = el.classList.contains('collapsed') ? '+' : '−';
      if (window.Soul) Soul.audio.tick();
    });
  });

  // spectrum
  const cv = document.getElementById('wave');
  const hz = document.getElementById('wave-hz');
  const st = document.getElementById('wave-st');
  if (cv) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const bars = new Array(26).fill(0);
    let phase = 0;

    const draw = () => {
      const audio = window.Soul && Soul.audio;
      const speaking = !!(audio && audio.speaking);
      phase += 0.14;
      ctx.clearRect(0, 0, W, H);

      // grid
      ctx.strokeStyle = 'rgba(159,232,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(0, (H / 3) * i); ctx.lineTo(W, (H / 3) * i); ctx.stroke();
      }

      // waveform
      ctx.beginPath();
      const env = speaking ? 1 : 0.5;
      for (let x = 0; x <= W; x += 2) {
        const t = x / W;
        let v;
        if (speaking) {
          v = Math.sin(t * 38 + phase * 1.7) * 0.5
            + Math.sin(t * 91 + phase * 2.3) * 0.28
            + Math.sin(t * 173 + phase * 3.1) * 0.14
            + Math.sin(t * 7 + phase * 0.6) * 0.22;
          v *= 0.5 + 0.5 * Math.sin(t * 3.1 + phase * 0.4);
        } else {
          v = Math.sin(t * 6 + phase * 0.25) * 0.08 + (Math.random() - 0.5) * 0.02;
        }
        const y = H / 2 + v * (H * 0.38) * env;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = speaking ? 'rgba(210,245,255,0.92)' : 'rgba(159,232,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // spectrum bars
      const bw = W / bars.length;
      for (let i = 0; i < bars.length; i++) {
        const t = i / bars.length;
        let target = speaking
          ? (Math.pow(1 - t, 1.4) * (0.55 + 0.45 * Math.sin(i * 1.7 + phase)) +
             Math.exp(-Math.pow((t - 0.18) * 9, 2)) * 0.8 +
             Math.exp(-Math.pow((t - 0.42) * 11, 2)) * 0.5)
          : 0.08 + 0.07 * Math.sin(i * 0.8 + phase * 0.3);
        target = Math.max(0.02, Math.min(1, target));
        bars[i] += (target - bars[i]) * 0.25;
        const h = bars[i] * (H * 0.42);
        ctx.fillStyle = 'rgba(159,232,255,' + (0.18 + bars[i] * 0.55).toFixed(3) + ')';
        ctx.fillRect(i * bw + 1, H - h, Math.max(1, bw - 2), h);
      }

      if (hz) hz.textContent = speaking ? 'F0 196 Hz  ·  2 FORMANT' : 'F0 —— Hz';
      if (st) st.textContent = speaking ? 'VOICE' : 'IDLE';
    };

    setInterval(draw, 55);
  }

  // reflect the last mood on the track
  const origApply = window.applyReport;
  window.__setTrack = (rep) => {
    try {
      const c = new THREE.Color().setRGB(rep.colors[0][0], rep.colors[0][1], rep.colors[0][2], THREE.SRGBColorSpace);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      hue = hsl.h * 360;
      if (knob) knob.style.left = ((hue / 360) * 100).toFixed(2) + '%';
      if (modes) modes.querySelectorAll('button').forEach((x) =>
        x.classList.toggle('on', x.dataset.mode === rep.mode));
    } catch (e) { /* ignore */ }
  };
}

/* ---- crawling data chains ---- */
function initCrawl() {
  const els = Array.from(document.querySelectorAll('.crawl'));
  if (!els.length) return;
  const groups = els.map((el) => {
    el.innerHTML = '<b></b><span> · </span><b></b><span> · </span><b></b>';
    const parts = Array.from(el.querySelectorAll('b'));
    const fmt = el.dataset.fmt === 'bin';
    parts.forEach((b) => {
      b.textContent = fmt ? '0000 0000' : 'A3F1';
    });
    return { parts, fmt, i: 0 };
  });

  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const bin = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += Math.random() < 0.5 ? '0' : '1';
    return s.slice(0, 4) + ' ' + s.slice(4);
  };

  setInterval(() => {
    for (const g of groups) {
      g.i = (g.i + 1) % g.parts.length;
      g.parts[g.i].textContent = g.fmt ? bin() : hex();
      const fade = g.parts[(g.i + 1) % g.parts.length];
      if (fade) fade.style.opacity = '.45';
    }
  }, 220);
}

/* ---- engineering feedback: sounds on every control ---- */
function bindEngineeringUI() {
  if (window.Soul) {
    document.querySelectorAll('button').forEach((b, i) => {
      if (!b.dataset.i) b.dataset.i = String(i + 1).padStart(2, '0');
      b.addEventListener('click', () => Soul.audio.tick());
    });
    ['s-density', 's-lens', 's-speed'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => Soul.audio.tick());
    });
  }

  const reticle = document.getElementById('reticle');
  const rcoord = document.getElementById('rcoord');
  if (reticle) {
    window.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      reticle.style.setProperty('--rx', (x * 100).toFixed(2) + '%');
      reticle.style.setProperty('--ry', (y * 100).toFixed(2) + '%');
      if (rcoord) rcoord.textContent = 'X ' + x.toFixed(3) + '  Y ' + y.toFixed(3);
      reticle.classList.add('on');
    }, { passive: true });
  }

  const t0 = performance.now();
  setInterval(() => {
    const cam = document.getElementById('sys-cam');
    const flow = document.getElementById('sys-flow');
    const v = document.getElementById('sys-v');
    const a = document.getElementById('sys-a');
    const tt = document.getElementById('sys-t');
    if (cam) cam.textContent =
      (view.yaw >= 0 ? '+' : '') + view.yaw.toFixed(2) + ' / ' +
      view.pitch.toFixed(2) + ' / ' + view.dist.toFixed(1);
    if (flow) flow.textContent = U.uFlow.value.toFixed(1).padStart(5, '0');
    if (v) v.textContent = lastReport ? (lastReport.valence >= 0 ? '+' : '') + lastReport.valence.toFixed(2) : '—';
    if (a) a.textContent = lastReport ? lastReport.arousal.toFixed(2) : '—';
    if (tt) {
      const sec = Math.floor((performance.now() - t0) / 1000);
      tt.textContent = String(Math.floor(sec / 3600)).padStart(2, '0') + ':' +
        String(Math.floor((sec % 3600) / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }
  }, 260);
}


boot();
