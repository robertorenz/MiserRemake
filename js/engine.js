/* ============================================================
   engine.js — game state, verbs, parser, and turn loop
   Game content lives in data.js (GAME); this file runs it.
   Verb set mirrors the original 1981 game: GET TAKE MOVE SLIDE
   PUSH OPEN READ I QUIT DROP SAY POUR FILL UNLOCK LOOK GO
   N S E W SCORE TURN JUMP SWIM FIX
   ============================================================ */

const Engine = (() => {

  let state = null;
  let ui = null;   // injected by main.js: { print, showRoom, refreshInventory, modal, setScore }

  function newState() {
    const itemLocs = {};
    for (const [id, item] of Object.entries(GAME.items)) itemLocs[id] = item.startsIn ?? null;
    return {
      room: GAME.startRoom,
      itemLocs,               // itemId -> roomId | 'inv' | 'gone'
      flags: {},              // puzzle state
      visited: {},            // roomId -> true (drives the minimap fog)
      dead: false,
      won: false,
    };
  }

  function treasureCount() {
    return Object.entries(state.itemLocs)
      .filter(([id, loc]) => loc === 'inv' && GAME.items[id].treasure).length;
  }

  const api = {
    print: (msg, cls) => ui.print(msg, cls),
    flag: (k, v) => (v === undefined ? state.flags[k] : (state.flags[k] = v)),
    has: id => state.itemLocs[id] === 'inv',
    here: id => state.itemLocs[id] === state.room,
    give: id => { state.itemLocs[id] = 'inv'; ui.refreshInventory(); ui.setScore(treasureCount()); },
    remove: id => { state.itemLocs[id] = 'gone'; ui.refreshInventory(); },
    place: (id, roomId) => { state.itemLocs[id] = roomId; },
    goTo: roomId => enterRoom(roomId),
    redraw: () => ui.showRoom(),
    treasureCount,
    die: msg => { state.dead = true; ui.modal('You Have Died', msg, [{ label: 'Try again', action: restart }]); },
    win: (title, msg) => { state.won = true; ui.modal(title, msg, [{ label: 'Play again', action: restart }]); },
    modal: (title, body, actions) => ui.modal(title, body, actions),
    state: () => state,
  };

  /* ---------- movement ---------- */

  function enterRoom(roomId) {
    const room = GAME.rooms[roomId];
    if (!room) return;
    state.room = roomId;
    state.visited[roomId] = true;
    ui.showRoom();
    ui.print(roomName(room), 'room-title');
    ui.print(typeof room.desc === 'function' ? room.desc(api) : room.desc);
    if (room.onEnter) room.onEnter(api);
    if (!state.dead && !state.won) listExits(room);
  }

  function roomName(room) {
    return typeof room.name === 'function' ? room.name(api) : room.name;
  }

  function openExits(room) {
    const out = {};
    for (const [dir, exit] of Object.entries(room.exits || {})) {
      if (exit.hidden && exit.hidden(api)) continue;
      out[dir] = exit;
    }
    return out;
  }

  function listExits(room) {
    const dirs = Object.keys(openExits(room));
    if (dirs.length) ui.print(`Obvious exits: ${dirs.join(', ')}.`, 'echo');
  }

  function go(dir) {
    const room = GAME.rooms[state.room];
    const exit = openExits(room)[dir];
    if (!exit) { ui.print("It's impossible to go that way.", 'echo'); return; }
    if (exit.blocked && exit.blocked(api)) return; // blocked() prints (or kills) on its own
    if (exit.onUse) { exit.onUse(api); return; }
    enterRoom(exit.to);
  }

  function goNamed(noun) {
    // GO STAIRS / GO POOL / GO LADDER — exits declare via: ['stairs']
    const room = GAME.rooms[state.room];
    for (const [dir, exit] of Object.entries(openExits(room))) {
      if ((exit.via || []).some(v => noun.startsWith(v) || v.startsWith(noun))) { go(dir); return true; }
    }
    return false;
  }

  /* ---------- object lookup ---------- */

  function nameOf(thing) {
    const n = typeof thing.name === 'function' ? thing.name(api) : thing.name;
    return n || '';
  }

  function findThing(noun) {
    if (!noun) return null;
    noun = noun.toLowerCase().replace(/^\*|\*$/g, '');
    const room = GAME.rooms[state.room];
    const candidates = [];
    for (const [id, item] of Object.entries(GAME.items)) {
      const loc = state.itemLocs[id];
      if (loc !== state.room && loc !== 'inv') continue;
      candidates.push({ kind: 'item', id, item, thing: item });
    }
    for (const p of room.props || []) {
      if (!p.id || (p.hidden && p.hidden(api))) continue;
      candidates.push({ kind: 'prop', id: p.id, prop: p, thing: p });
    }
    // Tier 1: exact id or word-list match (most specific wins)
    for (const c of candidates) {
      if (c.id === noun || (c.thing.words || []).some(w => w === noun || w.startsWith(noun) || noun.startsWith(w))) return c;
    }
    // Tier 2: display-name substring
    for (const c of candidates) {
      if (nameOf(c.thing).toLowerCase().includes(noun)) return c;
    }
    return null;
  }

  /* ---------- verbs ---------- */

  function doTake(noun) {
    const t = findThing(noun);
    if (!t) { ui.print("I don't see it here.", 'echo'); return; }
    const target = t.kind === 'item' ? t.item : t.prop;
    if (target.verbs && target.verbs.take) { target.verbs.take(api); return; }
    if (t.kind === 'prop' || !t.item.portable) { ui.print('That item stays put.', 'echo'); return; }
    if (state.itemLocs[t.id] === 'inv') { ui.print('You already have it.', 'echo'); return; }
    state.itemLocs[t.id] = 'inv';
    if (t.item.treasure) {
      ui.print(`You got a treasure! (${nameOf(t.item)})`, 'good');
      ui.setScore(treasureCount());
    } else {
      ui.print(`Taken: ${nameOf(t.item)}.`, 'amber');
    }
    ui.refreshInventory();
    ui.showRoom();
    if (t.item.onTake) t.item.onTake(api);
  }

  function doDrop(noun) {
    const t = findThing(noun);
    if (!t || t.kind !== 'item' || state.itemLocs[t.id] !== 'inv') { ui.print("You aren't carrying that.", 'echo'); return; }
    if (t.item.treasure) { ui.print("Don't drop *treasures*!", 'echo'); return; }
    if (t.item.onDrop && t.item.onDrop(api) === true) { ui.refreshInventory(); ui.showRoom(); return; }
    state.itemLocs[t.id] = state.room;
    ui.print(`Dropped: ${nameOf(t.item)}.`, 'echo');
    ui.refreshInventory();
    ui.showRoom();
  }

  function doExamine(noun) {
    if (!noun) { doLook(); return; }
    const t = findThing(noun);
    if (!t) { ui.print("I don't see it here.", 'echo'); return; }
    const target = t.kind === 'item' ? t.item : t.prop;
    const desc = typeof target.desc === 'function' ? target.desc(api) : target.desc;
    ui.print(desc || 'You see nothing special.', t.kind === 'item' ? 'amber' : undefined);
    if (target.onExamine) target.onExamine(api);
  }

  function doLook() {
    const room = GAME.rooms[state.room];
    ui.print(roomName(room), 'room-title');
    ui.print(typeof room.desc === 'function' ? room.desc(api) : room.desc);
    const visible = Object.entries(state.itemLocs)
      .filter(([, loc]) => loc === state.room)
      .map(([id]) => itemLabel(id));
    if (visible.length) ui.print(`You see: ${visible.join(', ')}.`, 'amber');
    listExits(room);
  }

  function itemLabel(id) {
    const item = GAME.items[id];
    const name = typeof item.name === 'function' ? item.name(api) : item.name;
    return item.treasure ? `*${name}*` : name;
  }

  function doInventory() {
    const inv = Object.entries(state.itemLocs).filter(([, l]) => l === 'inv').map(([id]) => itemLabel(id));
    ui.print(inv.length ? `You are carrying: ${inv.join(', ')}.` : 'You are empty-handed.', 'amber');
    if (state.itemLocs.parachute === 'inv' && !state.flags.chuteFixed) ui.print('(better fix that parachute)', 'echo');
  }

  function doScore() {
    const n = treasureCount();
    ui.print(`You are carrying ${n} treasure${n === 1 ? '' : 's'}, worth ${n * 20} points. (100 possible)`, 'amber');
  }

  function doSay(word) {
    if (!word) { ui.print('Say what?', 'echo'); return; }
    if (GAME.say && GAME.say(api, word) === true) return;
    if (word === 'xyzzy') { ui.print(`A hollow voice says, 'WRONG ADVENTURE.'`, 'amber'); return; }
    ui.print(`Okay: '${word.toUpperCase()}' ... nothing happens.`, 'echo');
  }

  /* ---------- parser ---------- */

  const DIR_WORDS = {
    n: 'north', north: 'north', s: 'south', south: 'south',
    e: 'east', east: 'east', w: 'west', west: 'west',
    u: 'up', up: 'up', d: 'down', down: 'down',
  };

  const VERB_ALIAS = {
    get: 'take', grab: 'take', pick: 'take',
    slide: 'move', push: 'move', pull: 'move',
    x: 'examine', l: 'look', i: 'inventory', inv: 'inventory',
    walk: 'go', climb: 'go', enter: 'go',
    leave: 'drop',
  };

  function handle(input) {
    if (state.dead || state.won) return;
    input = input.trim().toLowerCase();
    if (!input) return;
    ui.print(`> ${input}`, 'echo');

    const words = input.split(/\s+/).filter(w => !['the', 'a', 'an', 'at', 'to', 'in', 'on', 'with', 'under'].includes(w));
    let [verb, ...rest] = words;
    verb = VERB_ALIAS[verb] || verb;
    let noun = rest.join(' ');
    if (verb === 'take') noun = noun.replace(/^up /, '');

    // game-level phrase / verb handlers first (jump, swim, magic phrases…)
    if (GAME.handlers) {
      const h = GAME.handlers[`${verb} ${noun}`.trim()] || GAME.handlers[verb];
      if (h && h(api, noun) !== false) return;
    }

    if (DIR_WORDS[verb] && !noun) { go(DIR_WORDS[verb]); return; }

    switch (verb) {
      case 'go':
        if (DIR_WORDS[noun]) { go(DIR_WORDS[noun]); return; }
        if (noun && goNamed(noun)) return;
        ui.print('Go which way?', 'echo');
        return;
      case 'look':
        if (noun) doExamine(noun); else doLook();
        return;
      case 'examine': case 'search':
        doExamine(noun); return;
      case 'take': doTake(noun); return;
      case 'drop': case 'put': doDrop(noun); return;
      case 'inventory': doInventory(); return;
      case 'score': doScore(); return;
      case 'say': doSay(noun); return;
      case 'help':
        ui.modal('How to Play', GAME.helpText, [{ label: 'Back to the mansion' }]);
        return;
      case 'quit':
        ui.print('This is the web — just close the tab. Or type SCORE to see how you stand.', 'echo');
        return;
      default: {
        // object-directed verbs defined in data: open, read, move, unlock, fill, pour, turn, fix, play…
        const t = findThing(noun);
        if (t) {
          const target = t.kind === 'item' ? t.item : t.prop;
          if (target.verbs && target.verbs[verb]) { target.verbs[verb](api); return; }
          if (verb === 'read' || verb === 'open' || verb === 'move' || verb === 'unlock' ||
              verb === 'fill' || verb === 'pour' || verb === 'turn' || verb === 'fix' || verb === 'play') {
            ui.print('I am unable to do that.', 'echo');
            return;
          }
        } else if (noun) {
          ui.print("I don't see it here.", 'echo');
          return;
        }
        ui.print(state.flags.errFlip ? "I don't understand that." : 'What?', 'echo');
        state.flags.errFlip = !state.flags.errFlip;
      }
    }
  }

  /* ---------- clicks from the scene ---------- */

  function clickHotspot(id) {
    if (state.dead || state.won) return;
    const t = lookupById(id);
    if (!t) return;
    const target = t.kind === 'item' ? t.item : t.prop;
    if (target.onClick) { target.onClick(api); return; }
    if (t.kind === 'item' && target.portable) {
      ui.print(`> take ${nameOf(target)}`, 'echo');
      doTake(t.id);
      return;
    }
    ui.print(`> examine ${nameOf(target) || id}`, 'echo');
    doExamine(t.id);
  }

  function lookupById(id) {
    if (GAME.items[id]) return { kind: 'item', id, item: GAME.items[id] };
    const p = (GAME.rooms[state.room].props || []).find(p => p.id === id);
    if (p) return { kind: 'prop', id, prop: p };
    return null;
  }

  /* ---------- lifecycle ---------- */

  function restart() {
    state = newState();
    ui.setScore(0);
    ui.refreshInventory();
    document.getElementById('log').innerHTML = '';
    enterRoom(GAME.startRoom);
  }

  function start(uiHooks) {
    ui = uiHooks;
    state = newState();
    ui.refreshInventory();
    ui.modal(GAME.title, GAME.intro, [{ label: 'Step onto the porch', action: () => enterRoom(GAME.startRoom) }]);
  }

  return { start, restart, handle, go, clickHotspot, state: () => state, api: () => api, openExits: () => openExits(GAME.rooms[state.room]) };
})();
