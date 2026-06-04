---
name: color-palette
description: Generate semantic color systems — OKLCH palette generation, shadcn/ui CSS variable mapping, Tailwind config, light/dark mode tokens, semantic naming (surface/text/border/accent), and accessible contrast checking.
---

## Why OKLCH

OKLCH is perceptually uniform — equal lightness steps look equal to the eye across all hues. Use it for palette generation; output HSL for shadcn/ui compatibility.

```
oklch(L C H)
  L — lightness 0–1 (0 = black, 1 = white)
  C — chroma 0–0.4 (0 = gray, 0.37 = vivid)
  H — hue 0–360 (degrees)
```

## Palette Generation Strategy

Pick one brand hue, derive the full scale by varying L only. Keep C and H constant.

```
Brand hue example: oklch(? 0.21 250)  ← vivid blue

Scale:
  50:  oklch(0.97 0.05 250)  ← near white tint
 100:  oklch(0.94 0.08 250)
 200:  oklch(0.87 0.11 250)
 300:  oklch(0.76 0.15 250)
 400:  oklch(0.64 0.19 250)
 500:  oklch(0.52 0.21 250)  ← brand mid
 600:  oklch(0.43 0.21 250)
 700:  oklch(0.34 0.20 250)
 800:  oklch(0.25 0.18 250)
 900:  oklch(0.16 0.14 250)
 950:  oklch(0.10 0.10 250)  ← near black shade
```

Reduce C slightly at the extremes (50 and 950) to avoid over-saturated near-whites/blacks.

## Semantic Token Layer (CSS)

```css
/* tokens.css — generated from palette */
:root {
  /* --- Backgrounds --- */
  --color-bg:              oklch(0.99 0.00 0);
  --color-bg-subtle:       oklch(0.96 0.01 250);
  --color-bg-muted:        oklch(0.92 0.02 250);

  /* --- Surfaces (cards, panels) --- */
  --color-surface:         oklch(1.00 0.00 0);
  --color-surface-raised:  oklch(0.98 0.01 250);

  /* --- Borders --- */
  --color-border:          oklch(0.87 0.02 250);
  --color-border-strong:   oklch(0.76 0.05 250);

  /* --- Text --- */
  --color-text:            oklch(0.14 0.02 250);
  --color-text-muted:      oklch(0.45 0.04 250);
  --color-text-subtle:     oklch(0.65 0.03 250);
  --color-text-inverse:    oklch(0.99 0.00 0);

  /* --- Brand / Accent --- */
  --color-accent:          oklch(0.52 0.21 250);
  --color-accent-hover:    oklch(0.43 0.21 250);
  --color-accent-subtle:   oklch(0.94 0.08 250);
  --color-accent-fg:       oklch(0.99 0.00 0);   /* text on accent bg */

  /* --- Semantic states --- */
  --color-success:         oklch(0.54 0.17 142);
  --color-success-subtle:  oklch(0.94 0.07 142);
  --color-warning:         oklch(0.72 0.18  85);
  --color-warning-subtle:  oklch(0.96 0.06  85);
  --color-danger:          oklch(0.55 0.22  25);
  --color-danger-subtle:   oklch(0.95 0.06  25);
  --color-info:            oklch(0.58 0.18 230);
  --color-info-subtle:     oklch(0.94 0.06 230);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:              oklch(0.13 0.02 250);
    --color-bg-subtle:       oklch(0.17 0.02 250);
    --color-bg-muted:        oklch(0.21 0.03 250);

    --color-surface:         oklch(0.17 0.02 250);
    --color-surface-raised:  oklch(0.21 0.03 250);

    --color-border:          oklch(0.28 0.04 250);
    --color-border-strong:   oklch(0.38 0.06 250);

    --color-text:            oklch(0.95 0.01 250);
    --color-text-muted:      oklch(0.72 0.04 250);
    --color-text-subtle:     oklch(0.55 0.04 250);
    --color-text-inverse:    oklch(0.14 0.02 250);

    --color-accent:          oklch(0.64 0.19 250);  /* lighter in dark */
    --color-accent-hover:    oklch(0.72 0.17 250);
    --color-accent-subtle:   oklch(0.20 0.06 250);
    --color-accent-fg:       oklch(0.10 0.02 250);

    --color-success:         oklch(0.68 0.15 142);
    --color-success-subtle:  oklch(0.20 0.05 142);
    --color-warning:         oklch(0.80 0.16  85);
    --color-warning-subtle:  oklch(0.22 0.06  85);
    --color-danger:          oklch(0.68 0.20  25);
    --color-danger-subtle:   oklch(0.22 0.06  25);
    --color-info:            oklch(0.70 0.15 230);
    --color-info-subtle:     oklch(0.21 0.05 230);
  }
}
```

## shadcn/ui HSL Variable Mapping

shadcn expects HSL. Convert OKLCH → HSL using oklch.com or CSS Color 4 tooling.

