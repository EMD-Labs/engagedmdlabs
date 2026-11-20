// Doc + Flo shared stage — three.js r187
// createDuo({ container, flo: ArrayBuffer|url, doc: ArrayBuffer|url, layout?, controls?, autoGreet?, hoverGreet? })
// One transparent canvas, one light rig, one shadow floor, two independent characters and a staggered greeting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createTablet } from './tablet.js';

const byName = (root, n) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
const srgb = (hex) => new THREE.Color(hex);
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// Default placement, matched to the EngagedMD layout (Doc behind-left, Flo in front-right). World units = metres.
export const DEFAULT_LAYOUT = {
  doc: { x: -0.16, z: -0.14, rotY: 0.04 },
  flo: { x: 0.14, z: 0.3, rotY: -0.06, scale: 0.9 },
  camera: { fov: 20, position: [-0.45, 1.5, 6.4], target: [0.0, 0.84, 0.0] },
  // where the pair sits in the canvas (fractions of width/height), matched to the 600x578 layout comp
  fit: [0.632, 0.284, 0.968, 0.958],
  // tablet artwork rect in the same 600x578 box (fractions): x, y, w, h
  tablet: [0.06, 0.0294, 0.5867, 0.839],
};

// ---------- materials ----------
const FLO_LOOK = {
  'Flo.Skin':   { color: '#a07a60', roughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.5, specularIntensity: 0.35, sss: 0.16 },
  'Flo.Face':   { color: '#977058', roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.5, specularIntensity: 0.3, sss: 0.14 },
  'Flo.Shirt':  { color: '#d9d0c2', roughness: 0.62, specularIntensity: 0.35, sheen: 0.35, sheenRoughness: 0.7, sheenColor: '#ffffff' },
  'Flo.Pants':  { color: '#79b3c8', roughness: 0.58, specularIntensity: 0.35, sheen: 0.25, sheenRoughness: 0.7, sheenColor: '#d6f1ff' },
  'Flo.Hair':   { color: '#262626', roughness: 0.5, specularIntensity: 0.4 },
  'Flo.Shoes':  { color: '#2b2d30', roughness: 0.45, specularIntensity: 0.5 },
  'Cloth.Black':{ color: '#1c1c1d', roughness: 0.6, specularIntensity: 0.3 },
  'Plastic.White': { color: '#c8c9cc', roughness: 0.42, specularIntensity: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.3 },
  'Eye.Glassy.Textured': { color: '#0c0c0d', roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12, specularIntensity: 0.8 },
};
// Doc: his web materials are kept; these adjust colour/finish for the shared light rig
export const DOC_LOOK = {
  'Doc.Skin.WebPBR':  { color: '#6b4632', roughness: 0.66, specularIntensity: 0.35, sss: 0.16 },
  'Doc.Hands.WebPBR': { color: '#6b4632', roughness: 0.66, specularIntensity: 0.35, sss: 0.22 },
  'Doc.Coat.WebPBR':  { color: '#e4e4e6', roughness: 0.55, specularIntensity: 0.35, sheen: 0.25, sheenRoughness: 0.7, sheenColor: '#ffffff' },
  'Doc.Pants.WebPBR': { color: '#24626c', roughness: 0.6, specularIntensity: 0.3 },
  'Doc.Shirt.WebPBR': { color: '#6c6d70', roughness: 0.6, specularIntensity: 0.3 },
  'Doc.Tie.WebPBR':   { color: '#d8692b', roughness: 0.62, specularIntensity: 0.3 },
  'Doc.Shoes.WebPBR': { color: '#8a4f2d', roughness: 0.5, specularIntensity: 0.4 },
  'Doc.Glasses.WebPBR': { color: '#e07a3e', roughness: 0.45, specularIntensity: 0.5 },
  'Doc.Eyebrows.WebPBR': { color: '#2a2622', roughness: 0.85, specularIntensity: 0.2 },
  'Doc.Hair.WebPBR':  { color: '#4a4744', roughness: 0.85, specularIntensity: 0.25, keepMaps: true },
  'Eye.Glassy.Textured.WebPBR': { color: '#0c0c0d', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12, specularIntensity: 0.8, eye: true },
};

