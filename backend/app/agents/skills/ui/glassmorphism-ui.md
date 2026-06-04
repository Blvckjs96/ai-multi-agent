# Glassmorphism UI

## Glass CSS Recipe
```css
.glass-card {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
/* REQUIRED: visible background behind glass */
body { background: radial-gradient(ellipse at top, #1e1b4b 0%, #0f0f0f 70%); }
```

## shadcn/ui Components
- `Card` — override bg/border with rgba values
- `Button variant="ghost"` — add `hover:bg-white/10`
- `Input` — `className="bg-white/10 border-white/20 text-white placeholder:text-white/50"`

## Framer Motion Entrance
```tsx
// Card entrance
<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.2, ease: "easeOut" }} />

// Staggered children
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };
```

## Hover Interactions
```tsx
<Card className="hover:-translate-y-1 hover:shadow-2xl transition-all duration-200 ease-out glass-card">
<Button className="active:scale-[0.98] transition-transform duration-50">
```

## Motion Tokens
| Element | Duration | Easing |
|---------|----------|--------|
| Button hover | 150ms | ease-out |
| Card transitions | 200ms | ease-out |
| Entrance | 200ms | ease-out |
| Drawer | 300ms | ease-out |

## Quality Checklist
- [ ] Body has visible gradient (glass requires a background to show through)
- [ ] Card uses `backdrop-filter` + `-webkit-backdrop-filter`
- [ ] Hover uses `-translate-y-1 shadow-2xl transition-all duration-200`
- [ ] All animated elements have `motion-reduce:transition-none motion-reduce:animate-none`
