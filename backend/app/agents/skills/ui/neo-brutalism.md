---
name: neo-brutalism
description: Generate neo-brutalist UI — raw borders, high-contrast fills, offset shadows, visible structure, and bold type. Stack, card, button, badge, and input patterns with intentional roughness.
---

## Design Tokens

```css
:root {
  --nb-black: #000;
  --nb-white: #fff;
  --nb-accent-yellow: #f5e642;
  --nb-accent-pink:   #ff6fd8;
  --nb-accent-blue:   #4f8eff;
  --nb-accent-green:  #3ddc84;

  --nb-border: 2px solid var(--nb-black);
  --nb-border-heavy: 3px solid var(--nb-black);
  --nb-shadow: 4px 4px 0 var(--nb-black);
  --nb-shadow-lg: 6px 6px 0 var(--nb-black);
  --nb-radius: 0;            /* flat by default */
  --nb-radius-sm: 4px;       /* allow slight radius as option */
}
```

## Offset Shadow Card

```tsx
function BrutalCard({
  children,
  color = "#f5e642",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className="relative border-2 border-black p-5 bg-white transition-all duration-150
                 hover:-translate-x-0.5 hover:-translate-y-0.5"
      style={{ boxShadow: `4px 4px 0 #000` }}
    >
      {/* Color stripe on top */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: color }} />
      <div className="pt-2">{children}</div>
    </div>
  );
}
```

## Button Variants

```tsx
import { cn } from "@/lib/utils";

type BrutalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  color?: string;
};

function BrutalButton({
  children,
  variant = "primary",
  color = "#f5e642",
  className,
  ...props
}: BrutalButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2.5 font-bold text-sm border-2 border-black",
        "transition-all duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none",
        variant === "primary" && "text-black",
        variant === "outline" && "bg-white text-black hover:bg-black hover:text-white",
        variant === "ghost"   && "border-transparent shadow-none hover:border-black",
        className
      )}
      style={
        variant === "primary"
          ? { background: color, boxShadow: "3px 3px 0 #000" }
          : variant === "outline"
          ? { boxShadow: "3px 3px 0 #000" }
          : {}
      }
    >
      {children}
    </button>
  );
}
```

## Badge

```tsx
function BrutalBadge({
  children,
  color = "#4f8eff",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wider border-2 border-black"
      style={{ background: color, boxShadow: "2px 2px 0 #000" }}
    >
      {children}
    </span>
  );
}
```

## Input

```tsx
function BrutalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border-2 border-black px-3.5 py-2.5 text-sm font-medium bg-white
                 outline-none placeholder:text-black/40
                 focus:shadow-[3px_3px_0_#000] focus:-translate-x-px focus:-translate-y-px
                 transition-all duration-100"
    />
  );
}
```

## Hero Section

```tsx
function BrutalHero() {
  return (
    <section className="min-h-screen bg-white flex flex-col justify-center px-6 md:px-12 py-24 border-b-2 border-black">
      {/* Kicker */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-black max-w-[60px]" />
        <BrutalBadge color="#f5e642">New release</BrutalBadge>
      </div>

      {/* Headline */}
      <h1 className="text-[clamp(3rem,8vw,8rem)] font-black leading-none tracking-tight uppercase mb-6">
        Build
        <br />
        <span className="relative inline-block">
          Ugly.
          {/* Underline stripe */}
          <span className="absolute bottom-2 left-0 right-0 h-4 bg-[#ff6fd8] -z-10" />
        </span>
        <br />
        Ship Fast.
      </h1>

      <p className="max-w-md text-lg font-medium mb-10 border-l-4 border-black pl-4">
        Design tools for teams who care more about shipping than polish.
      </p>

      <div className="flex gap-4 flex-wrap">
        <BrutalButton color="#f5e642">Get started →</BrutalButton>
        <BrutalButton variant="outline">View docs</BrutalButton>
      </div>
    </section>
  );
}
```

## Feature Stack

```tsx
const features = [
  { label: "Zero config", icon: "⚡", color: "#f5e642" },
  { label: "Open source", icon: "🔓", color: "#3ddc84" },
  { label: "Ship today",  icon: "🚀", color: "#4f8eff" },
];

function BrutalFeatureStack() {
  return (
    <div className="flex flex-col divide-y-2 divide-black border-2 border-black">
      {features.map(({ label, icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-4 px-5 py-4 hover:bg-black hover:text-white transition-colors duration-100 cursor-pointer"
        >
          <span
            className="w-9 h-9 flex items-center justify-center border-2 border-black text-lg shrink-0"
            style={{ background: color }}
          >
            {icon}
          </span>
          <span className="font-bold text-sm uppercase tracking-wide">{label}</span>
          <span className="ml-auto font-black">→</span>
        </div>
      ))}
    </div>
  );
}
```

## Pricing Card Grid

```tsx
const plans = [
  { name: "Free",  price: "$0",  color: "#fff",    features: ["5 projects", "Community"] },
  { name: "Pro",   price: "$29", color: "#f5e642", features: ["Unlimited", "Priority support", "API access"] },
  { name: "Team",  price: "$99", color: "#ff6fd8", features: ["Everything", "SSO", "SLA"] },
];

function BrutalPricing() {
  return (
    <div className="grid md:grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black">
      {plans.map((plan) => (
        <div key={plan.name} className="flex flex-col p-6" style={{ background: plan.color }}>
          <span className="text-xs font-black uppercase tracking-widest mb-2">{plan.name}</span>
          <span className="text-5xl font-black mb-6">{plan.price}</span>
          <ul className="flex flex-col gap-2 flex-1 mb-8">
            {plan.features.map((f) => (
              <li key={f} className="text-sm font-medium flex items-center gap-2">
                <span className="font-black">✓</span> {f}
              </li>
            ))}
          </ul>
          <BrutalButton color={plan.color === "#fff" ? "#f5e642" : plan.color}>
            Choose {plan.name}
          </BrutalButton>
        </div>
      ))}
    </div>
  );
}
```

## Motion Pattern (hover lift)

```tsx
import { motion } from "framer-motion";

<motion.div
  whileHover={{ x: -2, y: -2, boxShadow: "6px 6px 0 #000" }}
  whileTap={{ x: 1, y: 1, boxShadow: "2px 2px 0 #000" }}
  transition={{ type: "spring", stiffness: 500, damping: 25 }}
  className="border-2 border-black p-5 bg-white cursor-pointer"
  style={{ boxShadow: "4px 4px 0 #000" }}
>
  {/* card content */}
</motion.div>
```

## Quality Checklist

- [ ] All borders use solid black, never rounded-full by default
- [ ] Offset shadow always uses pure `#000` — never a soft color shadow
- [ ] `active:translate-x-1 active:translate-y-1 active:shadow-none` on every clickable
- [ ] Accent fills are saturated, never pastels
- [ ] Typography uppercase for headings — `tracking-tight` or `tracking-widest` only
- [ ] No gradients in the primary design surface; reserve for accents if used at all
- [ ] Color stripes / highlight underlines use `position: absolute` `z-index: -1`
- [ ] Dividers use `border-black` — never `border-muted`
- [ ] Dark mode: swap bg-black / text-white; keep accent colors identical