// skin "dimension": a colour shift across the face from upper right (lighter, warmer-gold) to lower left (deeper, redder),
// plus a small forehead lift. default 1.7 (option E, chosen 20 Nov); 0 = off; shared by every skin material.
const SKIN_DIM = { value: 0 };
function addSkinScatter(m, amount) {
  m.userData.sss = { value: amount };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSSS = m.userData.sss; sh.uniforms.uDim = SKIN_DIM;
    sh.fragmentShader = 'uniform float uSSS;\nuniform float uDim;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    float g = dot(normal, normalize(vec3(0.55, 0.7, 0.45)));
    float lift = smoothstep(-0.1, 0.95, g), shade = smoothstep(0.25, -0.85, g), top = smoothstep(0.35, 0.95, normal.y);
    vec3 k = mix(vec3(1.0), vec3(1.12, 1.08, 1.0), lift * uDim) * mix(vec3(1.0), vec3(0.84, 0.72, 0.68), shade * uDim) * (1.0 + 0.08 * top * uDim);
    reflectedLight.directDiffuse *= k; reflectedLight.indirectDiffuse *= k;
  }
#if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    float ndl = dot(normal, directionalLights[i].direction);
    float wrap = max(0.0, (ndl + 0.5) / 1.5) - max(ndl, 0.0);
    float back = pow(clamp(-ndl, 0.0, 1.0), 2.0) * 0.15;
    reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.62, 0.48) * directionalLights[i].color * (wrap + back) * uSSS;
  }
#endif`);
  };
  m.customProgramCacheKey = () => 'duo-sss';
}
function makeMaterial(src, look, eyeMap) {
  const m = new THREE.MeshPhysicalMaterial({ name: src.name, side: THREE.FrontSide });
  if (look.keepMaps) { m.normalMap = src.normalMap || null; m.normalScale = src.normalScale?.clone?.() || m.normalScale; m.map = src.map || null; }
  m.color.copy(srgb(look.color)); m.roughness = look.roughness ?? 0.5; m.metalness = look.metalness ?? 0;
  m.specularIntensity = look.specularIntensity ?? 0.5; m.clearcoat = look.clearcoat ?? 0; m.clearcoatRoughness = look.clearcoatRoughness ?? 0.3;
  if (look.sheen) { m.sheen = look.sheen; m.sheenRoughness = look.sheenRoughness; m.sheenColor = srgb(look.sheenColor); }
  if (look.sss) addSkinScatter(m, look.sss);
  if (look.eye || /^Eye/.test(src.name)) { m.envMap = eyeMap; m.envMapIntensity = 1.2; }
  return m;
}
function eyeEnv(renderer) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 512, 256);
  for (const [x, y, r] of [[300, 80, 30], [360, 95, 14]]) { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#fff'); gr.addColorStop(1, '#3a3a3a'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose(); return env;
}
function bodyBox(model) { // posed bounds of the skinned body
  model.updateMatrixWorld(true); const box = new THREE.Box3(), v = new THREE.Vector3();
  model.traverse((o) => { if (!o.isMesh) return; const n = o.geometry.attributes.position.count, step = o.isSkinnedMesh ? 6 : 10;
    for (let i = 0; i < n; i += step) { o.getVertexPosition(i, v); box.expandByPoint(v.applyMatrix4(o.matrixWorld)); } });
  return box;
}

