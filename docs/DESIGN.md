# Design guidelines

How Liner looks and moves, and why. Read this before a UI change. The code rules in
[AGENTS.md](../AGENTS.md) still apply: Tailwind v4, `cn()` for conditional classes, theme
tokens instead of raw hex, shared primitives from `@/shared/ui`.

## Principles

1. **Content is the colour.** The cover art drives the colour of the screen through the
   page backdrop and the fullscreen Kawarp background. The chrome stays neutral: white or
   black at low alpha on top of whatever the cover gives.
2. **Glass, not boxes.** Surfaces are translucent tints with blur, not opaque grey panels.
   You should still feel the page under a menu, a toast or an overlay.
3. **The target is the thing.** When the user does something to a place, make that place
   respond. Do not draw a small box that says "here". The drag-and-drop overlay below is
   the reference example.
4. **Calm motion.** Short fades, soft springs, one easing curve. Loops are slow and quiet.
5. **Nothing new for one call site.** Reuse the hero, the glass button, the dropdown, the
   toast. If a pattern is missing, add it to `@/shared/ui` and use it everywhere.

## Tokens

Use the theme tokens from `src/app/globals.css`. They switch with the theme.

| Use                                | Token                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| Text                               | `text-text-primary`, `text-text-secondary`, `text-text-tertiary`      |
| Raised surfaces (toasts, popovers) | `bg-bg-elevated`, `bg-bg-panel`                                       |
| Hairlines and quiet fills          | `border-alpha-14`, `border-alpha-33` (as `bg-`, `text-` or `border-`) |
| Accent                             | `accent-primary` (liked heart, active state)                          |

Quiet fills for things sitting inside a surface (inputs, rows, segmented controls,
secondary buttons, panels). One class covers both themes:

| Class            | Light     | Dark      | Use                        |
| ---------------- | --------- | --------- | -------------------------- |
| `bg-fill-subtle` | black 3%  | white 4%  | barely-there backgrounds   |
| `bg-fill`        | black 5%  | white 7%  | default field, panel, chip |
| `bg-fill-hover`  | black 8%  | white 10% | hover, selected tab        |
| `bg-fill-strong` | black 10% | white 14% | pressed, active            |

`bg-surface-glass` is the dialog glass, used with `backdrop-blur-2xl`. Use these instead
of writing `bg-black/[0.05] dark:bg-white/[0.07]` by hand.

Glass tints on top of the cover backdrop (the same everywhere, so chips and buttons read
as one surface):

- Glass fill: `bg-black/[0.05] dark:bg-white/[0.09]` (`HERO_GLASS_CLASS`)
- Glass button: `HERO_GLASS_BUTTON_CLASS`, hover goes to `0.09` / `0.16`
- List panel under a hero: `ListPanel` from `@/shared/ui` (`bg-fill-subtle`, blurred only in
  the dark theme where the cover backdrop is on)

## Type

- Inter everywhere (`font-family: var(--font-inter)`), Montserrat only in the player.
  Roboto Flex (wide) for the home feed's section headings (24px, Your Mixes 36px) and
  the generated daily mix covers.
- Section heading icons on home are neutral (`text-text-tertiary`, 20px).
- Hero title: `HERO_TITLE_CLASS` (30px heading font). Hero subtitle: `HERO_SUBTITLE_CLASS` (18px).
- Type scale: `text-caption` 12px, `text-body` 13px, `text-label` 14px (row and card titles, labels), `text-title` 15px, `text-heading`
  18px. Prefer these over `text-[Npx]`.
- Body and list rows: 14px / 500 for titles, `text-body` tertiary for the second line.
- Toast: 13px / 600 message, 12.5px tertiary description after a `·`.

## Shape

- Radius scale: `rounded-control` 8px (small controls, chips), `rounded-item` 12px
  (fields, rows, cards, dialog buttons), `rounded-panel` 20px (dialogs, top-level
  containers). Older code still has `rounded-xs` 4, `rounded-lg` 10, `rounded-2xl` 14, `rounded-3xl` 16 and a few `rounded-[Npx]`; new code uses the scale.
