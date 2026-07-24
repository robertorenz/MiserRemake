/* ============================================================
   data.js — MISER game content
   Faithful reconstruction of "Miser" by M.J. Lansing,
   CURSOR magazine #27, © 1981 The Code Works — verified
   against the original PET BASIC source. 2.5D presentation.
   ============================================================ */

const RANKS = ['Beginner', 'Amateur', 'Journeyman', 'Experienced', 'Pro', 'Master', 'GRANDMASTER ADVENTURER'];

function endGame(a, escaped) {
  const n = a.treasureCount();
  const score = n * 20;
  const rank = RANKS[Math.min(n + (escaped ? 1 : 0), 6)];
  const body = `
    <p>You yank the ripcord and the 'chute comes billowing out. You land safely!</p>
    <p><em>Congratulations on escaping!</em></p>
    <p>You accumulated ${n} treasure${n === 1 ? '' : 's'}, for a score of <em>${score} points</em>. (100 possible)</p>
    <p>Your rating: <em>${rank}</em>${rank === RANKS[6] ? '' : '. Better luck next time!'}</p>`;
  a.win('You Escaped the Mansion', body);
}

/* ---------- shared puzzle bits ---------- */

function snakeBlocks(a) {
  if (a.flag('snakeCharmed')) return false;
  if (!a.flag('snakeWarned')) {
    a.flag('snakeWarned', true);
    a.print('The snake is about to attack!', 'danger');
    return true;
  }
  a.die('<p>The snake bites you!</p><p>The venom works quickly. Everything goes dark.</p>');
  return true;
}

function fillBucket(a) {
  if (!a.has('bucket')) { a.print("You aren't carrying the bucket.", 'echo'); return; }
  const room = a.state().room;
  if (room === 'back_yard' || room === 'portico') {
    a.flag('bucketFull', true);
    a.print('You fill the bucket with water.', 'amber');
  } else {
    a.print('There is no water here.', 'echo');
  }
}

function pourBucket(a) {
  if (!a.has('bucket')) { a.print("You aren't carrying the bucket.", 'echo'); return; }
  if (!a.flag('bucketFull')) { a.print('The bucket is already empty.', 'echo'); return; }
  a.flag('bucketFull', false);
  if (a.state().room === 'blue_drawing' && !a.flag('fireOut')) {
    a.flag('fireOut', true);
    a.print('Congratulations! You have vanquished the flames.', 'good');
    a.redraw();
  } else {
    a.print('The water soaks into the dusty floor. Gone.', 'echo');
  }
}

/* ============================================================ */

