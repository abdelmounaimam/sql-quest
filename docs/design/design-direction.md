# SQL Quest · Design direction: "Lantern Atlas"

Source of truth for the styling pass. Companion files:

| File | What it is |
|---|---|
| `docs/design/theme.css` | Drop-in replacement for `src/styles.css` (Tailwind v4 + shadcn tokens, component classes, keyframes). Compiles with Tailwind 4.3 (checked with `@tailwindcss/node`). |
| `docs/design/preview.html` | Living style tile. Its tokens and component classes are injected verbatim from `theme.css`, so what you see there is what the app gets. Open it locally, toggle light/dark (top right) or add `?theme=light`. |
| `docs/design/preview-desktop.png`, `preview-mobile.png` | Screenshots at 1440px and 390px (dark mode, the app default). |
| `docs/design/refs/*.png` | Reference captures of other products used during design (kept out of the repository, they are not ours to redistribute). |

Rules for the build agent: restyle shadcn components through tokens and variants; never replace them. Everything below names a shadcn component, a token or a class from `theme.css`.

---

## 1. Inspiration summary

| Product | Borrow | Avoid |
|---|---|---|
| **Duolingo** | Measured from duolingo.com: primary button `#58CC02` with `box-shadow: 0 4px 0 #58A700`, 12px radius, 50px tall, bold uppercase with 0.8px tracking; secondary is white with a 2px `#E5E5E5` border and 2px ledge. The winding path of "pebble" nodes (Nov 2022 redesign), the verdict sheet that rises from the bottom, streak flame, mascot energy. | White text on bright green (about 2.2:1, fails AA). Guilt-trip streak notifications. Lives that block learning. |
| **TypingClub** | Lesson map with star ratings per lesson, a minimum score before advancing, instant per-keystroke feedback, keycap visuals. Replay of an attempt. | 5-star granularity (we use 3, readable at a glance). Its flat, dated chrome. |
| **Candy Crush** | Each episode has its own color region on the map; scrolling map with a "back to my level" button; juicy, glossy pieces; celebratory level complete with stars landing; boosters. | Pay-to-continue lives, ad pressure, visual noise everywhere. Gloss is used only on nodes, stars and bars. |
| **Brilliant** | Learning by doing with no video; calm editorial pacing; green CTA with bottom depth; Rive-built path nodes. | Their minimal near-white aesthetic: too quiet for "feels like a game". |
| **Mimo / Codecademy** | Mobile code entry: a key bar above the keyboard, fill-in tokens, run button in the thumb zone. | Dark IDE look that reads as "work". |
| **CodeCombat** | Code as spells, a hero on a map, world-themed chapters. | Busy 3D art; purple SaaS buttons on the marketing site. |
| **SQL Murder Mystery** | Story framing for SQL; a case board where tables are clues. | Text-only presentation. |
| **Khan Academy** | Mastery levels per skill, gentle hint ladder. | Utility look. |
| **Monument Valley** | Flat saturated planes, one accent per level, calm motion. | Isometric 3D (too heavy to build in CSS). |
| **Clash Royale / Supercell** | Chunky display type on buttons, ink-dark lettering on bright fills, chest-opening anticipation. | Aggressive monetization chrome. |
| **Hollow Knight map** | Hand-inked cartography, the map gets filled as you explore, cartographer feel. | Grimdark palette. |

---

## 2. Concept and personality

**Lantern Atlas.** A hand-inked adventure atlas that you light up one query at a time. By day it is parchment (light mode); by default it is the same atlas at night, deep ink-blue, lit by a warm amber lantern (dark mode). The world is made of candy-bright pieces with ink lettering and chunky toy ledges that sink when pressed. The lantern is the one source of glow in the whole system: amber light marks whatever your SQL touches.

**What it is not:** no purple-gradient dark dashboard, no glassmorphism, no neon. Surfaces are flat, outlines are 2px, depth is a solid ledge, not a blur shadow.

### SQL made playful (vocabulary for copy and visuals)

| SQL thing | In the game | Visual |
|---|---|---|
| Query | a **spell**, written in the **spellbook** (editor) and **cast** (run) | Cast button = amber lantern button with a wand icon |
| Keywords | **runes** | amber, bold in the editor |
| Table | a **treasure chest** | schema card with a "lid" header and rivets |
| Row / result set | **loot** / the **loot ledger** | result grid |
| Error | the spell **fizzles**; SQLSTATE is the broken **rune** | red verdict sheet with a rune chip `42703` |
| NULL | **the Void** | dashed, italic `NULL` pill, never an empty cell |
| JOIN | a **bridge** (World 3 is literally the Bridges) | relation edges become amber trails |
| XP | **Aether** | blue bolt |
| Streak | the **Hearth** (keep it lit) | orange flame |
| Gems | **Shards** | pink gem |
| Hint | the **Lantern** booster (lights the columns you need) | info-blue |
| Boss | a world **Guardian** | 96px skull node, boss intro |

Boosters (spent with shards, never required): **Lantern** (glow the needed columns), **Scry** (show the first expected row), **Rewind** (restore the last working query). No hard lives in normal levels; bosses have 3 hearts.

### Emotional arc of a level

1. **Curiosity** (mission card): story first, one clear goal line, the chests that matter are visible. Calm, no timers.
2. **Tension** (writing and casting): the spellbook is quiet, the only motion is the caret. On Cast, a short rune sweep (feedback that work started), then the verdict.
3. **Release** (verdict): correct gives a pop, a chime and a small burst; wrong gives one shake, one soft fizzle, and an explanation, never a punishment.
4. **Reward** (level complete): the only "big" moment. Stars land one by one, numbers count up, Wick cheers, the map path unlocks when you return.

### Mascot: Wick

A living lantern flame (inline SVG under 2KB, in `preview.html` as `<symbol id="wick">`). Amber outer flame `#FFB020`, gold core `#FFD23F`, ink eyes `#3B2600`, coral cheeks. States: idle (flicker `scale(0.97,1.04)` 2.4s, blink every 5s), thinking (eyes up, tint blue while a query runs), happy (hop), sad (droop, red tint, after a fizzle), sleeping (empty states), cheering (level complete). Wick walks the map to the current node. Optional everywhere; never blocks content.

---

## 3. Color system

All hex. Every text pair below is computed with the WCAG 2.x formula (script output, also recomputed live in `preview.html`). AA = 4.5:1 for text, 3:1 for UI boundaries.

**The rule:** candy fills carry **ink lettering** (a near-black of the same hue), never white. This keeps the juicy saturated look and passes AA in both modes. Only two world banners (Observatory, Library) take white because their hues are deep.

### 3.1 Surfaces

