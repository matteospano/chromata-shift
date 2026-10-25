(() => {
  'use strict';

const HUE_NAMES = [
  'Red', 'Red-orange', 'Orange', 'Amber', 'Yellow-orange',
  'Yellow', 'Yellow-lime', 'Lime', 'Yellow-green', 'Spring green',
  'Green', 'Sea green', 'Teal-green', 'Turquoise', 'Aqua',
  'Cyan', 'Sky blue', 'Azure', 'Blue-cyan', 'Blue-indigo',
  'Blue', 'Indigo', 'Blue-violet', 'Violet', 'Purple',
  'Magenta', 'Red-violet', 'Rose', 'Crimson', 'Scarlet'
];
  const HUES = HUE_NAMES.map((name, i) => ({ name, angle: i * 12 }));
  const LIGHTNESS = { '-2': 82, '-1': 68, '0': 50, '1': 36, '2': 24 };
  const SHADE_NAMES = { '-2': 'Pale', '-1': 'Light', '0': '', '1': 'Deep', '2': 'Dark' };
  const COSTS = { lighten: 1, darken: 1, invert: 3, mix: 1 };
  const MIX_RATIOS = [{label:'3:1',a:3,b:1},{label:'2:1',a:2,b:1},{label:'3:2',a:3,b:2},{label:'1:1',a:1,b:1},{label:'2:3',a:2,b:3},{label:'1:2',a:1,b:2},{label:'1:3',a:1,b:3}];
  const MIX_HUES = { red: 0, green: 10, blue: 20 };
  const ACTION_NAMES = {
    lighten: 'Bright', darken: 'Dark', invert: 'Invert', mix: 'Mix'
  };
  const LEVEL_START = { kind: 'normal', h: 0, t: -1 };
  const LEVEL_TARGET = { kind: 'normal', h: 10, t: 2 };
  const BEST_KEY = 'chroma-shift-level-01-best-v1';
  const $ = (id) => document.getElementById(id);

  //hard level:
  const HARD_TARGET = clone(LEVEL_TARGET);

const HARD_START_OPTIONS = [
  {
    id: 'efficient',
    label: 'Green',
    description: 'Two mixes · cost 2.0 · distance depends on ratio',
    state: { kind: 'normal', h: 10, t: 2 }
  },
  {
    id: 'inversion',
    label: 'Pale Magenta',
    description: 'One inversion · cost 3.0 · distance 6d',
    state: { kind: 'normal', h: 25, t: -2 }
  },
  {
    id: 'classic',
    label: 'Light Red',
    description: 'A longer route with several possible approaches',
    state: { kind: 'normal', h: 0, t: -1 }
  }
];

  // Recompose the desktop board: start/target together, wheel in the center, actions at right.
  const boardEl = document.querySelector('.board');
  const colorCards = boardEl.querySelectorAll('.color-panel');
  const wheelCard = boardEl.querySelector('.wheel-panel');
  const actionCard = document.querySelector('.actions-panel');
  const pairCard = document.createElement('article');
  pairCard.className = 'panel pair-panel';
  if (colorCards.length >= 2 && wheelCard && actionCard) {
    pairCard.append(colorCards[0], colorCards[1]);
    boardEl.replaceChildren(pairCard, wheelCard, actionCard);
  }

  let mode = 'level';
  let startState = clone(LEVEL_START);
  let targetState = clone(LEVEL_TARGET);
  let currentState = clone(startState);
  let moves = 0;
  let cost = 0;
  let pathDistance = 0;
  let won = false;
  let path = [];
  let bests = loadBests();
  let copyTimer = null;
  let selectedMixColor = 'red';
  let selectedRatio = '1:1';
  let previewState = null;

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function mod(n, m) { return ((n % m) + m) % m; }
  function isTerminal(s) { return s.kind !== 'normal'; }
  function isSame(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind !== 'normal') return true;
    return Math.abs(shortestHueDelta(a.h, b.h)) <= 0.5 && a.t === b.t;
  }
  function colorInfo(s) {
    if (s.kind === 'white') return { name: 'Pure White', hex: '#FFFFFF', css: '#FFFFFF', angle: null, tone: -3 };
    if (s.kind === 'black') return { name: 'Pure Black', hex: '#000000', css: '#000000', angle: null, tone: 3 };
    if (s.kind === 'grey') return { name: 'Neutral Grey', hex: '#808080', css: '#808080', angle: null, tone: 0 };
    const hueIndex = mod(Math.round(s.h), HUES.length);
    const hue = HUES[hueIndex];
    const angle = mod(s.h, HUES.length) * (360 / HUES.length);
    const prefix = SHADE_NAMES[String(s.t)];
    const hueLabel = Math.abs(s.h - Math.round(s.h)) > 0.001 ? `${hue.name} ${s.h.toFixed(1)}` : hue.name;
    const name = prefix ? prefix + ' ' + hueLabel : hueLabel;
    const lightness = LIGHTNESS[String(s.t)];
    const saturation = s.t === -2 ? 76 : (s.t === 2 ? 82 : 84);
    const hex = hslToHex(angle, saturation, lightness);
    return { name, hex, css: hex, angle, tone: s.t };
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0').toUpperCase();
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
  function shadeLabel(s) {
    if (s.kind === 'white') return 'Terminal shade · +3 light';
    if (s.kind === 'black') return 'Terminal shade · +3 dark';
    if (s.kind === 'grey') return 'Terminal · no hue';
    if (s.t === 0) return 'Neutral shade';
    return s.t < 0 ? `Shade ${s.t} · lighter` : `Shade +${s.t} · darker`;
  }
  function toneCaption(s) {
    if (isTerminal(s)) return 'Terminal color · no return';
    return `Hue index ${s.h.toFixed(1)} · shade ${s.t > 0 ? '+' : ''}${s.t}`;
  }
  function resolveTone(h, t) {
    if (t >= 3) return { kind: 'black', h, t: 3 };
    if (t <= -3) return { kind: 'white', h, t: -3 };
    return { kind: 'normal', h: mod(h, HUES.length), t };
  }
function shortestHueDelta(from, to) {
  const d = mod(to - from, HUES.length);
  return d > HUES.length / 2 ? d - HUES.length : d;
}
  function cellDistance(a, b, actionId) {
    // Inversion is a special transform: it crosses the five shade bands and the center (6d).
    if (actionId === 'invert') return 6;
    if (a.kind === 'normal' && b.kind === 'normal') return Math.round((Math.abs(shortestHueDelta(a.h, b.h)) + Math.abs(a.t - b.t)) * 10) / 10;
    // White/black sit one step beyond the lightest/darkest represented ring.
    if (a.kind === 'normal' && (b.kind === 'white' || b.kind === 'black')) return 1;
    return 0;
  }
function hueMidpoint(from, to) {
    return mod(from + shortestHueDelta(from, to) / 2, HUES.length);
  }
  function computeMove(actionId, mixColor = selectedMixColor, ratio = selectedRatio) {
    if (isTerminal(currentState)) return clone(currentState);
    const s = currentState;
    const towardNeutral = s.t === 0 ? 0 : s.t - Math.sign(s.t);
    switch (actionId) {
      case 'lighten': return resolveTone(s.h, s.t - 1);
      case 'darken': return resolveTone(s.h, s.t + 1);
      case 'invert': return { kind: 'normal', h: mod(s.h + HUES.length / 2, HUES.length), t: -s.t };
      case 'mix': {
        const targetHue = MIX_HUES[mixColor];
        if (targetHue === undefined) return clone(s);
        const r = MIX_RATIOS.find(item => item.label === ratio) || MIX_RATIOS[3];
        // Ratio means current color : chosen primary. The primary's share determines the travel fraction.
        const fraction = r.b / (r.a + r.b);
        const delta = shortestHueDelta(s.h, targetHue);
        const nextHue = mod(Math.round((s.h + delta * fraction) * 10) / 10, HUES.length);
        return resolveTone(nextHue, towardNeutral);
      }
      default: return clone(s);
    }
  }
  function applyMove(actionId, mixColor = selectedMixColor, ratio = selectedRatio) {
    if (won || isTerminal(currentState)) return;
    console.log(selectedRatio)
    const prevState = clone(currentState);
    const next = computeMove(actionId, mixColor, ratio);
    if (isSame(prevState, next)) return;
    const actionLabel = actionId === 'mix'
      ? `Mix ${mixColor[0].toUpperCase() + mixColor.slice(1)} ${ratio}`
      : ACTION_NAMES[actionId];
    moves += 1;
    cost = Number((cost + COSTS[actionId]).toFixed(1));
    currentState = next;
    pathDistance += cellDistance(prevState, currentState, actionId);
    won = isSame(currentState, targetState);
    path.push({ state: clone(currentState), action: actionLabel });
    let improved = false;
    if (won) improved = updateBests();
    previewState = null;
    render(improved);
  }
  function loadBests() {
    try {
      const data = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
      if (data && Number.isFinite(data.moves) && Number.isFinite(data.cost) && Number.isFinite(data.distance)) return data;
    } catch (_) {}
    return { moves: null, cost: null, distance: null };
  }
  function saveBests() {
    try { localStorage.setItem(BEST_KEY, JSON.stringify(bests)); } catch (_) {}
  }
  function updateBests() {
    if (mode === 'sandbox') return false;
    let improved = false;
    if (bests.moves === null || moves < bests.moves) { bests.moves = moves; improved = true; }
    if (bests.cost === null || cost < bests.cost - 1e-9) { bests.cost = Number(cost.toFixed(1)); improved = true; }
    if (bests.distance === null || pathDistance < bests.distance) { bests.distance = pathDistance; improved = true; }
    saveBests();
    return improved;
  }
  function setMode(nextMode) {
  if (mode === nextMode) {
    if (mode === 'hard') openHardStartPicker();
    return;
  }

  mode = nextMode;

  document.querySelectorAll('.mode-tab').forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  bests = loadBests();

  if (mode === 'level') {
    startState = clone(LEVEL_START);
    targetState = clone(LEVEL_TARGET);
    configureLevelText();
    resetAttempt();
    return;
  }

  if (mode === 'sandbox') {
    configureSandboxText();
    randomizePair();
    resetAttempt();
    return;
  }

  if (mode === 'hard') {
    targetState = clone(HARD_TARGET);

    if ($('introEyebrow')) {
      $('introEyebrow').textContent =
        'Hard Level · Choose your route';
    }
    if ($('levelCount')) {
      $('levelCount').textContent = 'HARD';
    }
    if ($('trailTitle')) {
      $('trailTitle').textContent = 'Hard level trace';
    }
    if ($('resetBtn')) {
      $('resetBtn').textContent = '↺ Choose another start';
    }

    openHardStartPicker();
  }
}
  function configureLevelText() {
    $('introEyebrow').textContent = 'Level 01 · Learn the inversion';
    if ($('introTitle')) $('introTitle').textContent = 'Every color is a state.';
    if ($('introText')) $('introText').textContent = ''; 
    $('levelCount').innerHTML = '01 <span style="color:#818a9e">/ 01</span>';
    if ($('levelSub')) $('levelSub').textContent = ''; 
    $('missionIcon').textContent = '↗';
    $('missionTitle').textContent = 'Mission: reach Dark Green';
    $('missionDesc').textContent = 'Invert the hue, then adjust its shade. There is more than one route.';
    if ($('movesSubtitle')) $('movesSubtitle').textContent = ''; 
    $('resetBtn').textContent = '↺ Reset attempt';
    $('trailTitle').textContent = 'Your trace';
    $('continueBtn').textContent = 'Try to master it ↗';
  }
  function configureSandboxText() {
    $('introEyebrow').textContent = 'Sandbox · No fixed objective';
    if ($('introTitle')) $('introTitle').textContent = 'Find your own route.';
    if ($('introText')) $('introText').textContent = ''; 
    $('levelCount').textContent = 'FREE PLAY';
    if ($('levelSub')) $('levelSub').textContent = ''; 
    $('missionIcon').textContent = '⟳';
    $('missionTitle').textContent = 'Mission: connect two colors';
    $('missionDesc').textContent = 'Try different routes. Terminal colors are traps, so choose each action carefully.';
    if ($('movesSubtitle')) $('movesSubtitle').textContent = ''; 
    $('resetBtn').textContent = '↺ Restart run';
    $('trailTitle').textContent = 'Sandbox trace';
    $('continueBtn').textContent = 'New color pair ↗';
  }
  function randomColor() {
    return { kind: 'normal', h: Math.floor(Math.random() * HUES.length), t: Math.floor(Math.random() * 5) - 2 };
  }
  function randomizePair() {
    startState = randomColor();
    targetState = randomColor();
    let attempts = 0;
    while (isSame(startState, targetState) && attempts < 20) { targetState = randomColor(); attempts++; }
if (isSame(startState, targetState)) {
  targetState = {
    kind: 'normal',
    h: mod(startState.h + HUES.length / 2, HUES.length),
    t: startState.t === 2 ? 1 : startState.t + 1
  };
}
  }
  function resetAttempt() {
    currentState = clone(startState);
    moves = 0; cost = 0; pathDistance = 0; won = false;
    path = [{ state: clone(currentState), action: 'Start' }];
    render();
  }
  function polar(cx, cy, r, degrees) {
    const rad = degrees * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function sectorPath(cx, cy, outer, inner, startAngle, endAngle) {
    const a = polar(cx, cy, outer, startAngle), b = polar(cx, cy, outer, endAngle);
    const c = polar(cx, cy, inner, endAngle), d = polar(cx, cy, inner, startAngle);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${outer} ${outer} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} A ${inner} ${inner} 0 0 0 ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`;
  }
  function wheelPoint(s) {
    if (isTerminal(s)) return { x: 150, y: 150 };
    const radii = { '-2': 130, '-1': 105, '0': 78, '1': 49, '2': 20 };
    const angle = s.h * (360 / HUES.length) - 90;
    return polar(150, 150, radii[String(s.t)], angle);
  }
  function renderWheel() {
    const bands = [
      { t: -2, inner: 118, outer: 140 },
      { t: -1, inner: 92, outer: 117 },
      { t: 0, inner: 65, outer: 91 },
      { t: 1, inner: 34, outer: 64 },
      { t: 2, inner: 0, outer: 33 }
    ];
    let sectors = '';
    bands.forEach(band => {
      HUES.forEach((h, i) => {
        const start = i * (360 / HUES.length) - 90 - (360 / HUES.length) / 2;
        const end = start + 360 / HUES.length;
        const base = colorInfo({ kind: 'normal', h: i, t: band.t }).hex;
        sectors += `<path d="${sectorPath(150,150,band.outer,band.inner,start,end)}" fill="${base}" stroke="#171b25" stroke-width=".8"><title>${h.name} · shade ${band.t}</title></path>`;
      });
    });
    $('wheelSectors').innerHTML = sectors;
    let guides = '';
    [33,64,91,117,140].forEach(r => { guides += `<circle cx="150" cy="150" r="${r}" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width=".6"/>`; });
    for (let i = 0; i < HUES.length; i++) {
      const a = i * (360 / HUES.length) - 90;
      const p1 = polar(150,150,0,a), p2 = polar(150,150,140,a);
      guides += `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="#ffffff" stroke-opacity=".24" stroke-width=".45"/>`;
    }
    $('wheelGuides').innerHTML = guides;
    const cp = wheelPoint(currentState), tp = wheelPoint(targetState);
    let marks = '';
    marks += `<circle cx="${tp.x.toFixed(2)}" cy="${tp.y.toFixed(2)}" r="7" fill="${colorInfo(targetState).hex}" stroke="#d1e0ff" stroke-width="2" stroke-dasharray="2 1"/>`;
    marks += `<circle cx="${cp.x.toFixed(2)}" cy="${cp.y.toFixed(2)}" r="7" fill="${colorInfo(currentState).hex}" stroke="#f2ffb4" stroke-width="2" filter="url(#markerGlow)"/>`;
    if (previewState && !isSame(previewState, currentState)) { const pp = wheelPoint(previewState); marks += `<circle cx="${pp.x.toFixed(2)}" cy="${pp.y.toFixed(2)}" r="9" fill="${colorInfo(previewState).hex}" stroke="#d9fc73" stroke-width="2" stroke-dasharray="3 2" opacity=".95"><title>Move preview: ${escapeHtml(colorInfo(previewState).name)}</title></circle>`; }
    $('wheelMarkers').innerHTML = marks;
  }
  function renderState(prefix, s) {
    const info = colorInfo(s);
    $(prefix + 'Swatch').style.background = info.css;
    $(prefix + 'Swatch').setAttribute('aria-label', info.name + ' color swatch, ' + info.hex);
    $(prefix + 'Name').textContent = info.name;
    $(prefix + 'Caption').textContent = isTerminal(s) ? shadeLabel(s) : toneCaption(s);
    const hex = $(prefix + 'Hex');
    hex.innerHTML = `<span>${info.hex}</span><span>Copy</span>`;
    hex.setAttribute('data-hex', info.hex);
    const indicator = $(prefix + 'ToneIndicator');
    if (indicator) {
      if (isTerminal(s)) {
        indicator.innerHTML = '<span class="tone-dot active" style="background:#ff8585;flex:1"></span>';
      } else {
        indicator.innerHTML = Array.from({length:5}, (_, i) => `<span class="tone-dot ${i === s.t + 2 ? 'active' : ''}"></span>`).join('');
      }
    }
  }
  function renderStats() {
    $('movesValue').textContent = String(moves);
    $('costValue').textContent = cost.toFixed(1);
    $('areaValue').innerHTML = `${pathDistance} <small>d</small>`;
    $('movesBest').innerHTML = `Best: <strong>${mode !== 'sandbox' && bests.moves !== null ? bests.moves : '—'}</strong>`;
    $('costBest').innerHTML = `Best: <strong>${mode !== 'sandbox' && bests.cost !== null ? bests.cost.toFixed(1) : '—'}</strong>`;
    $('areaBest').innerHTML = `Best: <strong>${mode !== 'sandbox' && bests.distance !== null ? bests.distance : '—'}</strong>`;
  }
  function renderMission() {
    const startInfo = colorInfo(startState), targetInfo = colorInfo(targetState);
    $('routeStartName').textContent = startInfo.name;
    $('routeTargetName').textContent = targetInfo.name;
    $('routeStartDot').style.background = startInfo.hex;
    $('routeTargetDot').style.background = targetInfo.hex;
    if (mode === 'sandbox') {
      $('missionTitle').textContent = won ? 'Pair connected.' : 'Mission: connect two colors';
      $('missionDesc').textContent = won ? 'Try another pair, or replay this one to improve your score.' : 'Experiment with the move rules. Watch out for terminal colors.';
    }
  }
  function renderTrail() {
    $('trailCount').textContent = `${moves} ${moves === 1 ? 'action' : 'actions'} taken`;
    const trail = $('trail');
    trail.innerHTML = '';
    if (!path.length) { trail.innerHTML = '<div class="empty-trail">Your color journey will appear here.</div>'; return; }
    path.forEach((step, i) => {
      if (i > 0) {
        const arrow = document.createElement('span'); arrow.className = 'trail-arrow'; arrow.textContent = '→'; trail.appendChild(arrow);
      }
      const info = colorInfo(step.state);
      const item = document.createElement('div'); item.className = 'trail-step';
      item.innerHTML = `<span class="trail-swatch" style="background:${info.hex}"></span><span class="trail-meta"><div class="trail-step-name">${escapeHtml(info.name)}</div><div class="trail-step-action">${i === 0 ? 'START' : escapeHtml(step.action)}</div></span>`;
      item.title = `${info.name} · ${info.hex}`;
      trail.appendChild(item);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function render(improved = false) {
    renderState('current', currentState);
    renderState('target', targetState);
    renderWheel();
    renderStats();
    renderMission();
    renderTrail();
    document.querySelectorAll('[data-action]').forEach(btn => { btn.disabled = won || isTerminal(currentState); });
    $('mixApplyBtn').addEventListener('click', () => applyMove('mix', selectedMixColor, selectedRatio));

  document.querySelectorAll('[data-mix-color]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mixColor === selectedMixColor);
      btn.disabled = won || isTerminal(currentState);
    });
    document.querySelectorAll('[data-ratio]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.ratio === selectedRatio);
      btn.disabled = won || isTerminal(currentState);
    });
    const mixStatus = $('mixStatus');
    if (mixStatus) mixStatus.textContent = `Selected: ${selectedMixColor[0].toUpperCase()+selectedMixColor.slice(1)} · ratio ${selectedRatio} (current : primary)`;
    $('trapNote').textContent = 'Terminal color reached. White and black have no outgoing moves. Reset to try another route.';
    $('trapNote').classList.toggle('show', isTerminal(currentState) && !won);
    $('winBanner').classList.toggle('show', won);
    if (won) {
const bestMessage = mode === 'sandbox'
  ? 'Sandbox runs are unranked. Generate a new pair to continue.'
  : improved
    ? 'New personal best recorded for at least one statistic.'
    : 'Your personal bests are shown above; replay to improve any one of them.';
      $('winDesc').textContent = `${moves} moves · cost ${cost.toFixed(1)} · path distance ${pathDistance}d. ${bestMessage}`;
      $('replayBtn').textContent = mode === 'level' ? 'Replay level' : 'Replay pair';
      $('continueBtn').textContent = mode === 'level' ? 'Try to master it ↗' : 'New color pair ↗';
    }
    $('resetBtn').disabled = false;
  }
  async function copyHex(which) {
    const hex = $(which + 'Hex').dataset.hex;
    const button = $(which + 'Hex');
    try {
      await navigator.clipboard.writeText(hex);
      button.innerHTML = `<span>${hex}</span><span>Copied</span>`;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { if (button.isConnected) button.innerHTML = `<span>${hex}</span><span>Copy</span>`; }, 1100);
    } catch (_) {
      button.innerHTML = `<span>${hex}</span><span>Copy blocked</span>`;
    }
  }

  document.querySelectorAll('.mode-tab').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  document.querySelectorAll('[data-action]').forEach(btn => {
    if (btn.id !== 'mixApplyBtn') btn.addEventListener('click', () => applyMove(btn.dataset.action));
    btn.addEventListener('mouseenter', () => { previewState = computeMove(btn.dataset.action); renderWheel(); });
    btn.addEventListener('focus', () => { previewState = computeMove(btn.dataset.action); renderWheel(); });
    btn.addEventListener('mouseleave', () => { previewState = null; renderWheel(); });
    btn.addEventListener('blur', () => { previewState = null; renderWheel(); });
  });
  document.querySelectorAll('[data-mix-color]').forEach(btn => {
    btn.addEventListener('click', () => { selectedMixColor = btn.dataset.mixColor; previewState = computeMove('mix'); render(); });
    btn.addEventListener('mouseenter', () => { previewState = computeMove('mix', btn.dataset.mixColor, selectedRatio); renderWheel(); });
    btn.addEventListener('mouseleave', () => { previewState = null; renderWheel(); });
    btn.addEventListener('focus', () => { previewState = computeMove('mix', btn.dataset.mixColor, selectedRatio); renderWheel(); });
    btn.addEventListener('blur', () => { previewState = null; renderWheel(); });
  });
  document.querySelectorAll('[data-ratio]').forEach(btn => {
    btn.addEventListener('click', () => { selectedRatio = btn.dataset.ratio; previewState = computeMove('mix'); render(); });
    btn.addEventListener('mouseenter', () => { previewState = computeMove('mix', selectedMixColor, btn.dataset.ratio); renderWheel(); });
    btn.addEventListener('mouseleave', () => { previewState = null; renderWheel(); });
    btn.addEventListener('focus', () => { previewState = computeMove('mix', selectedMixColor, btn.dataset.ratio); renderWheel(); });
    btn.addEventListener('blur', () => { previewState = null; renderWheel(); });
  });
$('resetBtn').addEventListener('click', () => {
  if (mode === 'hard') {
    openHardStartPicker();
  } else {
    resetAttempt();
  }
});

$('replayBtn').addEventListener('click', () => {
  if (mode === 'hard') {
    openHardStartPicker();
  } else {
    resetAttempt();
  }
});

$('continueBtn').addEventListener('click', () => {
  if (mode === 'sandbox') {
    randomizePair();
    resetAttempt();
  } else if (mode === 'hard') {
    openHardStartPicker();
  } else {
    resetAttempt();
  }
});

$('cancelStartPicker').addEventListener('click', () => {
  $('startPicker').classList.add('hidden');
  setMode('level');
});
  $('currentHex').addEventListener('click', () => copyHex('current'));
  $('targetHex').addEventListener('click', () => copyHex('target'));
function openHardStartPicker() {
  const container = $('startChoices');
  container.innerHTML = '';

  HARD_START_OPTIONS.forEach(option => {
    const info = colorInfo(option.state);
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'start-choice';

    button.innerHTML = `
      <span class="start-choice-swatch"
            style="background:${info.hex}"></span>
      <span class="start-choice-copy">
        <strong>${escapeHtml(option.label)}</strong>
        <small>${escapeHtml(info.name)} · ${info.hex}</small>
        <small>${escapeHtml(option.description)}</small>
      </span>
    `;

    button.addEventListener('click', () => {
      chooseHardStart(option.id);
    });

    container.appendChild(button);
  });

  $('startPicker').classList.remove('hidden');
}

function chooseHardStart(id) {
  const option = HARD_START_OPTIONS.find(item => item.id === id);
  if (!option) return;

  startState = clone(option.state);
  targetState = clone(HARD_TARGET);

  $('startPicker').classList.add('hidden');

  // Restart the attempt, not the saved records.
  resetAttempt();
}
  render();
})();