const GAME = {
  title: 'MISER',
  intro: `
    <p>The old miser is dead, and his vast, dust-choked mansion stands silent on
    the hill. Somewhere inside are <em>five treasures</em> he could never bear
    to spend &mdash; and stranger things he could never bear to explain.</p>
    <p>Find every treasure. Then find a way out alive.</p>
    <p>Click doors and objects in the room, or type commands like
    <kbd>get mat</kbd>, <kbd>unlock door</kbd>, <kbd>say ritnew</kbd>,
    <kbd>n</kbd>&hellip; just like 1981, only prettier.</p>
    <p class="look-title">Choose your look <em>(switch anytime up top)</em>:</p>
    <div class="look-picker" role="group" aria-label="Choose your look">
      <button type="button" class="look-opt" data-look="firstperson"><b>First-Person</b><small>step inside each room</small></button>
      <button type="button" class="look-opt" data-look="iso"><b>Isometric</b><small>angled bird&rsquo;s-eye view</small></button>
      <button type="button" class="look-opt" data-look="side"><b>Side View</b><small>cutaway, dollhouse style</small></button>
    </div>
    <p class="mast-sub"><em>Miser</em> by M.J. Lansing, CURSOR #27, &copy; 1981 The Code Works.</p>`,
  helpText: `
    <p><em>Click</em> doors to walk through them and objects to use them, or type
    two-word commands as in the original: <kbd>get</kbd>, <kbd>move</kbd>,
    <kbd>open</kbd>, <kbd>read</kbd>, <kbd>drop</kbd>, <kbd>say</kbd>,
    <kbd>pour</kbd>, <kbd>fill</kbd>, <kbd>unlock</kbd>, <kbd>turn</kbd>,
    <kbd>jump</kbd>, <kbd>swim</kbd>, <kbd>fix</kbd>, <kbd>score</kbd>,
    <kbd>i</kbd>nventory, and the compass: <kbd>n s e w</kbd>.</p>
    <p>There are five treasures worth 20 points each. Treasures cannot be
    dropped &mdash; find them all, then <em>escape</em> for the highest rank.</p>
    <p>Listen to what the house tells you. Read everything. Mind the snake.</p>`,
  startRoom: 'front_porch',
  treasureGoal: 5,

  /* ---------------- rooms ---------------- */

  rooms: {

    front_porch: {
      name: 'Front Porch',
      desc: 'You stand on the sagging front porch of the miser’s mansion. A heavy oak door bars the way north. A worn mat lies at your feet.',
      shell: { wall: '#38302a', back: '#443a32', floor: '#2c2620', ceil: '#1d1815' },
      exits: {
        north: {
          to: 'foyer', label: 'The heavy front door', u: 0,
          blocked: a => {
            if (a.flag('doorUnlocked')) return false;
            if (a.has('key')) {
              a.flag('doorUnlocked', true);
              a.print('The key fits. The door easily unlocks and swings open.', 'good');
              return false;
            }
            a.print('The heavy front door is locked.', 'echo');
            if (!a.flag('matMoved')) a.print('That mat has an odd lump under it…', 'echo');
            return true;
          },
        },
      },
      props: [
        { type: 'mat', on: 'floor', u: 0, t: 0.8, scale: 1.7, id: 'mat', name: 'worn mat', words: ['mat', 'doormat'],
          desc: 'A worn welcome mat. Nobody has been welcome here for years.',
          onClick: a => { a.print('> move mat', 'echo'); GAME.rooms.front_porch.props[0].verbs.move(a); },
          verbs: {
            move: a => {
              if (a.flag('matMoved')) { a.print('Nothing else under it but dust.', 'echo'); return; }
              a.flag('matMoved', true);
              a.place('key', 'front_porch');
              a.print('You find a door key!', 'good');
              a.redraw();
            },
            take: a => GAME.rooms.front_porch.props[0].verbs.move(a),
          } },
        { type: 'window', on: 'wall', u: -0.62, id: 'porchwindow', name: 'grimy window', words: ['window'],
          desc: 'Too grimy to see through. Something might have moved inside. Or not.' },
        { type: 'plant', on: 'floor', u: -0.8, t: 0.55, id: 'shrub', name: 'dead shrub', words: ['shrub', 'plant', 'bush'],
          desc: 'Even the plants gave up on this place.' },
        { type: 'door', on: 'wall', u: 0, id: 'frontdoor', name: 'front door', words: ['door'], scale: 0,
          desc: 'A heavy oak door with a sturdy brass lock.',
          verbs: {
            open: a => {
              if (a.flag('doorUnlocked')) a.print('It stands open. North lies the foyer.', 'echo');
              else a.print('The heavy front door is locked.', 'echo');
            },
            unlock: a => {
              if (a.flag('doorUnlocked')) { a.print('It is already unlocked.', 'echo'); return; }
              if (!a.has('key')) { a.print('You have nothing to unlock it with.', 'echo'); return; }
              a.flag('doorUnlocked', true);
              a.print('The door easily unlocks and swings open.', 'good');
            },
          } },
      ],
    },

    foyer: {
      name: 'Foyer',
      desc: 'You are in the foyer of a large house. Dust is everywhere.',
      shell: { wall: '#4a3b2a', back: '#544433', floor: '#33261a' },
      onEnter: a => {
        if (!a.flag('doorSlammed')) {
          a.flag('doorSlammed', true);
          a.print('The door slams shut behind you! It will not budge. You will have to find another way out.', 'danger');
        }
      },
      exits: {
        north: { to: 'great_hall', label: 'North to the great hall' },
        west: { to: 'dining_room', label: 'West to the dining room' },
      },
      props: [
        { type: 'candle', on: 'floor', u: 0.72, t: 0.5, id: 'candlestand', name: 'candle stand', words: ['candle'],
          desc: 'A guttering candle. Odd — who lit it?' },
        { type: 'rug', on: 'floor', u: -0.1, t: 0.6, id: 'foyerrug', name: 'dusty rug', words: ['rug'],
          desc: 'Dust rises in a small grey cloud when you nudge it. Nothing underneath.' },
      ],
    },

    great_hall: {
      name: 'Great Hall',
      desc: 'You are in the great hall. Suits of armor line the walls. A majestic staircase leads up.',
      shell: { wall: '#44392c', back: '#4e4436', floor: '#302519' },
      exits: {
        north: { to: 'breakfast_room', label: 'North to the breakfast room', u: -0.55 },
        south: { to: 'foyer', label: 'Back to the foyer' },
        up: {
          to: 'west_hallway', label: 'The majestic staircase', via: ['stairs', 'staircase', 'upstairs'], u: 0.5,
          blocked: a => {
            if (a.has('sword')) {
              a.print('The suits of armor try to stop you, but you fight them off with your sword!', 'good');
              return false;
            }
            a.print('The suits of armor prevent you from going up!', 'danger');
            return true;
          },
        },
      },
      props: [
        { type: 'armor', on: 'floor', u: -0.85, t: 0.45, id: 'armor', name: 'suit of armor', words: ['armor', 'suits'],
          desc: 'Ancient suits of armor. They seem to be watching the staircase. And you.' },
        { type: 'armor', on: 'floor', u: 0.9, t: 0.35, scale: 1.1 },
      ],
    },

    breakfast_room: {
      name: 'Breakfast Room',
      desc: 'You are in the breakfast room. It is bright and cheery.',
      facing: 'south',
      shell: { wall: '#54503a', back: '#5e5a44', floor: '#38321f', ceil: '#2a2718' },
      exits: {
        south: { to: 'great_hall', label: 'South to the great hall' },
        east: { to: 'conservatory', label: 'East to the conservatory' },
        west: { to: 'pantry', label: 'West to the pantry' },
      },
      props: [
        { type: 'table', on: 'floor', u: 0, t: 0.65, id: 'table', name: 'breakfast table', words: ['table'],
          desc: 'Set for a breakfast that was never eaten.' },
        { type: 'window', on: 'wall', u: 0.55, id: 'bwindow', name: 'sunny window', words: ['window'],
          desc: 'Somehow the light in here is bright and cheery. The house is trying too hard.' },
      ],
    },

    conservatory: {
      name: 'Conservatory',
      desc: a => `You are in the conservatory. Through a window you see a hedge-maze.${a.flag('snakeCharmed') ? ' A charmed snake sways peacefully in the corner.' : ' A VICIOUS SNAKE coils between you and the doors south and east!'}`,
      facing: 'south',
      shell: { wall: '#3c4a34', back: '#46543c', floor: '#2c331f' },
      exits: {
        south: { to: 'red_room', label: 'South to the red-walled room', blocked: snakeBlocks },
        east: { to: 'green_drawing', label: 'East to the green drawing room', blocked: snakeBlocks },
        west: { to: 'breakfast_room', label: 'West to the breakfast room' },
      },
      props: [
        { type: 'snake', on: 'floor', u: 0.15, t: 0.78, id: 'snake', name: a => a.flag('snakeCharmed') ? 'charmed snake' : 'vicious snake', words: ['snake'],
          desc: a => a.flag('snakeCharmed')
            ? 'The snake sways gently, utterly charmed. It bears you no ill will.'
            : 'A vicious snake, coiled and ready. It guards the south and east doors. Perhaps some charming words would help.',
          onClick: a => { a.print('> examine snake', 'echo'); a.print(a.flag('snakeCharmed') ? 'The snake sways gently, utterly charmed.' : 'A vicious snake! It guards the south and east doors. Perhaps some charming words would help.', 'amber'); } },
        { type: 'window', on: 'wall', u: -0.55, id: 'cwindow', name: 'window onto the hedge-maze', words: ['window', 'maze'],
          desc: 'Through the glass you can see a great hedge-maze in the grounds behind the house.' },
        { type: 'plant', on: 'floor', u: -0.85, t: 0.5, id: 'ferns', name: 'overgrown ferns', words: ['fern', 'ferns'],
          desc: 'The only living things in the house that are thriving.' },
      ],
    },

    red_room: {
      name: 'Red-Walled Room',
      desc: 'You are in the red-walled room. A cabinet on rollers stands against one wall… over here.',
      facing: 'east',
      shell: { wall: '#5a2c24', back: '#66362c', floor: '#33261a' },
      exits: {
        north: { to: 'conservatory', label: 'North to the conservatory' },
        south: { to: 'parlor', label: 'South to the formal parlor' },
        east: { to: 'vault_room', label: 'Into the vault', hidden: a => !a.flag('vaultOpen'), style: 'portal', u: 0.55 },
      },
      props: [
        { type: 'cabinet', on: 'floor', id: 'cabinet', name: 'cabinet on rollers', words: ['cabinet'],
          hidden: a => a.flag('cabinetMoved'),
          u: 0.1, t: 0.9, scale: 1.05,
          desc: 'A tall cabinet on small brass rollers. Rollers. As if someone meant it to be moved.',
          onClick: a => { a.print('> open cabinet', 'echo'); GAME.rooms.red_room.propById('cabinet').verbs.open(a); },
          verbs: {
            open: a => {
              a.print("It is empty and dusty. Words are scribbled in the dust on a shelf: 'BEHIND ME'.", 'amber');
            },
            move: a => {
              if (a.flag('cabinetMoved')) return;
              a.flag('cabinetMoved', true);
              a.print('Behind the cabinet is a VAULT!', 'good');
              a.redraw();
            },
          } },
        { type: 'vaultDoor', on: 'floor', u: 0.1, t: 0.92, id: 'vault', name: 'vault', words: ['vault', 'safe', 'dial'],
          hidden: a => !a.flag('cabinetMoved') || a.flag('vaultOpen'),
          desc: 'A walk-in vault with a heavy combination dial.',
          onClick: a => { a.print('> unlock vault', 'echo'); GAME.rooms.red_room.propById('vault').verbs.unlock(a); },
          verbs: {
            open: a => GAME.rooms.red_room.propById('vault').verbs.unlock(a),
            unlock: a => {
              if (!a.flag('paperRead')) { a.print("I don't know the combination.", 'echo'); return; }
              a.flag('vaultOpen', true);
              a.print("OK, let's see. 12…35…6… <CLICK!> The door swings open.", 'good');
              a.redraw();
            },
          } },
      ],
      propById(id) { return this.props.find(p => p.id === id); },
    },

    vault_room: {
      name: 'Walk-In Vault',
      desc: 'You are inside the walk-in vault. The air is stale and smells of old money.',
      facing: 'east',
      shell: { wall: '#3f4348', back: '#4b4f55', floor: '#2b2e32', ceil: '#25282c' },
      exits: {
        west: { to: 'red_room', label: 'Out of the vault' },
      },
      props: [],
    },

    parlor: {
      name: 'Formal Parlor',
      desc: 'You are in the formal parlor. An oriental rug lies in the middle of the floor.',
      shell: { wall: '#3d3226', back: '#4a4033', floor: '#2e241a' },
      exits: {
        north: { to: 'red_room', label: 'North to the red-walled room' },
        east: { to: 'blue_drawing', label: 'East to the blue drawing room' },
      },
      props: [
        { type: 'sofa', on: 'floor', u: -0.7, t: 0.55, id: 'sofa', name: 'stately sofa', words: ['sofa', 'couch'],
          desc: 'Formal, stiff, and deeply uncomfortable even to look at.' },
        { type: 'rug', on: 'floor', u: 0.15, t: 0.72, id: 'rug', name: 'oriental rug', words: ['rug', 'carpet'],
          hidden: a => a.flag('rugMoved'),
          desc: 'A fine oriental rug — oddly fine for a man who spent nothing. It sits exactly in the middle of the floor.',
          onClick: a => { a.print('> move rug', 'echo'); GAME.rooms.parlor.props[1].verbs.move(a); },
          verbs: {
            move: a => {
              if (a.flag('rugMoved')) return;
              a.flag('rugMoved', true);
              a.print("You find a trap door! It is marked 'DANGER'.", 'amber');
              a.redraw();
            },
          } },
        { type: 'trapdoor', on: 'floor', u: 0.15, t: 0.72, id: 'trapdoor', name: 'trap door marked ‘DANGER’', words: ['trapdoor', 'trap', 'door'],
          hidden: a => !a.flag('rugMoved'),
          desc: "A trap door set into the floor, stencilled 'DANGER'. It has no lock.",
          onClick: a => { a.print('> open trapdoor', 'echo'); GAME.rooms.parlor.props[2].verbs.open(a); },
          verbs: {
            open: a => {
              a.print('You open the door. You lean over to peer in, and… YOU FALL IN!', 'danger');
              a.goTo('dungeon');
            },
          } },
      ],
    },

    green_drawing: {
      name: 'Green Drawing Room',
      desc: 'You are in the green drawing room.',
      facing: 'east',
      shell: { wall: '#36442e', back: '#405038', floor: '#2a3320' },
      exits: {
        east: { to: 'trophy_room', label: 'East to the trophy room' },
        west: { to: 'conservatory', label: 'West to the conservatory' },
      },
      props: [
        { type: 'sofa', on: 'floor', u: -0.55, t: 0.6, id: 'chaise', name: 'green chaise', words: ['chaise', 'sofa'],
          desc: 'Green velvet, faded to the color of pond water.' },
        { type: 'painting', on: 'wall', u: 0.5, id: 'gpainting', name: 'gloomy landscape', words: ['painting', 'picture'],
          desc: 'A gloomy landscape. Not the rare one, sadly — the miser kept that elsewhere.' },
      ],
    },

    trophy_room: {
      name: 'Trophy Room',
      desc: a => `You are in the trophy room. Animal heads line the walls.${a.flag('portalOpen') ? ' A portal stands open in the north wall!' : ' Row upon row of prizes — a room that celebrates winning.'}`,
      shell: { wall: '#463527', back: '#503f2f', floor: '#33261a' },
      exits: {
        north: { to: 'game_room', label: 'Through the portal', hidden: a => !a.flag('portalOpen'), style: 'portal' },
        south: { to: 'den', label: 'South to the den' },
        west: { to: 'green_drawing', label: 'West to the green drawing room' },
      },
      props: [
        { type: 'painting', on: 'wall', u: -0.6, id: 'heads', name: 'mounted animal heads', words: ['head', 'heads', 'trophy', 'trophies', 'animal'],
          desc: 'Glass eyes everywhere. Every one of them a victory over something. A prize-winning sort of room.' },
      ],
    },

    den: {
      name: 'Den',
      desc: 'You are in the den.',
      shell: { wall: '#40332a', back: '#4a3d32', floor: '#2e241a' },
      exits: {
        north: { to: 'trophy_room', label: 'North to the trophy room' },
        west: { to: 'blue_drawing', label: 'West to the blue drawing room' },
      },
      props: [
        { type: 'fireplace', on: 'wall', u: 0.4, id: 'denfire', name: 'cold fireplace', words: ['fireplace'],
          desc: 'Cold ashes. The miser burned twigs, one at a time, to save money.' },
        { type: 'sofa', on: 'floor', u: -0.6, t: 0.6, id: 'armchair', name: 'worn armchair', words: ['chair', 'armchair'],
          desc: 'The seat where a rich man sat and counted other ways to be poor.' },
      ],
    },

    blue_drawing: {
      name: 'Blue Drawing Room',
      desc: a => `You are in the blue drawing room.${a.flag('fireOut') ? ' Steam rises from the scorched south doorway.' : ' There is a HOT FIRE on the south wall! If you go that way you’ll burn to death!'}`,
      facing: 'south',
      shell: { wall: '#2c3a4a', back: '#344455', floor: '#242c36' },
      exits: {
        south: {
          to: 'library', label: 'South to the library',
          blocked: a => {
            if (a.flag('fireOut')) return false;
            a.die('<p>You stride into the flames.</p><p>You have burnt to a crisp!</p>');
            return true;
          },
        },
        east: { to: 'den', label: 'East to the den' },
        west: { to: 'parlor', label: 'West to the formal parlor' },
      },
      props: [
        { type: 'fireWall', on: 'wall', u: 0, scale: 1.4, id: 'fire', name: 'roaring fire', words: ['fire', 'flames'],
          hidden: a => a.flag('fireOut'),
          desc: 'A wall of flame blocks the south doorway. Water would help. A bucket of it, say.' },
        { type: 'sofa', on: 'floor', u: -0.65, t: 0.5, id: 'bluesofa', name: 'blue divan', words: ['divan', 'sofa'],
          desc: 'Silk the color of a drowned sky.' },
      ],
    },

    library: {
      name: 'Library',
      desc: 'You are in the library. Empty shelves line the walls.',
      shell: { wall: '#3a2f22', back: '#443930', floor: '#2c231a' },
      exits: {
        north: { to: 'blue_drawing', label: 'North to the blue drawing room' },
      },
      props: [
        { type: 'bookshelf', on: 'floor', u: -0.8, t: 0.55, id: 'shelves', name: 'empty shelves', words: ['shelf', 'shelves'],
          desc: 'He sold every book but one. Guess which one survived.' },
        { type: 'bookshelf', on: 'floor', u: 0.85, t: 0.45 },
      ],
    },

    dining_room: {
      name: 'Dining Room',
      desc: 'You are in the dining room.',
      facing: 'west',
      shell: { wall: '#42362a', back: '#4c4034', floor: '#30261c' },
      exits: {
        east: { to: 'foyer', label: 'East to the foyer' },
        west: { to: 'chinese_room', label: 'West to the Chinese room' },
      },
      props: [
        { type: 'table', on: 'floor', u: 0, t: 0.6, scale: 1.5, id: 'diningtable', name: 'long dining table', words: ['table'],
          desc: 'Twenty chairs. He dined alone at the far end, in the dark, to save candles.' },
        { type: 'candle', on: 'floor', u: 0.75, t: 0.45, id: 'candelabra', name: 'candelabra', words: ['candelabra', 'candle'],
          desc: 'One candle in a holder built for twelve.' },
      ],
    },

    chinese_room: {
      name: 'Chinese Room',
      desc: 'You are in the Chinese room, papered in faded red silk.',
      shell: { wall: '#5c3028', back: '#683a30', floor: '#332018' },
      exits: {
        north: { to: 'kitchen', label: 'North to the kitchen' },
        east: { to: 'dining_room', label: 'East to the dining room' },
      },
      props: [
        { type: 'painting', on: 'wall', u: 0.55, id: 'silkscreen', name: 'silk screen', words: ['screen', 'silk'],
          desc: 'Painted cranes rising through gold mist. Beautiful — and worthless. He checked.' },
      ],
    },

    kitchen: {
      name: 'Kitchen',
      desc: 'You are in the kitchen. It is bare.',
      shell: { wall: '#4a453a', back: '#545044', floor: '#33302a' },
      exits: {
        north: { to: 'back_yard', label: 'North door to the back yard' },
        south: { to: 'chinese_room', label: 'South to the Chinese room' },
        east: { to: 'pantry', label: 'East to the pantry' },
      },
      props: [
        { type: 'table', on: 'floor', u: -0.55, t: 0.6, id: 'block', name: 'butcher’s block', words: ['block', 'table'],
          desc: 'Scarred and bare. Not so much as a crumb.' },
      ],
    },

    pantry: {
      name: 'Pantry',
      desc: 'You are in the pantry. Dust covers the mahogany shelves.',
      facing: 'east',
      shell: { wall: '#3e332a', back: '#483d32', floor: '#2e2820' },
      onEnter: a => {
        a.print("A rich, full voice says: 'RITNEW is a charming word.'", 'amber');
      },
      exits: {
        east: { to: 'breakfast_room', label: 'East to the breakfast room' },
        west: { to: 'kitchen', label: 'West to the kitchen' },
      },
      props: [
        { type: 'cabinet', on: 'floor', u: -0.7, t: 0.6, id: 'pshelves', name: 'mahogany shelves', words: ['shelf', 'shelves'],
          desc: 'Mahogany shelving, empty but for dust. The voice seems to come from everywhere and nowhere.' },
      ],
    },

    /* ---- the sealed south-east wing (via the portal) ---- */

    game_room: {
      name: 'Game Room',
      desc: 'You are in the game room.',
      facing: 'west',
      shell: { wall: '#35402e', back: '#3f4a38', floor: '#282f1e' },
      exits: {
        south: { to: 'trophy_room', label: 'South through the portal', style: 'portal' },
        west: { to: 'smoking_room', label: 'West to the smoking room' },
      },
      props: [
        { type: 'table', on: 'floor', u: 0.1, t: 0.68, scale: 1.4, id: 'billiards', name: 'billiard table', words: ['billiard', 'billiards', 'table'],
          desc: 'Moth-eaten green baize. The balls are long gone — sold, no doubt.' },
      ],
    },

    smoking_room: {
      name: 'Smoking Room',
      desc: 'You are in the smoking room. The air is stale in here.',
      shell: { wall: '#3c342c', back: '#463e36', floor: '#2c261e' },
      exits: {
        north: { to: 'ballroom', label: 'North to the ballroom' },
        east: { to: 'game_room', label: 'East to the game room' },
        west: { to: 'portico', label: 'West to the portico' },
      },
      props: [
        { type: 'sofa', on: 'floor', u: 0.55, t: 0.6, id: 'smokingchair', name: 'leather chair', words: ['chair'],
          desc: 'Cracked leather, gone grey with old smoke.' },
        { type: 'fireplace', on: 'wall', u: -0.5, id: 'smokefire', name: 'sooty fireplace', words: ['fireplace'],
          desc: 'The soot in here never settled. The air is stale and close.' },
      ],
    },

    portico: {
      name: 'Portico',
      desc: 'You are in the portico. A murky pool glimmers on the south side. A sign stands beside it.',
      shell: { kind: 'outdoor', floor: '#2a2e22', silhouette: true },
      exits: {
        north: { to: 'ballroom', label: 'North to the ballroom', style: 'arch' },
        east: { to: 'smoking_room', label: 'East to the smoking room', style: 'arch' },
        west: { to: 'hall_mirrors', label: 'West to the hall of mirrors', style: 'arch' },
      },
      props: [
        { type: 'murkyPool', on: 'floor', u: 0.35, t: 0.8, id: 'murkypool', name: 'murky pool', words: ['pool', 'water'],
          desc: "Murky water, only a few inches deep. Coins wink faintly at the bottom. The sign says to drop one." },
        { type: 'sign', on: 'floor', u: -0.55, t: 0.65, id: 'sign', name: 'sign', words: ['sign'],
          desc: "The sign reads: 'DROP COINS FOR LUCK'.",
          verbs: { read: a => a.print("The sign reads: 'DROP COINS FOR LUCK'.", 'amber') } },
      ],
    },

    hall_mirrors: {
      name: 'Hall of Mirrors',
      desc: 'You are in the hall of mirrors — a good place to reflect. Doorways shimmer in every direction, and none of them are quite where they seem.',
      shell: { wall: '#333840', back: '#3d434c', floor: '#26292e' },
      exits: {
        north: { to: 'ballroom', label: 'A shimmering doorway' },
        south: { to: 'ballroom', label: 'A shimmering doorway' },
        east: { to: 'portico', label: 'A shimmering doorway' },
        west: { to: 'portico', label: 'A shimmering doorway' },
      },
      props: [
        { type: 'mirror', on: 'floor', u: -0.85, t: 0.5, id: 'mirror1', name: 'tall mirror', words: ['mirror', 'mirrors'],
          desc: 'You, lit by candlelight, looking slightly lost. North and south both lead one way here; east and west another.' },
        { type: 'mirror', on: 'floor', u: 0.9, t: 0.42 },
        { type: 'mirror', on: 'floor', u: 0.55, t: 0.75 },
      ],
    },

    ballroom: {
      name: 'Ballroom',
      desc: a => `You are in the ballroom. It has a beautiful wood dance floor. ${a.flag('crossDropped') ? 'A closed organ plays music in the corner, all by itself.' : 'An organ stands silent in the corner.'}`,
      facing: 'east',
      shell: { wall: '#4a3d28', back: '#544732', floor: '#403118' },
      exits: {
        south: { to: 'portico', label: 'South to the portico' },
        west: { to: 'hall_mirrors', label: 'West to the hall of mirrors' },
        east: { to: 'chapel', label: 'East to the chapel', hidden: a => !a.flag('pennyDropped'), u: 0.55 },
      },
      props: [
        { type: 'organ', on: 'floor', u: -0.55, t: 0.85, id: 'organ', name: a => a.flag('crossDropped') ? 'organ, playing by itself' : 'silent organ', words: ['organ'],
          desc: a => a.flag('crossDropped')
            ? (a.flag('organOpened') ? 'The organ plays on, softly. Its lid stands open and empty now.' : 'The organ is playing with no one at the keys. Its lid seems looser than before.')
            : 'A grand old pipe organ. Its lid is stuck fast, as if sealed by something more than rust.',
          onClick: a => { a.print('> open organ', 'echo'); GAME.rooms.ballroom.props[0].verbs.open(a); },
          verbs: {
            open: a => {
              if (!a.flag('crossDropped')) { a.print("It's stuck shut.", 'echo'); return; }
              if (a.flag('organOpened')) { a.print('It stands open and empty.', 'echo'); return; }
              a.flag('organOpened', true);
              a.place('slippers', 'ballroom');
              a.place('ripcord', 'ballroom');
              a.print('As you open it, several objects suddenly appear!', 'good');
              a.redraw();
            },
            play: a => a.print(a.flag('crossDropped') ? 'It is already playing itself, better than you ever could.' : 'The keys will not press. Stuck — all of it.', 'echo'),
          } },
      ],
    },

    chapel: {
      name: 'Chapel',
      desc: a => a.flag('crossDropped')
        ? 'You are in the chapel. It is quiet and calm, and faint organ music drifts in from the ballroom.'
        : "You are in the chapel. A stone tablet says: DROP A RELIGOUS ITEM OR DIE !!",
      facing: 'east',
      shell: { wall: '#3a3630', back: '#44403a', floor: '#2a2724', ceil: '#211e1b' },
      exits: {
        west: { to: 'ballroom', label: 'West to the ballroom' },
      },
      props: [
        { type: 'tablet', on: 'floor', u: 0.1, t: 0.85, id: 'tablet', name: 'stone tablet', words: ['tablet', 'stone'],
          hidden: a => a.flag('crossDropped'),
          desc: "The tablet reads, in crude letters: 'DROP A RELIGOUS ITEM OR DIE !!' (Whoever carved it could not spell. Perhaps they could still kill.)",
          verbs: { read: a => a.print("'DROP A RELIGOUS ITEM OR DIE !!'", 'danger') } },
        { type: 'candle', on: 'floor', u: -0.7, t: 0.55, id: 'votives', name: 'votive candles', words: ['candles', 'votive'],
          desc: 'Stubs of candles, lit by no one.' },
      ],
    },

    /* ---- grounds ---- */

    back_yard: {
      name: 'Back Yard',
      desc: 'You are in the back yard. A leaky faucet drips against the house wall. The forest looms north, the hedge-maze east, the pool area west.',
      shell: { kind: 'outdoor', floor: '#28301e', silhouette: false },
      exits: {
        north: { to: 'forest', label: 'North into the forest', style: 'arch' },
        south: { to: 'kitchen', label: 'South into the kitchen', style: 'door' },
        east: { to: 'maze_a', label: 'East into the hedge-maze', style: 'arch' },
        west: { to: 'pool_area', label: 'West to the pool area', style: 'arch' },
      },
      props: [
        { type: 'faucet', on: 'floor', u: -0.35, t: 0.55, id: 'faucet', name: 'leaky faucet', words: ['faucet', 'tap', 'water'],
          desc: 'A leaky garden faucet, dripping steadily. Good for filling things.' },
        { type: 'plant', on: 'floor', u: 0.8, t: 0.5, id: 'weeds', name: 'weeds', words: ['weeds'],
          desc: 'Knee-high and victorious.' },
      ],
    },

    forest: {
      name: 'Forest',
      desc: 'You are in the forest. The trees all look the same in every direction… except south, where lamplight glints from the house.',
      shell: { kind: 'hedge', wall: '#1f2b1a', floor: '#232a19' },
      exits: {
        north: { to: 'forest', label: 'Deeper into the forest', style: 'arch' },
        south: { to: 'back_yard', label: 'South toward the house', style: 'arch' },
        east: { to: 'forest', label: 'Deeper into the forest', style: 'arch' },
        west: { to: 'forest', label: 'Deeper into the forest', style: 'arch' },
      },
      props: [
        { type: 'plant', on: 'floor', u: -0.6, t: 0.6, scale: 1.6 },
        { type: 'plant', on: 'floor', u: 0.7, t: 0.45, scale: 1.3 },
      ],
    },

    pool_area: {
      name: 'Pool Area',
      desc: a => a.flag('poolDrained')
        ? 'You are in the pool area. The great pool stands empty. I see something SHINY at the bottom of the pool!'
        : 'You are in the pool area. There is a large swimming pool here — full of LIQUID MERCURY!',
      shell: { kind: 'outdoor', floor: '#2a2e26', silhouette: true },
      exits: {
        north: { to: 'pump_house', label: 'North to the pump house', style: 'door' },
        east: { to: 'back_yard', label: 'East to the back yard', style: 'arch' },
        down: { to: 'pool_bottom', label: 'Climb down into the empty pool', via: ['pool', 'ladder'], style: 'stairs-down', u: 0.6,
          hidden: a => !a.flag('poolDrained') },
      },
      props: [
        { type: 'poolMercury', on: 'floor', u: 0, t: 0.7, id: 'pool', name: 'pool of liquid mercury', words: ['pool', 'mercury'],
          hidden: a => a.flag('poolDrained'),
          desc: 'A full-size swimming pool brimming with quicksilver. Swimming is out of the question. Where there is a pool, there is a pump.' },
        { type: 'poolEmpty', on: 'floor', u: 0, t: 0.7, id: 'emptypool', name: 'empty pool', words: ['pool'],
          hidden: a => !a.flag('poolDrained'),
          desc: 'Drained to the tiles. Something glitters at the deep end. A ladder leads down.',
          onClick: a => { a.print('> go pool', 'echo'); a.goTo('pool_bottom'); } },
      ],
    },

    pump_house: {
      name: 'Pump House',
      desc: 'You are in the pump house. There is pool machinery installed here, and a VALVE on one of the pipes.',
      shell: { wall: '#3a3d40', back: '#44474b', floor: '#2a2c2e', ceil: '#222426' },
      exits: {
        south: { to: 'pool_area', label: 'South to the pool area' },
      },
      props: [
        { type: 'valve', on: 'wall', u: 0, scale: 1.2, id: 'valve', name: 'valve', words: ['valve', 'pipes', 'machinery'],
          desc: 'A big red valve on the pool pipework. It looks like it wants turning. About five times.',
          onClick: a => { a.print('> turn valve', 'echo'); GAME.rooms.pump_house.props[0].verbs.turn(a); },
          verbs: {
            turn: a => {
              a.flag('poolDrained', !a.flag('poolDrained'));
              a.print('With much effort, you turn the valve 5 times. You hear the sound of liquid flowing through pipes.', 'amber');
            },
            fix: a => a.print("I ain't no plumber.", 'echo'),
          } },
      ],
    },

    pool_bottom: {
      name: 'Bottom of the Swimming Pool',
      desc: 'You are at the bottom of the swimming pool. Mercury fumes still shimmer above the tiles. A ladder leads up and out.',
      shell: { wall: '#465158', back: '#525d64', floor: '#39434a', ceil: '#1c2637' },
      exits: {
        up: { to: 'pool_area', label: 'Climb the ladder', via: ['ladder', 'out'], style: 'ladder' },
      },
      props: [],
    },

    /* ---- maze (exact original topology) ---- */

    maze_a: { // room 40
      name: 'Hedge Maze',
      desc: 'You are in the hedge maze. Walls of clipped green tower over you.',
      facing: 'south',
      shell: { kind: 'hedge' },
      exits: {
        south: { to: 'maze_c', label: 'A gap in the hedge', style: 'arch' },
        west: { to: 'maze_b', label: 'A gap in the hedge', style: 'arch' },
      },
      props: [],
    },
    maze_b: { // room 41
      name: 'Hedge Maze',
      desc: 'You are in the hedge maze. Every wall looks like every other wall.',
      shell: { kind: 'hedge' },
      exits: {
        north: { to: 'maze_e', label: 'A gap in the hedge', style: 'arch' },
        south: { to: 'maze_c', label: 'A gap in the hedge', style: 'arch' },
      },
      props: [],
    },
    maze_c: { // room 42
      name: 'Hedge Maze',
      desc: 'You are in the hedge maze. You have the uneasy feeling you have been here before.',
      shell: { kind: 'hedge' },
      exits: {
        north: { to: 'maze_b', label: 'A gap in the hedge', style: 'arch' },
        south: { to: 'maze_e', label: 'A gap in the hedge', style: 'arch' },
        east: { to: 'maze_d', label: 'A gap in the hedge', style: 'arch' },
      },
      props: [],
    },
    maze_d: { // room 43
      name: 'Hedge Maze',
      desc: 'You are in the hedge maze. Through a thin patch in the hedge you can smell the back yard.',
      shell: { kind: 'hedge' },
      exits: {
        north: { to: 'maze_b', label: 'A gap in the hedge', style: 'arch' },
        south: { to: 'back_yard', label: 'Out of the maze!', style: 'arch' },
      },
      props: [],
    },
    maze_e: { // room 44
      name: 'Hedge Maze',
      desc: 'You are in the hedge maze. The hedges here are older, taller, darker.',
      facing: 'west',
      shell: { kind: 'hedge', wall: '#212c1b' },
      exits: {
        south: { to: 'maze_c', label: 'A gap in the hedge', style: 'arch' },
        west: { to: 'maze_f', label: 'A narrow gap in the hedge', style: 'arch' },
      },
      props: [],
    },
    maze_f: { // room 45 — dead end, golden leaf
      name: 'Hedge Maze — Dead End',
      desc: 'You are in a dead end deep in the hedge maze. Something golden gleams among the leaves.',
      facing: 'west',
      shell: { kind: 'hedge', wall: '#1d2818' },
      exits: {
        east: { to: 'maze_e', label: 'Back out the narrow gap', style: 'arch' },
      },
      props: [],
    },

    dungeon: {
      name: 'Dungeon',
      desc: 'You are in the dungeon. There is light above, and to the south.',
      facing: 'south',
      shell: { wall: '#2c2c30', back: '#36363b', floor: '#212124', ceil: '#1a1a1d' },
      exits: {
        south: { to: 'maze_a', label: 'Toward the light, into the hedge maze', style: 'arch' },
      },
      props: [
        { type: 'candle', on: 'floor', u: -0.75, t: 0.5, id: 'dcandle', name: 'stub of candle', words: ['candle'],
          desc: 'A dying candle. Somebody has been down here. Recently.' },
      ],
    },

    /* ---- upstairs ---- */

    west_hallway: {
      name: 'Middle of the Western Hallway',
      desc: 'You are in the middle of the western hallway, at the top of the great staircase.',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        north: { to: 'junction_west', label: 'North along the hallway', u: -0.55 },
        east: { to: 'master_bedroom', label: 'East to the master bedroom' },
        west: { to: 'west_bedroom', label: 'West to the west bedroom' },
        down: { to: 'great_hall', label: 'Down the majestic staircase', via: ['stairs', 'staircase', 'downstairs'], u: 0.5 },
      },
      props: [
        { type: 'painting', on: 'wall', u: 0.05, scale: 0.7, id: 'hallportrait', name: 'stern portrait', words: ['portrait', 'painting'],
          desc: 'The miser himself, painted young. He looks like he begrudged the artist every brushstroke.' },
      ],
    },

    west_bedroom: {
      name: 'West Bedroom',
      desc: 'You are in the west bedroom.',
      facing: 'east',
      shell: { wall: '#3c3430', back: '#463e3a', floor: '#2c2622' },
      exits: {
        east: { to: 'west_hallway', label: 'East to the hallway' },
      },
      props: [
        { type: 'bed', on: 'floor', u: -0.55, t: 0.65, scale: 0.8, id: 'wbed', name: 'narrow bed', words: ['bed'],
          desc: 'A servant’s bed. The servants left decades ago.' },
      ],
    },

    master_bedroom: {
      name: 'Master Bedroom',
      desc: 'You are in the master bedroom. There’s a huge four-poster bed.',
      facing: 'east',
      shell: { wall: '#443226', back: '#4e3c30', floor: '#302319' },
      exits: {
        east: { to: 'east_hallway', label: 'East to the hallway' },
        west: { to: 'west_hallway', label: 'West to the hallway' },
      },
      props: [
        { type: 'bed', on: 'floor', u: -0.35, t: 0.75, scale: 1.15, id: 'bed', name: 'four-poster bed', words: ['bed'],
          desc: 'A huge four-poster. He died in it, they say, holding the ledger.' },
      ],
    },

    east_bedroom: {
      name: 'East Bedroom',
      desc: 'You are in the east bedroom.',
      shell: { wall: '#3a3630', back: '#443f38', floor: '#2a2620' },
      exits: {
        north: { to: 'closet', label: 'North to a closet' },
        west: { to: 'east_hallway', label: 'West to the hallway' },
      },
      props: [
        { type: 'bed', on: 'floor', u: 0.55, t: 0.6, scale: 0.85, id: 'ebed', name: 'guest bed', words: ['bed'],
          desc: 'A guest bed. It has never held a guest.' },
      ],
    },

    closet: {
      name: 'Closet',
      desc: 'You are in a closet. It smells of cedar and old canvas.',
      shell: { wall: '#332b22', back: '#3d352c', floor: '#26211a', ceil: '#1d1914' },
      exits: {
        south: { to: 'east_bedroom', label: 'Back out of the closet' },
      },
      props: [],
    },

    junction_west: {
      name: 'West Junction',
      desc: 'You are at the junction of the west hallway and the north-south hallway.',
      facing: 'east',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        south: { to: 'west_hallway', label: 'South along the west hallway' },
        east: { to: 'ns_hallway', label: 'East to the north-south hallway' },
      },
      props: [
        { type: 'candle', on: 'floor', u: -0.7, t: 0.5 },
      ],
    },

    ns_hallway: {
      name: 'North-South Hallway',
      desc: 'You are at the center of the north-south hallway. A cold draught blows from the north.',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        north: { to: 'rear_balcony', label: 'North to the rear balcony' },
        east: { to: 'junction_east', label: 'East junction' },
        west: { to: 'junction_west', label: 'West junction' },
      },
      props: [],
    },

    junction_east: {
      name: 'East Junction',
      desc: 'You are at the junction of the east hallway and the north-south hallway.',
      facing: 'south',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        south: { to: 'east_hallway', label: 'South along the east hallway' },
        west: { to: 'ns_hallway', label: 'West to the north-south hallway' },
      },
      props: [
        { type: 'candle', on: 'floor', u: 0.7, t: 0.5 },
      ],
    },

    east_hallway: {
      name: 'Middle of the East Hallway',
      desc: 'You are in the middle of the east hallway.',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        north: { to: 'junction_east', label: 'North along the hallway' },
        south: { to: 'east_hallway_south', label: 'South along the hallway' },
        east: { to: 'east_bedroom', label: 'East to the east bedroom' },
        west: { to: 'master_bedroom', label: 'West to the master bedroom' },
      },
      props: [],
    },

    east_hallway_south: {
      name: 'South End of the East Hallway',
      desc: 'You are at the south end of the east hallway. A glass door opens onto the front balcony.',
      facing: 'south',
      shell: { wall: '#42382c', back: '#4c4236', floor: '#2e2820' },
      exits: {
        north: { to: 'east_hallway', label: 'North along the hallway' },
        south: { to: 'front_balcony', label: 'Out to the front balcony' },
      },
      props: [],
    },

    front_balcony: {
      name: 'Front Balcony',
      desc: 'You are on the front balcony. There is a large road below — a long, long way below.',
      facing: 'south',
      shell: { kind: 'outdoor', floor: '#33302a' },
      exits: {
        north: { to: 'east_hallway_south', label: 'Back inside' },
      },
      props: [
        { type: 'railing', on: 'floor', u: 0, t: 0.95, scale: 1.1, id: 'railing', name: 'balcony railing', words: ['railing', 'road', 'below'],
          desc: 'Far below, the road out of here. If only you could fly. Or float.',
          onClick: a => { a.print('> jump', 'echo'); GAME.handlers.jump(a); } },
      ],
    },

    rear_balcony: {
      name: 'Rear Balcony',
      desc: 'You are on the rear balcony. Below you see the hedge maze, spread out like a puzzle on a table.',
      shell: { kind: 'outdoor', floor: '#33302a' },
      exits: {
        south: { to: 'ns_hallway', label: 'Back inside' },
      },
      props: [
        { type: 'railing', on: 'floor', u: 0, t: 0.95, scale: 1.1, id: 'rrailing', name: 'balcony railing', words: ['railing', 'maze', 'below'],
          desc: 'From here you can trace the whole maze: in from the yard, then West, North, West to its secret heart.',
          onClick: a => { a.print('> jump', 'echo'); GAME.handlers.jump(a); } },
      ],
    },
  },

  /* ---------------- items ---------------- */

  items: {
    key: {
      name: 'brass door key', words: ['key'], portable: true, startsIn: null,
      desc: 'A heavy brass key. It looks like a front-door sort of key.',
      prop: { type: 'itemGlint', on: 'floor', u: -0.25, t: 0.85 },
    },
    bucket: {
      name: 'plastic bucket', words: ['bucket', 'pail'], portable: true, startsIn: 'pump_house',
      desc: a => a.flag('bucketFull') ? 'The bucket is full of water.' : 'An empty plastic bucket. Cheap, like everything he bought.',
      prop: { type: 'bucket', on: 'floor', u: -0.5, t: 0.75 },
      verbs: { fill: fillBucket, pour: pourBucket },
    },
    sword: {
      name: 'sword', words: ['sword'], portable: true, startsIn: 'chinese_room',
      desc: 'An old ceremonial sword — but the edge is real. The suits of armor downstairs would respect this.',
      prop: { type: 'sword', on: 'floor', u: -0.45, t: 0.78 },
    },
    book: {
      name: 'battered book', words: ['book'], portable: true, startsIn: 'library',
      desc: 'A battered book — the only one he kept. The cover is inscribed in Greek.',
      prop: { type: 'book', on: 'floor', u: 0.15, t: 0.8 },
      verbs: {
        read: a => a.print('The cover is inscribed in Greek. Perhaps try OPENING it.', 'amber'),
        open: a => a.print("Scrawled in blood inside the front cover: 'VICTORY is a prize-winning word.'", 'amber'),
      },
    },
    paper: {
      name: 'piece of paper', words: ['paper', 'note'], portable: true, startsIn: 'master_bedroom',
      desc: 'A folded piece of paper. Worth reading, surely.',
      prop: { type: 'itemGlint', on: 'floor', u: 0.55, t: 0.8 },
      verbs: {
        read: a => {
          a.flag('paperRead', true);
          a.print("It says: '12-35-6'. Hmm… looks like a combination.", 'amber');
        },
      },
    },
    penny: {
      name: 'penny', words: ['penny', 'coin', 'coins'], portable: true, startsIn: 'west_bedroom',
      desc: 'A single penny. The miser’s entire liquid fortune, as far as you can tell.',
      prop: { type: 'itemGlint', on: 'floor', u: 0.4, t: 0.8, scale: 0.7 },
      onDrop: a => {
        if (a.state().room !== 'portico') return false;
        a.remove('penny');
        a.print('As the penny sinks below the surface of the pool, a fleeting image of a chapel with dancers outside appears…', 'good');
        a.flag('pennyDropped', true);
        return true;
      },
    },
    cross: {
      name: 'rusty cross', words: ['cross'], portable: true, startsIn: 'back_yard',
      desc: 'A rusty iron cross, half-buried in the weeds. A religious item, if anyone should ask. Or demand.',
      prop: { type: 'cross', on: 'floor', u: 0.35, t: 0.7 },
      onDrop: a => {
        if (a.state().room !== 'chapel') return false;
        a.remove('cross');
        a.flag('crossDropped', true);
        a.print('Even before it hits the ground, the cross fades away!', 'good');
        a.print('The tablet has disintegrated.', 'good');
        a.print('You hear music from the organ.', 'amber');
        a.redraw();
        return true;
      },
    },
    parachute: {
      name: a => a.flag('chuteFixed') ? 'repaired parachute' : 'parachute with no ripcord',
      words: ['parachute', 'chute'], portable: true, startsIn: 'closet',
      desc: a => a.flag('chuteFixed')
        ? 'A parachute, now with a ripcord. You are no expert, but you think it will work.'
        : 'A packed parachute… with no ripcord. Useless until fixed.',
      prop: { type: 'parachute', on: 'floor', u: 0, t: 0.75 },
      verbs: {
        fix: a => {
          if (a.flag('chuteFixed')) { a.print('It is as fixed as it is going to get.', 'echo'); return; }
          if (!a.has('ripcord')) { a.print('You need a ripcord to fix it.', 'echo'); return; }
          if (!a.has('parachute')) { a.print('Pick up the parachute first.', 'echo'); return; }
          a.flag('chuteFixed', true);
          a.remove('ripcord');
          a.print("I'm no expert, but I think it'll work.", 'good');
        },
      },
    },
    ripcord: {
      name: 'parachute ripcord', words: ['ripcord', 'cord'], portable: true, startsIn: null,
      desc: 'A parachute ripcord, missing its parachute. Somewhere there is a parachute missing its ripcord.',
      prop: { type: 'itemGlint', on: 'floor', u: -0.2, t: 0.75, scale: 0.8 },
      verbs: { fix: a => GAME.items.parachute.verbs.fix(a) },
    },
    leaf: {
      name: 'golden leaf', words: ['leaf'], portable: true, treasure: true, startsIn: 'maze_f',
      desc: 'A leaf of solid gold. Why the miser hid it in the one place he could never find it again is a question for his ghost.',
      prop: { type: 'leaf', on: 'floor', u: 0.1, t: 0.75 },
    },
    moneybag: {
      name: 'bulging moneybag', words: ['moneybag', 'bag', 'money'], portable: true, treasure: true, startsIn: 'vault_room',
      desc: 'A bulging canvas moneybag, knotted shut.',
      prop: { type: 'moneybag', on: 'floor', u: 0, t: 0.8 },
      verbs: { open: a => a.print('The bag is knotted securely. It won’t open.', 'echo') },
    },
    ring: {
      name: 'diamond ring', words: ['ring', 'diamond'], portable: true, treasure: true, startsIn: 'pool_bottom',
      desc: 'A diamond ring. It must have slipped off a rich finger, long before the mercury.',
      prop: { type: 'itemGlint', on: 'floor', u: 0.3, t: 0.8 },
    },
    rare_painting: {
      name: 'rare painting', words: ['painting', 'picture', 'art'], portable: true, treasure: true, startsIn: 'east_hallway_south',
      desc: 'A rare painting, leaning casually against the hallway wall as if it were worthless. It is not.',
      prop: { type: 'paintingLeaning', on: 'floor', u: -0.6, t: 0.8 },
    },
    slippers: {
      name: 'pair of ruby slippers', words: ['slippers', 'ruby', 'shoes'], portable: true, treasure: true, startsIn: null,
      desc: 'A pair of ruby slippers. There’s no place like home — and these might be worth more than this one.',
      prop: { type: 'slippers', on: 'floor', u: -0.4, t: 0.8 },
    },
  },

  /* ---------------- minimap ---------------- */
  /* Hand-placed coordinates (x grows east, y grows north).
     The maze and mirrors are deliberately non-euclidean in the
     original; their nodes are clustered rather than exact. */

  map: {
    layers: { ground: 'Ground Floor & Grounds', upper: 'Upstairs' },
    rooms: {
      /* Layout is direction-true: every connection's map bearing matches
         the compass direction you walk (long straight edges = corridors).
         Only the maze and the hall of mirrors cheat — as designed. */
      front_porch: { x: 0, y: -1, layer: 'ground' },
      foyer: { x: 0, y: 0, layer: 'ground' },
      dining_room: { x: -1, y: 0, layer: 'ground' },
      chinese_room: { x: -2, y: 0, layer: 'ground' },
      kitchen: { x: -2, y: 2, layer: 'ground' },
      pantry: { x: -1, y: 2, layer: 'ground' },
      great_hall: { x: 0, y: 1, layer: 'ground' },
      breakfast_room: { x: 0, y: 2, layer: 'ground' },
      conservatory: { x: 1, y: 2, layer: 'ground' },
      red_room: { x: 1, y: 1, layer: 'ground' },
      parlor: { x: 1, y: 0, layer: 'ground' },
      library: { x: 2, y: -1, layer: 'ground' },
      blue_drawing: { x: 2, y: 0, layer: 'ground' },
      vault_room: { x: 2, y: 1, layer: 'ground' },
      green_drawing: { x: 2, y: 2, layer: 'ground' },
      den: { x: 3, y: 0, layer: 'ground' },
      trophy_room: { x: 3, y: 2, layer: 'ground' },
      game_room: { x: 3, y: 3, layer: 'ground' },
      smoking_room: { x: 2, y: 3, layer: 'ground' },
      portico: { x: 1, y: 3, layer: 'ground' },
      hall_mirrors: { x: 0, y: 3, layer: 'ground' },
      ballroom: { x: 1.5, y: 4, layer: 'ground' },
      chapel: { x: 2.5, y: 4, layer: 'ground' },
      back_yard: { x: -2, y: 3, layer: 'ground' },
      forest: { x: -2, y: 4, layer: 'ground' },
      pool_area: { x: -3, y: 3, layer: 'ground' },
      pump_house: { x: -3, y: 4, layer: 'ground' },
      pool_bottom: { x: -4, y: 3, layer: 'ground' },
      maze_a: { x: -1, y: 3, layer: 'ground' },
      maze_b: { x: -1, y: 4, layer: 'ground' },
      maze_c: { x: -1, y: 5, layer: 'ground' },
      maze_d: { x: 0, y: 5, layer: 'ground' },
      maze_e: { x: -2, y: 5, layer: 'ground' },
      maze_f: { x: -3, y: 5, layer: 'ground' },
      dungeon: { x: 0, y: 6, layer: 'ground' },

      front_balcony: { x: 3, y: 0, layer: 'upper' },
      east_hallway_south: { x: 3, y: 1, layer: 'upper' },
      east_hallway: { x: 3, y: 2, layer: 'upper' },
      east_bedroom: { x: 4, y: 2, layer: 'upper' },
      closet: { x: 4, y: 3, layer: 'upper' },
      master_bedroom: { x: 2, y: 2, layer: 'upper' },
      west_hallway: { x: 1, y: 2, layer: 'upper' },
      west_bedroom: { x: 0, y: 2, layer: 'upper' },
      junction_west: { x: 1, y: 3, layer: 'upper' },
      ns_hallway: { x: 2, y: 3, layer: 'upper' },
      junction_east: { x: 3, y: 3, layer: 'upper' },
      rear_balcony: { x: 2, y: 4, layer: 'upper' },
    },
  },

  /* ---------------- magic words ---------------- */

  say(a, word) {
    if (word === 'ritnew') {
      if (a.flag('snakeCharmed')) { a.print('The snake is already quite charmed, thank you.', 'echo'); return true; }
      a.flag('snakeCharmed', true);
      a.print('The snake is charmed by the very utterance of your words.', 'good');
      if (a.state().room === 'conservatory') a.redraw();
      return true;
    }
    if (word === 'victory') {
      if (a.flag('portalOpen')) { a.print('The portal is already open.', 'echo'); return true; }
      a.flag('portalOpen', true);
      a.print('A PORTAL has opened in the north wall of the trophy room!!', 'good');
      if (a.state().room === 'trophy_room') a.redraw();
      return true;
    }
    return false;
  },

  /* ---------------- global verbs ---------------- */

  handlers: {
    jump: a => {
      const room = a.state().room;
      if (room === 'front_balcony') {
        if (a.has('parachute') && a.flag('chuteFixed')) { endGame(a, true); return; }
        if (a.has('parachute')) a.print('There is no way to open the parachute!', 'danger');
        a.die('<p>The road rushes up to meet you.</p><p>You have broken your neck! You are dead.</p>');
        return;
      }
      if (room === 'rear_balcony') {
        if (a.has('parachute') && a.flag('chuteFixed')) {
          a.print("You yank the ripcord and the 'chute comes billowing out. You drift down… into the hedge maze.", 'amber');
          a.goTo('maze_a');
          return;
        }
        if (a.has('parachute')) a.print('There is no way to open the parachute!', 'danger');
        a.die('<p>The hedges do not break your fall.</p><p>You have broken your neck! You are dead.</p>');
        return;
      }
      if (room === 'west_hallway') {
        if (!a.flag('jumpedStairs')) {
          a.flag('jumpedStairs', true);
          a.print('You leap down the staircase and narrowly escape serious injury. PLEASE don’t try it again.', 'danger');
          a.goTo('great_hall');
          return;
        }
        a.die('<p>You were warned.</p><p>You have broken your neck! You are dead.</p>');
        return;
      }
      a.print('You jump on the spot. Dust rises. Nothing else happens.', 'echo');
    },

    swim: a => {
      const room = a.state().room;
      if (room === 'pool_area') {
        a.print(a.flag('poolDrained') ? 'The pool is empty. Swimming would be very brief.' : 'In MERCURY? No way!', 'echo');
        return;
      }
      if (room === 'portico') { a.print('The water is only a few inches deep.', 'echo'); return; }
      a.print('There is nothing here to swim in.', 'echo');
    },

    fill: (a, noun) => {
      if (!noun || noun.startsWith('bucket') || noun.startsWith('pail')) { fillBucket(a); return; }
      a.print('I am unable to fill that.', 'echo');
    },

    pour: (a, noun) => {
      if (!noun || noun.startsWith('bucket') || noun.startsWith('water')) { pourBucket(a); return; }
      a.print('I am unable to pour that.', 'echo');
    },
  },
};
