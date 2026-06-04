---
name: light-mode-ui
description: Generate light mode UIs with shadcn/ui default theming, soft shadows, WCAG AA contrast ratios, Framer Motion entrance animations, and kit motion tokens
---

## Light Mode UI Strategy

### shadcn/ui Light Theme (default)
shadcn/ui ships light mode by default. Ensure `<html>` does NOT have `class="dark"`:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --border: 214.3 31.8% 91.4%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --primary: 222.2 47.4% 11.2%;
  --ring: 222.2 84% 4.9%;
}
```

### Custom Light CSS Variables
```css
:root {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f8f9fa;
  --bg-card:       #ffffff;
  --bg-hover:      #f1f3f5;
  --border:        rgba(0,0,0,0.08);
  --text-primary:  #111827;
  --text-secondary:#4b5563;
  --text-muted:    #9ca3af;
  --accent:        #6c63ff;
  --accent-subtle: rgba(108,99,255,0.08);
}
```

### shadcn/ui Components in Light Mode
```tsx
// All components use default (light) variables automatically

// Accent button
<Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-150">

// Subtle card
<Card className="border border-border/60 shadow-sm hover:shadow-md hover:border-border transition-all duration-200">

// Badge — use outline for light bg
<Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50">

// Input focus
<Input className="focus-visible:ring-violet-500 focus-visible:border-violet-500">
```

### WCAG AA Contrast Ratios
| Text color | Background | Ratio | Level |
|------------|-----------|-------|-------|
| #111827 | #ffffff | 16.1:1 | AAA |
| #4b5563 | #ffffff | 7.0:1 | AA |
| #9ca3af | #ffffff | 2.9:1 | **Decorative only** |
| #6c63ff | #ffffff | 4.6:1 | AA large text |
| white | #6c63ff button | 4.6:1 | AA |

### Tailwind Animate (from kit animation library)
```tsx
// Page entrance — fade-in (200ms)
<main className="animate-in fade-in duration-200">

// Card appearance — zoom-in-95 + fade-in
<Card className="animate-in zoom-in-95 fade-in duration-200 ease-out">

// Dropdown / popover — slide-in-from-top (150ms, dropdown-enter preset)
<div className="animate-in slide-in-from-top-2 fade-in duration-150">

// Toast — slide-in-from-right (300ms, toast-enter preset)
<div className="animate-in slide-in-from-right duration-300">
```

### Framer Motion Patterns
```tsx
import { motion } from "framer-motion";

// Section entrance on scroll
function AnimatedSection({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Subtle spring hover on cards
<motion.div whileHover={{ y: -3, transition: { type: "spring", stiffness: 300, damping: 20 } }}>
  <Card>...</Card>
</motion.div>
```

### Soft Shadows (light-mode correct values)
```css
/* NEVER use dark-mode shadow values (0.4 opacity) in light mode */
.card          { box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06); }
.card:hover    { box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08); }
.btn-accent    { box-shadow: 0 2px 8px rgba(108,99,255,0.25); }
.btn-accent:hover { box-shadow: 0 4px 16px rgba(108,99,255,0.35); }
```

### Hover & Interaction Effects (from kit effects library)
```tsx
// Card hover (translate + shadow + border)
<Card className="hover:-translate-y-1 hover:shadow-md hover:border-violet-200 transition-all duration-200">

// Button hover
<Button className="hover:bg-primary/90 active:scale-[0.98] transition-all duration-150">

// Nav link
<a className="text-muted-foreground hover:text-foreground transition-colors duration-150">
```

### Motion Token Reference
| Element | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Card entrance | 200ms | ease-out | `zoom-in-95 fade-in` |
| Dropdown | 150ms | ease-out | `slide-in-from-top-2` |
| Toast | 300ms | spring | `slide-in-from-right` |
| Scroll section | 400ms | ease-out | Framer `useInView` |
| Card hover | 200ms | ease-out | `transition-all` |
| Button hover | 150ms | ease-out | `transition-all` |

### Quality Checklist
- [ ] `<html>` has NO `dark` class
- [ ] Text uses `#111827` not `#000000` for primary
- [ ] Muted color `#9ca3af` only on decorative text, never body copy
- [ ] Shadows are SOFT (opacity 0.06–0.12, never dark-mode values)
- [ ] `hover:shadow-md` not `hover:shadow-2xl` (too heavy for light)
- [ ] Framer Motion spring hover (`stiffness: 300, damping: 20`) — subtle
- [ ] `motion-reduce:transition-none` on all animated elements
- [ ] App.tsx has `export default function App()`
