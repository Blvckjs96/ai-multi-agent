---
name: typography-system
description: Research-grounded typography for web UI — line length, fluid type scale, contrast tokens, dark mode, Japanese overrides, font loading, and accessibility. Apply whenever CSS touches font-size, line-height, max-width, or color.
---

## Token File — generate this first for any new project

```css
/* typography-tokens.css */
:root {
  /* Scale — 1.25 major third from 16px */
  --size-xs:   0.75rem;    /* 12px — captions, fine print */
  --size-sm:   0.875rem;   /* 14px — labels, metadata */
  --size-base: 1rem;       /* 16px — body, inputs */
  --size-md:   1.25rem;    /* 20px — lead text, intros */
  --size-lg:   1.5625rem;  /* 25px — H3, card titles */
  --size-xl:   1.953rem;   /* 31px — H2 */
  --size-2xl:  2.441rem;   /* 39px — H1 */
  --size-3xl:  3.052rem;   /* 49px — hero / display */

  /* Fluid headings */
  --size-h1: clamp(28px, 4vw + 16px, 48px);
  --size-h2: clamp(22px, 2.5vw + 16px, 32px);
  --size-h3: clamp(18px, 1.5vw + 14px, 25px);

  /* Line height */
  --lh-body:    1.5;
  --lh-heading: 1.1;
  --lh-sub:     1.2;
  --lh-label:   1.3;
  --lh-ja:      1.7;

  /* Color — light */
  --color-text:     #1a1a1a;
  --color-text-2:   #595959;
  --color-text-off: #8a8a8a;
  --color-bg:       #f5f5f5;
  --color-surface:  #ffffff;

  --fs-scale: 1;        /* reader control multiplier: 0.85 / 1 / 1.15 */
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-text:     #e8e8e8;
    --color-text-2:   #a0a0a0;
    --color-text-off: #606060;
    --color-bg:       #121212;
    --color-surface:  #1e1e1e;
  }
}

body {
  font-size: calc(clamp(16px, 1.1vw + 14px, 18px) * var(--fs-scale));
  line-height: var(--lh-body);
  color: var(--color-text);
  background-color: var(--color-bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif;
  font-optical-sizing: auto;
}
```

## Line Length

```css
/* Reading containers — always constrain */
.prose { max-width: min(90vw, 65ch); margin-inline: auto; }

/* Heading CPL targets */
/* H1 / hero: 30–40 chars  H2: 40–60  H3: 50–65 */
```

- Body target: **60–65 CPL**. Hard limits: 45 min, 80 max.
- Use `ch` for Latin (scales with font + zoom). Use `em` for Japanese.
- Full-width liquid layouts for long-form reading = always wrong.

## Font Size

| Context | Size |
|---------|------|
| Desktop body | 18px target (`clamp` to 16px min) |
| Mobile body | 16px absolute floor |
| Long-form / articles | 18–24px |
| Dense UI / dashboard | 14–16px |
| Any readable text | 12px minimum — never below |

## Line Height — couples to column width

| Column width | Line height |
|-------------|------------|
| 45ch | 1.4 |
| 65ch | 1.5 |
| 80ch | 1.6 |
| Mobile body | 1.55–1.6 |
| Japanese body | 1.7 |
| Headings | 1.1 |
| Subheadings | 1.2 |

## Type Scale — max 5–6 distinct sizes per UI

Use the 1.25 major-third token set above. For editorial/reading layouts use **1.333**. For dense dashboards use **1.125**.

## Contrast

| Mode | Target | WCAG minimum |
|------|--------|-------------|
| Light body | 7:1–10:1 | 4.5:1 |
| Dark body | ~14:1 | 4.5:1 |
| Disabled / placeholder | 3:1 | — |

- Light: `#1a1a1a` on `#f5f5f5` ≈ 10:1 ✓
- Dark: **never** `#000` background. Use `#121212`. **Never** mechanically invert.
- Dark surfaces: `#121212` (base) → `#1e1e1e` → `#252525` → `#2c2c2c` (elevation)
- Dark accents: desaturate 20–40% from light-mode values.

## Font Weight Hierarchy

