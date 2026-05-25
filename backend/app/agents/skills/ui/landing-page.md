---
name: landing-page
description: Generate SaaS landing pages with shadcn/ui Button/Badge/Card, Framer Motion scroll-triggered sections, staggered hero animations, and kit motion tokens
---

## SaaS Landing Page Strategy

### shadcn/ui Components to Use
- `Button` — hero CTAs: `variant="default"` (primary) + `variant="outline"` (ghost)
- `Badge` — "New", "Beta", version labels above hero headline
- `Card`, `CardHeader`, `CardContent` — feature cards, pricing cards, testimonial cards
- `Separator` — between page sections and footer columns
- `Avatar`, `AvatarImage`, `AvatarFallback` — testimonial author avatars
- `NavigationMenu` — sticky navbar links
- `HoverCard` — feature tooltip previews

### Page Sections (in order)
1. **Navbar** — sticky, logo + NavigationMenu links + two Buttons
2. **Hero** — min-height: 100vh, gradient bg, Badge label + headline + subtext + 2 CTAs
3. **Features** — 3-col Card grid
4. **Social Proof** — logo strip (grayscale) or testimonial Cards
5. **CTA Section** — contrasting background, single Button
6. **Footer** — Separator + 4-col links + copyright

### Tailwind Animate (from kit animation library)
```tsx
// Hero badge — fade-in from top (200ms)
<Badge className="animate-in slide-in-from-top fade-in duration-200">New ✨</Badge>

// Hero headline — zoom-in-95 + fade-in (200ms)
<h1 className="animate-in zoom-in-95 fade-in duration-200 delay-75">

// Hero subtext — fade-in with delay (200ms)
<p className="animate-in fade-in duration-200 delay-150">

// CTA buttons — slide-in-from-bottom (300ms)
<div className="animate-in slide-in-from-bottom fade-in duration-300 delay-200">
```

### Framer Motion — Scroll-Triggered Sections
```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

function AnimatedSection({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Feature cards — staggered entrance
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
```

### Hero Gradient Headline
```css
.hero-headline {
  background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: clamp(2.5rem, 6vw, 5rem);
  line-height: 1.1;
}
```

### Hover Effects (from kit effects library)
```tsx
// Feature card hover lift
<Card className="hover:-translate-y-1 hover:border-primary hover:shadow-lg transition-all duration-200">

// CTA button hover
<Button className="hover:bg-primary/90 active:scale-[0.98] transition-all duration-150">

// Nav link hover
<a className="hover:text-foreground transition-colors duration-150 text-muted-foreground">
```

### Motion Token Reference
| Element | Duration | Notes |
|---------|----------|-------|
| Badge / label | 200ms | `slide-in-from-top fade-in` |
| Hero headline | 200ms + 75ms delay | `zoom-in-95 fade-in` |
| Hero subtext | 200ms + 150ms delay | `fade-in` |
| CTA buttons | 300ms + 200ms delay | `slide-in-from-bottom` |
| Section scroll-trigger | 500ms | Framer `useInView` |
| Feature card stagger | 100ms between | `staggerChildren: 0.1` |

### Quality Checklist
- [ ] shadcn `Button` for all CTAs — NOT plain `<a>` or `<div>`
- [ ] Hero has staggered animation sequence (badge → headline → sub → buttons)
- [ ] Feature section uses `AnimatedSection` + staggered cards
- [ ] `useInView` scroll triggers on Features, SocialProof, CTA sections
- [ ] All animations have `motion-reduce:` fallback
- [ ] App.tsx has `export default function App()`
