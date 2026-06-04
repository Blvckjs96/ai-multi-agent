---
name: visual-style-system
description: Assemble a complete visual style system — pick a direction, wire color + typography + spacing + radius + shadow + motion tokens into a cohesive CSS/Tailwind kit. Covers 6 named directions with ready-to-use token sets.
---

## Step 1 — Pick a Direction

Never start with "clean and minimal." Choose a named direction:

| # | Direction | Character |
|---|-----------|-----------|
| 1 | **SaaS / Product** | Neutral, dense, functional. Geist/Inter, slate palette, compact spacing |
| 2 | **Editorial / Magazine** | Typographic hierarchy, high contrast, serif display |
| 3 | **Luxury / Premium** | Restrained, slow, gold or stone tones, generous whitespace |
| 4 | **Neo-Brutalism** | Raw borders, offset shadows, saturated fills, bold uppercase |
| 5 | **Creative / Expressive** | Oversized type, bento grid, gradient fills, playful motion |
| 6 | **Dark Luxury** | Deep backgrounds, luminous accents, glass surfaces, tight type |

---

## Direction 1 — SaaS / Product

```css
/* style-saas.css */
:root {
  /* Color */
  --color-bg:      oklch(0.99 0.00 0);
  --color-surface: oklch(1.00 0.00 0);
  --color-border:  oklch(0.91 0.01 250);
  --color-text:    oklch(0.15 0.02 250);
  --color-muted:   oklch(0.50 0.03 250);
  --color-accent:  oklch(0.52 0.21 250);   /* vivid blue */

  /* Typography */
  --font-display: "Geist", ui-sans-serif;
  --font-body:    "Geist", ui-sans-serif;
  --font-mono:    "Geist Mono", ui-monospace;
  --text-base:    clamp(0.875rem, 0.84rem + 0.2vw, 1rem);

  /* Spacing rhythm */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px;

  /* Shape */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadow */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.08);
  --shadow-lg: 0 8px 24px oklch(0 0 0 / 0.10);

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
}
```

**Tailwind class patterns for SaaS:**
```
bg-background text-foreground
border border-border rounded-lg
shadow-sm hover:shadow-md
text-sm font-medium text-muted-foreground
px-4 py-2 (dense) or px-6 py-3 (comfortable)
```

---

## Direction 2 — Editorial / Magazine

```css
:root {
  --color-bg:      oklch(0.99 0.00 0);
  --color-surface: oklch(0.97 0.00 0);
  --color-border:  oklch(0.10 0.00 0);      /* black rule lines */
  --color-text:    oklch(0.10 0.01 250);
  --color-muted:   oklch(0.40 0.01 250);
  --color-accent:  oklch(0.52 0.21 15);     /* editorial red */

  --font-display:  "Playfair Display", Georgia, serif;
  --font-body:     "Inter", ui-sans-serif;
  --font-mono:     "JetBrains Mono", ui-monospace;

  /* Editorial uses fluid scale with wider jumps */
  --text-caption:  clamp(0.75rem, 0.72rem + 0.15vw, 0.875rem);
  --text-body:     clamp(1rem, 0.96rem + 0.2vw, 1.125rem);
  --text-lead:     clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem);
  --text-h2:       clamp(2rem, 1.5rem + 2.5vw, 3.5rem);
  --text-hero:     clamp(3.5rem, 2rem + 7vw, 9rem);

  --radius-sm: 0;
  --radius-md: 2px;    /* editorial is nearly flat */
  --radius-lg: 4px;

  --shadow-sm: none;   /* editorial avoids soft shadows — uses borders */
  --shadow-md: none;
  --shadow-lg: 0 1px 0 oklch(0 0 0 / 1);   /* hard rule only */
}
```

**Editorial class patterns:**
```
font-display text-[clamp(4rem,8vw,10rem)] font-bold tracking-tight leading-[0.95]
font-body text-lg leading-relaxed max-w-[65ch]
border-b border-black pb-2 mb-8    ← rule line dividers
grid grid-cols-12 gap-4            ← 12-col editorial grid
```

---

## Direction 3 — Luxury / Premium

```css
:root {
  --color-bg:      oklch(0.97 0.01 75);     /* warm off-white */
  --color-surface: oklch(0.99 0.00 0);
  --color-border:  oklch(0.85 0.03 75);
  --color-text:    oklch(0.14 0.02 75);
  --color-muted:   oklch(0.50 0.04 75);
  --color-accent:  oklch(0.60 0.14 75);     /* warm gold */
  --color-accent-subtle: oklch(0.93 0.04 75);

  --font-display:  "Cormorant Garamond", Georgia, serif;
  --font-body:     "Jost", ui-sans-serif;

  --text-base:     clamp(0.9375rem, 0.9rem + 0.2vw, 1.0625rem);
  --tracking-display: 0.04em;    /* generous letter spacing for luxury */
  --tracking-caps:    0.12em;    /* ALL CAPS labels */

  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 2px;

  /* Luxury shadow: soft, warm-tinted */
  --shadow-sm: 0 2px 8px oklch(0.6 0.08 75 / 0.12);
  --shadow-md: 0 8px 32px oklch(0.6 0.08 75 / 0.16);
  --shadow-lg: 0 20px 60px oklch(0.6 0.08 75 / 0.20);

  /* Luxury motion is slow and deliberate */
  --ease-out:     cubic-bezier(0.22, 1, 0.36, 1);
  --duration-normal: 400ms;
  --duration-slow:   700ms;
}
```

