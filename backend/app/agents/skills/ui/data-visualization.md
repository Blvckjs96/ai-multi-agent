---
name: data-visualization
description: Generate SVG charts with shadcn/ui Card/Tabs/Badge, Framer Motion animated path drawing and counter animations, and kit motion tokens — no external chart libs
---

## SVG Data Visualization Strategy

### shadcn/ui Components to Use
- `Card`, `CardHeader`, `CardTitle`, `CardContent` — chart container
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — switch between chart types
- `Badge` — legend items + data point labels
- `Button` — time range selectors (variant="ghost" default, variant="secondary" active)
- `Skeleton` — loading state placeholder (`<Skeleton className="h-[200px] w-full">`)
- `Separator` — between legend items

### Responsive SVG Wrapper
```tsx
const CHART_W = 400;
const CHART_H = 200;
const PAD = { top: 20, right: 20, bottom: 40, left: 50 };

<svg
  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
  width="100%"
  preserveAspectRatio="xMidYMid meet"
  style={{ maxWidth: CHART_W }}
  role="img"
  aria-label="Chart description"
/>
```

### Tailwind Animate — Chart Loading
```tsx
// Skeleton while data loads
<Card className="animate-in fade-in duration-200">
  <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
  <CardContent><Skeleton className="h-[200px] w-full animate-pulse" /></CardContent>
</Card>

// Chart reveal after data loads
<Card className="animate-in zoom-in-95 fade-in duration-300">
```

### Framer Motion — Animated Bar Chart
```tsx
import { motion } from "framer-motion";

// Bars animate height from 0 with stagger
const maxVal = Math.max(...data.map(d => d.value));
const chartH = CHART_H - PAD.top - PAD.bottom;
const barW = (CHART_W - PAD.left - PAD.right) / data.length - 6;

{data.map((d, i) => {
  const barH = (d.value / maxVal) * chartH;
  const x = PAD.left + i * ((CHART_W - PAD.left - PAD.right) / data.length) + 3;
  return (
    <motion.rect
      key={i}
      x={x}
      y={PAD.top + chartH}
      width={barW}
      height={0}
      fill={COLORS[i % COLORS.length]}
      rx="3"
      animate={{ height: barH, y: PAD.top + chartH - barH }}
      transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
    />
  );
})}
```

### Framer Motion — Animated Line Chart
```tsx
// Draws path progressively from left to right
function AnimatedLine({ points }: { points: string }) {
  const pathLength = useMotionValue(0);
  useEffect(() => {
    animate(pathLength, 1, { duration: 1.0, ease: "easeInOut" });
  }, []);
  return (
    <motion.polyline
      points={points}
      fill="none"
      stroke="#6c63ff"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ pathLength }}
    />
  );
}
```

### Framer Motion — Donut Chart
```tsx
// Segments animate in with stagger
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = CHART_W / 2, CY = CHART_H / 2;

let offset = 0;
{data.map((d, i) => {
  const dash = (d.value / total) * CIRCUMFERENCE;
  const el = (
    <motion.circle key={i}
      cx={CX} cy={CY} r={RADIUS}
      fill="none"
      stroke={COLORS[i % COLORS.length]}
      strokeWidth="28"
      strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
      strokeDashoffset={-offset}
      transform={`rotate(-90 ${CX} ${CY})`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: i * 0.1 }}
    />
  );
  offset += dash;
  return el;
})}
```

### Animated Number Counter (for totals)
```tsx
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

function Counter({ to }: { to: number }) {
  const count = useMotionValue(0);
  const spring = useSpring(count, { stiffness: 100, damping: 30 });
  const rounded = useTransform(spring, v => Math.round(v).toLocaleString());
  useEffect(() => { count.set(to); }, [to]);
  return <motion.span>{rounded}</motion.span>;
}
```

### Color Palette
```ts
const COLORS = ['#6c63ff','#0ea5e9','#10b981','#f59e0b','#ef4444','#a855f7'];
```

### Motion Token Reference
| Element | Duration | Notes |
|---------|----------|-------|
| Chart card entrance | 300ms | `zoom-in-95 fade-in` |
| Bar animate | 500ms | stagger 60ms, ease-out |
| Line draw | 1000ms | `pathLength` 0→1, ease-in-out |
| Donut segment | 400ms | stagger 100ms, ease-out |
| Counter | spring | `stiffness:100 damping:30` |

### Quality Checklist
- [ ] `Card` container with `animate-in zoom-in-95` entrance
- [ ] `Skeleton` shown during loading state
- [ ] Framer `motion.rect` bars animate height from 0 with stagger
- [ ] Line chart uses `pathLength` for progressive draw
- [ ] `Counter` component for animated total values
- [ ] Color palette array — never hard-coded per element
- [ ] SVG has `role="img"` + `aria-label`
- [ ] `motion-reduce:transition-none` fallback
- [ ] App.tsx has `export default function App()`
