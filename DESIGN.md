---
name: รายจ่าย (Expense Tracker)
description: A Thai monthly expense ledger printed in banknote inks on fibre paper.
colors:
  paper: "#eef0ea"
  paper-sunk: "#e3e7de"
  sheet: "#f8f9f5"
  rule: "#d3d8cc"
  rule-strong: "#b6beae"
  ink: "#1c211b"
  ink-2: "#535b4f"
  band: "#1f5e3d"
  band-ink: "#f1f5ef"
  band-ink-2: "#bcd5c4"
  band-line: "#cfe6d6"
  primary: "#1f5e3d"
  primary-hover: "#184c31"
  primary-ink: "#ffffff"
  income: "#1f6b43"
  ok: "#2f7d4f"
  warn: "#8a6914"
  warn-fill: "#c49a2c"
  danger: "#b2303a"
  danger-hover: "#95262f"
  note-20: "#2f7d4f"
  note-50: "#2c5f9e"
  note-100: "#b2303a"
  note-500: "#6b3f8c"
  note-1000: "#7a6e5f"
  tint-green: "rgba(31, 94, 61, 0.1)"
  paper-dark: "#0e1411"
  paper-sunk-dark: "#18201b"
  sheet-dark: "#141b17"
  rule-dark: "#26302a"
  rule-strong-dark: "#3a473f"
  ink-dark: "#e4e9e1"
  ink-2-dark: "#a3ae9f"
  band-dark: "#133a27"
  band-ink-dark: "#e9f1ea"
  band-ink-2-dark: "#9fc2ab"
  band-line-dark: "#7fb293"
  primary-dark: "#2f7d4f"
  primary-hover-dark: "#37905c"
  income-dark: "#74c99a"
  ok-dark: "#5fb886"
  warn-dark: "#e0b64f"
  danger-dark: "#f07d84"
  danger-hover-dark: "#f5969c"
  tint-green-dark: "rgba(116, 201, 154, 0.12)"
typography:
  money-xl:
    fontFamily: "Trirong, Anuphan, serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
    fontFeature: "lnum, tnum"
  money-lg:
    fontFamily: "Trirong, Anuphan, serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.005em"
    fontFeature: "lnum, tnum"
  money-md:
    fontFamily: "Trirong, Anuphan, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.005em"
    fontFeature: "lnum, tnum"
  money-sm:
    fontFamily: "Trirong, Anuphan, serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
    fontFeature: "lnum, tnum"
  headline:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  hair: "1px"
  meter: "3px"
  note: "4px"
  sm: "8px"
  tile: "9px"
  md: "10px"
  toast: "12px"
  dialog: "16px"
  sheet: "18px"
  pill: "999px"
spacing:
  xs: "0.35rem"
  sm: "0.5rem"
  row: "0.75rem"
  panel: "1.25rem"
  panel-desk: "2rem"
  section: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-sunk}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
  button-danger:
    backgroundColor: "{colors.note-100}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-band:
    backgroundColor: "rgba(241, 245, 239, 0.12)"
    textColor: "{colors.band-ink}"
    rounded: "{rounded.md}"
    size: "40px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.55rem 0.8rem"
    height: "44px"
  input-money-large:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.money-lg}"
    rounded: "{rounded.md}"
    height: "64px"
  quick-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 0.85rem 0 0.6rem"
    height: "40px"
  date-pick-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    height: "30px"
  filter-chip:
    backgroundColor: "{colors.note-50}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  note-chip:
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.note}"
    width: "64px"
    height: "34px"
    padding: "5px 7px"
  category-tile:
    backgroundColor: "{colors.paper-sunk}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tile}"
    size: "36px"
  panel:
    padding: "1.25rem 1.25rem 1.35rem"
  sheet-dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    width: "560px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.band-ink}"
    rounded: "{rounded.toast}"
---

# Design System: รายจ่าย (Expense Tracker)

## Overview

**Creative North Star: "Banknote Inks on Fibre Paper"**

The app is printed, not rendered. A cool, faintly green fibre-paper ground carries every surface; the shell is a deep 20-baht green band engraved with faint guilloché linework; money is set in an engraved Thai serif with tabular figures, right-aligned in a single column. The five Thai banknote inks are the whole palette and each ink has exactly one job, so colour always carries meaning: green is the shell, the primary action and income; red is over-budget and destruction; gold is near-limit; blue and purple only appear in data and on denomination chips.

