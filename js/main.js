/* ============================================================
   main.js — UI wiring: scene clicks, log, inventory, modals
   ============================================================ */

(() => {
  const $ = sel => document.querySelector(sel);
  const sceneEl = $('#scene');
  const logEl = $('#log');
  const tipEl = $('#hotspot-tip');
  const turnBtn = $('#btn-turn');

  /* ---------- log ---------- */

  function print(msg, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.innerHTML = msg;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- scene ---------- */

  const resolve = v => (typeof v === 'function' ? v(Engine.api()) : v);

  /* Re-orient a prop for the direction the player is looking.
     Prop coordinates in data.js are authored for the room's designed
     facing; this rotates them to the current heading. */
  const VEC = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
  const RIGHT = { north: 'east', east: 'south', south: 'west', west: 'north' };

  function orientProp(p, designedFacing, facing) {
    if (p.on === 'wall') {
      const wallDir = p.wall || designedFacing; // which compass wall it hangs on
      const rel = Scene.dirWall(wallDir, facing);
      if (rel === 'back') return p;
      if (rel === 'behind') return null;                     // it's behind you
      return { ...p, on: 'floor', u: rel === 'left' ? -0.85 : 0.85, t: 0.5, scale: (p.scale ?? 1) * 0.75 };
    }
    if (designedFacing === facing) return p;
    const [dx0, dy0] = VEC[designedFacing], [rx0, ry0] = VEC[RIGHT[designedFacing]];
    const u0 = p.u ?? 0, t0 = p.t ?? 0.7;
    const px = rx0 * u0 + dx0 * (2 * t0 - 1);
    const py = ry0 * u0 + dy0 * (2 * t0 - 1);
    const [dx, dy] = VEC[facing], [rx, ry] = VEC[RIGHT[facing]];
    return {
      ...p,
      u: Math.max(-0.95, Math.min(0.95, px * rx + py * ry)),
      t: Math.max(0.18, Math.min(0.92, (px * dx + py * dy + 1) / 2)),
    };
  }

  function visibleProps() {
    const state = Engine.state();
    const room = GAME.rooms[state.room];
    const designed = room.facing || 'north';
    const props = [];
    for (const p of room.props || []) {
      if (p.hidden && p.hidden(Engine.api())) continue;
      const o = orientProp(p, designed, state.facing);
      if (!o) continue;
      props.push({ ...o, hotspot: p.id ? { id: p.id, label: resolve(p.name) || p.id } : null });
    }
    // items lying in this room render as glints (or their own prop type)
    for (const [id, loc] of Object.entries(state.itemLocs)) {
      if (loc !== state.room) continue;
      const item = GAME.items[id];
      const propDef = item.prop || { type: 'itemGlint', on: 'floor', u: 0.5, t: 0.8 };
      const o = orientProp(propDef, designed, state.facing);
      if (!o) continue;
      props.push({ ...o, hotspot: { id, label: `Take the ${resolve(item.name)}` } });
    }
    return props;
  }

  /* ---------- look (renderer) selection ---------- */

  const LOOKS = { firstperson: 'First-Person', iso: 'Isometric', side: 'Side View' };
  let look = localStorage.getItem('miser-look');
  if (!LOOKS[look]) look = 'firstperson';

  function setLook(l) {
    if (!LOOKS[l]) return;
    look = l;
    localStorage.setItem('miser-look', l);
    $('#btn-look').textContent = `Look: ${LOOKS[l]}`;
    document.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('selected', b.dataset.look === l));
    if (Engine.state()) showRoom();
  }

  /* Neutral room-space view for the iso/side renderers:
     floor props at (x east, y north) in [-1,1]; wall props pinned
     to a compass wall with a position along it. */
  function neutralView(room, state) {
    const designed = room.facing || 'north';
    const floorProps = [], wallProps = [];
    const add = (p, hotspot) => {
      if (p.on === 'wall') {
        wallProps.push({ type: p.type, wall: p.wall || designed, along: p.u ?? 0, scale: p.scale ?? 1, hotspot });
        return;
      }
      const [dx, dy] = VEC[designed], [rx, ry] = VEC[RIGHT[designed]];
      const u = p.u ?? 0, t = p.t ?? 0.7;
      floorProps.push({ type: p.type, x: rx * u + dx * (2 * t - 1), y: ry * u + dy * (2 * t - 1), scale: p.scale ?? 1, hotspot });
    };
    for (const p of room.props || []) {
      if (p.hidden && p.hidden(Engine.api())) continue;
      add(p, p.id ? { id: p.id, label: resolve(p.name) || p.id } : null);
    }
    for (const [id, loc] of Object.entries(state.itemLocs)) {
      if (loc !== state.room) continue;
      const item = GAME.items[id];
      add(item.prop || { type: 'itemGlint', on: 'floor', u: 0.5, t: 0.8 }, { id, label: `Take the ${resolve(item.name)}` });
    }
    const exits = [];
    let spreadCount = 0;
    for (const [dir, exit] of Object.entries(Engine.openExits())) {
      const spread = dir === 'north' || dir === 'up' || dir === 'down' ? (spreadCount++) * 0.28 - 0.14 : 0;
      exits.push({ dir, label: exit.label || `Go ${dir}`, style: exit.style, spread });
    }
    return { room, facing: state.facing || 'north', exits, floorProps, wallProps };
  }

  function showRoom() {
    const state = Engine.state();
    const room = GAME.rooms[state.room];
    const facing = state.facing || 'north';

    if (look === 'iso') {
      SceneIso.render(sceneEl, neutralView(room, state));
    } else if (look === 'side') {
      SceneSide.render(sceneEl, neutralView(room, state));
    } else {
      const exits = [];
      let behindCount = 0;
      for (const [dir, exit] of Object.entries(Engine.openExits())) {
        const wall = exit.wall || Scene.dirWall(dir, facing);
        const label = exit.label || `Go ${dir}`;
        if (wall === 'behind') { behindCount++; continue; }
        let style = exit.style;
        if (!style && dir === 'up') style = 'stairs-up';
        if (!style && dir === 'down') style = 'stairs-down';
        // authored u positions assume the designed facing; ignore them otherwise
        const u = facing === (room.facing || 'north') ? exit.u : undefined;
        exits.push({ dir, label, wall, style, u });
      }
      turnBtn.innerHTML = behindCount
        ? `&#8635; turn around <span class="turn-hint">(door behind you)</span>`
        : `&#8635; turn around`;
      Scene.render(sceneEl, room, exits, visibleProps());
    }

    $('#room-name').textContent = typeof room.name === 'function' ? room.name(Engine.api()) : room.name;
    $('#facing-chip').textContent = look === 'firstperson' ? `facing ${facing}` : '';
    turnBtn.hidden = look !== 'firstperson';
    renderMinimap();
    sceneEl.classList.remove('fade-in');
    void sceneEl.getBoundingClientRect(); // restart animation
    sceneEl.classList.add('fade-in');
  }

  sceneEl.addEventListener('click', e => {
    const exitG = e.target.closest('[data-exit]');
    if (exitG) { Engine.go(exitG.dataset.exit); return; }
    const hs = e.target.closest('[data-id]');
    if (hs) Engine.clickHotspot(hs.dataset.id);
  });

  sceneEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const exitG = e.target.closest && e.target.closest('[data-exit]');
    if (exitG) { e.preventDefault(); Engine.go(exitG.dataset.exit); return; }
    const hs = e.target.closest && e.target.closest('[data-id]');
    if (hs) { e.preventDefault(); Engine.clickHotspot(hs.dataset.id); }
  });

  sceneEl.addEventListener('mousemove', e => {
    const g = e.target.closest('[data-label]');
    if (!g) { tipEl.hidden = true; return; }
    tipEl.textContent = g.dataset.label;
    tipEl.hidden = false;
    const wrap = $('#scene-wrap').getBoundingClientRect();
    tipEl.style.left = `${e.clientX - wrap.left + 14}px`;
    tipEl.style.top = `${e.clientY - wrap.top + 10}px`;
  });
  sceneEl.addEventListener('mouseleave', () => { tipEl.hidden = true; });

  turnBtn.addEventListener('click', () => Engine.turnAround());

  /* ---------- minimap (fog of war: visited rooms only) ---------- */

  function renderMinimap() {
    const st = Engine.state();
    const here = GAME.map && GAME.map.rooms[st.room];
    const wrap = $('#minimap');
    if (!here) { wrap.hidden = true; return; }
    wrap.hidden = false;
    $('#mm-layer').textContent = GAME.map.layers[here.layer] || '';

    const layerRooms = Object.entries(GAME.map.rooms).filter(([, m]) => m.layer === here.layer);
    const xs = layerRooms.map(([, m]) => m.x), ys = layerRooms.map(([, m]) => m.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const CX = 34, CY = 26, PAD = 16;
    const W = (maxX - minX) * CX + PAD * 2, H = (maxY - minY) * CY + PAD * 2;
    const px = m => PAD + (m.x - minX) * CX;
    const py = m => PAD + (maxY - m.y) * CY; // north is up

    let edges = '', nodes = '';
    const seen = new Set();
    for (const [id, m] of layerRooms) {
      if (!st.visited[id]) continue;
      for (const [dir, ex] of Object.entries(GAME.rooms[id].exits || {})) {
        const tm = GAME.map.rooms[ex.to];
        if (!tm || tm.layer !== m.layer || ex.to === id || !st.visited[ex.to]) continue;
        const key = [id, ex.to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const dashed = dir === 'up' || dir === 'down' ? ' stroke-dasharray="3 3"' : '';
        edges += `<line x1="${px(m)}" y1="${py(m)}" x2="${px(tm)}" y2="${py(tm)}"${dashed}/>`;
      }
    }
    const FACE_DEG = { north: 0, east: 90, south: 180, west: 270 };
    for (const [id, m] of layerRooms) {
      if (!st.visited[id]) continue;
      const cur = id === st.room;
      if (cur) {
        // arrow pointing the way you're facing (the wall you're looking at)
        const deg = FACE_DEG[st.facing || 'north'] ?? 0;
        nodes += `<rect x="${px(m) - 7}" y="${py(m) - 5}" width="14" height="10" rx="2.5" class="mm-here"/>` +
          `<path d="M 0,-6.5 L 5,4.5 L 0,1.8 L -5,4.5 Z" class="mm-cur" transform="translate(${px(m)},${py(m)}) rotate(${deg})"/>`;
      } else {
        nodes += `<rect x="${px(m) - 7}" y="${py(m) - 5}" width="14" height="10" rx="2.5" class="mm-room"/>`;
      }
      // chevron on rooms with a way to another floor (stairs, trapdoor, pool…)
      const crossesUp = Object.values(GAME.rooms[id].exits || {}).some(ex => {
        const tm = GAME.map.rooms[ex.to];
        return tm && tm.layer !== m.layer;
      });
      if (crossesUp) nodes += `<path d="M ${px(m) - 3.5} ${py(m) - 8} L ${px(m)} ${py(m) - 12} L ${px(m) + 3.5} ${py(m) - 8} Z" class="mm-stairs"/>`;
    }
    const svg = $('#minimap-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<g class="mm-edges">${edges}</g>${nodes}`;
  }

  /* ---------- inventory ---------- */

  function refreshInventory() {
    const state = Engine.state();
    const ul = $('#inventory');
    ul.innerHTML = '';
    const inv = Object.entries(state.itemLocs).filter(([, l]) => l === 'inv');
    $('#satchel-empty').hidden = inv.length > 0;
    for (const [id] of inv) {
      const li = document.createElement('li');
      li.textContent = resolve(GAME.items[id].name);
      li.tabIndex = 0;
      li.title = 'Examine';
      li.addEventListener('click', () => Engine.handle(`examine ${id}`));
      ul.appendChild(li);
    }
  }

  /* ---------- modal ---------- */

  function modal(title, bodyHtml, actions) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml || '';
    const actionsEl = $('#modal-actions');
    actionsEl.innerHTML = '';
    (actions && actions.length ? actions : [{ label: 'Continue' }]).forEach((a, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-btn' + (i > 0 ? ' ghost' : '');
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        $('#modal-veil').hidden = true;
        if (a.action) a.action();
        $('#cmd').focus();
      });
      actionsEl.appendChild(btn);
    });
    $('#modal-veil').hidden = false;
    actionsEl.querySelector('button').focus();
  }

  function setScore(n) { $('#score').textContent = n; }

  /* ---------- input ---------- */

  $('#cmdform').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#cmd');
    Engine.handle(input.value);
    input.value = '';
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || !$('#modal-veil').hidden) return;
    if (look === 'firstperson') {
      // first-person arrows: ↑ forward, ←/→ sidestep, ↓ turn around
      const f = Engine.state().facing || 'north';
      const LEFT = { north: 'west', west: 'south', south: 'east', east: 'north' };
      if (e.key === 'ArrowUp') { e.preventDefault(); Engine.go(f); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); Engine.go(LEFT[f]); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); Engine.go(RIGHT[f]); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); Engine.turnAround(); }
    } else {
      // map views: arrows are compass-absolute
      const dirs = { ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east' };
      if (dirs[e.key]) { e.preventDefault(); Engine.go(dirs[e.key]); }
    }
  });

  $('#btn-help').addEventListener('click', () =>
    modal('How to Play', GAME.helpText, [{ label: 'Back to the mansion' }]));
  $('#btn-look').addEventListener('click', () => {
    const order = Object.keys(LOOKS);
    setLook(order[(order.indexOf(look) + 1) % order.length]);
  });
  // look picker inside the intro modal (delegated: modal body is re-rendered)
  $('#modal-body').addEventListener('click', e => {
    const opt = e.target.closest('[data-look]');
    if (opt) setLook(opt.dataset.look);
  });
  $('#btn-restart').addEventListener('click', () =>
    modal('Start Over?', '<p>All progress will be lost to the dust.</p>',
      [{ label: 'Restart', action: () => Engine.restart() }, { label: 'Keep playing' }]));

  /* ---------- go ---------- */

  $('#score-max').textContent = GAME.treasureGoal || '?';
  $('#btn-look').textContent = `Look: ${LOOKS[look]}`;
  Engine.start({ print, showRoom, refreshInventory, modal, setScore });
  document.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('selected', b.dataset.look === look));
})();
