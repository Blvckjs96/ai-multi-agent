---
name: font-pairing
description: Generate font pairing systems — curated display/body/mono pairings for 6 style directions, Next.js next/font loading, variable font setup, CSS font-face with font-display, and pairing decision rules.
---

## Pairing Logic

Good pairings create contrast between roles, not conflict:

| Role | Purpose | Traits to look for |
|------|---------|-------------------|
| **Display** | Headlines, hero text | Personality, weight contrast, distinctive letterforms |
| **Body** | Paragraphs, UI labels | High x-height, generous spacing, legible at 16px |
| **Mono** | Code, data, tabular | Clear 0/O l/1 distinction, monospaced rhythm |

**Rules:**
1. Serif display + sans body = classic contrast (safe)
2. Sans display + serif body = modern inversion (editorial)
3. Never two serifs or two display fonts at the same weight
4. Mono is always a third slot — never replace body with mono

---

## Curated Pairings by Style Direction

### 1. Editorial / Magazine
```
Display: Playfair Display (serif, high contrast)
Body:    Inter or DM Sans (clean, neutral)
Mono:    JetBrains Mono

Ratio:   Display 5–10× body size in hero
Weight:  Display 700–900 / Body 400–500
```

### 2. SaaS / Product (modern & clean)
```
Display: Cal Sans or Geist (geometric sans)
Body:    Geist or Inter
Mono:    Geist Mono

Ratio:   Display 2–3× body
Weight:  Display 600–700 / Body 400
```

### 3. Luxury / Premium
```
Display: Cormorant Garamond or Freight Display (high-contrast serif)
Body:    Jost or Neue Haas Grotesk / fallback: DM Sans
Mono:    Fira Code

Ratio:   Display very large, tracked (letter-spacing: 0.02em+)
Weight:  Display 300–400 italic or 700 / Body 300–400
```

### 4. Neo-Brutalism
```
Display: Space Grotesk or Syne (quirky geometric)
Body:    Space Grotesk (same family, different weight)
Mono:    Space Mono

Ratio:   Display 3–8× body, uppercase + tight tracking
Weight:  Display 700–800 / Body 500–600
```

### 5. Technical / Developer Tool
```
Display: IBM Plex Sans (humanist technical)
Body:    IBM Plex Sans
Mono:    IBM Plex Mono

Ratio:   Modest (1.5–2× body), monospaced accents in UI
Weight:  Display 600 / Body 400 / Mono 400
```

### 6. Creative / Agency
```
Display: Fraunces (optical sizing, quirky variable)
Body:    Nunito or Outfit (rounded, friendly)
Mono:    Cascadia Code

Ratio:   Display used sparingly at extreme sizes (8rem+)
Weight:  Display variable opsz / Body 400–500
```

---

## Next.js `next/font` Setup

```tsx
// lib/fonts.ts
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";

export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
```

