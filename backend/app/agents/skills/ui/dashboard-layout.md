# Dashboard Layout

## Grid Layout
```css
.app-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
@media (max-width: 768px) {
  .app-layout { grid-template-columns: 1fr; }
  .sidebar { position: fixed; bottom: 0; width: 100%; height: 60px; flex-direction: row; z-index: 50; }
}
```

## Stat Cards with Counter Animation
```tsx
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

function StatCard({ label, value }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, v => Math.round(v).toLocaleString());
  const spring = useSpring(count, { stiffness: 100, damping: 30 });
  useEffect(() => { spring.set(value); }, [value]);

  return (
    <Card className="animate-in fade-in duration-200">
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent>
        <motion.span className="text-3xl font-bold tabular-nums">{rounded}</motion.span>
      </CardContent>
    </Card>
  );
}
```

## shadcn/ui Components
- `Card` + `CardHeader/Content` — KPI stat cards
- `Tabs/TabsList/TabsTrigger` — main content views
- `Badge` — status indicators on nav items
- `Button variant="ghost"` — sidebar nav (inactive), `variant="secondary"` active
- `Skeleton` — loading placeholders
- `Progress` — metric bars inside stat cards
- `DropdownMenu` — header menus, row actions

## Sidebar Nav Pattern
```tsx
<nav className="flex flex-col gap-1 p-3">
  {navItems.map(item => (
    <Button key={item.href} variant={isActive(item.href) ? "secondary" : "ghost"}
      className="justify-start gap-3 h-10">
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && <Badge className="ml-auto">{item.badge}</Badge>}
    </Button>
  ))}
</nav>
```

## Quality Checklist
- [ ] Stat counters animate on mount (spring-based)
- [ ] Sidebar collapses to bottom nav on mobile
- [ ] Skeleton loading states for async data
- [ ] Staggered card entrance (`staggerChildren: 0.05`)
