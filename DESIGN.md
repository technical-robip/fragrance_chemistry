---
name: Fragrance Chemistry
description: Formulation lab — ink grounds, teal accent, amber warning, Fraunces over Source Sans 3
colors:
  ink-950: '#060c0f'
  ink-900: '#0b1418'
  ink-800: '#122028'
  teal-400: '#3dafa3'
  teal-500: '#2a9d8f'
  amber-400: '#e8b86d'
  amber-500: '#c9923e'
  paper: '#e8ecef'
  paper-muted: '#9aa8b2'
  note-top: '#6ecf9a'
  note-heart: '#e8b86d'
  note-base: '#9b7bb8'
  danger: '#d45d5d'
  family-fresh: '#6ecfc4'
  family-citrus: '#e8d36a'
  family-green: '#3d9a6a'
  light-bg: '#f7f4ee'
  light-text: '#1a1f24'
typography:
  display:
    fontFamily: 'Fraunces, Georgia, serif'
    fontWeight: 600
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Source Sans 3, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: '6px'
  md: '10px'
  lg: '16px'
spacing:
  touch: '44px'
components:
  button-primary:
    backgroundColor: '{colors.teal-400}'
    textColor: '{colors.ink-950}'
    rounded: '{rounded.sm}'
    padding: '0.55rem 1rem'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.teal-400}'
    rounded: '{rounded.sm}'
---

# Design System: Fragrance Chemistry

## Overview

**Creative North Star: "The lab reference manual"**

The product looks like the notebook a perfumer already trusts: ink paper, a bound edge, measured type, and computed values written on a translucent overlay rather than in badges. Dark is the bench light; light is the paper on the desk. Both are first-class.

Personality is editorial and technical, never generic SaaS. Density is low on the public surface and high inside the lab. Colour is used as a signal (teal for the engine, amber for a decision, note hues for the pyramid), not as decoration.

**Key Characteristics:**

- Fraunces display, Source Sans 3 body, tabular figures for every mass
- Deep ink grounds with teal accent and amber warning from `apps/web/src/styles/tokens.css`
- Boards carry the work; acetate leaves carry only computed values
- Touch targets stay at 44px; reduced motion is respected

## Colors

The palette is the incumbent tokens file. Do not introduce a new hue on a new surface.

### Primary

- **Bench teal** (`#3dafa3` / `#2a9d8f`): actions, live engine state, focus rings.

### Secondary

- **Blotter amber** (`#e8b86d` / `#c9923e`): warnings, values below scale resolution, display titles in the lab.

### Neutral

- **Ink** (`#0b1418`, `#122028`, `#060c0f`): dark surfaces.
- **Paper** (`#e8ecef` on dark, `#f7f4ee` on light): text and light grounds.

### Notes

- Top `#6ecf9a`, heart `#e8b86d`, base `#9b7bb8`. These three are reserved for the pyramid.

### Families

Olfactory-family fills live on `--fc-family-*` (catalog, workbench radar, evaluation). Fresh, Citrus, and Green are distinct; they do not share the pyramid top green. Harsh is a blotter mark, not a family.

## Typography

Display is Fraunces 600, tracking about `-0.02em`, never below `-0.04em`. Body is Source Sans 3 at 15px / 1.5. Masses and percents use a tabular mono. Measure on reading copy stays near 66ch.

## Layout

Public surface: a bound left rail, a stepped tab rail on the fore edge, sheets on a four-column grid that collapse to one column under 60rem. Lab surface: `AppShell` with a primary nav and a formula-carrying query string.

## Elevation & Depth

A surface declares itself with a border or a shadow, not both. Leaves take the soft shadow; boards take a 2px top rule in the division hue. No zero-offset coloured glow.

## Shapes

Radii: 6 / 10 / 16. Cards sit at the large radius. Pills are for small controls only. Punch holes and tab geometry belong to the public manual; they do not migrate into the lab.

## Components

- **Primary button:** teal fill, ink text, 44px min height.
- **Quiet button:** transparent, teal border.
- **Input:** ink-950 fill, muted border, teal focus ring.
- **Chip:** quiet fill, stronger border when active.

## Do's and Don'ts

- Do compute every number the visitor can see; never invent customers, prices, or testimonials.
- Do keep dark and light equally finished.
- Do not add a kicker/eyebrow above a heading.
- Do not introduce purple gradients, glass as decoration, or a second type family.
- Do not claim IFRA endorsement; the product checks against the standard.