// ---------- rubber-hose arms (shared): pose tagged joints along a cubic curve shoulder -> wrist ----------
function makeHose(model, hose) {
  const rig = {};
  { const byside = { L: [], R: [] }; model.traverse((o) => { const h = o.userData?.hose; if (h) byside[h.side][h.k] = o; });
    for (const side of ['L', 'R']) { const nodes = byside[side].filter(Boolean); if (!nodes.length) continue; const h0 = nodes[0].userData.hose;
      rig[side] = { nodes, seg: h0.seg.map((n) => byName(model, n)), wrist: byName(model, h0.wrist), knots: h0.knots,
        axes: nodes.map((n) => new THREE.Vector3().fromArray(n.userData.hose.axis)), s: nodes.map((n) => n.userData.hose.s),
        off: nodes.map((n) => { const o = n.userData.hose.off; return o ? { p: new THREE.Vector3(o[0], o[1], o[2]), q: new THREE.Quaternion(o[3], o[4], o[5], o[6]) } : null; }) }; } }
  const HV = Array.from({ length: 13 }, () => new THREE.Vector3()), HQ = Array.from({ length: 4 }, () => new THREE.Quaternion());
  const hq = new THREE.Quaternion(), hq2 = new THREE.Quaternion(), hpq = new THREE.Quaternion(), NS = 48;
  const curveP = Array.from({ length: NS + 1 }, () => new THREE.Vector3()), curveL = new Float32Array(NS + 1);
  const bez = (P0, P1, P2, P3, u, out) => { const a = 1 - u; return out.set(0, 0, 0).addScaledVector(P0, a * a * a).addScaledVector(P1, 3 * a * a * u).addScaledVector(P2, 3 * a * u * u).addScaledVector(P3, u * u * u); };
  const bezD = (P0, P1, P2, P3, u, out) => { const a = 1 - u; out.set(0, 0, 0).addScaledVector(HV[8].subVectors(P1, P0), 3 * a * a).addScaledVector(HV[9].subVectors(P2, P1), 6 * a * u).addScaledVector(HV[8].subVectors(P3, P2), 3 * u * u); return out.normalize(); };
  function update() {
    if (!rig.L && !rig.R) return; model.updateMatrixWorld(true);
    for (const side in rig) { const r = rig[side];
      const S = r.seg[0].getWorldPosition(HV[0]), E = r.seg[2].getWorldPosition(HV[1]), W = r.wrist.getWorldPosition(HV[2]); r.seg.forEach((b, i) => b.getWorldQuaternion(HQ[i]));
      const Lr = S.distanceTo(E) + E.distanceTo(W); const du = HV[3].subVectors(E, S).normalize(), df = HV[4].subVectors(W, E).normalize(); const P1 = HV[5], P2 = HV[6];
      const useCurve = hose.on && S.distanceTo(W) < Lr * 0.9995;
      if (useCurve) { P1.copy(S).addScaledVector(du, S.distanceTo(E) * hose.k); P2.copy(W).addScaledVector(df, -E.distanceTo(W) * hose.k); }
      curveL[0] = 0;
      for (let i = 0; i <= NS; i++) { const u = i / NS; if (useCurve) bez(S, P1, P2, W, u, curveP[i]); else { const e = S.distanceTo(E) / Lr; if (u <= e) curveP[i].lerpVectors(S, E, u / e); else curveP[i].lerpVectors(E, W, (u - e) / (1 - e)); }
        if (i) curveL[i] = curveL[i - 1] + curveP[i].distanceTo(curveP[i - 1]); }
      const total = curveL[NS];
      r.nodes.forEach((node, k) => { const sk = r.s[k], d = sk * total; let i = 1; while (i < NS && curveL[i] < d) i++;
        const f = (d - curveL[i - 1]) / Math.max(1e-9, curveL[i] - curveL[i - 1]); const u = (i - 1 + f) / NS; const pos = HV[7].lerpVectors(curveP[i - 1], curveP[i], f);
        const tan = useCurve ? bezD(S, P1, P2, W, u, HV[10]) : HV[10].subVectors(curveP[i], curveP[i - 1]).normalize();
        const kn = r.knots; if (sk <= kn[0]) hq.copy(HQ[0]); else if (sk >= kn[3]) hq.copy(HQ[3]); else { let j = 0; while (sk > kn[j + 1]) j++; hq.slerpQuaternions(HQ[j], HQ[j + 1], (sk - kn[j]) / (kn[j + 1] - kn[j])); }
        hq2.setFromUnitVectors(HV[11].copy(r.axes[k]).applyQuaternion(hq), tan).multiply(hq);
        const o = r.off[k]; if (o) { pos.add(HV[12].copy(o.p).applyQuaternion(hq2)); hq2.multiply(o.q); } // bones authored off the curve keep their bind offset
        node.parent.getWorldQuaternion(hpq); node.quaternion.copy(hpq.invert().multiply(hq2)); node.position.copy(node.parent.worldToLocal(pos.clone())); });
    }
  }
  return { rig, update };
}