Structure comes from hairline rules on paper, not from cards. Sections are full-width panels divided by a 1px rule; lists are ledgers with day headers and rows separated by rules. The single piece of ornament with a job is the note chip: today's allowance is counted out as a small fanned stack of banknotes in their true inks. Dark mode is the same notes at night: an ink-green black ground with the inks lifted for legibility, while the note chips keep their printed colour.

Density is that of a working ledger: 15px body, 36px row tiles, 44px touch targets, one column on phones growing to a three-column ledger on wide desktops.

**Key Characteristics:**
- Fibre-paper ground (light) / ink-green night ground (dark); never pure white or pure black.
- Deep green header band with guilloché linework at 16–20% opacity.
- Engraved serif money figures (Trirong 600, tabular lining numerals) with a reduced baht unit.
- Hairline-ruled panels instead of cards; ledgers instead of tiles.
- Banknote-ink semantics: one ink, one job.
- Fanned denomination chips as the signature.
- Authored line icons (lucide, 1.75 stroke), never emoji in chrome.

## Colors

A restrained banknote palette: cool green-grey neutrals, one deep green for everything structural, and four further inks rationed by meaning. Every colour exists in both themes; dark-theme values carry the `-dark` suffix in the frontmatter and are applied by `[data-bs-theme="dark"]`.

### Primary
- **Twenty-Baht Green** (band / primary): the header band, the primary button, checked controls, the selected date pick, the selected month bar in charts and the browser theme-color. In dark mode the band deepens (band-dark) while the button ink lifts (primary-dark) so it still reads against the night ground.
- **Ledger Green** (income / ok): income figures, the in-budget meter fill and status, income category tiles. Lifted to a soft mint in dark mode.

### Secondary
- **Hundred-Baht Red** (danger / note-100): over-budget meter fill, over-budget status, negative bars in charts, destructive buttons and the danger panel rule. The red never decorates.
- **Thousand-Baht Gold** (warn-fill for fills, warn for text): the near-limit meter fill and near-limit status text and icons. The fill gold is the same in both themes; the text gold is darkened in light and brightened in dark for contrast.

### Tertiary
- **Fifty-Baht Blue** (note-50): data only. The active category in the ranked list (tile, label, share bar), the active category filter chip, and the 50 note chip.
- **Five-Hundred Purple** (note-500): denomination chips only.
- **Thousand-Baht Khaki** (note-1000): the 1000 denomination chip only.

### Neutral
- **Fibre Paper** (paper): page ground.
- **Sunk Paper** (paper-sunk): hover wash, segmented-control track, category tiles, meter track, notices.
- **Sheet** (sheet): raised surfaces that take input: fields, dialogs, the dock, quick chips, picker cells.
- **Hairline** (rule) and **Strong Hairline** (rule-strong): panel and row dividers; control outlines.
- **Ink** (ink) and **Second Ink** (ink-2): primary text and focus ring; secondary text, captions, icons.
- **Band Ink** (band-ink, band-ink-2, band-line): text, secondary text and guilloché linework on the green band.

### Named Rules
**The One Ink, One Job Rule.** Green = shell, primary action, income. Red = over budget and destructive. Gold = near limit. Blue and purple = data and denomination chips only. If a colour appears without its meaning, it is wrong.

**The Fixed Print Rule.** Note-chip inks (note-20/50/100/500/1000) are printed colours and do not change between themes.

