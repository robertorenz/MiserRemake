/* ============================================================
   scene-iso.js — isometric renderer (angled bird's-eye room)
   Same declarative room data as scene.js; different projection.
   View model (from main.js): { room, facing, exits[], floorProps[],
   wallProps[] } — coordinates in room space (x east, y north, ±1).
   ============================================================ */

const SceneIso = (() => {

  const VW = 1200, VH = 675;
  const CX = 600, CY = 356;   // floor-diamond centre
  const S = 195;              // iso scale (half-diagonal)
  const WALL_H = 168;         // wall height
  const DOOR_H = 132;

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const lerp = (a, b, k) => a + (b - a) * k;

  // room-space (x east, y north) -> screen
  const px = (x, y) => CX + S * (x + y);
  const py = (x, y) => CY + (S / 2) * (x - y);

  // corners: NW top, NE right, SE bottom, SW left
  const C = {
    NW: [px(-1, 1), py(-1, 1)], NE: [px(1, 1), py(1, 1)],
    SE: [px(1, -1), py(1, -1)], SW: [px(-1, -1), py(-1, -1)],
  };

  // wall edges A->B (left to right as seen), whether the wall is drawn upright
  const EDGES = {
    north: { a: C.NW, b: C.NE, solid: true },
    west:  { a: C.SW, b: C.NW, solid: true },
    south: { a: C.SW, b: C.SE, solid: false },  // near edges: low sill only
    east:  { a: C.SE, b: C.NE, solid: false },
  };

  const DIR_TAG = { north: 'N', south: 'S', east: 'E', west: 'W', up: 'UP', down: 'DN' };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    return `#${(((c(n >> 16)) << 16) | ((c((n >> 8) & 255)) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
  }

  function poly(pts, fill, extra = '') {
    return `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
  }

  function backdrop(kind) {
    if (kind === 'outdoor' || kind === 'hedge') {
      return `<rect x="-800" y="-400" width="2800" height="1475" fill="url(#sky-grad-iso)"/>
        ${[[150, 80], [420, 50], [760, 90], [1050, 60], [280, 160], [900, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#e8ddc8" opacity="0.5"/>`).join('')}
        <circle cx="980" cy="96" r="36" fill="#e8ddc8" opacity="0.8"/><circle cx="966" cy="88" r="34" fill="#0f1520" opacity="0.92"/>`;
    }
    return `<rect x="-800" y="-400" width="2800" height="1475" fill="#0e0b09"/>`;
  }

  function floorDiamond(shell) {
    const kind = shell?.kind || 'room';
    const f = shell?.floor || (kind === 'hedge' ? '#2a2e1d' : kind === 'outdoor' ? '#28301e' : '#33261a');
    let s = poly([C.NW, C.NE, C.SE, C.SW], f);
    // depth lines
    for (let i = -0.5; i <= 0.5; i += 0.5) {
      s += `<line x1="${px(-1, i)}" y1="${py(-1, i)}" x2="${px(1, i)}" y2="${py(1, i)}" stroke="#000" stroke-opacity="0.1"/>`;
      s += `<line x1="${px(i, -1)}" y1="${py(i, -1)}" x2="${px(i, 1)}" y2="${py(i, 1)}" stroke="#000" stroke-opacity="0.1"/>`;
    }
    // plinth (gives the slab thickness)
    s += poly([C.SW, C.SE, [C.SE[0], C.SE[1] + 16], [C.SW[0], C.SW[1] + 16]], shade(f, -22));
    s += poly([C.SE, C.NE, [C.NE[0], C.NE[1] + 16], [C.SE[0], C.SE[1] + 16]], shade(f, -30));
    return s;
  }

  function wall(dir, shell) {
    const kind = shell?.kind || 'room';
    if (kind === 'outdoor') return '';                 // open ground
    const e = EDGES[dir];
    const base = kind === 'hedge' ? (shell?.wall || '#26331f') : (shell?.wall || '#4a3b2a');
    const fill = dir === 'north' ? shade(base, -6) : shade(base, -20);
    if (!e.solid) {
      // near edge: low sill so the room stays open to the camera
      return poly([e.a, e.b, [e.b[0], e.b[1] - 20], [e.a[0], e.a[1] - 20]], shade(base, -14), 'opacity="0.85"');
    }
    return poly([e.a, e.b, [e.b[0], e.b[1] - WALL_H], [e.a[0], e.a[1] - WALL_H]], fill);
  }

  function doorOn(exit, shell) {
    const dir = ['up', 'down'].includes(exit.dir) ? null : exit.dir;
    if (!dir) return stairsMarker(exit);
    const e = EDGES[dir];
    const kind = shell?.kind || 'room';
    const f = 0.5 + (exit.spread || 0);
    const m1 = [lerp(e.a[0], e.b[0], f - 0.11), lerp(e.a[1], e.b[1], f - 0.11)];
    const m2 = [lerp(e.a[0], e.b[0], f + 0.11), lerp(e.a[1], e.b[1], f + 0.11)];
    const mid = [lerp(e.a[0], e.b[0], f), lerp(e.a[1], e.b[1], f)];
    let art = '';
    if (e.solid && kind !== 'outdoor') {
      art = poly([m1, m2, [m2[0], m2[1] - DOOR_H], [m1[0], m1[1] - DOOR_H]], '#0d0a07', 'class="hs-body"') +
        `<text x="${mid[0]}" y="${mid[1] - DOOR_H - 10}" text-anchor="middle" font-size="19" font-family="serif" fill="#d8b36a" opacity="0.9">${DIR_TAG[exit.dir]}</text>`;
    } else {
      // near edge or open ground: a stepping-stone marker just outside the room
      const out = [mid[0] - CX, mid[1] - CY];
      const len = Math.hypot(out[0], out[1]) || 1;
      const ox = mid[0] + (out[0] / len) * 30, oy = mid[1] + (out[1] / len) * 26;
      art = `<ellipse cx="${ox}" cy="${oy}" rx="34" ry="15" fill="#0d0a07" class="hs-body" stroke="#d8b36a" stroke-opacity="0.45" stroke-width="2"/>
        <text x="${ox}" y="${oy - 20}" text-anchor="middle" font-size="19" font-family="serif" fill="#d8b36a" opacity="0.9">${DIR_TAG[exit.dir]}</text>`;
    }
    return hotspotExit(exit, art);
  }

  function stairsMarker(exit) {
    const up = exit.dir === 'up';
    const x = px(0.74, 0.74), y = py(0.74, 0.74);
    let steps = '';
    for (let i = 0; i < 4; i++) {
      steps += `<rect x="${x - 40 + i * 6}" y="${y - 14 - i * (up ? 16 : -8)}" width="${80 - i * 12}" height="14" fill="${i % 2 ? '#4a3b2a' : '#5a4a35'}"/>`;
    }
    const art = `<g class="hs-body">${steps}</g>
      <text x="${x}" y="${y - (up ? 84 : -46)}" text-anchor="middle" font-size="16" font-family="serif" fill="#d8b36a" opacity="0.9">${DIR_TAG[exit.dir]}</text>`;
    return hotspotExit(exit, art);
  }

  function hotspotExit(exit, inner) {
    return `<g class="exit-door hotspot" data-exit="${exit.dir}" data-label="${esc(exit.label)}" tabindex="0" role="button" aria-label="${esc(exit.label)}">${inner}</g>`;
  }

  function billboard(type, x, y, scale, hotspot, extraClass = '') {
    const draw = Scene.PROPS[type];
    if (!draw) return null;
    const sx = px(x, y), sy = py(x, y);
    const s = scale * (0.44 + 0.06 * ((x - y) / 2 + 1)); // subtle nearer-is-bigger
    const inner = `<g transform="translate(${sx},${sy}) scale(${s})" class="${extraClass}">${draw({})}</g>`;
    const g = hotspot
      ? `<g class="hotspot" data-id="${esc(hotspot.id)}" data-label="${esc(hotspot.label)}" tabindex="0" role="button" aria-label="${esc(hotspot.label)}">${inner}</g>`
      : inner;
    return { sy, svg: g };
  }

  const FACE_DEG = { north: -27, east: 27, south: 153, west: 207 };

  function render(svgEl, view) {
    const { room, facing, exits, floorProps, wallProps } = view;
    const shell = room.shell || {};
    const defs = `<defs>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ffb648" flood-opacity="0.9"/>
      </filter>
      <radialGradient id="sky-grad-iso" cx="50%" cy="10%" r="100%">
        <stop offset="0%" stop-color="#1c2637"/><stop offset="100%" stop-color="#0b0e14"/>
      </radialGradient>
      <radialGradient id="iso-light" cx="50%" cy="48%" r="66%">
        <stop offset="0%" stop-color="#ffb648" stop-opacity="0.13"/>
        <stop offset="50%" stop-color="#ffb648" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>`;

    // walls behind everything: north then west
    let base = backdrop(shell.kind) + wall('north', shell) + wall('west', shell) + floorDiamond(shell);

    // doors: solid-wall doors go under props; near-edge markers on top
    let doorsBack = '', doorsFront = '';
    for (const ex of exits) {
      const solid = EDGES[ex.dir]?.solid && (shell.kind || 'room') !== 'outdoor';
      (solid ? doorsBack = doorsBack + doorOn(ex, shell) : doorsFront = doorsFront + doorOn(ex, shell));
    }

    // props + wall hangings + the player, depth-sorted
    const items = [];
    for (const p of wallProps) {
      // hang on the two visible walls; others sit near their edge on the floor
      if (p.wall === 'north') items.push(billboard(p.type, (p.along ?? 0) * 0.8, 0.94, (p.scale ?? 1) * 0.8, p.hotspot));
      else if (p.wall === 'west') items.push(billboard(p.type, -0.94, (p.along ?? 0) * 0.8, (p.scale ?? 1) * 0.8, p.hotspot));
      else if (p.wall === 'south') items.push(billboard(p.type, (p.along ?? 0) * 0.8, -0.86, (p.scale ?? 1) * 0.75, p.hotspot));
      else items.push(billboard(p.type, 0.86, (p.along ?? 0) * 0.8, (p.scale ?? 1) * 0.75, p.hotspot));
    }
    for (const p of floorProps) items.push(billboard(p.type, p.x, p.y, p.scale ?? 1, p.hotspot));
    items.push(billboard('player', -0.12, -0.3, 1.05, null, 'player-iso'));
    const sorted = items.filter(Boolean).sort((a, b) => a.sy - b.sy).map(i => i.svg).join('');

    // facing arrow at the player's feet
    const ax = px(-0.12, -0.3), ay = py(-0.12, -0.3);
    const arrow = `<g transform="translate(${ax},${ay + 10}) rotate(${FACE_DEG[facing] ?? -27})" opacity="0.9">
      <path d="M 0,-26 L 7,-8 L 0,-13 L -7,-8 Z" fill="#ffb648"/></g>`;

    svgEl.innerHTML = `${defs}${base}${doorsBack}${sorted}${doorsFront}${arrow}
      <rect x="-800" y="-400" width="2800" height="1475" fill="url(#iso-light)" pointer-events="none" class="light-veil"/>`;
  }

  return { render };
})();
