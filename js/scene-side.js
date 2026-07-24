/* ============================================================
   scene-side.js — side-view renderer (cutaway dollhouse room)
   Flat side-on stage with parallax bands. Same view model as
   scene-iso.js: room-space x is left/right (west→east), room-space
   y is depth (near/far), drawn as slight scale + vertical offset.
   ============================================================ */

const SceneSide = (() => {

  const VW = 1200, VH = 675;
  const FLOOR = 540;            // main floor line
  const WALL_TOP = 128;
  const L = 150, R = 1050;      // back-wall span
  const JAMB = 70;              // side-wall depth

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const DIR_TAG = { north: 'N', south: 'S', east: 'E', west: 'W', up: 'UP', down: 'DN' };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    return `#${(((c(n >> 16)) << 16) | ((c((n >> 8) & 255)) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
  }

  function hotspotExit(exit, inner) {
    return `<g class="exit-door hotspot" data-exit="${exit.dir}" data-label="${esc(exit.label)}" tabindex="0" role="button" aria-label="${esc(exit.label)}">${inner}</g>`;
  }

  function stage(shell) {
    const kind = shell?.kind || 'room';
    if (kind === 'outdoor' || kind === 'hedge') {
      const ground = shell?.floor || (kind === 'hedge' ? '#2a2e1d' : '#28301e');
      const hedge = kind === 'hedge' ? (shell?.wall || '#26331f') : null;
      return `
        <rect x="-800" y="-400" width="2800" height="1475" fill="url(#sky-grad-side)"/>
        ${[[150, 70], [420, 40], [760, 80], [1050, 50], [280, 150], [900, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#e8ddc8" opacity="0.5"/>`).join('')}
        <circle cx="980" cy="86" r="36" fill="#e8ddc8" opacity="0.8"/><circle cx="966" cy="78" r="34" fill="#0f1520" opacity="0.92"/>
        ${hedge ? `<rect x="-800" y="${WALL_TOP + 90}" width="2800" height="${FLOOR - WALL_TOP - 90}" fill="${shade(hedge, -6)}"/>
          ${[120, 300, 520, 740, 950, 1120].map(x => `<circle cx="${x}" cy="${WALL_TOP + 120 + (x % 3) * 40}" r="13" fill="${shade(hedge, 12)}" opacity="0.5"/>`).join('')}` : ''}
        <rect x="-800" y="${FLOOR}" width="2800" height="835" fill="${ground}"/>
        <rect x="-800" y="${FLOOR}" width="2800" height="10" fill="${shade(ground, 14)}"/>`;
    }
    const wallC = shell?.wall || '#4a3b2a';
    const backC = shell?.back || '#544433';
    const floorC = shell?.floor || '#33261a';
    const ceilC = shell?.ceil || '#241c13';
    return `
      <rect x="-800" y="-400" width="2800" height="1475" fill="#0e0b09"/>
      <rect x="${L - JAMB}" y="${WALL_TOP - 34}" width="${R - L + JAMB * 2}" height="34" fill="${ceilC}"/>
      <rect x="${L}" y="${WALL_TOP}" width="${R - L}" height="${FLOOR - WALL_TOP}" fill="${backC}"/>
      <polygon points="${L - JAMB},${WALL_TOP - 34} ${L},${WALL_TOP} ${L},${FLOOR} ${L - JAMB},${FLOOR + 34}" fill="${wallC}"/>
      <polygon points="${R + JAMB},${WALL_TOP - 34} ${R},${WALL_TOP} ${R},${FLOOR} ${R + JAMB},${FLOOR + 34}" fill="${shade(wallC, -18)}"/>
      <rect x="${L - JAMB}" y="${FLOOR}" width="${R - L + JAMB * 2}" height="${VH - FLOOR + 60}" fill="${floorC}"/>
      <line x1="${L}" y1="${FLOOR}" x2="${R}" y2="${FLOOR}" stroke="#000" stroke-opacity="0.25"/>
      <line x1="${L}" y1="${WALL_TOP + (FLOOR - WALL_TOP) * 0.7}" x2="${R}" y2="${WALL_TOP + (FLOOR - WALL_TOP) * 0.7}" stroke="${shade(backC, 10)}" stroke-opacity="0.5" stroke-width="3"/>`;
  }

  function door(exit, shell) {
    const kind = shell?.kind || 'room';
    const tag = t => `<text x="0" y="0" text-anchor="middle" font-size="19" font-family="serif" fill="#d8b36a" opacity="0.9">${t}</text>`;
    let art = '';
    const w = 96, h = 190;
    if (exit.dir === 'north' || exit.dir === 'up' || exit.dir === 'down') {
      const x = L + (R - L) * (0.5 + (exit.spread || 0)) - w / 2;
      if (exit.dir === 'north') {
        art = `<rect x="${x - 7}" y="${FLOOR - h - 7}" width="${w + 14}" height="${h + 7}" fill="#1c150e"/>
          <rect x="${x}" y="${FLOOR - h}" width="${w}" height="${h}" fill="#0d0a07" class="hs-body"/>
          <circle cx="${x + w - 15}" cy="${FLOOR - h / 2}" r="4.5" fill="#d8b36a"/>
          <g transform="translate(${x + w / 2},${FLOOR - h - 18})">${tag('N')}</g>`;
      } else {
        const up = exit.dir === 'up';
        let steps = '';
        for (let i = 0; i < 5; i++) steps += `<rect x="${x - 14 + i * 6}" y="${FLOOR - 18 - i * (up ? 20 : -10)}" width="${w + 28 - i * 12}" height="18" fill="${i % 2 ? '#4a3b2a' : '#5a4a35'}"/>`;
        art = `<g class="hs-body">${steps}</g><g transform="translate(${x + w / 2},${FLOOR - (up ? 130 : -64)})">${tag(DIR_TAG[exit.dir])}</g>`;
      }
    } else if (exit.dir === 'west' || exit.dir === 'east') {
      const west = exit.dir === 'west';
      const xN = west ? L : R, xF = west ? L - JAMB : R + JAMB;
      art = `<polygon points="${xN},${FLOOR - h} ${xF},${FLOOR - h - 30} ${xF},${FLOOR + 30} ${xN},${FLOOR}" fill="#0d0a07" class="hs-body" stroke="#1c150e" stroke-width="5"/>
        <g transform="translate(${(xN + xF) / 2},${FLOOR - h - 34})">${tag(west ? 'W' : 'E')}</g>`;
    } else { // south: toward the camera
      art = `<ellipse cx="600" cy="${VH - 26}" rx="120" ry="26" fill="#0d0a07" class="hs-body" stroke="#d8b36a" stroke-opacity="0.4" stroke-width="2"/>
        <g transform="translate(600,${VH - 58})">${tag('S')}</g>`;
    }
    return hotspotExit(exit, art);
  }

  function billboard(type, x, y, scale, hotspot, extraClass = '') {
    const draw = Scene.PROPS[type];
    if (!draw) return null;
    const sx = 600 + x * ((R - L) / 2 - 60);
    const depth = (1 - y) / 2;                       // 0 far … 1 near
    const sy = FLOOR - 26 + depth * 30;
    const s = (scale ?? 1) * (0.62 + depth * 0.12);
    const inner = `<g transform="translate(${sx},${sy}) scale(${s})" class="${extraClass}">${draw({})}</g>`;
    const g = hotspot
      ? `<g class="hotspot" data-id="${esc(hotspot.id)}" data-label="${esc(hotspot.label)}" tabindex="0" role="button" aria-label="${esc(hotspot.label)}">${inner}</g>`
      : inner;
    return { sy, svg: g };
  }

  function wallHang(p) {
    // back (north) wall hangings drawn flat on the wall; other walls become floor-standing
    if (p.wall === 'north') {
      const sx = 600 + (p.along ?? 0) * ((R - L) / 2 - 80);
      return { sy: -1, svg: wrapHot(p, `<g transform="translate(${sx},${FLOOR - 10}) scale(${(p.scale ?? 1) * 0.72})">${Scene.PROPS[p.type] ? Scene.PROPS[p.type]({}) : ''}</g>`) };
    }
    const x = p.wall === 'west' ? -0.82 : p.wall === 'east' ? 0.82 : (p.along ?? 0);
    const y = p.wall === 'south' ? -0.9 : (p.along ?? 0);
    return billboard(p.type, x, y, (p.scale ?? 1) * 0.72, p.hotspot);
  }

  function wrapHot(p, inner) {
    if (!p.hotspot) return inner;
    return `<g class="hotspot" data-id="${esc(p.hotspot.id)}" data-label="${esc(p.hotspot.label)}" tabindex="0" role="button" aria-label="${esc(p.hotspot.label)}">${inner}</g>`;
  }

  const FACE_X = { west: -1, east: 1 };

  function render(svgEl, view) {
    const { room, facing, exits, floorProps, wallProps } = view;
    const shell = room.shell || {};
    const defs = `<defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ffb648" flood-opacity="0.9"/>
      </filter>
      <radialGradient id="sky-grad-side" cx="50%" cy="10%" r="100%">
        <stop offset="0%" stop-color="#1c2637"/><stop offset="100%" stop-color="#0b0e14"/>
      </radialGradient>
      <radialGradient id="side-light" cx="50%" cy="52%" r="68%">
        <stop offset="0%" stop-color="#ffb648" stop-opacity="0.12"/>
        <stop offset="55%" stop-color="#ffb648" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>`;

    let doors = '';
    for (const ex of exits) doors += door(ex, shell);

    const items = [];
    for (const p of wallProps) items.push(wallHang(p));
    for (const p of floorProps) items.push(billboard(p.type, p.x, p.y, p.scale ?? 1, p.hotspot));

    // player near the left, flipped to face travel direction
    const flip = FACE_X[facing] === -1 ? -1 : 1;
    items.push({ sy: FLOOR + 40, svg: `<g transform="translate(340,${FLOOR + 4}) scale(${flip * 0.95},0.95)" class="player-side">${Scene.PROPS.player({})}</g>` });

    const sorted = items.filter(Boolean).sort((a, b) => a.sy - b.sy).map(i => i.svg).join('');

    svgEl.innerHTML = `${defs}${stage(shell)}${doors}${sorted}
      <rect x="-800" y="-400" width="2800" height="1475" fill="url(#side-light)" pointer-events="none" class="light-veil"/>`;
  }

  return { render };
})();