| Token | Day Atlas (light) | Night Atlas (dark, default) |
|---|---|---|
| `--background` | `#FBF5E9` parchment | `#0E1424` night ink |
| `--card` | `#FFFDF8` | `#172036` |
| `--popover` / `--surface-raised` | `#FFFDF8` | `#1F2A45` |
| `--muted` / `--surface-sunken` | `#F3EBDA` | `#1A2440` / `#111A2E` |
| `--foreground` | `#1D2436` | `#F4ECDC` warm paper white |
| `--muted-foreground` | `#5F6577` | `#A6AEC4` |
| `--border` | `#E2D6BD` | `#2C3A5E` |
| `--ledge` (neutral ledge) | `#D6C7A8` | `#070B16` |
| `--input` (field boundary) | `#A08E6E` | `#5E6F99` |
| `--accent` (hover in menus) | `#FFF0CC` soft lantern | `#3A2A0A` |
| `--ring` | `#3AA8FF` | `#3AA8FF` |
| `--editor` | `#FFFCF3` | `#0A1020` |

| Pair | Light | Dark |
|---|---|---|
| foreground / background | 14.24 | 15.62 |
| foreground / card | 15.21 | 13.79 |
| muted-fg / background | 5.35 | 8.28 |
| muted-fg / card | 5.72 | 7.31 |
| muted-fg / muted | 4.90 | 6.91 |
| input border / card (UI 3:1) | 3.14 | 3.25 |
| foreground / accent | 13.69 | 11.80 |

### 3.2 Brand and semantic (fill / edge (ledge) / ink on fill / soft tint / ink on tint)

Fills and inks are identical in both modes; edges get slightly darker in dark mode; soft tints flip.

| Role | Fill | Edge L / D | Ink on fill (ratio) | Soft L, ink (ratio) | Soft D, ink (ratio) |
|---|---|---|---|---|---|
| **Lantern** primary | `#FFB020` (dark `#FFB524`) | `#CC8000` / `#C47F00` | `#3B2600` (7.85) | `#FFF0CC`, `#7A4800` (6.75) | `#3A2A0A`, `#FFD27A` (9.73) |
| **Moss** success | `#4CC764` | `#2E9A46` / `#2A8A40` | `#08331A` (6.45) | `#DDF6E2`, `#145C2C` (7.07) | `#12321F`, `#8BE6A0` (9.27) |
| **Cinder** destructive | `#FF5A6A` | `#D2334A` / `#B8283E` | `#3F0711` (5.54) | `#FFE1E4`, `#9A1B2E` (6.67) | `#3A1620`, `#FF9AA5` (7.92) |
| **Aether** info | `#3AA8FF` | `#1F7FD0` / `#1A6DB3` | `#04243F` (6.19) | `#DCEFFF`, `#0B5594` (6.51) | `#10294A`, `#8FCBFF` (8.45) |
| **Hearth** warning | `#FF8A2B` | `#D0631A` / `#B85514` | `#3A1600` (6.89) | `#FFE8D4`, `#8A3B00` (6.56) | `#3A2010`, `#FFB27A` (8.54) |
| **Arcane** special | `#A77BFF` | `#7C52D6` / `#6A43C2` | `#1F0B4A` (5.74) | `#EEE6FF`, `#5B2DB8` (6.93) | `#261A47`, `#CDB6FF` (8.88) |

Soft inks also pass directly on cards (light 7.5 to 8.2, dark 8.0 to 11.4), so they can be used as colored text.

### 3.3 Game economy

| Token | Fill | Edge | Text on bg (L / D) |
|---|---|---|---|
| `--star` / `--reward` | `#FFD23F` | `#E8A200` (D `#C98C00`) | ink `#3B2A00` on star 9.59 |
| `--star-empty` | `#E2D6BD` / `#2C3A5E` | | |
| `--xp` Aether | `#3AA8FF` | `#1F7FD0` | `--xp-text` `#0B5594` (7.05) / `#8FCBFF` (10.62) |
| `--streak` Hearth | `#FF8A2B` | `#D0631A` | `--streak-text` `#8A3B00` (7.15) / `#FFB27A` (10.40) |
| `--gem` Shards | `#FF5FB0` | `#CF3A86` | `--gem-text` `#9C1C5E` (7.05) / `#FF9CCD` |
| `--heart` | `#FF5A6A` | `#D2334A` | bosses only |
| `--lantern` | `#FFB020` | | glow color, `--lantern-glow` = 45% mix |

Note: the app currently uses `--reward` for XP. Keep `--reward` for stars, level and rewards; move XP numbers to `text-xp-text` and bars to `bg-xp`.

### 3.4 Syntax runes (CodeMirror)

| Token | Light on `#FFFCF3` | Dark on `#0A1020` |
|---|---|---|
| `--syn-keyword` (bold) | `#B54708` 5.29 | `#FFB547` 10.79 |
| `--syn-function` | `#1D5FC0` 5.93 | `#74B9FF` 9.14 |
| `--syn-string` | `#1F7A3A` 5.24 | `#86E39A` 12.16 |
| `--syn-number` (also bool, null) | `#B0256F` 6.13 | `#FF8EC8` 8.99 |
| `--syn-type` (`::numeric`) | `#0E7480` 5.35 | `#5FD8D2` 11.05 |
| `--syn-operator` | `#B42318` 6.41 | `#FF8A80` 8.30 |
| `--syn-comment` (italic) | `#6B7081` 4.81 | `#8B94AE` 6.27 |
| `--syn-param` (`$1`) | `#6D3BD8` 6.27 | `#C7A6FF` 9.32 |
| `--syn-table` (table/alias names from the schema) | `#7A4800` 7.43 | `#FFD27A` 13.32 |
| `--syn-punct` | `#5F6577` 5.66 | `#A6AEC4` 8.55 |
| `--syn-ident` | `#1D2436` 15.08 | `#F4ECDC` 16.14 |

Map `@lezer/highlight` tags to the `.tok-*` classes in `theme.css` with `HighlightStyle.define([{ tag: t.keyword, class: "tok-keyword" }, …])`. Table names known from the dataset schema get `tok-table` via a small view plugin (this is what makes "your spell touches this chest" visible in the code too).

### 3.5 Data-type badges (schema explorer)

Hue plus a glyph, so color is never the only cue. Generated in OKLCH (bg L 0.945, fg L 0.45 in light; bg L 0.30, fg L 0.87 in dark). All pairs pass AA (light 5.58 to 6.61, dark 8.52 to 9.33).