// ---------- Flo ----------
function setupFlo(gltf, ctx) {
  const model = gltf.scene; const mats = {};
  let headMesh = null; const headBone = byName(model, 'head'); const pencil = byName(model, 'Flo.Acc.Pencil');
  model.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const isFace = o.name === 'FloHead' || o.parent?.name === 'FloHead';
    if (o.morphTargetDictionary && 'Smile' in o.morphTargetDictionary) headMesh = o;
    const swap = (mat) => { const name = mat.name === 'Flo.Skin' && isFace ? 'Flo.Face' : mat.name; const look = FLO_LOOK[name]; if (!look) return mat;
      return (mats[name] ||= makeMaterial(mat, look, ctx.eyeMap)); };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    if (/^FloEye/.test(o.name)) o.castShadow = false;
  });
  const mixer = new THREE.AnimationMixer(model); const actions = {};
  for (const [k, n] of Object.entries({ wave: 'Flo.Wave.Pencil', rest: 'Flo.Rest' })) { const clip = gltf.animations.find((a) => a.name === n); if (clip) actions[k] = mixer.clipAction(clip); }
  for (const a of Object.values(actions)) { a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = 0; a.play(); }

  // rubber-hose arms
  const hose = { on: true, k: 0.6 }; const H = makeHose(model, hose), hoseRig = H.rig, updateHose = H.update;
  { let skel = null; model.traverse((o) => { if (!skel && o.isSkinnedMesh && o.skeleton.bones.some((b) => b.userData?.hose)) skel = o; });
    const watch = byName(model, 'Flo.Acc.Watch');
    if (skel && watch && watch.parent) { const sk = skel.skeleton, bw = (b) => { const i = sk.bones.indexOf(b); return i < 0 ? null : skel.bindMatrix.clone().multiply(sk.boneInverses[i].clone().invert()); };
      const Bf = bw(watch.parent);
      if (Bf) { watch.updateMatrix(); const Wb = Bf.clone().multiply(watch.matrix); const wp = new THREE.Vector3().setFromMatrixPosition(Wb); let best = null, bd = 1e9;
        for (const side in hoseRig) for (const n of hoseRig[side].nodes) { const M = bw(n); const d = new THREE.Vector3().setFromMatrixPosition(M).distanceTo(wp); if (d < bd) { bd = d; best = [n, M]; } }
        if (best) { const L = best[1].clone().invert().multiply(Wb); best[0].add(watch); L.decompose(watch.position, watch.quaternion, watch.scale); } } } }
  const RAISE = 1.05, LOWER = 1.0; const waveDur = actions.wave?.getClip().duration || 0, restDur = actions.rest?.getClip().duration || 1;
  const st = { phase: 'rest', seqT: 0, idleT: 0, waveCount: 0 };
  const eyes = ['Flo.Eye.L', 'Flo.Eye.R'].map((n) => byName(model, n)).filter(Boolean);
  const eyeBaseY = eyes.map((e) => e.scale.y); // node scale carries the mesh dequantization (~0.01): blink relative to it
  const blink = { t: -1, next: 1.5 + Math.random() * 3, double: false, queued: -1 };
  const BLINK = 0.16; // seconds, close + open
  const stepBlink = (dt) => {
    if (blink.queued >= 0) { blink.queued -= dt; if (blink.queued < 0 && blink.t < 0) blink.t = 0; }
    if (blink.t >= 0) { blink.t += dt; if (blink.t > BLINK) { blink.t = -1; if (blink.double) { blink.double = false; blink.queued = 0.09; } } }
    else if ((blink.next -= dt) <= 0) { blink.t = 0; blink.double = Math.random() < 0.2; blink.next = 2 + Math.random() * 4; }
  };
  const applyBlink = () => { const u = blink.t >= 0 ? Math.sin(Math.PI * Math.min(1, blink.t / BLINK)) : 0; eyes.forEach((e, i) => { e.scale.y = eyeBaseY[i] * (1 - 0.9 * u); }); };
  const apply = () => { const w = st.phase === 'rest' ? 0 : ease(st.seqT / RAISE) * (1 - ease((st.seqT - (waveDur - LOWER)) / LOWER));
    if (actions.wave) { actions.wave.time = Math.min(st.seqT, waveDur - 1e-4); actions.wave.setEffectiveWeight(w); }
    if (actions.rest) { actions.rest.time = st.idleT % restDur; actions.rest.setEffectiveWeight(1 - w); }
    mixer.update(0); updateHose(); applyBlink(); };
  return {
    name: 'flo', model, headBone, headMesh, materials: mats, hose, pencil, cycle: waveDur,
    step(dt) { st.idleT += dt; stepBlink(dt); if (st.phase === 'wave') { st.seqT += dt; if (st.seqT >= waveDur) { st.phase = 'rest'; st.seqT = 0; } } },
    apply, busy: () => st.phase === 'wave',
    greet() { if (st.phase === 'wave') return false; st.phase = 'wave'; st.seqT = 0; st.waveCount++; blink.queued = 0.25; blink.next = 3 + Math.random() * 3; return true; },
    blinkNow() { blink.t = 0; },
    seek(t) { st.phase = t > 0 && t < waveDur ? 'wave' : 'rest'; st.seqT = Math.max(0, Math.min(waveDur, t)); },
    state() { return { phase: st.phase === 'wave' ? (st.seqT < RAISE ? 'raise' : st.seqT > waveDur - LOWER ? 'return' : 'wave') : 'rest', time: st.phase === 'wave' ? st.seqT : 0, duration: waveDur, waveCount: st.waveCount }; },
  };
}

