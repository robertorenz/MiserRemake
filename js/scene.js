/* ============================================================
   scene.js — 2.5D one-point-perspective room renderer (SVG)
   Rooms are declarative (see data.js); this file projects them.
   ============================================================ */

const Scene = (() => {

  const VW = 1200, VH = 675;               // viewbox
  const BW = { x1: 340, y1: 140, x2: 860, y2: 440 };  // back wall rect
  const BACK_SCALE = (BW.x2 - BW.x1) / VW; // prop scale at the back wall

  const lerp = (a, b, k) => a + (b - a) * k;

  // Room cross-section at depth t (0 = viewer, 1 = back wall)
  const L = t => lerp(0, BW.x1, t);
  const R = t => lerp(VW, BW.x2, t);
  const T = t => lerp(0, BW.y1, t);
  const B = t => lerp(VH, BW.y2, t);
  const S = t => lerp(1, BACK_SCALE, t);   // perspective scale for floor props

  function floorPoint(u, t) {
    const margin = 30 * S(t);
    return { x: lerp(L(t) + margin, R(t) - margin, (u + 1) / 2), y: B(t) };
  }

  function wallPoint(u, v) {
    return { x: lerp(BW.x1, BW.x2, (u + 1) / 2), y: lerp(BW.y1, BW.y2, v) };
  }

  /* ---------- facing: map compass exits onto walls ---------- */

  const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };

  // Which wall does `dir` land on when the viewer faces `facing`?
  function dirWall(dir, facing = 'north') {
    if (dir === 'up' || dir === 'down') return 'back';
    if (dir === facing) return 'back';
    if (dir === OPPOSITE[facing]) return 'behind';
    const rightOf = { north: 'east', east: 'south', south: 'west', west: 'north' };
    return rightOf[facing] === dir ? 'right' : 'left';
  }

  /* ---------- shells ---------- */

  // Perspective lines extended past the 1200x675 viewBox so wide screens
  // (preserveAspectRatio "meet" letterboxing) still show room, not void.
  // Extension factor s=3.353 puts the near plane at x = -800 / 2000.
  const EXT = { xL: -800, xR: VW + 800, yTop: -329, yBot: 1228, yTopHedge: -299 };

  function shellRoom(p) {
    const wall = p.wall || '#4a3b2a', back = p.back || '#544433';
    const floor = p.floor || '#33261a', ceil = p.ceil || '#241c13';
    const dark = shade(wall, -18), light = shade(back, 10);
    const E = EXT;
    return `
      <polygon points="${E.xL},${E.yTop} ${E.xR},${E.yTop} ${BW.x2},${BW.y1} ${BW.x1},${BW.y1}" fill="${ceil}"/>
      <polygon points="${E.xL},${E.yBot} ${E.xR},${E.yBot} ${BW.x2},${BW.y2} ${BW.x1},${BW.y2}" fill="${floor}"/>
      <polygon points="${E.xL},${E.yTop} ${BW.x1},${BW.y1} ${BW.x1},${BW.y2} ${E.xL},${E.yBot}" fill="${wall}"/>
      <polygon points="${E.xR},${E.yTop} ${BW.x2},${BW.y1} ${BW.x2},${BW.y2} ${E.xR},${E.yBot}" fill="${dark}"/>
      <rect x="${BW.x1}" y="${BW.y1}" width="${BW.x2 - BW.x1}" height="${BW.y2 - BW.y1}" fill="${back}"/>
      ${floorLines(floor)}
      <line x1="${BW.x1}" y1="${lerp(BW.y1, BW.y2, 0.68)}" x2="${BW.x2}" y2="${lerp(BW.y1, BW.y2, 0.68)}" stroke="${light}" stroke-opacity="0.5" stroke-width="3"/>
    `;
  }

  function shellOutdoor(p) {
    const ground = p.floor || '#232a1c';
    const horizon = BW.y2;
    const E = EXT;
    return `
      <rect x="${E.xL}" y="-400" width="${E.xR - E.xL}" height="${horizon + 400}" fill="url(#sky-grad)"/>
      <circle cx="960" cy="110" r="42" fill="#e8ddc8" opacity="0.8"/>
      <circle cx="944" cy="100" r="40" fill="#0f1520" opacity="0.92"/>
      ${stars()}
      ${p.silhouette ? mansionSilhouette() : ''}
      <rect x="${E.xL}" y="${horizon}" width="${E.xR - E.xL}" height="${E.yBot - horizon}" fill="${ground}"/>
      <polygon points="${E.xL},${E.yBot} ${E.xR},${E.yBot} ${BW.x2},${BW.y2} ${BW.x1},${BW.y2}" fill="${shade(ground, 8)}"/>
    `;
  }

  function shellHedge(p) {
    const hedge = p.wall || '#26331f', hedgeD = shade(hedge, -12);
    const ground = p.floor || '#2a2e1d';
    const E = EXT;
    return `
      <rect x="${E.xL}" y="-400" width="${E.xR - E.xL}" height="${BW.y2 + 400}" fill="url(#sky-grad)"/>
      ${stars()}
      <polygon points="${E.xL},${E.yBot} ${E.xR},${E.yBot} ${BW.x2},${BW.y2} ${BW.x1},${BW.y2}" fill="${ground}"/>
      <rect x="${E.xL}" y="${VH - 60}" width="${E.xR - E.xL}" height="${E.yBot - VH + 60}" fill="${shade(ground, -8)}"/>
      <polygon points="${E.xL},${E.yTopHedge} ${BW.x1},${BW.y1 + 30} ${BW.x1},${BW.y2} ${E.xL},${E.yBot}" fill="${hedge}"/>
      <polygon points="${E.xR},${E.yTopHedge} ${BW.x2},${BW.y1 + 30} ${BW.x2},${BW.y2} ${E.xR},${E.yBot}" fill="${hedgeD}"/>
      <rect x="${BW.x1}" y="${BW.y1 + 30}" width="${BW.x2 - BW.x1}" height="${BW.y2 - BW.y1 - 30}" fill="${shade(hedge, -5)}"/>
      ${leafTexture(hedge)}
    `;
  }

  function leafTexture(hedge) {
    let s = '';
    const spots = [[80, 200], [180, 380], [90, 520], [1120, 210], [1040, 400], [1110, 540], [450, 300], [700, 320], [560, 260], [620, 380]];
    for (const [x, y] of spots) {
      s += `<circle cx="${x}" cy="${y}" r="14" fill="${shade(hedge, 14)}" opacity="0.5"/>`;
    }
    return s;
  }

  function mansionSilhouette() {
    return `<g fill="#171310">
      <rect x="300" y="230" width="600" height="212"/>
      <polygon points="280,232 600,120 920,232"/>
      <rect x="560" y="150" width="80" height="60"/>
      <rect x="380" y="280" width="50" height="70" fill="#0d0a07"/>
      <rect x="770" y="280" width="50" height="70" fill="#0d0a07"/>
    </g>`;
  }

  function floorLines(floor) {
    let s = '';
    for (let i = 1; i < 7; i++) {
      const u = -1 + (2 * i) / 7;
      const a = floorPoint(u, 0), b = floorPoint(u, 1);
      s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#000" stroke-opacity="0.14"/>`;
    }
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      s += `<line x1="${L(t)}" y1="${B(t)}" x2="${R(t)}" y2="${B(t)}" stroke="#000" stroke-opacity="0.10"/>`;
    }
    return s;
  }

  function stars() {
    const pts = [[120, 60], [220, 140], [420, 50], [520, 100], [700, 70], [1080, 180], [880, 40], [1140, 90], [60, 200]];
    return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#e8ddc8" opacity="0.5"/>`).join('');
  }

  /* ---------- exits ---------- */

  function exitBack(exit, u, style) {
    const w = 130;
    const c = wallPoint(u, 1);
    const top = lerp(BW.y2, BW.y1, 0.94);
    const x = c.x - w / 2, h = BW.y2 - top;
    let art = '';
    switch (style) {
      case 'arch':
        art = `<path d="M ${x} ${BW.y2} L ${x} ${top + 40} Q ${c.x} ${top - 26} ${x + w} ${top + 40} L ${x + w} ${BW.y2} Z" fill="#0a0d08" class="hs-body"/>`;
        break;
      case 'portal':
        art = `
          <rect x="${x - 10}" y="${top - 10}" width="${w + 20}" height="${h + 10}" fill="#3b3b40"/>
          <path d="M ${x} ${BW.y2} L ${x} ${top + 30} Q ${c.x} ${top - 20} ${x + w} ${top + 30} L ${x + w} ${BW.y2} Z" fill="#0d0a07" class="hs-body"/>
          <path d="M ${x + 12} ${BW.y2} L ${x + 12} ${top + 36} Q ${c.x} ${top - 4} ${x + w - 12} ${top + 36} L ${x + w - 12} ${BW.y2}" fill="none" stroke="#ffb648" stroke-opacity="0.55" stroke-width="4"/>`;
        break;
      case 'stairs-up': {
        let steps = '';
        for (let i = 0; i < 6; i++) steps += `<rect x="${x - 20 + i * 8}" y="${BW.y2 - 24 - i * 24}" width="${w + 40 - i * 16}" height="24" fill="${i % 2 ? '#4a3b2a' : '#5a4a35'}"/>`;
        art = `<g class="hs-body">${steps}<rect x="${x - 20}" y="${BW.y2 - 168}" width="${w + 40}" height="24" fill="#0d0a07"/></g>`;
        break;
      }
      case 'stairs-down': {
        let steps = '';
        for (let i = 0; i < 5; i++) steps += `<rect x="${x - 10 + i * 6}" y="${BW.y2 - 60 + i * 12}" width="${w + 20 - i * 12}" height="12" fill="${shade('#33261a', -i * 6)}"/>`;
        art = `<g class="hs-body"><rect x="${x - 10}" y="${BW.y2 - 62}" width="${w + 20}" height="62" fill="#0d0a07"/>${steps}</g>`;
        break;
      }
      case 'ladder': {
        art = `<g class="hs-body">
          <line x1="${c.x - 24}" y1="${BW.y1 + 10}" x2="${c.x - 24}" y2="${BW.y2}" stroke="#6a5b3f" stroke-width="8"/>
          <line x1="${c.x + 24}" y1="${BW.y1 + 10}" x2="${c.x + 24}" y2="${BW.y2}" stroke="#6a5b3f" stroke-width="8"/>
          ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${c.x - 24}" y1="${BW.y1 + 40 + i * 44}" x2="${c.x + 24}" y2="${BW.y1 + 40 + i * 44}" stroke="#6a5b3f" stroke-width="6"/>`).join('')}
        </g>`;
        break;
      }
      default: // wooden door
        art = `
          <rect x="${x - 8}" y="${top - 8}" width="${w + 16}" height="${h + 8}" fill="#1c150e"/>
          <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="#0d0a07" class="hs-body"/>
          <rect x="${x + 14}" y="${top + 16}" width="${w - 28}" height="${h * 0.36}" fill="none" stroke="#2e2418" stroke-width="3"/>
          <rect x="${x + 14}" y="${top + 24 + h * 0.36}" width="${w - 28}" height="${h * 0.4}" fill="none" stroke="#2e2418" stroke-width="3"/>
          <circle cx="${x + w - 18}" cy="${(top + BW.y2) / 2}" r="5" fill="#d8b36a"/>`;
    }
    return hotspotWrap(exit, art);
  }

  function exitSide(exit, side, style, t1 = 0.42, t2 = 0.66) {
    const xx = side === 'left' ? L : R;
    const hTop = t => lerp(B(t), T(t), 0.8);
    const pts = [
      [xx(t1), hTop(t1)], [xx(t2), hTop(t2)],
      [xx(t2), B(t2)], [xx(t1), B(t1)]
    ].map(p => p.join(',')).join(' ');
    const midT = (t1 + t2) / 2;
    const knobX = side === 'left' ? xx(t2) - 10 : xx(t2) + 10;
    const isGap = style === 'arch';
    return hotspotWrap(exit, `
      <polygon points="${pts}" fill="${isGap ? '#0a0d08' : '#0d0a07'}" stroke="${isGap ? 'none' : '#1c150e'}" stroke-width="6" class="hs-body"/>
      ${isGap ? '' : `<circle cx="${knobX}" cy="${lerp(B(midT), hTop(midT), 0.45)}" r="4.5" fill="#d8b36a"/>`}
    `);
  }

  function hotspotWrap(exit, inner) {
    return `<g class="exit-door hotspot" data-exit="${exit.dir}" data-label="${esc(exit.label)}" tabindex="0" role="button" aria-label="${esc(exit.label)}">${inner}</g>`;
  }

  /* ---------- prop library ---------- */
  /* Each prop draws with origin at bottom-center, ~1px = 1px at t=0. */

  const PROPS = {
    painting: () => `
      <rect x="-70" y="-190" width="140" height="110" fill="#2e2418" stroke="#d8b36a" stroke-width="5" class="hs-body"/>
      <rect x="-58" y="-178" width="116" height="86" fill="#1d2a33"/>
      <path d="M -50 -110 L -20 -150 L 5 -120 L 30 -158 L 50 -110 Z" fill="#3d4f42"/>
      <circle cx="30" cy="-165" r="9" fill="#d8b36a" opacity="0.8"/>`,
    paintingLeaning: () => `
      <g class="hs-body" transform="rotate(-4)">
      <rect x="-58" y="-150" width="116" height="92" fill="#2e2418" stroke="#d8b36a" stroke-width="5"/>
      <rect x="-48" y="-140" width="96" height="72" fill="#24303a"/>
      <path d="M -40 -80 L -14 -116 L 4 -92 L 24 -122 L 40 -80 Z" fill="#44584a"/>
      </g>`,
    window: () => `
      <rect x="-60" y="-230" width="120" height="170" fill="#101722" stroke="#2e2418" stroke-width="8" class="hs-body"/>
      <line x1="0" y1="-230" x2="0" y2="-60" stroke="#2e2418" stroke-width="6"/>
      <line x1="-60" y1="-145" x2="60" y2="-145" stroke="#2e2418" stroke-width="6"/>
      <circle cx="28" cy="-196" r="12" fill="#e8ddc8" opacity="0.7"/>`,
    table: () => `
      <g class="hs-body">
      <rect x="-95" y="-105" width="190" height="14" rx="3" fill="#5a4327"/>
      <rect x="-85" y="-91" width="12" height="91" fill="#4a3720"/>
      <rect x="73" y="-91" width="12" height="91" fill="#4a3720"/>
      </g>`,
    sofa: () => `
      <g class="hs-body">
      <rect x="-110" y="-95" width="220" height="70" rx="12" fill="#5d3a2e"/>
      <rect x="-110" y="-140" width="220" height="55" rx="12" fill="#6b463a"/>
      <rect x="-124" y="-110" width="26" height="86" rx="10" fill="#6b463a"/>
      <rect x="98" y="-110" width="26" height="86" rx="10" fill="#6b463a"/>
      </g>`,
    bookshelf: () => `
      <g class="hs-body">
      <rect x="-80" y="-260" width="160" height="260" fill="#3a2c1c"/>
      ${[-225, -168, -111, -54].map(y =>
        `<rect x="-70" y="${y}" width="140" height="8" fill="#241c13"/>` +
        `<rect x="-62" y="${y - 40}" width="124" height="40" fill="#2a211a"/>`
      ).join('')}
      </g>`,
    rug: () => `
      <g class="hs-body">
      <ellipse cx="0" cy="-4" rx="150" ry="34" fill="#6e2f26"/>
      <ellipse cx="0" cy="-4" rx="112" ry="24" fill="none" stroke="#d8b36a" stroke-opacity="0.5" stroke-width="3"/>
      </g>`,
    mat: () => `
      <g class="hs-body">
      <rect x="-70" y="-16" width="140" height="20" rx="4" fill="#6a5b3f"/>
      <text x="0" y="-1" text-anchor="middle" font-size="13" fill="#241c13" font-family="serif">WELCOME</text>
      </g>`,
    plant: () => `
      <g class="hs-body">
      <path d="M -22 0 L 22 0 L 15 -40 L -15 -40 Z" fill="#7a4a2a"/>
      <path d="M 0 -40 C -35 -80 -45 -110 -10 -135 C 0 -100 0 -80 0 -40" fill="#3d4f2e"/>
      <path d="M 0 -40 C 35 -80 45 -115 10 -140 C 0 -100 0 -80 0 -40" fill="#4a5f38"/>
      </g>`,
    candle: () => `
      <g class="hs-body">
      <rect x="-6" y="-150" width="12" height="150" fill="#2e2418"/>
      <path d="M -26 -150 L 26 -150 L 14 -164 L -14 -164 Z" fill="#3a2c1c"/>
      <rect x="-5" y="-196" width="10" height="32" fill="#e8ddc8"/>
      <ellipse cx="0" cy="-204" rx="6" ry="11" fill="#ffb648" class="flame"/>
      </g>`,
    fireplace: () => `
      <g class="hs-body">
      <rect x="-110" y="-170" width="220" height="170" fill="#3a2c1c"/>
      <rect x="-80" y="-130" width="160" height="130" fill="#0d0a07"/>
      <rect x="-124" y="-184" width="248" height="18" fill="#4a3b2a"/>
      <path d="M -40 0 Q -30 -50 0 -60 Q 30 -46 40 0 Z" fill="#241c13"/>
      </g>`,
    armor: () => `
      <g class="hs-body">
      <rect x="-34" y="-16" width="68" height="16" fill="#2e2418"/>
      <path d="M -22 -16 L -26 -120 L 26 -120 L 22 -16 Z" fill="#7d8289"/>
      <rect x="-30" y="-150" width="60" height="34" rx="8" fill="#6a6f76"/>
      <path d="M -18 -150 A 18 20 0 0 1 18 -150 L 18 -178 A 18 16 0 0 0 -18 -178 Z" fill="#8a8f96"/>
      <rect x="-20" y="-166" width="40" height="8" fill="#131010"/>
      <path d="M -14 -168 L -8 -158 M 14 -168 L 8 -158" stroke="#2e2418" stroke-width="3"/>
      <line x1="44" y1="0" x2="44" y2="-190" stroke="#5a5f66" stroke-width="7"/>
      <path d="M 44 -190 L 36 -214 L 52 -214 Z" fill="#8a8f96"/>
      </g>`,
    snake: () => `
      <g class="hs-body">
      <path d="M -70 -6 Q -40 -34 -6 -14 Q 30 6 56 -20 Q 70 -34 62 -50" fill="none" stroke="#5f7a3c" stroke-width="17" stroke-linecap="round"/>
      <circle cx="62" cy="-56" r="13" fill="#6f8a48"/>
      <circle cx="66" cy="-60" r="2.6" fill="#131010"/>
      <path d="M 74 -56 q 12 2 16 -3" stroke="#b5533c" stroke-width="3" fill="none"/>
      </g>`,
    fireWall: () => `
      <g class="hs-body">
      ${[-100, -55, -10, 35, 80].map((x, i) => `
        <path d="M ${x} 0 Q ${x - 16} ${-60 - (i % 3) * 26} ${x + 10} ${-95 - (i % 2) * 40} Q ${x + 30} ${-52 - (i % 3) * 20} ${x + 44} 0 Z" fill="${i % 2 ? '#b5533c' : '#d8722f'}"/>
        <path d="M ${x + 10} 0 Q ${x + 4} ${-40 - (i % 2) * 18} ${x + 18} ${-58 - (i % 3) * 14} Q ${x + 30} ${-34} ${x + 34} 0 Z" fill="#ffb648"/>`).join('')}
      </g>`,
    bed: () => `
      <g class="hs-body">
      <rect x="-120" y="-80" width="240" height="56" rx="8" fill="#5d4630"/>
      <rect x="-112" y="-104" width="224" height="34" rx="10" fill="#7a6a50"/>
      <rect x="-58" y="-112" width="52" height="22" rx="8" fill="#e8ddc8" opacity="0.85"/>
      ${[-126, 120].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="-230" stroke="#3a2c1c" stroke-width="9"/><circle cx="${x}" cy="-234" r="7" fill="#d8b36a"/>`).join('')}
      <rect x="-132" y="-252" width="264" height="10" fill="#3a2c1c"/>
      </g>`,
    cabinet: () => `
      <g class="hs-body">
      <rect x="-75" y="-180" width="150" height="176" fill="#4a3720"/>
      <rect x="-63" y="-168" width="60" height="150" fill="#3a2c1c" stroke="#241c13" stroke-width="3"/>
      <rect x="3" y="-168" width="60" height="150" fill="#3a2c1c" stroke="#241c13" stroke-width="3"/>
      <circle cx="-12" cy="-96" r="4" fill="#d8b36a"/><circle cx="12" cy="-96" r="4" fill="#d8b36a"/>
      <circle cx="-56" cy="-2" r="7" fill="#241c13"/><circle cx="56" cy="-2" r="7" fill="#241c13"/>
      </g>`,
    vaultDoor: () => `
      <g class="hs-body">
      <rect x="-95" y="-210" width="190" height="210" rx="8" fill="#4b4f55"/>
      <rect x="-79" y="-194" width="158" height="178" rx="6" fill="#5c6167"/>
      <circle cx="0" cy="-105" r="34" fill="#3b3f44"/>
      <circle cx="0" cy="-105" r="26" fill="none" stroke="#d8b36a" stroke-width="5"/>
      ${[0, 60, 120, 180, 240, 300].map(a => `<line x1="0" y1="-105" x2="${Math.cos(a * Math.PI / 180) * 24}" y2="${-105 + Math.sin(a * Math.PI / 180) * 24}" stroke="#d8b36a" stroke-width="4"/>`).join('')}
      </g>`,
    organ: () => `
      <g class="hs-body">
      ${[-70, -46, -22, 2, 26, 50].map((x, i) =>
        `<rect x="${x}" y="${-330 + Math.abs(i - 2.5) * 24}" width="20" height="${210 - Math.abs(i - 2.5) * 24}" rx="8" fill="#3a2c1c"/>`).join('')}
      <rect x="-100" y="-120" width="200" height="120" fill="#4a3720"/>
      <rect x="-88" y="-112" width="176" height="26" fill="#e8ddc8"/>
      ${[-72, -48, -24, 0, 24, 48].map(x => `<rect x="${x}" y="-112" width="10" height="16" fill="#131010"/>`).join('')}
      </g>`,
    sign: () => `
      <g class="hs-body">
      <line x1="0" y1="0" x2="0" y2="-110" stroke="#4a3720" stroke-width="9"/>
      <rect x="-78" y="-158" width="156" height="52" rx="5" fill="#5a4327" stroke="#3a2c1c" stroke-width="4"/>
      <text x="0" y="-126" text-anchor="middle" font-size="17" fill="#e8ddc8" font-family="serif">DROP COINS</text>
      </g>`,
    tablet: () => `
      <g class="hs-body">
      <path d="M -60 0 L -60 -140 Q 0 -180 60 -140 L 60 0 Z" fill="#6a6f76"/>
      <path d="M -60 0 L -60 -140 Q 0 -180 60 -140 L 60 0 Z" fill="none" stroke="#4b4f55" stroke-width="5"/>
      <text x="0" y="-104" text-anchor="middle" font-size="15" fill="#241c13" font-family="serif">DROP A</text>
      <text x="0" y="-84" text-anchor="middle" font-size="15" fill="#241c13" font-family="serif">RELIGOUS ITEM</text>
      <text x="0" y="-64" text-anchor="middle" font-size="15" fill="#241c13" font-family="serif">OR DIE !!</text>
      </g>`,
    valve: () => `
      <g class="hs-body">
      <line x1="-140" y1="-90" x2="140" y2="-90" stroke="#5c6167" stroke-width="16"/>
      <line x1="60" y1="-90" x2="60" y2="0" stroke="#5c6167" stroke-width="16"/>
      <circle cx="0" cy="-90" r="26" fill="none" stroke="#b5533c" stroke-width="9"/>
      <line x1="-18" y1="-90" x2="18" y2="-90" stroke="#b5533c" stroke-width="7"/>
      <line x1="0" y1="-108" x2="0" y2="-72" stroke="#b5533c" stroke-width="7"/>
      </g>`,
    faucet: () => `
      <g class="hs-body">
      <line x1="0" y1="0" x2="0" y2="-70" stroke="#5c6167" stroke-width="10"/>
      <path d="M 0 -70 L 26 -70 L 26 -56" stroke="#5c6167" stroke-width="10" fill="none"/>
      <circle cx="0" cy="-82" r="10" fill="none" stroke="#7d8289" stroke-width="5"/>
      <path d="M 26 -50 q 3 14 0 22" stroke="#7fa8c9" stroke-width="4" fill="none" opacity="0.8"/>
      </g>`,
    mirror: () => `
      <g class="hs-body">
      <rect x="-46" y="-220" width="92" height="200" rx="40" fill="#d8b36a"/>
      <rect x="-38" y="-212" width="76" height="184" rx="34" fill="#20262e"/>
      <path d="M -22 -196 L -30 -60" stroke="#e8ddc8" stroke-width="5" opacity="0.35"/>
      </g>`,
    railing: () => `
      <g class="hs-body">
      <rect x="-240" y="-104" width="480" height="12" fill="#3a2c1c"/>
      ${[-220, -160, -100, -40, 20, 80, 140, 200].map(x => `<rect x="${x}" y="-92" width="10" height="92" fill="#4a3b2a"/>`).join('')}
      <rect x="-240" y="-8" width="480" height="8" fill="#3a2c1c"/>
      </g>`,
    trapdoor: () => `
      <g class="hs-body">
      <rect x="-70" y="-40" width="140" height="44" rx="4" fill="#241c13" stroke="#3a2c1c" stroke-width="5" transform="skewX(-24)"/>
      <circle cx="36" cy="-16" r="6" fill="#d8b36a" transform="skewX(-24)"/>
      <text x="-6" y="-14" text-anchor="middle" font-size="14" fill="#b5533c" font-family="serif" transform="skewX(-24)">DANGER</text>
      </g>`,
    poolMercury: () => `
      <g class="hs-body">
      <ellipse cx="0" cy="-8" rx="270" ry="52" fill="#3a3f47"/>
      <ellipse cx="0" cy="-14" rx="250" ry="44" fill="#9aa3ad"/>
      <ellipse cx="-60" cy="-20" rx="70" ry="12" fill="#c6ccd3" opacity="0.7"/>
      <ellipse cx="90" cy="-8" rx="50" ry="9" fill="#c6ccd3" opacity="0.5"/>
      </g>`,
    poolEmpty: () => `
      <g class="hs-body">
      <ellipse cx="0" cy="-8" rx="270" ry="52" fill="#3a3f47"/>
      <ellipse cx="0" cy="-14" rx="250" ry="44" fill="#20262e"/>
      <ellipse cx="0" cy="-6" rx="200" ry="30" fill="#171b21"/>
      </g>`,
    murkyPool: () => `
      <g class="hs-body">
      <ellipse cx="0" cy="-8" rx="180" ry="36" fill="#2c3a33"/>
      <ellipse cx="0" cy="-12" rx="160" ry="28" fill="#1d2a25"/>
      <ellipse cx="-40" cy="-16" rx="46" ry="8" fill="#3d4f42" opacity="0.6"/>
      </g>`,
    bucket: () => `
      <g class="hs-body">
      <path d="M -30 -60 L -22 0 L 22 0 L 30 -60 Z" fill="#8a4a3a"/>
      <ellipse cx="0" cy="-60" rx="30" ry="9" fill="#a05a46"/>
      <path d="M -28 -62 A 30 26 0 0 1 28 -62" stroke="#5c6167" stroke-width="4" fill="none"/>
      </g>`,
    sword: () => `
      <g class="hs-body" transform="rotate(24)">
      <rect x="-5" y="-150" width="10" height="112" fill="#aab2ba"/>
      <path d="M -5 -150 L 0 -168 L 5 -150 Z" fill="#aab2ba"/>
      <rect x="-26" y="-38" width="52" height="9" rx="4" fill="#d8b36a"/>
      <rect x="-6" y="-29" width="12" height="26" rx="5" fill="#5a4327"/>
      <circle cx="0" cy="2" r="7" fill="#d8b36a"/>
      </g>`,
    book: () => `
      <g class="hs-body">
      <rect x="-44" y="-24" width="88" height="24" rx="3" fill="#6e2f26"/>
      <rect x="-44" y="-24" width="10" height="24" fill="#4a1f18"/>
      <line x1="-30" y1="-12" x2="36" y2="-12" stroke="#d8b36a" stroke-opacity="0.6" stroke-width="2"/>
      </g>`,
    cross: () => `
      <g class="hs-body">
      <rect x="-7" y="-104" width="14" height="104" fill="#7a5a34"/>
      <rect x="-34" y="-80" width="68" height="14" fill="#7a5a34"/>
      <circle cx="0" cy="-73" r="5" fill="#5a3f22"/>
      </g>`,
    parachute: () => `
      <g class="hs-body">
      <path d="M -52 -60 A 52 44 0 0 1 52 -60 L 40 -50 L 20 -58 L 0 -50 L -20 -58 L -40 -50 Z" fill="#8a7a5e"/>
      <path d="M -40 -52 L -12 -8 M 40 -52 L 12 -8" stroke="#5a4f3c" stroke-width="3"/>
      <rect x="-16" y="-12" width="32" height="16" rx="4" fill="#5a4327"/>
      </g>`,
    moneybag: () => `
      <g class="hs-body">
      <path d="M -42 0 Q -50 -52 -12 -66 L -8 -80 L 8 -80 L 12 -66 Q 50 -52 42 0 Z" fill="#a08858"/>
      <path d="M -12 -70 Q 0 -78 12 -70" stroke="#5a4327" stroke-width="5" fill="none"/>
      <text x="0" y="-26" text-anchor="middle" font-size="26" fill="#5a4327" font-family="serif">$</text>
      </g>`,
    slippers: () => `
      <g class="hs-body">
      <path d="M -50 0 Q -54 -20 -34 -22 L -8 -18 Q 0 -8 -6 0 Z" fill="#b5233c"/>
      <path d="M 6 0 Q 2 -20 22 -22 L 48 -18 Q 56 -8 50 0 Z" fill="#b5233c"/>
      <circle cx="-36" cy="-18" r="4" fill="#ffb648"/>
      <circle cx="20" cy="-18" r="4" fill="#ffb648"/>
      </g>`,
    itemGlint: () => `
      <g class="hs-body">
      <ellipse cx="0" cy="-6" rx="26" ry="10" fill="#d8b36a" opacity="0.9"/>
      <path d="M 0 -34 L 4 -22 L 16 -18 L 4 -14 L 0 -2 L -4 -14 L -16 -18 L -4 -22 Z" fill="#ffb648"/>
      </g>`,
    leaf: () => `
      <g class="hs-body">
      <path d="M 0 0 C -34 -22 -30 -62 0 -78 C 30 -62 34 -22 0 0 Z" fill="#d8b36a"/>
      <line x1="0" y1="-6" x2="0" y2="-70" stroke="#a08030" stroke-width="3"/>
      </g>`,
  };

  /* ---------- helpers ---------- */

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function defs() {
    return `<defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ffb648" flood-opacity="0.9"/>
      </filter>
      <radialGradient id="candle-light" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#ffb648" stop-opacity="0.16"/>
        <stop offset="45%" stop-color="#ffb648" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.62"/>
      </radialGradient>
      <radialGradient id="sky-grad" cx="50%" cy="10%" r="100%">
        <stop offset="0%" stop-color="#1c2637"/>
        <stop offset="100%" stop-color="#0b0e14"/>
      </radialGradient>
    </defs>`;
  }

  /* ---------- render ---------- */

  function renderProp(prop, hotspot) {
    const draw = PROPS[prop.type];
    if (!draw) return '';
    let x, y, s;
    if (prop.on === 'wall') {
      x = wallPoint(prop.u ?? 0, 1).x;
      y = BW.y2 - (prop.lift || 0);
      s = BACK_SCALE * (prop.scale ?? 1);
    } else {
      const pt = floorPoint(prop.u ?? 0, prop.t ?? 0.7);
      x = pt.x; y = pt.y;
      s = S(prop.t ?? 0.7) * (prop.scale ?? 1);
    }
    const body = draw(prop);
    if (hotspot) {
      return `<g class="hotspot" data-id="${esc(hotspot.id)}" data-label="${esc(hotspot.label)}" tabindex="0" role="button" aria-label="${esc(hotspot.label)}" transform="translate(${x},${y}) scale(${s})">${body}</g>`;
    }
    return `<g transform="translate(${x},${y}) scale(${s})">${body}</g>`;
  }

  // exits: [{dir, label, wall: back|left|right, style, u}]
  function render(svgEl, room, exits, visibleProps) {
    const kind = room.shell?.kind || 'room';
    const shell = kind === 'outdoor' ? shellOutdoor(room.shell)
      : kind === 'hedge' ? shellHedge(room.shell || {})
      : shellRoom(room.shell || {});

    const backs = exits.filter(e => e.wall === 'back');
    let doors = '';
    backs.forEach((e, i) => {
      const u = e.u ?? (backs.length === 1 ? 0 : -0.55 + (1.1 * i) / (backs.length - 1));
      doors += exitBack(e, u, e.style || (kind === 'room' ? 'door' : 'arch'));
    });
    for (const e of exits) {
      if (e.wall === 'left') doors += exitSide(e, 'left', e.style || (kind === 'room' ? 'door' : 'arch'));
      if (e.wall === 'right') doors += exitSide(e, 'right', e.style || (kind === 'room' ? 'door' : 'arch'));
    }

    let props = '';
    for (const p of visibleProps) props += renderProp(p, p.hotspot);

    svgEl.innerHTML = `
      ${defs()}
      <rect x="-800" y="-400" width="${VW + 1600}" height="${VH + 800}" fill="#0e0b09"/>
      ${shell}
      ${doors}
      ${props}
      <rect x="-800" y="-400" width="${VW + 1600}" height="${VH + 800}" fill="url(#candle-light)" pointer-events="none" class="light-veil"/>
    `;
  }

  return { render, PROPS, dirWall, OPPOSITE };
})();
