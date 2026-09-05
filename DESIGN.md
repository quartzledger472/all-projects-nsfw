# Design Guidelines

This site is two tiers with two design systems. Keep them separate — the index is
the "meta" layer, project pages are the "in-experience" layer.

## Tier 1 — Index (`index.html`)

Purpose: a plain, fast, text-first directory. Not the moment; just the doorway.

- **Type**: `Space Grotesk` (display/headings), `Space Mono` (labels, numbers,
  eyebrow text, meta). No serif here.
- **Palette**: cool near-black, blue-violet accent.
  ```
  --bg:       #14161c   --text:      #eceef2
  --surface:  #1b1e26   --muted:     #828997
  --border:   #2b2f3a   --accent:    #8b95ff
                         --accent-hi: #aeb5ff
  ```
- **Layout**: single centered column, `max-width: 760px`, generous top padding
  via `clamp()`. Rows are a plain-text index list (number · title · dotted
  leader · tag · year), not cards — deliberately spare.
- **Content source of truth**: `projects.js` (`window.PROJECTS`). Never hardcode
  entries into `index.html` — add an object to the array instead. Fields:
  `slug`, `title`, `description`, `type`, `added` (ISO date, sorts newest-first),
  optional `href` override.
- Set text via `.textContent`, never `.innerHTML`, when rendering `PROJECTS`
  fields — they're free text and must not be treated as markup.

## Tier 2 — Project pages (`cnc-dice/`, `freeuse-slots/`, `invite/`, `ntp-tracker/`, `tied/`)

Purpose: the actual tool/experience. Intimate, tactile, a little more designed.

- **Type**: `Jost` (UI text, body, buttons) + `Playfair Display` italic (logo,
  headings, revealed results/copy — the "moment" text). Keep the serif
  reserved for things that should feel a little special; everything
  functional stays in Jost.
- **Palette**: each project gets its own near-black background and a single
  accent hue — don't reuse another project's accent. Three-step background
  scale + three-step text scale is the pattern:
  ```
  --bg / --bg2 / --bg3        (darkest → card surface, ~+8-10% lightness each step)
  --text / --text2 / --text3  (full white-ish → muted → near-invisible label color)
  --accent / --accent2        (base accent, lighter accent for hover/emphasis)
  --border: rgba(255,255,255,0.06)   (hairline, not a solid gray)
  ```
  Example accents already in use: violet `#9e7eb8` (cnc-dice), keep new
  projects visually distinct from these.
- **Background texture**: a fixed, full-viewport SVG fractal-noise overlay at
  `opacity: 0.04` on `body::before`. Copy this verbatim into new project pages
  — it's what keeps the flat dark bg from looking dead:
  ```css
  body::before{
    content:'';position:fixed;inset:0;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    opacity:0.04;pointer-events:none;z-index:0;
  }
  ```
- **Viewport**: mobile-first, typically fixed-height/no-scroll app shell
  (`overflow:hidden` on html/body, internal `.main{overflow-y:auto}` for
  scrollable content), capped at `max-width: 430px`, centered.
- **Chrome**:
  - `.back` link, fixed top-left, small uppercase mono/Jost label back to `/`.
  - Header row: italic Playfair logo + uppercase micro-label subtitle.
  - Cards (`--bg3` surface, hairline border, 1-5px radius) for discrete units
    of content (a die, a slot result, an invitation field).
  - Micro-labels everywhere (10-11px, uppercase, `letter-spacing: 0.1-0.18em`,
    `--text3`) — this is the recurring "quiet label above the thing" motif.
  - Buttons: solid accent-fill primary (`color: var(--bg)` text on accent
    background) + transparent/bordered secondary. Uppercase, letter-spaced,
    no heavy shadows, 1-2px border radius — flat, not skeuomorphic.

### Consent & safety pattern (required for every project page)

These pages carry 18+ content. Every project page must include:

1. **Age/consent gate** (`#gate`) shown before the app: a full-screen overlay
   with a short consent notice, an explicit "Enter" and "Leave" button pair
   (`.btn-enter` / `.btn-leave`). Don't let the app render before this is
   dismissed.
2. **Safeword / exit affordance** where the content involves a scene or
   roleplay mechanic (see `.safeword-bar` in `cnc-dice`) — a persistent,
   low-key reminder of how to stop, not buried in a menu.
3. Mark the project `18+.` in its `description` in `projects.js` so the index
   is honest about content before a visitor clicks through.

## Adding a new project — checklist

1. New folder at repo root, `slug/index.html`, self-contained (inline
   `<style>`/`<script>` is the existing convention — no shared bundler).
2. Pick a new accent hue; copy the token block structure above, don't copy
   another project's exact values.
3. Include the noise-texture `body::before`, the `.back` link, and the age
   gate. Add a safeword/exit affordance if the content is scene-based.
4. Add one object to `window.PROJECTS` in `projects.js` (with `added` as
   today's date so it sorts to the top). Do not edit `index.html` itself to
   list it.
5. Test at mobile width first; the index and every project page are designed
   mobile-first with a capped max-width, not desktop-first.

## Accessibility baseline (both tiers)

- Respect `prefers-reduced-motion: reduce` — kill transitions/animations
  (index already does this; carry it into every new project page).
- Visible `:focus-visible` states on interactive elements (index uses an
  inset accent-colored box-shadow — reuse that pattern).
- Sufficient contrast between `--text`/`--text2` and their background steps;
  `--text3`/label colors are for decorative micro-labels only, never for
  content someone needs to read.