```css
/* globals.css — shadcn layer */
:root {
  --background:       0 0% 100%;
  --foreground:       224 10% 10%;
  --card:             0 0% 100%;
  --card-foreground:  224 10% 10%;
  --primary:          221 83% 53%;     /* mapped from --color-accent */
  --primary-foreground: 0 0% 98%;
  --secondary:        214 32% 91%;
  --secondary-foreground: 224 10% 20%;
  --muted:            214 32% 91%;
  --muted-foreground: 215 16% 47%;
  --accent:           214 32% 91%;
  --accent-foreground: 224 10% 20%;
  --destructive:      0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --border:           214 32% 91%;
  --input:            214 32% 91%;
  --ring:             221 83% 53%;
  --radius: 0.5rem;
}

.dark {
  --background:       222 47% 11%;
  --foreground:       210 40% 98%;
  --card:             222 47% 14%;
  --card-foreground:  210 40% 98%;
  --primary:          217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --secondary:        217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted:            217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent:           217 33% 17%;
  --accent-foreground: 210 40% 98%;
  --destructive:      0 63% 55%;
  --destructive-foreground: 210 40% 98%;
  --border:           217 33% 17%;
  --input:            217 33% 17%;
  --ring:             224 76% 48%;
}
```

## Tailwind Config Extension

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "oklch(0.97 0.05 250)",
          100: "oklch(0.94 0.08 250)",
          200: "oklch(0.87 0.11 250)",
          300: "oklch(0.76 0.15 250)",
          400: "oklch(0.64 0.19 250)",
          500: "oklch(0.52 0.21 250)",
          600: "oklch(0.43 0.21 250)",
          700: "oklch(0.34 0.20 250)",
          800: "oklch(0.25 0.18 250)",
          900: "oklch(0.16 0.14 250)",
          950: "oklch(0.10 0.10 250)",
        },
        /* Map semantic tokens into Tailwind utility classes */
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        accent: "var(--color-accent)",
        "accent-subtle": "var(--color-accent-subtle)",
      },
      /* shadcn tokens */
      backgroundColor: {
        background: "hsl(var(--background))",
        card:       "hsl(var(--card))",
      },
      textColor: {
        foreground:       "hsl(var(--foreground))",
        "card-foreground": "hsl(var(--card-foreground))",
        "muted-foreground": "hsl(var(--muted-foreground))",
      },
      borderColor: {
        border: "hsl(var(--border))",
      },
    },
  },
};

export default config;
```

## Curated Palette Starters

### Midnight Blue (professional / SaaS)
```
Accent hue: oklch(? 0.21 250)   ← H=250
bg dark:    oklch(0.12 0.03 250)
```

### Forest (natural / wellness)
```
Accent hue: oklch(? 0.17 142)   ← H=142
bg dark:    oklch(0.13 0.03 142)
```

### Amber / Gold (luxury / finance)
```
Accent hue: oklch(? 0.18 75)    ← H=75
bg dark:    oklch(0.11 0.02 75)
```

### Rose (beauty / fashion)
```
Accent hue: oklch(? 0.20 15)    ← H=15
bg dark:    oklch(0.13 0.03 15)
```

### Violet (creative / AI)
```
Accent hue: oklch(? 0.22 295)   ← H=295
bg dark:    oklch(0.12 0.03 295)
```

### Slate (neutral / editorial)
```
Accent hue: oklch(? 0.04 250)   ← low-chroma blue-gray
bg dark:    oklch(0.11 0.01 250)
```

## Contrast Reference (WCAG)

| Pair | Ratio | Level |
|------|-------|-------|
| White on Accent-500 | 4.5:1+ | AA Normal |
| Accent-900 on Accent-100 | 7:1+ | AAA |
| --text on --bg | 7:1 target | AAA |
| --text-muted on --bg | 4.5:1 minimum | AA |
| --text-subtle on --bg | 3:1 minimum (large text only) | AA Large |

Check with: `okColor.app/contrast` or browser DevTools color picker.

## Multi-Brand / Theming Pattern

```tsx
// Apply theme via data attribute
<div data-theme="forest">
  {/* All children use forest palette */}
</div>

/* CSS */
[data-theme="forest"] {
  --color-accent:       oklch(0.52 0.17 142);
  --color-accent-hover: oklch(0.43 0.17 142);
  --color-accent-subtle: oklch(0.94 0.07 142);
}

[data-theme="rose"] {
  --color-accent:       oklch(0.55 0.20 15);
  --color-accent-hover: oklch(0.46 0.20 15);
  --color-accent-subtle: oklch(0.95 0.07 15);
}
```

## Quality Checklist

- [ ] Palette uses OKLCH with constant H and C across the scale
- [ ] C reduced at 50 and 950 to avoid over-saturated extremes
- [ ] Semantic token names: never hardcode a number like `blue-500` in component code
- [ ] Dark mode inverts L values — never just darkens the light palette
- [ ] Accent in dark mode is a lighter step (e.g. 400) not the same step as light mode (500)
- [ ] All text/bg pairs checked at WCAG AA minimum (4.5:1 normal, 3:1 large)
- [ ] State colors (success/warning/danger/info) defined for both light and dark
- [ ] shadcn HSL variables present in `globals.css` for component compatibility
- [ ] `--radius` set intentionally — not left at default
- [ ] No hardcoded `#hex` or `rgb()` values in component files