| `data-type` | Glyph | Light fg / bg | Dark fg / bg | Covers |
|---|---|---|---|---|
| `int` | `#` | `#00569F` / `#CFF1FF` | `#9CDAFF` / `#092F52` | smallint, integer, bigint, serial, identity |
| `numeric` | `#.#` | `#006585` / `#C0F8FF` | `#74E7FF` / `#003645` | numeric, real, double, money |
| `text` | `Aa` | `#036819` / `#D5F8D5` | `#A6E8A7` / `#103714` | text, varchar, char, citext |
| `bool` | `T/F` | `#932A33` / `#FFDEDC` | `#FFB7B6` / `#4D1B1E` | boolean |
| `datetime` | `◷` | `#784B00` / `#FFEBC0` | `#F5CF7D` / `#3F2A00` | date, time, timestamp(tz), interval |
| `uuid` | `id` | `#485572` / `#E5EDFE` | `#C9D4EC` / `#262E3D` | uuid, and fallback for unknown types |
| `jsonb` | `{ }` | `#882D67` / `#FFDDF6` | `#FFB7E5` / `#471C36` | json, jsonb |
| `array` | `[ ]` | `#545C00` / `#EBF2C5` | `#D2DD87` / `#2D3200` | any `[]` |
| `enum` | `⋯` | `#6D398E` / `#F9E2FF` | `#EAC0FF` / `#39214A` | enum, domain |
| `range` | `[ )` | `#8D3800` / `#FFE3C7` | `#FFC18D` / `#492100` | int4range, tstzrange, daterange, multiranges |
| `vector` | `→` | `#4947A0` / `#E4E9FF` | `#C6CDFF` / `#272852` | pgvector |
| `tsvector` | `¶` | `#006C58` / `#C2FBEE` | `#79ECD7` / `#00392F` | tsvector, tsquery |
| `geometric` | `△` | `#6A4F39` / `#FAE9DD` | `#E6CFBE` / `#392A1E` | point, box, polygon, inet/cidr (stone tones) |

Usage: `<Badge variant="type" data-type="jsonb">` or plain `className="type-badge" data-type="jsonb"`. Legacy aliases `--type-number`, `--type-text`, `--type-time`, `--type-json`, `--type-vector`, `--type-bool`, `--type-other` still resolve.

### 3.6 World accents (one per world)

Tokens are **1-based**: `--world-1` … `--world-11`, each with `-deep` (ledge), `-ink` (text on the accent), `-tint` and `-tint-fg` (flip in dark). Set `data-world="N"` on any container to get `--w`, `--w-deep`, `--w-ink`, `--w-tint`, `--w-tint-fg`. **Change `src/lib/content.ts`**: replace `var(--world-${index % WORLD_TOKENS})` with `var(--world-${index + 1})` (or set `data-world`).

| # | World | Name | Accent | Deep | Ink (ratio) | Tint L / fg (ratio) | Tint D / fg (ratio) | Motif (CSS only) | Dataset |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Tavern of First Queries | Hearth | `#F2893B` | `#AE632A` | `#301B0C` 6.54 | `#FDEDE2` / `#6D3E1B` 7.81 | `#402E29` / `#F8BE93` 7.79 | planks + knots | Starport Exchange |
| 2 | Counting House | Coin | `#E8B526` | `#A7821B` | `#2E2408` 8.07 | `#FCF4DE` / `#685111` 6.90 | `#3E3724` / `#F2D688` 8.30 | coin dots | Starport Exchange |
| 3 | Bridges | River | `#17A9C6` | `#117A8F` | `#052228` 5.95 | `#DCF2F6` / `#0A4C59` 8.25 | `#103548` / `#7FD0E0` 7.39 | wave scallops | Starport Exchange |
| 4 | Nested Catacombs | Moss | `#7EA33C` | `#5B752B` | `#19210C` 5.69 | `#ECF1E2` / `#39491B` 8.52 | `#273329` / `#B8CC94` 7.60 | nested arches | Guild of the Silver Dragon |
| 5 | Observatory | Night sky | `#5D63F0` | `#4347AD` | `#FFFFFF` 4.66 | `#E7E8FD` / `#2A2D6C` 10.27 | `#1F2551` / `#A6A9F7` 6.69 | star field | Bardic Beats, Dungeon Delve |
| 6 | Forge | Molten | `#EE5636` | `#AB3E27` | `#30110B` 4.97 | `#FCE6E1` / `#6B2718` 9.10 | `#3F2328` / `#F6A290` 7.08 | diagonal heat + sparks | Starport, Wandering Star Inn |
| 7 | Architect's Tower | Blueprint | `#2E86EA` | `#2160A8` | `#091B2F` 4.72 | `#E0EDFC` / `#153C69` 9.40 | `#152D50` / `#8CBCF3` 6.96 | blueprint grid | Guild of the Silver Dragon |
| 8 | Alchemist's Vault | Potion | `#DD4F9C` | `#9F3970` | `#2C101F` 4.72 | `#FAE5F0` / `#632446` 9.37 | `#3C213E` / `#EC9EC9` 6.96 | bubbles | Guild, Inn, Library |
| 9 | Oracle's Library | Vellum | `#C9405A` | `#912E41` | `#FFFFFF` 4.81 | `#F7E2E6` / `#5A1D28` 10.34 | `#371E30` / `#E196A4` 6.54 | book spines | Great Library of Aethel, Bardic Beats |
| 10 | Clockwork Engine | Gunmetal | `#6E83A3` | `#4F5E75` | `#161A21` 4.52 | `#E9ECF1` / `#313B49` 9.57 | `#232C40` / `#AFBBCC` 7.17 | gear teeth | Dungeon Delve (large) |
| 11 | Astral Spire | Aurora | `#B05CF0` | `#7F42AD` | `#231230` 4.69 | `#F3E7FD` / `#4F296C` 9.46 | `#322451` / `#D4A5F7` 6.98 | aurora + stars | Great Library of Aethel |

All accents are at least 3.8:1 against the night background (map nodes stay readable as UI objects).

---

## 4. Typography

| Role | Family | Why |
|---|---|---|
| **Display** (titles, juicy button labels, big numbers, banners) | **Lilita One** 400 | Chunky, rounded, Supercell-like game voice; reads at 16px on buttons. |
| **UI** (everything you read) | **Atkinson Hyperlegible Next** variable 400 to 800 | Designed for legibility (Braille Institute); distinct letterforms suit learners. Not a generic Inter/Roboto look. |
| **Code** | **Atkinson Hyperlegible Mono** variable 400 to 700 | Same family; unambiguous `0/O`, `1/l/I`, quote shapes: exactly the confusions SQL learners hit. |

Self-host for offline (PWA): `@fontsource/lilita-one`, `@fontsource-variable/atkinson-hyperlegible-next`, `@fontsource-variable/atkinson-hyperlegible-mono` (all 5.3.0 on npm). Import in the root route, drop the Google Fonts preconnects, let Workbox precache the woff2. Preload Lilita One and Atkinson Next 400 latin subsets only.

### Scale