- The scales are registered with tailwind-merge in `src/shared/lib/utils.ts`. A new step
  has to be added there too, or `cn()` reads it as a colour and drops it.
- Buttons and chips in a hero: 9px. Dropdown menu: 11px with 8px items. Toast: 12px.
  Cover in a hero: 10px. Library tiles: `rounded-md`. Big floating art: 16px.
- The app window itself is rounded 12px and goes square when maximised
  (`isEdgeToEdge`). Full-window effects follow the window shape, not the screen.

## Motion

- Default easing: `[0.22, 1, 0.36, 1]`. Use it for enter and exit.
- Fades: 0.1 to 0.2s. Page and list transitions: about 0.2s with a 4 to 6px slide and
  a light blur (`filter: blur(4px)` to `0`).
- Springs for things that "land": stiffness about 260 to 320, damping about 20 to 22.
- Idle loops (breathing, floating): 1.8 to 2.4s, `easeInOut`, small amplitude
  (opacity 0.55 to 1, or a 6px float).
- Pause anything continuous when the window is hidden (`isWindowVisible()`), and keep
  the fullscreen background at 60 fps or less.

## Building blocks

- **Surfaces**: `Panel` from `@/shared/ui`. `variant="glass"` is a top-level container
  (dialogs, popovers, floating sheets), `variant="fill"` (default) is a quiet block inside
  one. Where a component can't be a plain `div` (a `motion.div`), use
  `PANEL_GLASS_CLASS` / `PANEL_FILL_CLASS`. Glass only on the outer container; never
  nest glass in glass.
- **Settings**: `SettingSection`, `SettingRow` and `SettingBlock` from
  `src/features/settings/ui/controls.tsx`. A section is a fill panel of rows.

- **Entity page** (playlist, album, local files): `EntityHero` with a 168px cover, title,
  subtitle, a meta chip (`HERO_CHIP_CLASS`: count · duration), primary "Play all", a
  glass shuffle button, then search, sort and secondary actions on the right. Under it,
  the glass list panel with virtualised `SongCardWithMenu` rows of 64px.
- **Menus**: `DropdownMenu` from `@/shared/ui`. One line per item, icon on the left,
  `danger` for destructive items, `active` for the current one.
- **Toasts**: `showToast(message, variant, { description })`. Keep the message short; put
  the name of the thing in the description. Toasts size to their content.
- **Generated covers** (Liked Songs, On this device): 1000×1000 SVG in `src/assets/`.
  Dark radial gradient, three large blurred glow shapes at 30% opacity, a 20% black
  shade, and one white glyph at 70% opacity in the middle. Each virtual collection gets
  its own hue (Liked Songs violet, On this device teal). Take the glyph from Mingcute,
  so it matches the app icons.

## Reference: the drag-and-drop overlay

`src/features/library/local/ui/LocalDropZone.tsx`. Shown while files are dragged over
the window.

- The whole window is the drop target, so the window itself reacts: a 2px ring inset
  10px from the edges with an 18px radius, following the window shape, breathing between
  55% and 100% opacity.
- Behind it the app is frosted (`bg-black/45 backdrop-blur-2xl backdrop-saturate-150`)
  rather than hidden, so the user keeps their place.
- In the centre is the cover of the destination, not a generic icon: it springs in from
  a slight tilt and floats. Dragging several files fans out more cards behind it, so the
  count is visible before the text is read.
- Text is white on the frost: a 22px / 600 title, a 13.5px subtitle at 60%, and a glass
  pill with the file count.

Use the same recipe for any future full-window state: frost the app, make the window
edge respond, and put the destination's own artwork in the middle.

## Icons

`@mingcute/react` first, then `@solar-icons/react` and `@ai0x0/keyline-icons`. Do not add
another icon library. Use the Fill variant on artwork and active states, Line elsewhere.