| Weight | Value | Use |
|--------|-------|-----|
| Regular | 400 | Body, most UI text |
| Medium | 500 | Active nav states |
| Semi-bold | 600 | Nav labels, buttons, subheadings |
| Bold | 700 | H1–H2 only |
| Heavy | 800+ | Display/hero only |

Bold everywhere = no hierarchy. Reserve it for the top level.

## Spacing

```css
p + p { margin-block-start: 1.1em; }
h2 { margin-block-start: 2em; margin-block-end: 0.5em; }
h3 { margin-block-start: 1.75em; margin-block-end: 0.4em; }
```

Space *above* heading ≈ 2× space below — binds it to its content.

## Font Selection Quick Picks

| Context | Primary | Fallback |
|---------|---------|---------|
| Web UI | Inter | Source Sans 3 |
| Long-form reading | Literata | Charter |
| Code | JetBrains Mono | Fira Code |
| Display headings | Fraunces / Space Grotesk | Playfair Display |
| "Just pick a system" | Source superfamily | IBM Plex superfamily |

**System font stack (zero loading cost):**
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif;
```

## Font Loading

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter.woff2") format("woff2");
  font-display: optional;   /* eliminates FOUT/FOIT — use swap for brand display only */
  font-weight: 100 900;     /* variable font — one file, all weights */
}
```

- Self-host. Cache partitioning killed CDN font advantage.
- **woff2 only** — drop all other formats.
- `font-display: optional` as default; `swap` for brand-critical display only.
- Variable fonts when using 2+ weights of the same family.
- Font budget: < 100KB total per page. Target: < 50KB.
- **Two families maximum.** Superfamilies (Source, IBM Plex, Noto) eliminate pairing risk.

## Mobile

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

```css
a, button { padding-block: 0.25em; min-height: 44px; } /* 44px touch target */
```

- Always use `rem` for font sizes, `em` for spacing, `px` only for borders.
- Viewport meta is non-negotiable — flag as violation if absent.

## Japanese Typography Overrides

Activate when `lang="ja"` is present.

```css
:lang(ja) {
  max-width: min(90vw, 38em);   /* em, not ch */
  line-height: 1.7;
  letter-spacing: 0.05em;
  text-align: justify;
  text-align-last: left;
  line-break: strict;           /* JIS X 4051 kinsoku */
  word-break: keep-all;
  overflow-wrap: break-word;
  font-family:
    'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic,
    'Meiryo', 'Noto Sans JP', sans-serif;
}

:lang(ja) h1, :lang(ja) h2, :lang(ja) h3 {
  line-height: 1.25;
  letter-spacing: 0;
  word-break: auto-phrase; /* Chrome 119+ */
}
```

**Japanese absolute prohibitions:** `word-break: break-all`, `font-style: italic`, `ch` units for column width, omitting `lang="ja"`, full font without subsetting.

## Absolute Prohibitions

```
❌ text-align: justify on Latin text
❌ font-size below 12px for any readable text
❌ #000 on #fff or #fff on #000 for body text
❌ #000 as dark mode background — use #121212
❌ More than 6 distinct font sizes without documented reason
❌ letter-spacing on mixed-case body text
❌ ALL-CAPS for text longer than 4–5 words
❌ Mechanical dark mode color inversion
❌ Missing viewport meta tag
❌ Two fonts from the same category (e.g. two geometric sans)
```

## Quality Checklist

- [ ] Token file (`typography-tokens.css`) generated before any component CSS
- [ ] Body text constrained to `max-width: min(90vw, 65ch)`
- [ ] Body font-size uses `clamp(16px, 1.1vw + 14px, 18px)`
- [ ] Body line-height ≥ 1.5
- [ ] Light contrast ≥ 4.5:1; dark ≥ 4.5:1 (never pure black bg)
- [ ] `prefers-color-scheme` handled via tokens, not mechanical inversion
- [ ] Viewport meta tag present
- [ ] Touch targets ≥ 44px
- [ ] Max 5–6 distinct font sizes
- [ ] Self-hosted woff2, `font-display: optional`
- [ ] `lang="ja"` declared if Japanese content present
