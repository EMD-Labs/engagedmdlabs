// EngagedMD hero tablet — four-card build, recreated from "HERO Tablet Action_BASE-1sec" (AE, 24 fps).
// createTablet(container, { frameSvg, icons, signature, mode: 'faithful' | 'enhanced', autoplay })
// Screen content is authored in the AE comp's own space (1091 x 1499) and fitted into the tablet screen.

const NS = 'http://www.w3.org/2000/svg';
// brand values from the EngagedMD style guide (Cream, Dark Green, Teal, Pink, Orange)
const C = { card: '#fff2e3', cardLine: '#e3d6c4', teal: '#005459', cyan: '#05c9bf', pink: '#f54fb0', orange: '#ff9663', muted: '#43777b', scrub: '#327475', white: '#ffffff' };
const FPS = 24;
const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x, s = 1.6) => { x = clamp(x) - 1; return 1 + x * x * ((s + 1) * x + s); };
const spring = (x, k = 7, z = 0.62) => { x = clamp(x); return 1 - Math.exp(-z * k * x) * Math.cos(k * Math.sqrt(1 - z * z) * x * 1.25); }; // enhanced mode

const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
const rr = (p, x, y, w, h, r, fill, extra = {}) => el('rect', { x, y, width: w, height: h, rx: r, fill, ...extra }, p);
const bar = (p, x0, x1, y, h, fill) => el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: fill, 'stroke-width': h, 'stroke-linecap': 'round' }, p);

// card layout measured from the final frame of the MOV
const CARDS = [
  { kind: 'video', badge: C.orange, icon: 'cap', fill: 866, lines: [687, 841, 710] },
  { kind: 'sign', badge: C.cyan, icon: 'signdoc', fill: 802, lines: [787, 862] },
  { kind: 'check', badge: C.pink, icon: 'pin', fill: 905, lines: [787, 706, 754] },
  { kind: 'radio', badge: C.orange, icon: 'checklist', fill: 848, lines: [787, 706] },
];
const CARD_Y = (k) => 221 + 298 * k, STAGGER = 5, START = 1; // frames
// enhanced build runs slower and with more room between cards (per review: give the build more time)
const ENH = { speed: 0.45, stagger: 7.5, life: 0.8 };