// ---------- Doc ----------
function setupDoc(gltf, ctx) {
  const model = gltf.scene; const mats = {};
  model.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const swap = (mat) => { const look = DOC_LOOK[mat.name]; if (!look) return mat; return (mats[mat.name] ||= makeMaterial(mat, look, ctx.eyeMap)); };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    if (/Eyes|Eyebrows|Glasses/.test(o.name)) o.castShadow = false; });
  const headBone = byName(model, 'DEF-spine.006');
  const hose = { on: true, k: 0.6 }; const H = makeHose(model, hose);
  // Doc's single 20 s clip: 0-10 shift left + wave, 10-12 settle back, 12-20 stand loop. Two actions crossfade from the previous pose (as in Doc's demo).
  const clip = gltf.animations.find((a) => a.name === 'Cycle');
  const mixer = new THREE.AnimationMixer(model); const A = mixer.clipAction(clip), B = mixer.clipAction(clip.clone());
  for (const a of [A, B]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0; a.play(); }
  const WAVE_END = 10, CYCLE_END = 12, STAND = 8, FADE = 0.35;
  const st = { mode: 'stand', time: CYCLE_END, standT: 0, from: CYCLE_END, fade: 0, waveCount: 0 };
  const poseTime = () => (st.mode === 'cycle' ? st.time : CYCLE_END + (st.standT % STAND));
  const apply = () => { const f = Math.max(0, st.fade / FADE); A.time = Math.min(poseTime(), 20 - 1e-4); A.setEffectiveWeight(1 - f); B.time = Math.min(st.from, 20 - 1e-4); B.setEffectiveWeight(f); mixer.update(0); H.update(); };
  return {
    name: 'doc', model, headBone, materials: mats, cycle: CYCLE_END, hose,
    step(dt) { st.fade = Math.max(0, st.fade - dt);
      if (st.mode === 'cycle') { st.time += dt; if (st.time >= 20) { st.mode = 'stand'; st.standT = 0; } } else st.standT += dt; },
    apply, busy: () => st.mode === 'cycle' && st.time < CYCLE_END,
    greet() { if (st.mode === 'cycle' && st.time < CYCLE_END) return false; st.from = poseTime(); st.fade = FADE; st.mode = 'cycle'; st.time = 0; st.waveCount++; return true; },
    seek(t) { st.mode = 'cycle'; st.time = Math.max(0, Math.min(20, t)); st.fade = 0; },
    state() { const t = poseTime(); return { phase: st.mode === 'cycle' && st.time < WAVE_END ? 'wave' : st.mode === 'cycle' && st.time < CYCLE_END ? 'return' : 'rest', time: st.mode === 'cycle' ? st.time : 0, duration: CYCLE_END, waveCount: st.waveCount }; },
  };
}

