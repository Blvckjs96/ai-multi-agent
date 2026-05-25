---
name: gsap-animations
description: Generate high-performance animations with GSAP — tweens, timelines, ScrollTrigger, SplitText, Flip, Draggable, and React useGSAP patterns. Covers compositor-safe motion, accessibility, and plugin registration.
---

## Install

```bash
npm install gsap @gsap/react
```

## Plugin Registration — once at module level, never inside components

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, Draggable, MotionPathPlugin, useGSAP);
```

## Core Tween Methods

```ts
gsap.to(".box", { x: 100, duration: 1 });           // current → target
gsap.from(".box", { opacity: 0, y: 40 });           // target → current (entrances)
gsap.fromTo(".box", { x: -50 }, { x: 50 });         // explicit start + end
gsap.set(".box", { autoAlpha: 0 });                 // instant (duration: 0)
```

**Prefer `autoAlpha` over `opacity`** — at 0 it also sets `visibility: hidden`, so the element is non-interactive and doesn't block clicks.

### Transform Aliases — always use these, never raw `transform` strings

| GSAP property | CSS equivalent |
|---------------|----------------|
| `x`, `y`, `z` | `translateX/Y/Z` (px) |
| `xPercent`, `yPercent` | `translateX/Y` (%) |
| `scale`, `scaleX`, `scaleY` | `scale` |
| `rotation` | `rotate` (deg; or `"1.25rad"`) |
| `rotationX`, `rotationY` | 3D rotate |
| `skewX`, `skewY` | `skew` |
| `transformOrigin` | `transform-origin` |

Relative values: `x: "+=20"`, `rotation: "-=30"`. Directional rotation: `rotation: "-170_short"` (shortest path), `"_cw"`, `"_ccw"`.

### Common vars

```ts
gsap.to(".item", {
  x: 200,
  duration: 0.6,
  delay: 0.2,
  ease: "expo.out",
  stagger: 0.1,               // or { amount: 0.4, from: "center" }
  repeat: -1,
  yoyo: true,
  overwrite: "auto",          // kill overlapping property tweens
  clearProps: "x,y",          // remove inline style on complete
  onComplete: () => {},
});
```

### Function-based values — called once per target

```ts
gsap.to(".item", {
  x: (i) => i * 50,           // item 0→0, item 1→50, item 2→100…
  stagger: 0.08,
});
```

## Built-in Eases

```
power1–4   .in / .out / .inOut   (power1 = gentle, power4 = steep)
back.out(1.7)    elastic.out(1, 0.3)    bounce.out
circ.out   expo.out   sine.out   none (linear)
```

## Defaults

```ts
gsap.defaults({ duration: 0.6, ease: "power2.out" });
```

## Timeline — sequence without chaining delays

```ts
const tl = gsap.timeline({
  defaults: { ease: "expo.out", duration: 0.6 },
  paused: true,
});

tl.from(".badge",    { autoAlpha: 0, y: -16 })
  .from(".headline", { autoAlpha: 0, y: 48, duration: 0.8 }, "-=0.3")
  .from(".subtext",  { autoAlpha: 0, y: 24 }, "-=0.4")
  .from(".cta > *",  { autoAlpha: 0, y: 16, stagger: 0.1 }, "-=0.3");
```

### Position parameter

| Value | Meaning |
|-------|---------|
| `0` | absolute 0s |
| `"+=0.3"` | 0.3s after previous end |
| `"-=0.2"` | 0.2s before previous end |
| `"<"` | same start as previous |
| `"<0.2"` | 0.2s after previous *start* |
| `"labelName"` | at that label |

**Put ScrollTrigger on the timeline, never on a child tween inside a timeline.**

## React — useGSAP Hook

```tsx
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

function HeroSection() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "expo.out", duration: 0.6 } });
    tl.from(".hero-badge",    { autoAlpha: 0, y: -16 })
      .from(".hero-headline", { autoAlpha: 0, y: 48, duration: 0.8 }, "-=0.3")
      .from(".hero-sub",      { autoAlpha: 0, y: 24 }, "-=0.4")
      .from(".hero-cta > *",  { autoAlpha: 0, y: 16, stagger: 0.1 }, "-=0.3");
  }, {
    scope: container,         // scopes selector strings to this root
    dependencies: [],         // re-run when these change
    revertOnUpdate: true,     // revert + re-run when deps change
  });

  return <div ref={container}>...</div>;
}
```

- Always pass `scope: containerRef` — prevents selectors matching outside the component.
- Cleanup (ScrollTriggers, tweens, inline styles) is automatic on unmount.

### contextSafe — for event handlers created after useGSAP runs

```tsx
useGSAP((context, contextSafe) => {
  const onClick = contextSafe!(() => {
    gsap.to(boxRef.current, { rotation: 180 });
  });
  boxRef.current!.addEventListener("click", onClick);
  return () => boxRef.current!.removeEventListener("click", onClick);
}, { scope: container });
```

## ScrollTrigger

```ts
gsap.to(".box", {
  x: 500,
  scrollTrigger: {
    trigger: ".box",
    start: "top 80%",         // "triggerPos viewportPos"
    end: "bottom 20%",
    toggleActions: "play none none reverse",  // onEnter onLeave onEnterBack onLeaveBack
    markers: true,            // dev only — remove in production
  },
});
```

### Key config options

| Option | Use |
|--------|-----|
| `scrub: true` / `scrub: 1` | tie progress to scroll; number = lag seconds |
| `pin: true` | pin the trigger element while active |
| `pinSpacing` | default `true`; adds spacer to prevent layout collapse |
| `once: true` | kill after first play-through |
| `snap: 0.25` | snap to progress increments |
| `toggleClass: "active"` | add/remove class when active |
| `horizontal: true` | horizontal scroll |

### Timeline + ScrollTrigger (pinned scrollytelling)

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".pinned-section",
    start: "top top",
    end: "+=200%",
    scrub: 1,
    pin: true,
  },
});
tl.from(".step-1", { autoAlpha: 0, x: -80 })
  .from(".step-2", { autoAlpha: 0, x: 80 })
  .from(".step-3", { autoAlpha: 0, scale: 0.85 });
```

