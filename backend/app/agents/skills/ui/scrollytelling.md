---
name: scrollytelling
description: Generate scroll-driven narrative UIs — pinned sections, step reveals, parallax, horizontal scroll, and progress-linked animations using GSAP ScrollTrigger and Framer Motion useScroll.
---

## GSAP — Pinned scrollytelling section

```tsx
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const steps = [
  { title: "Collect", body: "Ingest data from any source in real time.", color: "#6c63ff" },
  { title: "Analyze", body: "Surface insights with zero configuration.",  color: "#0ea5e9" },
  { title: "Act",     body: "Trigger workflows the moment things change.", color: "#10b981" },
];

function PinnedSteps() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container.current,
        start: "top top",
        end: `+=${steps.length * 100}%`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    steps.forEach((_, i) => {
      tl.to(`.step-${i}`, { autoAlpha: 1, y: 0, duration: 1 })
        .to(`.step-${i}`, { autoAlpha: 0, y: -40, duration: 1 }, "+=0.5");
    });
  }, { scope: container });

  return (
    <div ref={container} className="relative h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Left — sticky copy */}
      <div className="relative w-full max-w-2xl mx-auto px-6">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`step-${i} absolute inset-0 flex flex-col gap-4`}
            style={{ opacity: i === 0 ? 1 : 0, transform: i === 0 ? "none" : "translateY(40px)" }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step.color }} />
            <h2 className="text-5xl font-bold">{step.title}</h2>
            <p className="text-xl text-muted-foreground max-w-md">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## GSAP — Horizontal scroll (fake)

```tsx
function HorizontalScroll() {
  const container = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const panels = track.current!.querySelectorAll(".h-panel");

    gsap.to(track.current, {
      xPercent: -100 * (panels.length - 1),
      ease: "none",                     // REQUIRED — linear mapping to scroll
      scrollTrigger: {
        trigger: container.current,
        pin: true,
        scrub: 1,
        start: "top top",
        end: () => "+=" + (panels.length - 1) * window.innerWidth,
        snap: 1 / (panels.length - 1),
      },
    });
  }, { scope: container });

  return (
    <div ref={container} className="overflow-hidden">
      <div ref={track} className="flex will-change-transform">
        {["Brand", "Product", "Culture", "Careers"].map((label) => (
          <div
            key={label}
            className="h-panel w-screen h-screen flex-shrink-0 flex items-center justify-center"
          >
            <h2 className="text-6xl font-bold">{label}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Framer Motion — useScroll reveal sequence

```tsx
import { useScroll, useTransform, motion } from "framer-motion";

function ScrollRevealSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity  = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale    = useTransform(scrollYProgress, [0, 0.3], [0.92, 1]);
  const y        = useTransform(scrollYProgress, [0, 0.3], [60, 0]);

  return (
    <motion.section ref={ref} style={{ opacity, scale, y }} className="py-32 px-4 max-w-4xl mx-auto">
      <h2 className="text-4xl font-bold mb-6">Revealed on scroll</h2>
      <p className="text-muted-foreground text-lg leading-relaxed">
        This section fades and scales in as it enters the viewport.
      </p>
    </motion.section>
  );
}
```

## Framer Motion — Parallax layers

```tsx
function ParallaxHero() {
  const { scrollYProgress } = useScroll();

  const bgY   = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const fade  = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  return (
    <div className="relative h-[150vh] overflow-hidden">
      {/* Background — moves slower */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/parallax-bg.jpg')", y: bgY }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Text — moves faster */}
      <motion.div
        className="sticky top-0 h-screen flex items-center justify-center text-white"
        style={{ y: textY, opacity: fade }}
      >
        <h1 className="text-7xl font-bold text-center">Scroll down</h1>
      </motion.div>
    </div>
  );
}
```

## Scroll progress indicator

```tsx
function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-0.5 bg-primary origin-left z-50"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
```

## Step dots navigation

```tsx
function ScrollDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => document.getElementById(`step-${i}`)?.scrollIntoView({ behavior: "smooth" })}
          aria-label={`Go to step ${i + 1}`}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            i === current ? "bg-primary w-2 h-5" : "bg-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}
```

## Quality Checklist

- [ ] GSAP pinned sections use `anticipatePin: 1` to prevent jump
- [ ] Horizontal scroll tween uses `ease: "none"` — never any other ease
- [ ] Scrub timelines: ScrollTrigger on the timeline, not on child tweens
- [ ] Parallax layers animate `y` (transform) — never `top` or `margin`
- [ ] `useScroll` targets specific `ref` — not global scroll by default
- [ ] Progress indicator uses `scaleX` from `scrollYProgress` (compositor-only)
- [ ] Step dots have `aria-label` for screen readers
- [ ] `markers: true` removed from all ScrollTrigger configs before production
