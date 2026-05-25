---
name: micro-interactions
description: Generate micro-interactions — button feedback, skeleton loading, optimistic UI, hover lift/tilt, magnetic cursor, ripple, count-up, and input focus states. Uses Framer Motion and Tailwind.
---

## Button Micro-interactions

```tsx
import { motion } from "framer-motion";

// Primary — scale + shadow
function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onClick}
      className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
    >
      {children}
    </motion.button>
  );
}

// Loading state
function LoadingButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      disabled={loading}
      animate={loading ? { opacity: 0.7 } : { opacity: 1 }}
      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium"
    >
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
        />
      )}
      {loading ? "Saving…" : children}
    </motion.button>
  );
}
```

## Skeleton Loading

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-9 w-28 mt-2" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 items-center px-4 py-3 border rounded-lg">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

## Optimistic UI — toggle with instant feedback

```tsx
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function LikeButton({ initialLiked, count }: { initialLiked: boolean; count: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [displayCount, setDisplayCount] = useState(count);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    setDisplayCount((c) => (next ? c + 1 : c - 1));
    startTransition(async () => {
      await fetch("/api/like", { method: "POST", body: JSON.stringify({ liked: next }) });
    });
  };

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm font-medium"
      aria-pressed={liked}
    >
      <motion.div animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
        <Heart className={cn("w-4 h-4", liked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.span
          key={displayCount}
          initial={{ y: liked ? -10 : 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: liked ? 10 : -10, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {displayCount}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
```

## Hover Lift Card

```tsx
<motion.div
  whileHover={{ y: -6, boxShadow: "0 20px 40px hsl(var(--foreground) / 0.12)" }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  className="rounded-xl border bg-card p-5 cursor-pointer"
>
  {/* card content */}
</motion.div>
```

## 3D Tilt Card

```tsx
function TiltCard({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);
  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 800 }}
      className="rounded-2xl border bg-card p-6 will-change-transform"
    >
      {children}
    </motion.div>
  );
}
```

## Animated Number Count-up

```tsx
import { useMotionValue, useSpring, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const count = useMotionValue(0);
  const spring = useSpring(count, { stiffness: 80, damping: 20 });
  const rounded = useTransform(spring, (v) =>
    Math.round(v).toLocaleString() + suffix
  );

  useEffect(() => { count.set(to); }, [to]);

  return <motion.span>{rounded}</motion.span>;
}

// Usage
<CountUp to={12400} suffix="+" />  // "12,400+"
```

## Input Focus State

```tsx
<div className="relative">
  <input
    className={cn(
      "w-full rounded-lg border px-3.5 py-2.5 text-sm bg-background",
      "outline-none ring-offset-background",
      "focus:ring-2 focus:ring-primary/30 focus:border-primary",
      "transition-all duration-150",
      "placeholder:text-muted-foreground/60"
    )}
    placeholder="Enter your email"
  />
</div>
```

## Magnetic Button

```tsx
function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.35);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.35);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-medium"
    >
      {children}
    </motion.button>
  );
}
```

## Motion Token Reference

| Interaction | Transition | Notes |
|-------------|-----------|-------|
| Button hover | spring 400/17 | scale 1.03 |
| Button tap | spring 400/17 | scale 0.97 |
| Card lift | spring 300/20 | y -6px |
| Like burst | 0.3s | scale keyframe [1, 1.4, 1] |
| Count flip | spring 80/20 | stiffness 80 — slow for weight |
| Tilt | spring 200/20 | rotateX/Y ±8deg |
| Magnetic | spring 150/15 | 35% offset factor |

## Quality Checklist

- [ ] Skeleton shown for any async data > 200ms
- [ ] Optimistic updates snapshot and rollback on error
- [ ] `aria-pressed` on toggle buttons (like, bookmark, etc.)
- [ ] Loading spinners use `rotate: 360, repeat: Infinity, ease: "linear"`
- [ ] Tilt cards use `will-change-transform` to stay on compositor
- [ ] Magnetic buttons reset on `onMouseLeave`
- [ ] CountUp uses spring — never raw `setInterval`
- [ ] Input focus ring uses `ring-primary/30` + `border-primary` combo