| Token | Size / line-height | Font, weight | Use |
|---|---|---|---|
| `text-hero` | 56px / 1 (clamp 40 to 76 on marketing) | Lilita | Level complete, boss name |
| `text-title` | 36px / 1.05 | Lilita | World titles, section heads |
| h2 | 22px / 1.2 | Atkinson 800 | Chapter titles |
| h3 | 18px / 1.25 | Atkinson 800 | Card titles |
| body | 16px / 1.55 | Atkinson 400 (bold = 800) | Mission and lesson text |
| small | 14px / 1.45 | Atkinson 400/700 | Helper text, table cells |
| `overline` | 12px, 0.08em, uppercase | Atkinson 800 | "WORLD 3 · CHAPTER 9" |
| mono | 15px editor (16px on `pointer: coarse` to stop iOS zoom), 14px grids, 12px badges | Atkinson Mono | |
| juicy label | 17px (sm 14, lg 20, xl 21), uppercase, 0.05em | Lilita | Game actions |
| UI button label | 15px | Atkinson 800, sentence case | UI actions |

Numeric styles: HUD counters use `tabular-nums` (class `tabular`) so values do not jitter while counting; big celebration numbers use Lilita in a fixed-width box (`min-width: Nch`). Thousands separators always (`1,240`).

---

## 5. Shape and depth

- **Radius**: `--radius: 1rem`. `rounded-sm` 10 (badges, menu items), `rounded-md` 12 (inputs, small buttons), `rounded-lg` 16 (buttons, cards), `rounded-xl` 20 (panels, popovers), `rounded-2xl` 28 (dialogs, sheets). Map nodes are pebbles: `width = 1.06 × height`, `border-radius: 50%`.
- **Borders**: 2px everywhere (never hairlines). Dashed 2px for "stitched" separators on parchment.
- **Ledges** (the signature): `--ledge-sm` 3px (chips, keycaps), `--ledge-md` 4px (buttons, cards), `--ledge-lg` 6px (map nodes), `--ledge-xl` 8px (boss nodes).
- **No blur shadows** except a single soft drop under floating overlays (dialog, toast, popover): `0 12px 24px -12px var(--ink-shadow)`.
- **Gloss**: a hard-edged highlight band (`.gloss`: white 30% over the top 34%) on map nodes, stars, XP/progress fills only. Buttons stay flat.

### Juicy button recipe (`.juicy` in `theme.css`)

```css
.juicy {
  background-color: var(--j-fill); color: var(--j-ink); border-radius: var(--radius-lg);
  box-shadow: var(--j-ring), 0 var(--j-ledge) 0 var(--j-edge);   /* crisp ledge, no blur */
  transition: transform 110ms var(--ease-out), box-shadow 110ms var(--ease-out), background-color 150ms ease;
  margin-bottom: var(--j-ledge);                                 /* reserve ledge space */
}
.juicy:active { transform: translateY(var(--j-ledge)); box-shadow: var(--j-ring), 0 0 0 var(--j-edge); }
```

Why `box-shadow` and not `filter: drop-shadow` (the first recipe): WebKit clips filter output to the element's compositing layer, so inside a `backdrop-filter` bar, a transformed sheet or a scroller the ledge was cut flat on iPhone. An unblurred box-shadow is painted with the element and never clipped that way; the press repaints one button for 110ms, which is cheap. `--j-ring` carries an inset outline (paper buttons, quiz states) alongside the ledge. Map nodes, the level pip and world banners use the same box-shadow ledge. For clipped shapes (the level-complete ribbon) the ledge is a second copy of the shape 4px lower (`::after`), not a filter. Focus uses `outline` (3px `--ring`, 2px offset).

### Mobile platform rules

- Safe areas live in four tokens on `:root` (`--safe-top|right|bottom|left` = `env(safe-area-inset-*)`); components never call `env()` directly. Utilities are additive: `pt-safe-2` = 0.5rem + inset, `pb-safe-3`, `px-safe-3`, `bottom-safe-8`, `right-safe-4`.
- Fixed bottom bars use `bottom-bar` (fixed, lifted by `--kb-inset` above an iOS keyboard) + `px-safe-N pb-safe-N`, opaque `bg-card`, no `backdrop-filter`.
- A night-ink strip the height of `--safe-top` sits under the status bar in both themes (the installed app uses `black-translucent`, whose clock is always white).
- Tap targets are at least 44px; controls drawn smaller (`sm`, `icon-sm` buttons, step pips, switches, tabs) get an invisible hit area with `tap-target`.
- Inline code chips never split when short (`nowrap`, up to 24 chars); long chips wrap with `box-decoration-break: clone`.

### Cards

- **Paper card** (`.panel` / `.ledge-card`): card bg, 2px border, `box-shadow: 0 4px 0 var(--ledge)` (static, never animated).
- **Inset well** (`.inset-well`): sunken bg + inner top shadow; used for the editor frame, TabsList, progress tracks.
- **Lit card** (`.glow-lantern[data-lit="true"]`): amber 2px ring + glow painted on `::after`, only its opacity transitions.

### Textures

- Paper grain: `--grain` (inline SVG `feTurbulence`, 160px tile, 5 to 7% alpha) on `body`. Static.
- World motifs: `.world-motif[data-world="N"]` (repeating/radial/conic gradients only; see table in 3.6). Used on world banners, the mission ribbon, the map section header, and at 20 to 30% opacity as the far parallax layer.

---

## 6. shadcn theming

### 6.1 Install

1. Replace `src/styles.css` with `docs/design/theme.css` (it keeps every class the app already uses).
2. Fonts as in section 4; `__root.tsx` theme-color metas: light `#FBF5E9`, dark `#0E1424`; add `viewport-fit=cover, interactive-widget=resizes-content`.
3. Fix `transition-all` in generated components (Button, Toggle, Switch, Tabs) to explicit properties.
4. Add the missing shadcn components: `npx shadcn@latest add popover alert-dialog collapsible radio-group hover-card` (Popover for JSONB previews and boosters, AlertDialog for "quit level?", Collapsible for the mission card on mobile, RadioGroup for quiz choices, HoverCard for desktop column details).

### 6.2 Button variants (`src/components/ui/button.tsx`)