### ScrollTrigger.batch() — coordinated stagger for viewport-entering elements

```ts
ScrollTrigger.batch(".card", {
  onEnter: (elements) => {
    gsap.to(elements, { autoAlpha: 1, y: 0, stagger: 0.1, overwrite: true });
  },
  onLeaveBack: (elements) => {
    gsap.set(elements, { autoAlpha: 0, y: 50, overwrite: true });
  },
  start: "top 85%",
  batchMax: 4,
  interval: 0.1,
});
```

### Horizontal scroll (containerAnimation)

```ts
const scrollTween = gsap.to(".h-wrap", {
  xPercent: -100 * (panels.length - 1),
  ease: "none",               // REQUIRED — keeps 1:1 scroll-to-position mapping
  scrollTrigger: {
    trigger: ".h-section",
    pin: true,
    scrub: 1,
    start: "top top",
    end: () => "+=" + document.querySelector(".h-wrap")!.offsetWidth,
  },
});

// Nested triggers inside horizontal scroll
gsap.to(".panel-content", {
  autoAlpha: 1,
  scrollTrigger: {
    containerAnimation: scrollTween,  // required
    trigger: ".panel",
    start: "left center",
    toggleActions: "play none none reset",
  },
});
```

### Cleanup in React

```ts
// useGSAP handles this automatically; or manually:
useEffect(() => {
  const ctx = gsap.context(() => { /* animations */ }, containerRef);
  return () => ctx.revert();
}, []);

// Or kill by id:
ScrollTrigger.getById("my-id")?.kill();
```

## SplitText — character / word / line reveals

```tsx
import { SplitText } from "gsap/SplitText";

useGSAP(() => {
  const split = SplitText.create(".headline", {
    type: "words,chars",
    autoSplit: true,            // re-splits on resize to fix line breaks
    mask: "chars",              // overflow:clip wrappers for reveal effect
    aria: "auto",               // screen readers see the original text
    onSplit(self) {
      return gsap.from(self.chars, {
        autoAlpha: 0,
        y: 40,
        rotateX: -90,
        stagger: 0.015,
        duration: 0.5,
        ease: "back.out(1.7)",
      });
    },
  });
  // split.revert() on manual cleanup (not needed if autoSplit + onSplit are used)
}, { scope: container });
```

## Flip — layout state transitions

```ts
import { Flip } from "gsap/Flip";

const state = Flip.getState(".item");
// apply DOM/class changes
items.forEach((el) => newContainer.appendChild(el));
Flip.from(state, { duration: 0.5, ease: "power2.inOut", absolute: true });
```

## Draggable with Inertia

```ts
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

Draggable.create(".card", {
  type: "x,y",
  bounds: "#container",
  inertia: true,
  edgeResistance: 0.65,
  onDragEnd() { console.log("landed at", this.x, this.y); },
});
```

## Performance — gsap.quickTo for mouse followers

```ts
const xTo = gsap.quickTo("#cursor", "x", { duration: 0.4, ease: "power3" });
const yTo = gsap.quickTo("#cursor", "y", { duration: 0.4, ease: "power3" });

window.addEventListener("mousemove", (e) => {
  xTo(e.clientX);
  yTo(e.clientY);
});
```

## Accessibility — gsap.matchMedia

```ts
const mm = gsap.matchMedia();

mm.add(
  {
    isDesktop: "(min-width: 768px)",
    reduceMotion: "(prefers-reduced-motion: reduce)",
  },
  (context) => {
    const { isDesktop, reduceMotion } = context.conditions!;
    gsap.to(".hero", {
      x: isDesktop ? 200 : 80,
      duration: reduceMotion ? 0 : 0.8,
    });
  }
);
```

## Motion Token Reference

| Element | Duration | Ease | Notes |
|---------|----------|------|-------|
| Hero badge | 0.4s | power2.out | y -16 → 0 |
| Hero headline | 0.8s | expo.out | y 48 → 0 |
| Hero subtext | 0.5s | power2.out | 0.3s after headline |
| CTA buttons | 0.5s | power2.out | stagger 0.1 |
| Scroll reveal | 0.8s | power3.out | start "top 85%" |
| Staggered cards | 0.6s | power3.out | batch stagger 0.1 |
| Scrub / parallax | — | none | scrub: true |
| Char split reveal | 0.5s | back.out(1.7) | stagger 0.015 |
| Mouse cursor | 0.4s | power3 | gsap.quickTo |

## Quality Checklist

- [ ] `gsap.registerPlugin(...)` called once at module level
- [ ] All React animations use `useGSAP` with `scope: containerRef`
- [ ] Event-handler tweens wrapped in `contextSafe`
- [ ] `autoAlpha` used instead of raw `opacity` for fade in/out
- [ ] Transform aliases used (`x`, `y`, `scale`, `rotation`) — never raw CSS strings
- [ ] `ScrollTrigger` on top-level tween/timeline, never on a child inside a timeline
- [ ] `ease: "none"` on horizontal scroll tween when using `containerAnimation`
- [ ] `markers: true` removed before production
- [ ] `gsap.matchMedia()` guards both responsive breakpoints and `prefers-reduced-motion`
- [ ] Only compositor properties animated: transform, opacity — not width/height/top/left
- [ ] `App.tsx` has `export default function App()`