**Luxury class patterns:**
```
font-display text-5xl font-light italic tracking-[0.04em]
uppercase tracking-[0.12em] text-xs text-muted    ← category labels
py-24 px-12                                        ← generous section padding
border border-[var(--color-border)]                ← thin gold-tinted border
```

---

## Direction 4 — Neo-Brutalism

See `/neo-brutalism` skill for full patterns. Token summary:

```css
:root {
  --color-bg:     #fff;
  --color-text:   #000;
  --color-accent: #f5e642;   /* swap freely: #ff6fd8 #4f8eff #3ddc84 */
  --radius-sm: 0; --radius-md: 0; --radius-lg: 0;
  --shadow-brutal: 4px 4px 0 #000;
  --shadow-brutal-lg: 6px 6px 0 #000;
  --duration-fast: 80ms;
  --ease-out: linear;        /* brutalism moves instantly */
}
```

---

## Direction 5 — Creative / Expressive

```css
:root {
  --color-bg:      oklch(0.98 0.00 0);
  --color-surface: oklch(1.00 0.00 0);
  --color-accent-1: oklch(0.64 0.22 295);   /* violet */
  --color-accent-2: oklch(0.72 0.18  15);   /* coral */
  --color-accent-3: oklch(0.80 0.16  85);   /* yellow */

  --font-display:  "Fraunces", Georgia, serif;
  --font-body:     "Nunito", ui-sans-serif;

  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 32px;
  --radius-pill: 9999px;

  /* Gradient fills */
  --gradient-hero: linear-gradient(135deg, oklch(0.64 0.22 295), oklch(0.72 0.18 15));
  --gradient-card: linear-gradient(160deg, oklch(0.95 0.05 295), oklch(0.97 0.04 15));
}
```

---

## Direction 6 — Dark Luxury

```css
:root {
  --color-bg:      oklch(0.10 0.02 250);    /* very dark blue-black */
  --color-surface: oklch(0.14 0.03 250);
  --color-border:  oklch(0.22 0.04 250);
  --color-text:    oklch(0.94 0.01 250);
  --color-muted:   oklch(0.60 0.05 250);
  --color-accent:  oklch(0.80 0.15 75);     /* luminous gold */
  --color-accent-glow: oklch(0.80 0.15 75 / 0.3);

  --font-display:  "Cormorant Garamond", serif;
  --font-body:     "Inter", ui-sans-serif;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;

  /* Glass surface */
  --glass-bg: oklch(1 0 0 / 0.04);
  --glass-border: oklch(1 0 0 / 0.10);
  --glass-blur: blur(20px);

  /* Glow shadow */
  --shadow-accent: 0 0 32px oklch(0.80 0.15 75 / 0.25);
  --shadow-surface: 0 8px 32px oklch(0 0 0 / 0.50);

  --duration-normal: 350ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## Composing the Full Kit

Once direction is chosen, create a single `style-kit.css` that imports all layers:

```css
/* style-kit.css */
@import "./fonts.css";         /* @font-face declarations */
@import "./tokens.css";        /* raw palette + semantic layer */
@import "./shadcn.css";        /* HSL variable mapping for shadcn */
@import "./typography.css";    /* fluid type scale */
@import "./animations.css";    /* motion tokens + keyframes */
```

```css
/* animations.css */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

.animate-fade-up    { animation: fade-up    var(--duration-normal) var(--ease-out) both; }
.animate-fade-in    { animation: fade-in    var(--duration-normal) var(--ease-out) both; }
.animate-scale-in   { animation: scale-in   var(--duration-normal) var(--ease-out) both; }

/* Stagger utility */
.stagger-1 { animation-delay: 0.06s; }
.stagger-2 { animation-delay: 0.12s; }
.stagger-3 { animation-delay: 0.18s; }
.stagger-4 { animation-delay: 0.24s; }
```

---

## Token Consistency Rules

| Token type | Rule |
|---|---|
| Color | Use semantic names in components (`--color-accent`), never palette steps (`blue-500`) |
| Font | Only 3 roles: display, body, mono. Map to `--font-*` variables |
| Spacing | Use 4px base grid: 4/8/12/16/24/32/48/64/96/128 |
| Radius | One radius scale per direction — never mix flat (0) and pill (9999) |
| Shadow | Match direction mood: hard (brutalism), soft-warm (luxury), glow (dark luxury) |
| Motion | Speed from direction: instant (brutalism), snappy (SaaS), deliberate (luxury) |

---

## Quality Checklist

- [ ] Direction chosen before writing any component
- [ ] Color, typography, spacing, radius, shadow, and motion all match the direction
- [ ] Semantic token names used in all components — no raw palette values
- [ ] Dark mode tokens defined (or dark mode explicitly not supported with a reason)
- [ ] The full style kit fits in one `style-kit.css` import — no scattered token files
- [ ] At least 4 of the 10 design quality criteria met (hierarchy, rhythm, depth, typography, color, states, composition, texture, motion, data)
- [ ] No default library values used without override
- [ ] Style direction produces output that looks like a real product, not a template