```ts
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap outline-none select-none " +
  "transition-[transform,filter,background-color] duration-(--duration-press) ease-out " +
  "disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        // game actions: Lilita, ink on candy, ledge
        default:  "juicy juicy-primary juicy-label",
        game:     "juicy juicy-primary juicy-label",
        success:  "juicy juicy-success juicy-label",
        danger:   "juicy juicy-danger juicy-label",
        destructive: "juicy juicy-danger juicy-label",
        info:     "juicy juicy-info juicy-label",
        special:  "juicy juicy-special juicy-label",
        gem:      "juicy juicy-gem juicy-label",
        world:    "juicy juicy-world juicy-label",          // needs data-world on an ancestor
        secondary:"juicy juicy-paper font-extrabold",        // paper button with ledge, sentence case
        // UI actions: flat
        outline:  "rounded-md border-2 border-border bg-transparent font-extrabold active:scale-[0.97] hover:bg-accent",
        ghost:    "rounded-md font-extrabold active:scale-[0.97] hover:bg-accent",
        "ghost-glow": "rounded-md font-extrabold text-(--syn-keyword) active:scale-[0.97] hover:bg-accent [&_svg]:drop-shadow-[0_0_6px_var(--lantern-glow)]",
        link:     "font-extrabold text-info-soft-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-md [--j-ledge:var(--ledge-sm)]",
        default: "h-12 px-5 text-[17px]",          // 48px, touch target
        lg: "h-14 px-7 text-xl",
        xl: "h-15 w-full text-[21px]",             // full-width CTA (Cast on mobile, Continue)
        icon: "size-12", "icon-sm": "size-9 [--j-ledge:var(--ledge-sm)]", "icon-lg": "size-14",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  })
```

Loading state: `disabled` + `<Spinner data-icon="inline-start" />` + label "Casting". Keep the fill (do not grey out) while casting: add `data-pressed="true"` so it stays sunk.

### 6.3 Every component, how it is styled

| Component | Where | Styling |
|---|---|---|
| **Button** | everywhere | variants above. `hover:` is gated by Tailwind v4 to hover-capable pointers. |
| **Card** | mission, level hub, profile stats, chests | `CardVariants`: `paper` (default, `.panel`), `mission` (header = `.world-motif` ribbon with overline + Lilita title, body on card), `chest` (see 10), `lit` (`.glow-lantern data-lit`), `inset`. Always full composition (CardHeader/Title/Description/Content/Footer). |
| **Badge** | types, XP, statuses | variants `default` (muted), `success|danger|info|warning|special` = soft tint + soft ink, `xp` (bg-xp ink `--info-foreground`), `gem`, `streak`, `type` (`.type-badge`, reads `data-type`). Radius 10, 12px/800, no ledge except `type` (inset 2px bottom line). |
| **Progress** | XP bar, chapter progress, segmented lesson bar | Track: `--muted` + inset top shadow, 12 to 16px, pill. Indicator: `bg-xp` (XP), `bg-success` (lesson), `bg-(--w)` (world), with `.gloss`. shadcn already animates `translateX`; set `transition: transform 600ms var(--ease-out)`. Lesson progress = row of segments (one Progress per step or a custom flex of 8 pills). |
| **Dialog** | level complete, achievement detail, settings sub-pages | Content: `rounded-2xl`, 2px border, `0 8px 0 var(--ledge)` ledge + soft drop, padding 24. Overlay: `bg-[#0A0F1C]/75` with a static radial lantern light behind the stars. Enter: tw-animate `zoom-in-95 fade-in` 220ms ease-out (already in shadcn); exit 150ms. Level complete layout in 7.3 and in `preview.html`. Always a DialogTitle. |
| **AlertDialog** (add) | quit level, reset progress | Same shell as Dialog; actions = `danger` + `secondary`. |
| **Drawer** (vaul) | mobile schema, mobile results, verdict sheet | Top radius 28, 2px top border, 40×5 handle (`--border`), `snapPoints={[0.45, 0.92]}`, content `overscroll-behavior: contain`, bottom padding `pb-safe-4` (1rem + `--safe-bottom`). Vaul's built-in iOS curve, do not override. |
| **Sheet** | tablet schema panel (right), desktop settings | side right, width 380, card bg, 2px left border. Slide 300ms `--ease-drawer`. |
| **Tabs** | level panels (Spell / Results / Schema on mobile), profile | TabsList = `.inset-well` (sunken pill tray, p-1); active trigger: card bg + 2px border + 3px bottom inset line in `--lantern` (as in preview), font 800. Color change only, 120ms, no sliding indicator (switched often). |
| **Tooltip** | icon buttons, badges, map nodes (desktop) | bg `--foreground`, text `--background`, radius 10, 13px/700, padding 6×10. 400ms delay first, 0 after (Radix `skipDelayDuration`). Enter 150ms fade + scale 0.97 from trigger (`origin-(--radix-tooltip-content-transform-origin)`). Never the only way to get information on touch. |
| **Sonner** | achievements, streak, hints, sync errors | `position="top-center"` on mobile, `bottom-right` desktop, `offset` respects safe area, `duration` 3500 (achievements 5000), `richColors={false}`. `toastOptions.classNames`: toast = popover bg, 2px border, radius 18, ledge `0 4px 0 var(--ledge)` + soft drop; icon = 42px medallion (`rounded-[14px]`) in a soft tint (achievement medallion is a star-gold juicy tile that flips in). Use Sonner's own transitions. |
| **Alert** | hint cards, schema notes, error explanations | soft tint background + matching 2px border at 40%, icon medallion left, title 800. Variants `info`, `warning`, `destructive`, `success`, `lore` (world tint). |
| **Popover** (add) | JSONB/array/vector preview, booster picker | Same as Tooltip shell but card colors, 2px border, ledge, radius 20, origin-aware scale 0.97. |
| **HoverCard** (add) | column details on desktop | as Popover. |
| **Input / Textarea** | quiz free answer, profile name | 2px `--input` border, radius 12, height 48, 16px text minimum; focus: border `--ring` + 3px outline. Invalid: `--destructive` border + soft red bg. |
| **Select / DropdownMenu** | dataset picker, settings | content = Popover shell; items radius 10, hover `--accent`, checked = `--syn-keyword` check. |
| **RadioGroup** (add) / **ToggleGroup** | quiz choices, predict-the-output | each choice = `juicy juicy-paper` tile (full width, left aligned, mono for SQL options). Selected: `--info-soft` bg, `--info` 2px border, `--info-edge` ledge. After verdict: correct tile goes `success` soft, chosen wrong tile goes `destructive` soft + shake once. |
| **Switch** | settings (sound, haptics, reduced motion) | track 28×48, `--muted` inset, checked `--success`; thumb white 24px with 2px ledge. |
| **Slider** | volume | track 10px inset, range `--primary`, thumb 24px juicy amber. |
| **Table** | result grid ("loot ledger"), leaderboards | mono 14px, header 11px/800 uppercase on `--muted`, sticky header, row borders 1.5px, numbers right + tabular, NULL as `.null-pill`, diff mode: missing rows `--destructive-soft`, extra rows `--warning-soft`, matched rows a 3px `--success` inset bar (plus `+`/`−` glyphs, not color only). Virtualize over 200 rows. |
| **ScrollArea** | panels | thumb `--border`, 6px, hover `--muted-foreground`. |
| **Resizable** | desktop level layout | handle 8px with three grip dots, hover/drag amber `--lantern`. |
| **Separator** | lists | 2px `--border`; `variant="stitch"` = 2px dashed. |
| **Skeleton** | loading datasets | `--muted` with opacity pulse 1.4s (no shimmer gradient). |
| **Spinner** | casting, loading | lucide `LoaderCircle` at 0.6s per turn (fast spin feels faster). Optional: Wick "thinking". |
| **Kbd** | shortcuts, quick-key bar | `.keycap` (2px border + 3px ledge), mono 700. |
| **Avatar** | profile, leaderboard | rounded-square (radius 30%), 2px border + 3px ledge; AvatarFallback initials on a world tint. |
| **Empty** | no attempts, no achievements | Wick sleeping + one line + a `secondary` button. |
| **Field / Label** | forms | label 14px/800, description 13px muted. |
| **Collapsible** (add) | mission card on mobile | collapsed shows ribbon + goal line; chevron rotates 180° in 200ms ease-out. |

