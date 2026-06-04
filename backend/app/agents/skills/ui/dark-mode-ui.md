# Dark Mode UI

## CSS Variables
```css
:root {
  --bg-primary: #0f0f0f;  --bg-secondary: #1a1a1a;  --bg-card: #242424;
  --border: rgba(255,255,255,0.08);
  --text-primary: #e8e8e8;  --text-secondary: #a0a0a0;
  --accent: #6c63ff;
  --accent-gradient: linear-gradient(135deg, #6c63ff, #a855f7);
}
/* Argo project uses: #00d4ff (cyan) and #00ff9d (green) as accents */
```

## shadcn/ui Dark Components
```tsx
<Button className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 border-0">
<Badge className="bg-white/10 text-white border-white/20 hover:bg-white/15">
<Input className="bg-white/5 border-white/10 focus-visible:border-violet-500 focus-visible:ring-violet-500/20">
```

## Deep Shadows + Glow
```css
.card { box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
.card:hover { box-shadow: 0 8px 40px rgba(0,0,0,0.6); }
.btn-accent { box-shadow: 0 0 20px rgba(108,99,255,0.3); }
.btn-accent:hover { box-shadow: 0 0 32px rgba(108,99,255,0.5); }
```

## Framer Motion Stagger
```tsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } } };
```

## Quality Checklist
- [ ] Shadows use `rgba(0,0,0,0.4+)` — much deeper than light mode
- [ ] Accent elements have glow effect via `box-shadow`
- [ ] Staggered entrance on card grids
- [ ] `motion-reduce:` on all animated elements
