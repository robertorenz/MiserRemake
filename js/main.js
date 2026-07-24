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

  function visibleProps() {
    const state = Engine.state();
    const room = GAME.rooms[state.room];
    const props = [];
    for (const p of room.props || []) {
      if (p.hidden && p.hidden(Engine.api())) continue;
      props.push({ ...p, hotspot: p.id ? { id: p.id, label: resolve(p.name) || p.id } : null });
    }
    // items lying in this room render as glints (or their own prop type)
    for (const [id, loc] of Object.entries(state.itemLocs)) {
      if (loc !== state.room) continue;
      const item = GAME.items[id];
      const propDef = item.prop || { type: 'itemGlint', on: 'floor', u: 0.5, t: 0.8 };
      props.push({ ...propDef, hotspot: { id, label: `Take the ${resolve(item.name)}` } });
    }
    return props;
  }

  let behindDir = null;

  function showRoom() {
    const state = Engine.state();
    const room = GAME.rooms[state.room];
    const facing = room.facing || 'north';

    const exits = [];
    behindDir = null;
    for (const [dir, exit] of Object.entries(Engine.openExits())) {
      const wall = exit.wall || Scene.dirWall(dir, facing);
      const label = exit.label || `Go ${dir}`;
      if (wall === 'behind') { behindDir = dir; continue; }
      let style = exit.style;
      if (!style && dir === 'up') style = 'stairs-up';
      if (!style && dir === 'down') style = 'stairs-down';
      exits.push({ dir, label, wall, style, u: exit.u });
    }

    Scene.render(sceneEl, room, exits, visibleProps());
    $('#room-name').textContent = typeof room.name === 'function' ? room.name(Engine.api()) : room.name;
    turnBtn.hidden = !behindDir;
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

  turnBtn.addEventListener('click', () => { if (behindDir) Engine.go(behindDir); });

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
    const dirs = { ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east' };
    if (dirs[e.key]) { e.preventDefault(); Engine.go(dirs[e.key]); }
  });

  $('#btn-help').addEventListener('click', () =>
    modal('How to Play', GAME.helpText, [{ label: 'Back to the mansion' }]));
  $('#btn-restart').addEventListener('click', () =>
    modal('Start Over?', '<p>All progress will be lost to the dust.</p>',
      [{ label: 'Restart', action: () => Engine.restart() }, { label: 'Keep playing' }]));

  /* ---------- go ---------- */

  $('#score-max').textContent = GAME.treasureGoal || '?';
  Engine.start({ print, showRoom, refreshInventory, modal, setScore });
})();
