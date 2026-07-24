# MISER — a 2.5D Remake

A faithful browser remake of **Miser** by M.J. Lansing (CURSOR magazine #27, © 1981 The Code Works),
the classic treasure-hunt text adventure later reprinted for the Commodore 64 — rebuilt with a
2.5D first-person presentation: every one of the original 46 locations is rendered as a
one-point-perspective candlelit scene you can click your way through.

![The Great Hall](docs/screenshot.jpg)

## Play

Open `index.html` in any modern browser — no build step, no dependencies.
Or play the hosted version via GitHub Pages.

## Three looks, one game

Pick your presentation on the title screen (or switch anytime with the **Look** button):

- **First-Person** — step inside each room, one-point perspective, dynamic facing.
- **Isometric** — angled bird's-eye view of every room, with your adventurer standing in it.
- **Side View** — cutaway dollhouse-style stage with parallax depth.

All three run on the same engine, data, and minimap — the style is purely how the mansion is drawn.

## How it plays

- **Click** doors to walk through them and objects to use them — or **type** the original
  two-word commands: `GET`, `MOVE`, `OPEN`, `READ`, `DROP`, `SAY`, `POUR`, `FILL`, `UNLOCK`,
  `TURN`, `JUMP`, `SWIM`, `FIX`, `SCORE`, `I`, and the compass (`N S E W`).
- Five treasures, 20 points each. Treasures cannot be dropped.
- Collect all five and escape the mansion for the top rank: **Grandmaster Adventurer**.

The map, items, puzzles, deaths, magic words, ranks, and nearly all message text are decoded
from the original PET BASIC source — including the one-way front door, the hall-of-mirrors
gag, the misspelled chapel tablet, and `SAY XYZZY`.

## Tech

- Plain HTML/CSS/JS — zero dependencies.
- `js/scene.js` — declarative 2.5D room renderer (SVG, one-point perspective, prop library,
  candle-flicker lighting).
- `js/engine.js` — parser, verbs, and turn loop mirroring the 1981 engine's behavior.
- `js/data.js` — the full game as data: 46 rooms, 16 items, every puzzle handler.
- `js/main.js` — UI wiring (log, satchel, modals, hotspot tooltips, keyboard).

## Credits

- Original game: **Mary Jean Lansing**, CURSOR #27 (1981), © The Code Works.
- Remake: built with Claude Code. Not affiliated with the original publishers.