---

## 7. Motion language

Library: `motion` (already installed) for springs, layout and exit; CSS for press, hover, loops and anything that plays while the page is busy (route changes, PGlite boot). Follow the animate skill rules: no `transition: all`, no `scale(0)`, no `ease-in` on UI, no animation on keyboard actions (typing, Ctrl+Enter runs the query instantly; only the result animates).

### 7.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | enter/exit, press (also Tailwind `ease-out`) |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | movement on screen (avatar walk, path draw) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | sheets, drawers |
| `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | rare celebrations only (stars, combo bump) |
| `--duration-press` | 110ms | button/node press |
| `--duration-fast` | 160ms | tooltips, hover color |
| `--duration-base` | 220ms | dialogs, popovers, verdict sheet |
| `--duration-slow` | 320ms | sheets, progress |
| `--duration-celebrate` | 520ms | star landing |

Motion springs: UI pop `{ type: "spring", duration: 0.35, bounce: 0.2 }`; card swipe `{ type: "spring", duration: 0.45, bounce: 0.15 }`; celebration `{ type: "spring", duration: 0.5, bounce: 0.35 }` (only level complete and achievements). Use full `transform` strings in motion when the main thread is busy (query running, route loading).

### 7.2 Frequency budget

| Tier | Examples | Motion |
|---|---|---|
| 100+/day | typing, Ctrl+Enter, tab switches, quick keys | none (color only) |
| tens/day | Cast, verdict, hover, node tap | 110 to 240ms, functional |
| occasional | dialogs, drawers, toasts, unlock | 200 to 400ms |
| rare | level complete, boss intro, achievement, world unlock | delight budget, up to 1.5s total, always skippable |

### 7.3 Choreography

| Moment | Spec |
|---|---|
| **Lesson card swipe** | Drag with pointer capture, `touch-action: pan-y`. Release dismisses if offset > 30% width or velocity > 0.11 px/ms. Exit `translateX(±110%) rotate(±6deg)` 220ms ease-out; next card enters from `scale(0.96) opacity 0` 200ms; boundaries get rubber-band damping. |
| **Run query (Cast)** | Press 110ms. Label crossfades to Spinner + "Casting" with 2px blur bridge (200ms). Editor frame gets a rune sweep: a 2px amber line on the top border revealed with `clip-path: inset(0 100% 0 0) → inset(0)` 400ms linear, looping only if the query exceeds 400ms. Result rows rise (`translateY(8px)`, opacity) with 30ms stagger, first 12 rows only, rest instant. |
| **Wrong answer** | Spellbook panel `shake` once (420ms, ±6px decaying). Verdict sheet slides up 240ms `--ease-drawer`. Wick flickers red 600ms. Sound "fizzle", haptic `[30, 50, 30]`. Error rune chip pulses opacity once. No red full-screen flash. |
| **Correct answer** | Verdict sheet up 240ms; check medal `scale(0.6) → 1` with UI pop spring; 24-particle burst from the medal (canvas-confetti small, token colors, 1.2s). Chime + haptic 15ms. |
| **Combo increment** | Combo chip number rolls: old `translateY(0 → -100%)`, new `100% → 0`, 200ms ease-out, chip `bump` 280ms `--ease-pop`. At 3 a flame pip ignites; at 5 and 10 the chime steps up the pentatonic scale. |
| **XP count-up** | A "+15" token floats from the verdict sheet to the HUD XP chip along a curve (WAAPI, 520ms ease-in-out), chip bumps, then the number counts 600 to 900ms ease-out written to `ref.textContent` (never per-frame state). Bars fill with `transform: scaleX` 600ms ease-out. |
| **Stars landing** | Dialog in 220ms. At +300ms, each earned star: `scale(1.7) rotate(-28deg) opacity 0 → scale(1) rotate(0)` 520ms `--ease-pop`, 220ms apart, a 6-sparkle ring per star, notes C6, E6, G6, haptic 10ms each. Unearned stars are already visible as empty outlines. Stats count up after the last star. Tap anywhere skips to the end state. |
| **Level unlock on the map** | On return to the map: camera scrolls to the new node (smooth, 500ms); the dotted trail segment becomes solid road (`stroke-dashoffset` draw on a small SVG path, 700ms ease-in-out; acceptable paint cost, one path); lock badge pops off (`translateY(-12px) rotate(20deg) opacity 0`, 180ms); node colors in (crossfade overlay 240ms) and bounces `scale(0.92 → 1.06 → 1)`; pulse ring starts. Sound "unlock". |
| **Avatar walking** | Wick follows the path: sample 12 points with `getPointAtLength`, WAAPI keyframes on `transform` (translate + a 6px hop per sample), 700ms per node, ease-in-out. Lands with a squash `scale(1.1, 0.9)` 120ms. |
| **Boss intro** | Full-screen overlay (ink 80%), world motif at 20%. Guardian banner slams in `scale(1.15) → 1` + opacity 260ms ease-out, container shakes 6px once on impact (300ms), name letters stagger 25ms, then "3 hearts" pop in. Drum sound + haptic `[60, 40, 120]`. Tap to skip; auto-continues after 1.8s. |
| **Achievement unlock** | Sonner custom toast: medallion flips in (`rotateY(90deg) → 0`, 520ms ease-out), a sheen sweeps once (`shine`, 900ms), shimmer sound. 5s, swipe to dismiss. |
| **World unlock** | New world banner unfurls (`clip-path inset` reveal from left, 600ms ease-in-out), motif fades in, short fanfare. |

### 7.4 Reduced motion

Honor `prefers-reduced-motion` and the in-app setting (`.reduce-motion` on `<html>`, already wired in `fx.ts`). Reduced means gentler, not zero:
- Keep opacity and color transitions (verdict, dialogs fade 150 to 180ms).
- Remove: shake (use the red border + icon + text), parallax, path drawing (instant), confetti, avatar walking (teleport with fade), boss slam (fade), number count-up (show final), pulse rings, bobbing, flicker.
- `theme.css` neutralises tw-animate scale/slide/rotate/blur for Radix overlays and turns `animate-pop-in|star-land|rise` into a fade.
- In motion: `const reduce = useReducedMotion()` and swap transforms for `{ opacity }`.

### 7.5 Performance rules

- Animate `transform` and `opacity` only; `clip-path` and `filter: drop-shadow` allowed (composite tier). Never `box-shadow`, `width`, `height`, `top/left`.
- Glows: pre-paint the glow on a pseudo-element, animate its opacity.
- Never animate an inherited CSS variable on a parent (drag offsets go straight to `element.style.transform`).
- Long or busy-time animations (route change, PGlite init, query run) are CSS or WAAPI, not rAF.
- `will-change` only after you see a 1px shift; never on large containers.
- Blur under 8px and never animated on large areas (the topbar backdrop blur is static).
- Test on a mid-range Android phone at 120Hz (8ms budget).

---

## 8. Sound and haptics

WebAudio synth only (extends `src/game/sound.ts`). Master chain: per-sound gain → master gain 0.6 → `DynamicsCompressor` (threshold -18dB, ratio 4) → destination. All melodic sounds use C major pentatonic so overlapping sounds never clash (C5 523, D5 587, E5 659, G5 784, A5 880, C6 1047, E6 1319, G6 1568). Default on, mute toggle in HUD and settings, separate "haptics" switch. Start the AudioContext on the first user gesture.

| Sfx | When | Recipe |
|---|---|---|
| `tap` | juicy button press (not every UI tap) | sine 880→660 Hz slide, 40ms, attack 5ms, gain 0.04 |
| `run` (cast) | Cast pressed | triangle 330→660 Hz rising, 120ms + bandpassed noise whoosh (2 kHz, Q 1.2) 150ms, gain 0.07 |
| `success` | correct verdict | triangle E5 80ms then C6 220ms (exp decay), plus sine C7 at gain 0.02 for shimmer; gain 0.11 |
| `fail` (fizzle) | wrong verdict | square 196→123 Hz slide 180ms through lowpass 900 Hz + noise puff 60ms; gain 0.05. Soft, never a buzzer |
| `hint` | lantern booster | sine G5 then D6, 300ms bell decay, gain 0.06 |
| `star` | each star landing | triangle C6, E6, G6 (one per star), attack 10ms, decay 250ms, sine octave at 0.3 level |
| `combo` | combo +1 | pluck (triangle, 90ms) stepping up the pentatonic by combo count, gain 0.05 |
| `levelup` | level complete dialog | arpeggio C5 E5 G5 C6 (70ms each), last note held 400ms + sine pad fade 600ms |
| `unlock` | node or world unlock | 5ms noise click + sine C6 "ting" 250ms + C5 underneath |
| `boss` | boss intro | sine 65→55 Hz drum 400ms gain 0.22 + lowpassed noise hit (300 Hz); then A3 C4 E4 sawtooth stab through lowpass 1.2 kHz, 200ms |
| `achievement` | achievement toast | 5 sine notes G5 A5 C6 D6 G6, 40ms apart, 300ms decay |
| `streak` | streak extended | 3 crackles (noise bursts, bandpass 3 kHz, 20ms) + triangle C5 E5 |

Haptics: `navigator.vibrate` (Android Chrome; iOS Safari ignores it, that is fine). Guard with `'vibrate' in navigator` and the setting. Never on typing, scrolling or ordinary taps.

| Moment | Pattern (ms) |
|---|---|
| correct | `15` |
| wrong | `[30, 50, 30]` |
| each star | `10` |
| level complete | `[20, 40, 20, 40, 60]` |
| unlock | `25` |
| boss intro | `[60, 40, 120]` |
| achievement | `[15, 30, 15]` |

---

## 9. Layout

Breakpoints (Tailwind defaults): `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Mobile-first. App shell height `100dvh`; `viewport-fit=cover`; pad fixed bars with `env(safe-area-inset-*)`; `overscroll-behavior: none` on html, `contain` on inner scrollers; 16px inputs and editor on coarse pointers; hover styles only in `@media (hover: hover) and (pointer: fine)` (Tailwind v4 `hover:` already does this).