```tsx
// app/layout.tsx
import { fontSans, fontDisplay, fontMono } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(fontSans.variable, fontDisplay.variable, fontMono.variable)}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

```css
/* globals.css */
:root {
  --font-sans:    var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  --font-display: var(--font-display, Georgia, serif);
  --font-mono:    var(--font-mono, ui-monospace, monospace);
}
```

```css
/* tailwind.config.ts */
fontFamily: {
  sans:    ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
  display: ["var(--font-display)", "Georgia", "serif"],
  mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
},
```

---

## Self-Hosted Variable Font Setup

```css
/* fonts.css — for non-Next.js projects */
@font-face {
  font-family: "Fraunces";
  src: url("/fonts/Fraunces[SOFT,WONK,opsz,wght].woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: optional;   /* prevents FOUT on repeat visits */
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
                 U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122,
                 U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Fraunces";
  src: url("/fonts/Fraunces-Italic[SOFT,WONK,opsz,wght].woff2") format("woff2");
  font-weight: 100 900;
  font-style: italic;
  font-display: optional;
}
```

**Variable font axes quick reference:**

| Font | Axes | Notes |
|------|------|-------|
| Fraunces | `wght` `opsz` `SOFT` `WONK` | `opsz` 9–144, auto-optical-size |
| Inter | `wght` `opsz` | `opsz` 14–32 |
| Recursive | `wght` `MONO` `CASL` `slnt` `CRSV` | Switch between mono/casual/cursive |
| Geist | `wght` | Vercel's system font |
| Source Serif 4 | `wght` `opsz` | Reliable body at any size |

```css
/* Use variable font axes in CSS */
.hero-headline {
  font-family: "Fraunces", serif;
  font-weight: 800;
  font-variation-settings: "opsz" 72, "SOFT" 0, "WONK" 1;
}
```

---

## CSS Utility Classes (Tailwind-compatible)

```css
/* typography-roles.css */
.font-display { font-family: var(--font-display); }
.font-body    { font-family: var(--font-sans); }
.font-code    { font-family: var(--font-mono); }

/* Optical sizing shorthand */
.text-optical-sm { font-variation-settings: "opsz" 14; }
.text-optical-lg { font-variation-settings: "opsz" 72; }
```

---

## Pairing Usage Patterns

### Hero with display/body contrast
```tsx
<section>
  <h1 className="font-display text-6xl font-bold tracking-tight">
    Build interfaces people remember
  </h1>
  <p className="font-sans text-lg text-muted-foreground mt-4 max-w-xl">
    The design system that ships production-ready components.
  </p>
</section>
```

### Inline mono accents
```tsx
<p className="font-sans text-base">
  Add the{" "}
  <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded text-primary">
    --color-accent
  </code>{" "}
  token to your config.
</p>
```

### Pull quote (italic display)
```tsx
<blockquote className="font-display text-2xl italic font-light tracking-wide border-l-4 border-accent pl-6">
  "Design is the silent ambassador of your brand."
</blockquote>
```

---

## Preload Strategy

```html
<!-- Preload ONLY the critical display weight — never all weights -->
<link
  rel="preload"
  href="/fonts/Playfair_Display-Bold.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

- Preload maximum 1–2 font files (hero weight only)
- `font-display: optional` for body text (no FOUT)
- `font-display: swap` for display text (FOUT acceptable for large text)
- Never preload mono — it's never render-blocking

---

## Quick-Pick Matrix

| Project type | Display | Body | Mono |
|---|---|---|---|
| SaaS dashboard | Geist | Geist | Geist Mono |
| Marketing landing | Cal Sans | Inter | JetBrains Mono |
| Editorial blog | Playfair Display | Source Serif 4 | Fira Code |
| Luxury brand | Cormorant Garamond | Jost | Fira Code |
| Dev tool | IBM Plex Sans | IBM Plex Sans | IBM Plex Mono |
| Creative portfolio | Fraunces | Nunito | Cascadia Code |
| Neo-brutalism | Space Grotesk | Space Grotesk | Space Mono |
| Japanese product | Noto Serif JP | Noto Sans JP | — |

---

## Quality Checklist

- [ ] Max 2 font families unless there is a deliberate 3rd (mono always ok)
- [ ] Display and body fonts have clear visual contrast (weight, classification, or size)
- [ ] `font-display: swap` for display fonts, `optional` for body (prevents CLS from body FOUT)
- [ ] Only the critical weight is preloaded — not the entire family
- [ ] Variable fonts use `font-variation-settings` for non-standard axes
- [ ] Fallback stack defined after custom font — never rely on single `var(--font-sans)`
- [ ] `antialiased` on `<body>` via Tailwind
- [ ] Mono font used in `<code>`, `<pre>`, data tables — never body prose
- [ ] `font-feature-settings: "kern" 1, "liga" 1"` for display text where kerning matters
- [ ] Japanese text gets `font-feature-settings: "palt" 1` and `lang="ja"` on the element
