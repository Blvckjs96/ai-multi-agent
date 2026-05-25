# Hero Sections

## Gradient Headline Hero
```tsx
function GradientHero() {
  const container = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
  const item = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
             aria-labelledby="hero-heading">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />

      <motion.div variants={container} initial="hidden" animate="visible" className="max-w-3xl flex flex-col items-center gap-6">
        <motion.h1 id="hero-heading" variants={item}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
          Your headline{" "}
          <span className="bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent">
            that lands
          </span>
        </motion.h1>
        <motion.p variants={item} className="text-lg text-muted-foreground max-w-xl leading-relaxed">
          Subheading that clarifies the value. Keep it under 20 words.
        </motion.p>
        <motion.div variants={item} className="flex flex-wrap gap-3 justify-center">
          <Button size="lg" className="gap-2 px-6">Primary CTA</Button>
          <Button size="lg" variant="outline">Secondary CTA</Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
```

## CTA Hierarchy Rules
- Primary: filled, accent color, prominent size
- Secondary: outline or ghost, same size
- Max 2 CTAs in hero — more dilutes conversion
- Badge above headline → headline → subtext → CTAs (top-to-bottom reveal)

## Background Techniques
- Radial gradient mesh (subtle, behind content)
- Animated gradient orbs (position with absolute, blur with filter)
- Noise texture overlay (low opacity SVG filter)
- Grid pattern with fade mask

## Quality Checklist
- [ ] `aria-labelledby` on `<section>` pointing to `<h1>`
- [ ] Staggered entrance for all hero elements
- [ ] Gradient text uses `bg-clip-text text-transparent`
- [ ] Mobile-first responsive type scale (`text-4xl sm:text-6xl lg:text-7xl`)