### 9.1 World map

- Vertical scroll; one `<section data-world="N">` per world. World banner (`.world-motif`, Lilita title, overline "WORLD 3 · RIVER", chapter guide icon button) is `sticky top-0` within its section.
- Path column 320px centered. Node x offsets cycle `[0, 60, 76, 60, 0, -60, -76, -60]` px, rows every 104px, 116px before a boss. Node 72px (`--node-size: 4.5rem`), boss 96px, side quest 56px.
- Road: traveled segments are a 14px world-color stroke with a `--w-deep` copy offset 4px below (the road has a ledge too); ahead is a 9px dotted trail (`stroke-dasharray: 0 18`, round caps) at 45% world color. Side quests branch with an 8/8 dashed line in `--special`.
- Node states (all in `theme.css` via `data-state`): `locked` (stone `--muted`, no gloss, lock badge), `available` (world color, gloss, 6px ledge), `current` (pulse ring + bobbing START bubble + Wick beside it), `completed` (check + 3-star arc below, empty stars visible), `perfect` (gold node with crown), `boss` (`data-kind="boss"`, skull, red BOSS tag, 8px ledge), `side` (`data-kind="side"`, violet sparkle), review (blue dumbbell, spaced repetition).
- Parallax: 3 layers per world section: far (motif at 20 to 30%, `animation-timeline: scroll()` translateY at 0.3×), mid (inline SVG silhouettes: tavern roofs, arches, telescopes, gears, at 0.6×), near (props beside the path, 1×). CSS scroll-driven animations only; disabled under reduced motion; no JS scroll listeners.
- Floating "back to current" round juicy button (bottom right, above tabs) when the current node is off screen.
- Desktop (`lg`+): left rail nav (Map, Practice, Profile, Settings) 240px, center path column, right rail 340px with streak card, daily quest, next boss, leaderboard snippet.
- Mobile: bottom tab bar 64px + safe area (Map, Practice, Profile, Settings), active tab = amber icon + label, inactive muted; HUD strip on top (hearth, shards, aether).

### 9.2 Level screen