// ---------- stage ----------
export async function createDuo(opts) {
  SKIN_DIM.value = opts?.skinDim ?? 1.7;
  const { container } = opts; const layout = { ...DEFAULT_LAYOUT, ...(opts.layout || {}) };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = opts.exposure ?? 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  let tablet = null, tabletEl = null;
  if (opts.tablet) {
    tabletEl = document.createElement('div'); const [tx, ty, tw, th] = layout.tablet;
    Object.assign(tabletEl.style, { position: 'absolute', left: tx * 100 + '%', top: ty * 100 + '%', width: tw * 100 + '%', height: th * 100 + '%', zIndex: 0 });
    container.appendChild(tabletEl);
    tablet = createTablet(tabletEl, { ...opts.tablet, mode: opts.tablet.mode || 'enhanced', autoplay: false });
  }
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, display: 'block' });
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose(); }
  const camera = new THREE.PerspectiveCamera(layout.camera.fov, 600 / 578, 0.1, 40);

  // light rig: key from front-left (short soft shadows falling right/back, as in the layout comp)
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9cfc4, 0.9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6ec, 2.5); key.position.set(1.5, 4.4, 1.76); key.castShadow = true; // front-right and high: short shadows falling back-left
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 30; key.shadow.blurSamples = 24; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.2, near: 0.5, far: 12 }); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xeef3ff, 0.9); fill.position.set(-3, 1.4, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(-1.5, 2.5, -3); scene.add(rim);

  const ctx = { eyeMap: eyeEnv(renderer) };
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (src) => (typeof src === 'string' ? loader.loadAsync(src) : loader.parseAsync(src, ''));
  const [docG, floG] = await Promise.all([opts.doc ? load(opts.doc) : null, opts.flo ? load(opts.flo) : null]);
  const chars = [];
  for (const [g, setup, place] of [[docG, setupDoc, layout.doc], [floG, setupFlo, layout.flo]]) {
    if (!g) continue; const c = setup(g, ctx); const holder = new THREE.Group(); holder.add(c.model); scene.add(holder);
    holder.position.set(place.x, 0, place.z); holder.rotation.y = place.rotY || 0; if (place.scale) holder.scale.setScalar(place.scale);
    c.holder = holder; c.apply(); const b = bodyBox(c.model); holder.position.y = -b.min.y; c.box = bodyBox(c.model).expandByScalar(0.04); chars.push(c);
  }
  const ch = Object.fromEntries(chars.map((c) => [c.name, c]));

  // shadow floor, faded with distance from the pair
  const mid = new THREE.Vector3(); chars.forEach((c) => mid.add(c.holder.position)); mid.divideScalar(chars.length || 1);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: opts.shadowOpacity ?? 0.21, color: 0x2a2018 }));
  const tabRect = new THREE.Vector4(0, 0, -1, -1), drawSize = new THREE.Vector2(1, 1);
  if (opts.tablet) { const [tx, ty, tw, th] = layout.tablet; tabRect.set(tx, 1 - (ty + th), tx + tw, 1 - ty); } // canvas-normalised, GL y-up
  ground.material.onBeforeCompile = (sh) => { sh.uniforms.uC = { value: new THREE.Vector2(mid.x - 0.05, mid.z) }; sh.uniforms.uTab = { value: tabRect }; sh.uniforms.uRes = { value: drawSize };
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP; uniform vec2 uC; uniform vec4 uTab; uniform vec2 uRes;\n' + sh.fragmentShader.replace(/gl_FragColor = vec4\( color, opacity \* \( 1\.0 - getShadowMask\(\) \) \);/,
      `float d = length((vWP.xz - uC) * vec2(0.85, 1.1));
       vec2 sp = gl_FragCoord.xy / uRes; vec2 q = abs(sp - 0.5 * (uTab.xy + uTab.zw)) - 0.5 * (uTab.zw - uTab.xy) + 0.03;
       float behindTablet = 1.0 - smoothstep(-0.004, 0.004, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.03);
       gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * (1.0 - smoothstep(0.1, 0.65, d)) * (1.0 - behindTablet) );`); };
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.001; ground.receiveShadow = true; scene.add(ground);
  key.target.position.set(mid.x, 0.8, mid.z); key.position.add(key.target.position);

  camera.position.fromArray(layout.camera.position); const target = new THREE.Vector3().fromArray(layout.camera.target); camera.lookAt(target);
  camera.aspect = opts.aspect ?? 600 / 578; camera.updateProjectionMatrix();
  // auto-fit: dolly + shift the camera so the pair's projected bounds land on layout.fit
  if (layout.fit) {
    const pts = []; for (const c of chars) { const b = bodyBox(c.model); for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z)); }
    const [fx0, fy0, fx1, fy1] = layout.fit; const want = { x0: fx0 * 2 - 1, x1: fx1 * 2 - 1, y0: 1 - fy1 * 2, y1: 1 - fy0 * 2 };
    for (let it = 0; it < 6; it++) {
      camera.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) { const q = p.clone().project(camera); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const sH = (y1 - y0) / (want.y1 - want.y0); const dir = camera.position.clone().sub(target); camera.position.copy(target).addScaledVector(dir, sH); camera.updateMatrixWorld();
      x0 = 9; x1 = -9; y0 = 9; y1 = -9; for (const p of pts) { const q = p.clone().project(camera); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const dist = camera.position.distanceTo(target), halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, halfW = halfH * camera.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const dx = ((x0 + x1) / 2 - (want.x0 + want.x1) / 2) * halfW, dy = ((y0 + y1) / 2 - (want.y0 + want.y1) / 2) * halfH;
      const shift = right.multiplyScalar(dx).add(up.multiplyScalar(dy)); camera.position.add(shift); target.add(shift); camera.lookAt(target);
    }
  }
  let controls = null;
  if (opts.controls) { controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(target); controls.enableDamping = true; controls.enablePan = false; controls.update(); }

  // The canvas 'antialias' flag doesn't apply once post-processing renders into its own targets,
  // so the scene goes into a 4x multisampled HalfFloat target (resolved before the AO and output passes).
  const msaaTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: opts.msaa ?? 4 });
  const composer = new EffectComposer(renderer, msaaTarget); composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 16 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }); ao.blendIntensity = 0.85;
  composer.addPass(ao); composer.addPass(new OutputPass());
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); renderer.getDrawingBufferSize(drawSize); }; // aspect stays locked to the layout comp; size the container to 600:578
  new ResizeObserver(resize).observe(container); resize();

  // pointer: head follow + hover/click greeting per character
  const HEAD = { yaw: 0.32, up: 0.12, down: 0.14 }; // radians: about 18° side to side, 7° up, 8° down
  const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pointer = new THREE.Vector2(), ray = new THREE.Raycaster(); let follow = opts.follow ?? true, hoverGreet = opts.hoverGreet ?? true, hoverAt = 0, downAt = null;
  const hit = (e) => { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }, camera);
    let best = null, bd = 1e9; for (const c of chars) { const p = ray.ray.intersectBox(c.box, new THREE.Vector3()); if (p) { const d = p.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = c; } } } return best; };
  // head follow keeps the pointer's page position and re-measures it every frame, so scrolling can't leave a stale, extreme angle
  const cursor = { x: 0, y: 0, active: false };
  const toNDC = () => { const r = renderer.domElement.getBoundingClientRect(); pointer.set(((cursor.x - r.left) / r.width) * 2 - 1, -(((cursor.y - r.top) / r.height) * 2 - 1)); return r; };
  document.documentElement.addEventListener('pointerleave', () => { cursor.active = false; });
  window.addEventListener('blur', () => { cursor.active = false; });
  window.addEventListener('pointermove', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.active = true; toNDC();
    if (!hoverGreet || e.buttons || performance.now() - hoverAt < 150) return; hoverAt = performance.now(); const c = hit(e); if (c && !c.busy()) api.greet(c.name, 'hover'); });
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) >= 5) return;
    const c = hit(e); if (c) { api.greet(c.name, 'click'); return; }
    if (tabletEl) { const r = tabletEl.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      if (u > 0.05 && u < 0.95 && v > 0.04 && v < 0.96) api.replayScreen(); } });
  renderer.domElement.addEventListener('pointermove', (e) => { if (!tabletEl) return; const r = tabletEl.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    renderer.domElement.style.cursor = hit(e) || (u > 0.05 && u < 0.95 && v > 0.04 && v < 0.96) ? 'pointer' : 'default'; });

  // staggered automatic greeting: Doc opens, Flo answers, then a rest before the next round
  const STAGGER = opts.stagger ?? 1.85, ROUND = opts.round ?? 20;
  let paused = false, speed = 1, autoGreet = opts.autoGreet ?? true, started = false, roundT = 0, pendingFlo = -1, smileBoost = 0;
  // opening: the screen builds first, the greeting starts as its last card settles; later greetings nudge one card instead of rebuilding
  const INTRO = tablet ? tablet.buildDuration * 0.85 : 0; let introRound = true, pendingNudge = -1, nudgeIdx = 0;
  const listeners = new Set(); const emit = () => listeners.forEach((f) => f(api.state()));
  const step = (dt) => {
    chars.forEach((c) => c.step(dt));
    if (pendingFlo >= 0) { pendingFlo -= dt; if (pendingFlo < 0) ch.flo?.greet(); }
    if (pendingNudge >= 0) { pendingNudge -= dt; if (pendingNudge < 0) tablet?.nudge(nudgeIdx++ % 4); }
    if (started && (autoGreet || introRound)) { roundT -= dt; if (roundT <= 0) { api.greet('both', 'automatic'); } }
  };
  const tmpE = new THREE.Euler(); const offs = new Map(chars.map((c) => [c, new THREE.Quaternion()])); const inv = new THREE.Quaternion();
  const api = {
    renderer, scene, camera, characters: ch, ao, controls, lights: { hemi, key, fill, rim },
    greet(who = 'both', trigger = 'api') {
      if (paused) return false;
      if (who === 'both') { const a = ch.doc?.greet(); if (ch.flo) pendingFlo = ch.doc ? STAGGER : 0; roundT = ROUND;
        if (trigger === 'automatic' && !introRound && tablet) pendingNudge = 1.1; // Doc's hand reaches toward the screen
        introRound = false; emit(); return !!a; }
      const c = ch[who]; const ok = c?.greet(); if (ok && trigger !== 'automatic') roundT = Math.max(roundT, ROUND * 0.6); emit(); return ok;
    },
    seek(t) { paused = true; tablet?.seek(t * 24); const g = t - INTRO; chars.forEach((c) => c.seek(c.name === 'flo' ? g - STAGGER : g)); pendingFlo = -1; chars.forEach((c) => c.apply()); emit(); },
    replayScreen() { tablet?.play(); }, tablet,
    replayIntro() { if (paused) return; tablet?.play(); introRound = true; roundT = INTRO; },
    setPaused(p) { paused = p; p ? tablet?.pause() : tablet?.resume(); emit(); }, setSpeed(s) { speed = s; },
    setAutoGreet(on) { autoGreet = on; if (on) roundT = Math.min(roundT, 1.5); emit(); }, setHoverGreet(on) { hoverGreet = on; },
    setFollow(f) { follow = f; }, setSkinDim(v) { SKIN_DIM.value = v; }, setAO(on) { ao.enabled = on; }, setSmile(v) { smileBoost = v; },
    setHose(on) { chars.forEach((c) => { if (c.hose) c.hose.on = on; }); }, setHoseCurve(k) { chars.forEach((c) => { if (c.hose) c.hose.k = k; }); },
    onChange(f) { listeners.add(f); },
    state() { return { paused, autoGreet, nextRound: Math.max(0, roundT), doc: ch.doc?.state(), flo: ch.flo?.state(), duration: INTRO + Math.max(ch.doc?.cycle || 0, (ch.flo?.cycle || 0) + STAGGER), intro: INTRO }; },
    renderFrame() { chars.forEach((c) => c.apply()); composer.render(); },
  };

  const clock = new THREE.Timer(); clock.connect?.(document);
  const loop = () => {
    clock.update(); const dt = Math.min(clock.getDelta(), 0.05);
    if (!paused && !document.hidden) step(dt * speed);
    chars.forEach((c) => c.apply());
    // head follow + smile offsets: applied for this frame only (see note in viewer.js)
    const applied = [];
    for (const c of chars) { if (!c.headBone) continue; const q = offs.get(c);
      const hp = c.headBone.getWorldPosition(new THREE.Vector3()).project(camera);
      let pitch = 0, yaw = 0;
      if (follow && cursor.active) { toNDC(); const dx = pointer.x - hp.x, dy = pointer.y - hp.y;
        // fade out when the pointer is far from the stage (e.g. well below it on the page), soft-limit the angles
        const far = Math.max(Math.abs(dx), Math.abs(dy)), w = 1 - smoothstep(1.6, 3.2, far);
        yaw = HEAD.yaw * Math.tanh((dx * 0.3) / HEAD.yaw) * w;
        pitch = -dy * 0.15; pitch = (pitch > 0 ? HEAD.down : HEAD.up) * Math.tanh(pitch / (pitch > 0 ? HEAD.down : HEAD.up)) * w; }
      tmpE.set(pitch, yaw, 0);
      q.slerp(new THREE.Quaternion().setFromEuler(tmpE), 0.08); c.headBone.quaternion.multiply(q); applied.push(c); }
    let smilePrev = null; const fm = ch.flo?.headMesh, si = fm?.morphTargetDictionary?.Smile;
    if (fm && si !== undefined && smileBoost) { smilePrev = fm.morphTargetInfluences[si]; fm.morphTargetInfluences[si] = Math.min(1, smilePrev + smileBoost); }
    controls?.update(); composer.render();
    for (const c of applied) c.headBone.quaternion.multiply(inv.copy(offs.get(c)).invert());
    if (smilePrev !== null) fm.morphTargetInfluences[si] = smilePrev;
    if (!paused) emit();
  };
  renderer.setAnimationLoop(loop);
  if (opts.noAutoplay || matchMedia('(prefers-reduced-motion: reduce)').matches) { paused = true; tablet?.seek(400); }
  else {
    setTimeout(() => { started = true; api.replayIntro(); }, opts.greetDelay ?? 300);
    // coming back after 30 s away replays the opening (screen first)
    let hiddenAt = 0; new IntersectionObserver((es) => { for (const e of es) { if (!e.isIntersecting) hiddenAt = performance.now(); else if (hiddenAt && performance.now() - hiddenAt > 30000) { hiddenAt = 0; api.replayIntro(); } } }, { threshold: 0.25 }).observe(container);
  }
  // stop all rendering while the hero is offscreen or the tab is hidden
  { let visible = true, live = true;
    const sync = () => { const on = visible && !document.hidden; if (on === live) return; live = on;
      renderer.setAnimationLoop(on ? loop : null); tablet?.setRunning(on); if (on) clock.reset?.(); };
    new IntersectionObserver((es) => { for (const e of es) visible = e.isIntersecting; sync(); }, { rootMargin: '100px' }).observe(container);
    document.addEventListener('visibilitychange', sync); }
  return api;
}