**The No Pure Extremes Rule.** Grounds are paper (#eef0ea) or night green (#0e1411); text is ink, never #000 or #fff on paper.

## Typography

**Display / Money Font:** Trirong 500/600 (fallback Anuphan, serif), self-hosted
**UI Font:** Anuphan 400/500/600/700 (fallback Noto Sans Thai, system-ui, sans-serif), self-hosted

**Character:** A Thai engraved serif reserved for money, paired with a clean, sturdy Thai sans for everything else. The serif makes amounts look printed; the sans keeps the ledger quick to scan.

### Hierarchy
- **Money XL** (Trirong 600, 3.5rem, 1.05): the month balance on the band. One per screen.
- **Money LG** (Trirong 600, 2.125rem, 1.1): today's allowance figure.
- **Money MD** (Trirong 600, 1.375rem, 1.2): budget spent, income and expense pair, sheet totals.
- **Money SM** (Trirong 600, 1.0625rem, 1.3): every ledger row, category amount and chip amount (the default).
- **Headline** (Anuphan 700, 1.75rem mobile / 2.5rem desktop, 1.3): auth band heading only; Settings uses 1.375rem, auth form title 1.5rem.
- **Title** (Anuphan 600, 1.0625rem, 1.35): panel titles and the month name; sheet titles at 1.125rem.
- **Body** (Anuphan 400, 0.9375rem, 1.55): rows, buttons, notices. Inputs use 1rem to avoid mobile zoom.
- **Label** (Anuphan 600, 0.8125rem): form labels, panel meta, captions, day headers (500 weight for meta).

### Named Rules
**The Engraved Money Rule.** Every amount goes through the Money component: Trirong 600, lining tabular numerals, the baht sign at 0.62em weight 500, a true minus sign (−) and an explicit + on signed income. Money is never set in the UI sans, and only these four sizes exist.

**The One Column Rule.** Amounts are right-aligned in a single trailing column in every list, row and header.

## Layout

Phone-first single column (max 600px) of full-bleed panels on paper, with a fixed bottom dock (quick chips plus the primary add button) and 96px of bottom clearance. Panels pad 1.25rem; rows are a grid of 36px tile, flexible label, trailing amount; day headers separate groups.

At 992px the dashboard becomes a grid: a 360px sticky left column (band, allowance, budget, then the dock pinned to its foot), the ledger in the main column, and analysis below. At 1280px analysis moves to a third column (340–420px), max width 1480px, columns divided by vertical rules. Panel padding widens to 1.75–2rem. Auth pages split into band (46%, min 420px) and form (max 380px) at 992px. Settings is a 640px single column. Sheets go from bottom sheet to centred dialog at 576px.

Spacing rhythm is small and steady: 0.35 / 0.5 / 0.75 / 1.25 / 1.5 / 2rem; form stacks use 0.85rem between fields.

## Elevation & Depth

Flat paper by default. Depth comes from tone (paper, sunk paper, sheet) and hairlines; shadows are kept for things that physically sit above the page.

### Shadow Vocabulary
- **Dock lift** (`box-shadow: 0 -6px 20px rgba(28, 33, 27, 0.06)`): the fixed bottom dock; `0 -10px 18px rgba(28,33,27,0.07)` when sticky in the desktop side column.
- **Sheet** (`box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2)`) over a `rgba(14, 20, 17, 0.45)` backdrop.
- **Toast** (`box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28)`).
- **Note chip** (`box-shadow: 0 1px 0 rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)`): the paper edge of a banknote.
- **Segment thumb** (`box-shadow: 0 1px 2px rgba(28, 33, 27, 0.12)`).

### Named Rules
**The Rules Not Cards Rule.** Content sections are separated by a 1px rule on paper. No stacked rounded cards, no shadow on panels.

## Shapes

Modest, functional corners: 10px for buttons, fields, segmented tracks and picker cells; 8px for small buttons; 9px for category tiles; 4px for banknote chips (with a 2px inner frame); 3px for meters; pills (999px) only for chips and date picks; 16px for dialogs and 18px top corners on mobile sheets. Banknote chips are the only rotated shapes (−3° to 3° tilt). Hairline frames (1px rule) do the bordering; the inset 1px ink ring marks selection in the category picker.

## Components

### Buttons
- **Shape:** gently rounded (10px; 8px on small), min height 44px (36px small, 48px in the dock).
- **Primary:** twenty-baht green with white text, Anuphan 600; hover deepens to primary-hover. One primary per view.
- **Ghost:** transparent with a strong-hairline outline; hover washes to sunk paper. Quiet: no outline, ink-2 text.
- **Danger:** hundred-baht red fill for confirmed destruction; danger-ghost (red text, hairline outline) for the trigger.
- **Band controls:** 40px square icon buttons in translucent band ink on the green band.
- **States:** colour transitions 150ms ease; press nudges down 1px; focus is a 2px ink outline at 2px offset (band ink on the band). Bootstrap focus glow is removed.

### Chips
- **Quick chip:** pill, sheet ground, strong-hairline border, category icon + label + Money SM; logs a repeat entry in one tap. Scrolls horizontally with a fade mask.
- **Date pick:** 30px pill, outline; selected fills with primary green.
- **Filter chip:** fifty-baht blue pill with white text, shown when a category filter is active.

### Cards / Containers
- **Panels**, not cards: no radius, no background change, no shadow, 1px rule beneath, 1.25rem padding, a title row of 36px min height with an optional count in ink-2.
- **Notices:** full-width sunk-paper strip with a leading icon; warn and danger variants tint the ground (gold 16%, red 10%).

### Inputs / Fields
- **Style:** sheet ground, 1px strong-hairline border, 10px radius, 44px min height, 1rem text.
- **Focus:** border turns ink with a 3px tint-green ring.
- **Money field:** Trirong 600 tabular with a trailing ฿ unit; the large variant is 2rem in a 64px field for the add sheet.
- **Segmented control:** sunk track with 3px padding; the checked segment lifts to sheet with a hairline shadow; income segment turns ledger green.
- **Category picker:** 3-column (4 for income) grid of 64px cells; checked cell gets an ink border and inset ring.
- **Errors:** 10px-radius tinted strip with icon (danger, warn, ok variants).

### Navigation
- **Band header:** rosette wordmark, icon controls, month switcher (40px chevrons flanking the month title). On desktop the band tops the sticky left column.
- **Dock:** sheet-ground bar with a top rule, quick chips and primary add button; becomes the foot of the side column on desktop.

### Ledger rows
Grid of 36px category tile, label with optional sub-line, right-aligned Money SM. Tappable rows wash to sunk paper edge-to-edge (the wash bleeds into panel padding); the row being edited holds a tint-green wash. Paused recurring rows drop to 55% opacity.

### Budget meter
10px track (6px thin variant) on sunk paper with a hairline inset; fill in ok green, gold when near, red when over; a 2px ink pace marker shows where spending should be today. Paired with a status label that always combines icon, text and colour.

### Note chips (signature)
Today's allowance broken into Thai denominations (1000, 500, 100, 50, 20), max nine shown plus a "+N ใบ" count. Each chip is 64×34px (74×40px on auth), 4px radius, in its fixed note ink, white Trirong 600 figure, a 1px inner frame at 40% white, and a radial watermark disc on the right. Chips overlap by half their width, gap slightly between denominations, and tilt by small fixed angles. They deal in with a 420ms expo-out slide, staggered 55ms. The stack is one `role="img"` with a spoken breakdown.

### Guilloché
Generated SVG rosettes and wave bands in band-line at 20% opacity (16% dark), behind band content only. Pure geometry: no portraits, crests or seals. A small rosette is the wordmark.

### Sheets, toasts, charts
- **Sheet:** native dialog; bottom sheet with grip on phones (260ms slide-up), centred 16px dialog from 576px (220ms pop-in).
- **Toast:** ink-on-paper inverse (dark pill on light, light pill on dark), 12px radius, with an undo action in green.
- **Charts:** six-month bars; the chosen month in full ink, others at ~30% tint, over-budget months in red, the budget as a dashed ink-2 line; Anuphan labels; grid in rule colour.

### Motion
Ease-out only: `cubic-bezier(0.16, 1, 0.3, 1)` for entrances (note deal 420ms, sheet 260ms, pop-in 220ms, toast 240ms, meter fill 400ms); 150ms ease for colour state changes; 200ms chevron rotation. `prefers-reduced-motion` collapses all animation and transition.

## Do's and Don'ts

### Do:
- **Do** route every amount through Money (Trirong 600, tabular, ฿ at 0.62em, true minus) at one of the four fixed sizes.
- **Do** keep amounts in one right-aligned trailing column.
- **Do** separate sections with 1px hairline rules on paper.
- **Do** give each ink its one job: green shell/action/income, red over/destructive, gold near-limit, blue and purple data and denomination chips only.
- **Do** pair every status colour with an icon and text.
- **Do** use lucide line icons at 1.75 stroke (2 for small status icons) in 36px tiles for categories.
- **Do** define both themes for any new token; dark mode lifts text inks, keeps note inks fixed.
- **Do** keep touch targets at 44px minimum (36px for small and secondary controls).

### Don't:
- **Don't** stack white rounded cards on grey or give panels shadows.
- **Don't** use gradient balance cards or gradient surfaces; the only gradients are the note watermark disc and the loading shimmer.
- **Don't** put emoji in chrome or category icons.
- **Don't** show stock Bootstrap chrome (default blue, focus glow, default radii).
- **Don't** use red, gold, blue or purple decoratively.
- **Don't** set money in the UI sans, or invent new money sizes.
- **Don't** add portraits, crests or seals to guilloché; it stays geometric linework.