- **Desktop (`lg`+)**: top HUD (quit X, segmented progress, combo chip, hearth, shards) full width. Below, `Resizable` horizontal: left 340 to 400px (mission Card on top, schema explorer in Tabs "Chests | Diagram" below), right column vertical split: spellbook (editor, 55%) and loot ledger (results, 45%). A verdict bar spans the bottom (Duolingo footer): hint/booster buttons left, Cast (`lg`, 180px min) right; after a verdict it becomes the colored sheet with Continue/Try again.
- **Tablet (`md`)**: two columns (mission + editor | results); schema in a right `Sheet`.
- **Mobile**: HUD 48px; mission as a `Collapsible` card (ribbon + goal line when collapsed); editor fills the rest; bottom action bar in the thumb zone: Lantern booster (icon + count), Schema and Results buttons (open `Drawer` at 45%/92% snaps), and Cast as a flex-1 `xl` juicy button. After Cast, the results drawer auto-opens at 45%.
- **Quick-key bar**: horizontal scroll of `.keycap` chips (40px tall, 44px min width): `SELECT FROM WHERE JOIN * , ( ) ' = ; ⇥` then context keys (table names from the dataset in `--syn-table`). Pinned to the top of the software keyboard using `visualViewport` (`bottom: calc(100dvh - visualViewport.height - offsetTop)`) with `interactive-widget=resizes-content`. Tapping inserts at the cursor; no animation.
- Verdict sheet is a fixed bottom panel (not a toast): `--success-soft`/`--destructive-soft`, 2px tinted border, medal + Lilita title + one line, action button full width on mobile.

---

## 10. Schema explorer: treasure chests

- **Chest card** (`Card` variant `chest`, `data-world` of the dataset's world): lid header in `--w-tint` with `--w-tint-fg` text: 34px icon tile (world accent, `--w-deep` ledge, lucide `Archive` or the chest glyph), table name in mono 16/700, row count right. Two rivets (8px dots in `--w`) on the lid seam. Body: columns as rows (mono 14): key icon (`KeyRound` gold for PK, `Link` blue for FK), name, `?` muted for nullable, type badge right (13 types, section 3.5).
- **Referenced by the current query** (parse the editor buffer, debounce 150ms): chest gets `.glow-lantern data-lit="true"` (amber ring + glow, opacity transition 220ms) and an "IN YOUR SPELL" amber pill; referenced columns get a 16% amber row tint and a 3px amber inset bar. Unknown table names in the query: the chest list shakes nothing; instead an inline hint chip "no chest named `pilot`, did you mean `pilots`?".
- **Relations (React Flow diagram)**: edges 2px `--border`, smoothstep, FK→PK, crow's-foot markers optional. When both ends are referenced: `.react-flow__edge.is-referenced` = amber 2.5px, 8/6 dashes marching (1.6s linear; static under reduced motion). Minimap off on mobile; controls styled with tokens.
- **Previews** (Popover on tap/click, HoverCard on desktop hover):
  - JSONB: mini tree, keys in `--syn-function`, strings `--syn-string`, numbers `--syn-number`, collapsible nodes, first 3 levels.
  - Array: chip list (max 8, "+N").
  - Vector: 16 to 64 thin bars in `--type-vector-fg` on `--type-vector-bg` (normalized), plus dims label.
  - tsvector: lexeme chips `'dragon':3`.
  - Range: number line with `[` `)` bracket glyphs.
  - Geometric: 64px SVG plot.
- Mobile: chests stack in a `Drawer`, searchable; the diagram is a secondary tab (pinch-zoom).

---

## 11. Iconography and illustration

- **Icons**: lucide-react (installed). Stroke 2.25 for game chrome (pass `strokeWidth={2.25}` via a wrapper), 2 for UI. Inside Buttons use `data-icon`, no size classes (shadcn rule); juicy buttons size icons to 20px. Filled glyphs (star, flame, gem, bolt, heart) are custom inline SVG with fill + edge stroke + gloss, not lucide outlines (see `preview.html` symbols).
- **Emoji**: none in UI chrome (platform-inconsistent and break the ink style). Allowed only inside user-authored text.
- **World glyphs** (outline, 1.8 stroke, at 96px on banners): mug, coin, arch bridge, crypt arch, telescope, anvil, tower, flask, open book, gear, spire with star. Inline SVG symbols in `preview.html`; move them to `src/components/game/icons.tsx`.
- **Backgrounds**: CSS gradients only (`.world-motif`), plus small inline SVG silhouettes for parallax mid layers (under 1KB each). No raster images; nothing over 4KB per world.
- **Wick** as above; also used for the PWA icon (flame on `#0E1424` rounded square) and splash.

---

## 12. Build checklist (ordered by impact)

1. Swap `src/styles.css` for `theme.css`; self-host the three fonts; theme-color metas; viewport meta. Fix `lib/content.ts` world tokens to 1-based.
2. Button variants (6.2) and remove `transition-all` from generated components.
3. Map nodes and road (`.map-node` states, road with ledge, dotted trail, sticky world banners with motifs, Wick on current node, back-to-current button).
4. Level layout: HUD (segmented progress, combo, hearth, shards), mission Card (`mission`), spellbook editor theme (`.tok-*`, caret, active line), Cast in the thumb zone, verdict sheet.
5. Verdict choreography: shake/fizzle, pop/chime/burst, XP fly + count-up, combo bump; sounds and haptics table.
6. Level complete Dialog: ribbon, stars landing, stat tiles, Continue/Replay; map unlock sequence on return.
7. Schema chests with type badges, lantern glow on referenced tables/columns, React Flow edge styling, JSONB/vector previews.
8. Result grid (loot ledger): NULL pill, tabular numbers, diff mode, row stagger.
9. Mobile: Drawer for schema/results with snaps, quick-key bar above the keyboard, bottom tab bar, safe areas, 16px editor.
10. Sonner toasts (achievement flip + sheen, streak, hint, error), Tooltip, Popover, Tabs pill tray.
11. Boss intro overlay; world unlock banner.
12. Parallax layers per world (scroll-driven CSS), Empty states with Wick, Skeletons.
13. Reduced-motion pass (setting + media query) and a mid-range Android test at 120Hz.

---

### Sources

- Duolingo button styles measured live on duolingo.com (computed styles, 2026-10-31); palette cross-checked with [design.duolingo.com](https://design.duolingo.com/identity/color) and [open-design.ai Duolingo system](https://open-design.ai/plugins/design-system-duolingo/).
- Duolingo path redesign: [blog.duolingo.com/new-duolingo-home-screen-design](https://blog.duolingo.com/new-duolingo-home-screen-design).
- Brilliant path built with Rive: [rive.app blog](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations).
- TypingClub lesson map and stars: [Typing Jungle handbook](https://login.typingclub.com/m/edclubdocs/media/pdf/typing-jungle-handbook.pdf), [Common Sense review](https://www.commonsense.org/education/reviews/typingclub).
- Candy Crush map episodes and "back to current level": [uxdesign.cc review](https://uxdesign.cc/does-candy-crush-have-a-good-ux-3c1a865d24e), King patents (episode colors in the landscape view).
- Motion and mobile rules: project skills `animate`, `animation-performance`, `emil-design-eng`, `mobile-native`.