function iconGroup(parent, icon, cx, cy, size) {
  const [vx, vy, vw] = icon.viewBox; const s = size / vw;
  const g = el('g', { transform: `translate(${cx - size / 2} ${cy - size / 2}) scale(${s}) translate(${-vx} ${-vy})` }, parent);
  for (const p of icon.paths) el('path', p.stroke ? { d: p.d, fill: 'none', stroke: '#fff', 'stroke-width': p.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : { d: p.d, fill: '#fff' }, g);
  return g;
}

function buildCard(root, k, assets) {
  const spec = CARDS[k], y0 = CARD_Y(k), parts = {};
  const g = parts.card = el('g', {}, root);
  parts.glow = rr(g, 109, y0 - 6, 871, 277, 27, 'none', { stroke: C.cyan, 'stroke-width': 5, opacity: 0 });
  rr(g, 115, y0, 859, 265, 22, C.card, { stroke: C.cardLine, 'stroke-width': 1.5 });
  // thumbnail panel (scales in X from its left edge)
  const panel = parts.panel = el('g', {}, g);
  rr(panel, 148, y0 + 33, 271, 199, 22, C.teal);
  const inner = parts.inner = el('g', {}, panel);
  if (spec.kind === 'video') {
    rr(inner, 172, y0 + 54, 223, 128, 4, 'none', { stroke: C.white, 'stroke-width': 2.5 });
    parts.play = el('g', {}, inner); el('circle', { cx: 284, cy: y0 + 117, r: 32, fill: C.white }, parts.play);
    parts.tri = el('path', { d: `M276 ${y0 + 101} L276 ${y0 + 133} L302 ${y0 + 117} Z`, fill: C.teal, 'stroke-linejoin': 'round' }, parts.play);
    bar(inner, 243, 371, y0 + 210, 4, C.scrub); parts.scrub = bar(inner, 168, 243, y0 + 210, 4, C.white);
    parts.knob = el('circle', { cx: 243, cy: y0 + 210, r: 7, fill: C.white }, inner);
    rr(inner, 381, y0 + 201, 5, 18, 1.5, C.white); rr(inner, 391, y0 + 201, 5, 18, 1.5, C.white);
  } else if (spec.kind === 'sign') {
    for (const x of [168, 182, 196]) el('circle', { cx: x, cy: y0 + 56, r: 4.5, fill: C.white }, inner);
    rr(inner, 381, y0 + 46, 21, 21, 2, C.white);
    rr(inner, 164, y0 + 91, 239, 127, 7, C.white);
    const x = 381, yy = y0 + 108; el('path', { d: `M${x - 5} ${yy - 5} L${x + 5} ${yy + 5} M${x + 5} ${yy - 5} L${x - 5} ${yy + 5}`, stroke: C.teal, 'stroke-width': 3, 'stroke-linecap': 'round' }, inner);
    const clipId = `sig${k}${Math.random().toString(36).slice(2, 6)}`;
    const cp = el('clipPath', { id: clipId }, root); parts.sigClip = rr(cp, 180, y0 + 100, 220, 100, 0, '#000');
    el('path', { d: assets.signature, fill: C.teal, transform: `translate(0 ${y0 - 519})`, 'clip-path': `url(#${clipId})` }, inner);
    rr(inner, 188, y0 + 201, 194, 2.5, 1, C.teal);
  } else if (spec.kind === 'check') {
    parts.checks = [];
    for (const [i, yy] of [[0, 59], [1, 114], [2, 171]]) {
      rr(inner, 173, y0 + yy, 39, 39, 5, C.white);
      const ck = el('path', { d: `M180 ${y0 + yy + 21} L189 ${y0 + yy + 32} L206 ${y0 + yy + 7}`, fill: 'none', stroke: C.teal, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }, inner);
      parts.checks.push(ck);
    }
    bar(inner, 241, 397, y0 + 77, 5, C.white); bar(inner, 241, 371, y0 + 134, 5, C.white); bar(inner, 241, 394, y0 + 191, 5, C.white);
  } else {
    parts.radios = [];
    for (const [i, yy] of [[0, 77], [1, 132], [2, 188]]) {
      const ring = el('circle', { cx: 192, cy: y0 + yy, r: 16, fill: i === 1 ? C.teal : C.muted, stroke: C.white, 'stroke-width': 4 }, inner);
      const dot = el('circle', { cx: 192, cy: y0 + yy, r: 8.5, fill: C.white, opacity: i === 1 ? 1 : 0 }, inner); // selected answer: white centre
      parts.radios.push({ ring, dot });
    }
    parts.rlines = [bar(inner, 241, 371, y0 + 77, 5, C.muted), bar(inner, 241, 371, y0 + 134, 5, C.white), bar(inner, 241, 365, y0 + 190, 5, C.muted)];
  }
  // header: pink tag, progress bar, short rule
  parts.pill = rr(g, 445, y0 + 44, 155, 31, 8, 'none', { stroke: C.pink, 'stroke-width': 3.5 });
  parts.barBg = bar(g, 623, 947, y0 + 51, 9, C.cyan); parts.barFill = bar(g, 623, spec.fill, y0 + 51, 9, C.teal);
  parts.rule = bar(g, 897, 949, y0 + 74, 4, C.teal);
  parts.lines = spec.lines.map((x1, i) => bar(g, 450, x1, y0 + 112 + 30 * i, 5, C.teal));
  // badge
  parts.badge = el('g', {}, g); el('circle', { cx: 917, cy: y0 + 211, r: 37, fill: spec.badge }, parts.badge);
  iconGroup(parts.badge, assets.icons[spec.icon], 917, y0 + 211, 46);
  parts.spec = spec; parts.y0 = y0;
  return parts;
}

const scaleAbout = (x, y, sx, sy = sx) => `translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})`;
const growLine = (line, x0, x1, f) => { line.setAttribute('x2', x0 + (x1 - x0) * f); line.setAttribute('opacity', f > 0.015 ? 1 : 0); };

// faithful: curves sampled from every frame of the MOV (per card), so the hand-keyed AE timing is reproduced
const at = (arr, f) => { if (!arr) return 1; if (f <= 0) return arr[0] || 0; const i = Math.floor(f); if (i >= arr.length - 1) return arr[arr.length - 1]; const u = f - i; return arr[i] * (1 - u) + arr[i + 1] * u; };
const show = (node, v) => node.setAttribute('opacity', v > 0.015 ? 1 : 0);
function poseFaithful(p, t, frame, CV, k) {
  const y0 = p.y0, cx = 544.5, cy = y0 + 132.5, vf = frame; // video frame index (0-based) for this card's own curves
  const sc = at(CV.scale, t + 1), op = at(CV.opacity, t + 1);
  p.card.setAttribute('opacity', op); p.card.setAttribute('transform', scaleAbout(cx, cy, Math.max(0.001, sc)));
  const pan = at(CV.panel[k], vf), panLead = at(CV.panel[k], vf + 1.5); // the thin vertical sliver shows a frame before the measurable growth
  const pw = pan > 0 ? pan : panLead > 0 ? 0.03 : 0;
  p.panel.setAttribute('transform', scaleAbout(148, cy, Math.max(0.001, pw), 1)); show(p.panel, pw);
  const head = at(CV.panel[k], vf + 2); // tag + progress bar lead the panel slightly
  p.pill.setAttribute('transform', scaleAbout(522, y0 + 59, Math.max(0.001, head))); show(p.pill, head);
  const hb = Math.min(1, head); growLine(p.barBg, 623, 947, hb); growLine(p.barFill, 623, p.spec.fill, hb); show(p.barBg, hb); show(p.barFill, hb);
  const r = Math.min(1, at(CV.panel[k], vf - 2)); p.rule.setAttribute('x1', 949 - 52 * r); p.rule.setAttribute('x2', 949); show(p.rule, r);
  p.lines.forEach((ln, i) => { const v = at(CV.line[k], vf - i); growLine(ln, 450, p.spec.lines[i], v); show(ln, v); });
  const b = at(CV.badge[k], vf); p.badge.setAttribute('transform', scaleAbout(917, y0 + 211, Math.max(0.001, b))); show(p.badge, b);
  if (p.play) { const pb = at(CV.badge[k], vf - 1.5); p.play.setAttribute('transform', scaleAbout(284, y0 + 117, Math.max(0.001, 0.12 + 0.88 * Math.min(1.05, pb)))); p.tri.setAttribute('opacity', clamp((pb - 0.9) / 0.15)); }
  if (p.sigClip) p.sigClip.setAttribute('width', 220);
  if (p.checks) p.checks.forEach((c) => c.setAttribute('stroke-dashoffset', 0));
}

// enhanced: same build, springier and softer, then each card keeps a small loop of life
function poseEnhanced(p, t, life, nudge = 0) {
  const y0 = p.y0, cx = 544.5, cy = y0 + 132.5, k = CARDS.indexOf(p.spec);
  const nb = nudge > 0 && nudge < 1.6 ? Math.sin(Math.PI * Math.min(1, nudge / 1.6)) : 0; // 0..1..0 over 1.6 s
  const op = easeOut(t / 8), rise = (1 - easeOut(t / 10)) * 26;
  p.card.setAttribute('opacity', op); p.card.setAttribute('transform', `translate(0 ${rise - 6 * nb}) ` + scaleAbout(cx, cy, (0.94 + 0.06 * spring(t / 16)) * (1 + 0.018 * nb)));
  if (p.glow) p.glow.setAttribute('opacity', 0.55 * nb);
  p.panel.setAttribute('transform', scaleAbout(148, cy, Math.max(0.001, backOut((t - 4) / 11, 0.9)), 1)); p.panel.setAttribute('opacity', t >= 4 ? 1 : 0); // gentle overshoot: stays clear of the tag
  p.pill.setAttribute('transform', scaleAbout(522, y0 + 59, Math.max(0.001, spring((t - 5) / 10))));
  growLine(p.barBg, 623, 947, easeOut((t - 5) / 6));
  // progress fills over time, then breathes slightly
  const fillTo = p.spec.fill + Math.sin(life * 0.9 + k) * 10 * clamp((t - 30) / 10) + 34 * nb;
  growLine(p.barFill, 623, fillTo, easeOut((t - 8) / 18));
  { const r = easeOut((t - 9) / 6); p.rule.setAttribute('x1', 949 - 52 * r); p.rule.setAttribute('x2', 949); p.rule.setAttribute('opacity', r > 0.015 ? 1 : 0); }
  p.lines.forEach((ln, i) => growLine(ln, 450, p.spec.lines[i], spring((t - 8 - i * 1.5) / 12)));
  const bob = Math.sin(life * 1.6 + k * 1.3) * 2.2 * clamp((t - 20) / 10);
  p.badge.setAttribute('transform', `translate(0 ${bob}) ` + scaleAbout(917, y0 + 211, Math.max(0.001, spring((t - 7) / 12))));
  if (p.play) { // play pulses; the scrub knob travels
    const pulse = 1 + 0.06 * Math.max(0, Math.sin(life * 2.4)) * clamp((t - 24) / 6);
    p.play.setAttribute('transform', scaleAbout(284, y0 + 117, Math.max(0.001, spring((t - 6) / 12)) * pulse)); p.tri.setAttribute('opacity', clamp((t - 10) / 3));
    const u = clamp((t - 14) / 10) * ((life * 0.12) % 1), kx = 168 + (371 - 168) * (0.37 + 0.63 * u);
    p.knob.setAttribute('cx', kx); p.scrub.setAttribute('x2', kx);
  }
  if (p.sigClip) p.sigClip.setAttribute('width', 220 * easeOut((t - 9) / 16)); // signature writes itself
  if (p.checks) p.checks.forEach((c, i) => c.setAttribute('stroke-dashoffset', 1 - easeOut((t - 11 - i * 3) / 5)));
  if (p.radios) { // selection moves down the list on a slow loop
    const sel = t < 14 ? 1 : Math.floor(life / 2.2 + 1) % 3;
    p.radios.forEach((r, i) => { r.ring.setAttribute('fill', i === sel ? C.teal : C.muted); r.dot.setAttribute('opacity', i === sel ? 1 : 0); });
    p.rlines.forEach((l, i) => l.setAttribute('stroke', i === sel ? C.white : C.muted));
  }
}

export function createTablet(container, opts) {
  const { frameSvg, icons, signature } = opts; let mode = opts.mode || 'faithful';
  container.innerHTML = frameSvg; const svg = container.querySelector('svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.style.display = 'block';
  // screen area in the tablet artwork, minus the header strip with the logo
  const screen = el('svg', { x: 1029, y: 319, width: 955, height: 1361, viewBox: '0 0 1091 1499', preserveAspectRatio: 'xMidYMid meet', overflow: 'hidden' }, svg);
  const root = el('g', {}, screen);
  const cards = CARDS.map((_, k) => buildCard(root, k, { icons, signature }));
  const nudges = [-1, -1, -1, -1]; let t0 = null, frame = 0, playing = !!(opts.autoplay ?? true), lifeT = 0, last = null;
  const render = () => cards.forEach((p, k) => { if (mode === 'faithful') poseFaithful(p, frame - (START + STAGGER * k), frame, opts.curves, k); else poseEnhanced(p, frame * (opts.speed ?? ENH.speed) - (START + ENH.stagger * k), lifeT * ENH.life, nudges[k] >= 0 ? lifeT - nudges[k] : 0); });
  let running = true;
  const tick = (now) => {
    if (!running) return;
    if (last === null) last = now; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) { frame += dt * FPS; lifeT += dt; }
    render(); requestAnimationFrame(tick);
  };
  render(); requestAnimationFrame(tick);
  return {
    setRunning(on) { if (on && !running) { running = true; last = null; requestAnimationFrame(tick); } running = !!on; }, // stopped while offscreen
    play() { frame = 0; lifeT = 0; nudges.fill(-1); playing = true; },
    nudge(k) { nudges[k] = lifeT; },
    get buildDuration() { return mode === 'faithful' ? 35 / FPS : (START + ENH.stagger * 3 + 16) / (FPS * ENH.speed); },
    seek(f) { frame = f; playing = false; render(); },
    resume() { playing = true; }, pause() { playing = false; },
    setMode(m) { mode = m; render(); },
    get frame() { return frame; }, el: svg,
  };
}
