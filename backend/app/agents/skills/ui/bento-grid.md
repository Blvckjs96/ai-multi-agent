# Bento Grid Layout

## Grid CSS
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}
.bento-card.featured { grid-column: span 2; grid-row: span 2; }
@media (max-width: 768px) { .bento-card.featured { grid-column: span 1; grid-row: span 1; } }
```

## Framer Motion — Stagger + Spring Hover
```tsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };
const card = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } }
};

function BentoCard({ children, className }) {
  return (
    <motion.div
      variants={card}
      whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 17 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.05 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

## shadcn/ui Tile Components
- `Card`, `CardContent`, `CardHeader` — tile container
- `Badge` — category labels
- `Avatar` — user/author tiles
- `AspectRatio ratio={16/9}` — image tiles
- `Button variant="ghost"` — action tiles

## Quality Checklist
- [ ] Featured tile spans 2×2 on desktop, collapses on mobile
- [ ] Spring-based hover (stiffness: 400, damping: 17)
- [ ] Stagger entrance (0.07s between cards)
- [ ] Tile hierarchy: 1 large featured + supporting tiles
