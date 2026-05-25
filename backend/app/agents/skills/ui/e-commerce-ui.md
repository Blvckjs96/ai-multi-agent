---
name: e-commerce-ui
description: Generate e-commerce UI — product cards, image gallery, cart drawer, checkout flow, size/color selectors, quantity stepper, review stars, trust badges, and empty state. Uses shadcn/ui + Framer Motion.
---

## Product Card

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface ProductCardProps {
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  rating: number;
  reviewCount: number;
}

function ProductCard({ name, price, originalPrice, image, badge, rating, reviewCount }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative flex flex-col rounded-xl border bg-card overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {badge && (
          <Badge className="absolute top-3 left-3 text-xs" variant="destructive">
            {badge}
          </Badge>
        )}
        {/* Wishlist */}
        <button
          onClick={() => setWishlisted((v) => !v)}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm
                     flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart
            className="w-4 h-4 transition-colors"
            fill={wishlisted ? "currentColor" : "none"}
            color={wishlisted ? "#ef4444" : "currentColor"}
          />
        </button>

        {/* Quick add — slides up on hover */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <Button size="sm" className="w-full rounded-none gap-2">
            <ShoppingCart className="w-4 h-4" /> Quick add
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-4">
        <p className="text-sm font-medium leading-snug line-clamp-2">{name}</p>
        <StarRating rating={rating} count={reviewCount} />
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-bold">${price}</span>
          {originalPrice && (
            <span className="text-sm text-muted-foreground line-through">${originalPrice}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

## Star Rating

```tsx
import { Star } from "lucide-react";

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className="w-3.5 h-3.5"
            fill={i < Math.floor(rating) ? "#f59e0b" : "none"}
            color={i < Math.ceil(rating) ? "#f59e0b" : "#d1d5db"}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}
```

## Color + Size Selectors

```tsx
function ColorSelector({
  colors,
  selected,
  onChange,
}: {
  colors: { name: string; hex: string }[];
  selected: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Color: <span className="font-normal text-muted-foreground">{selected}</span></p>
      <div className="flex gap-2" role="radiogroup" aria-label="Color">
        {colors.map((c) => (
          <button
            key={c.name}
            role="radio"
            aria-checked={selected === c.name}
            aria-label={c.name}
            onClick={() => onChange(c.name)}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{
              background: c.hex,
              borderColor: selected === c.name ? "#000" : "transparent",
              outline: selected === c.name ? "2px solid hsl(var(--ring))" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SizeSelector({
  sizes,
  selected,
  onChange,
}: {
  sizes: string[];
  selected: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Size</p>
        <button className="text-xs text-primary underline underline-offset-2">Size guide</button>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
        {sizes.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={selected === s}
            onClick={() => onChange(s)}
            className={cn(
              "min-w-[40px] h-10 px-3 rounded-md border text-sm font-medium transition-colors",
              selected === s
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/50"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## Quantity Stepper

```tsx
import { Minus, Plus } from "lucide-react";

function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center border rounded-lg overflow-hidden w-fit">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span
        className="w-12 text-center text-sm font-medium tabular-nums"
        aria-live="polite"
        aria-label={`Quantity: ${value}`}
      >
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

## Cart Drawer

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { ShoppingCart, X, Minus, Plus } from "lucide-react";

function CartDrawer({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Open cart">
          <ShoppingCart className="w-4 h-4" />
          {items.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {items.reduce((s, i) => s + i.qty, 0)}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[420px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Cart ({items.length})</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto divide-y px-6">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 py-4">
              <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg border" />
              <div className="flex-1 flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-snug">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.variant}</p>
                <div className="flex items-center justify-between mt-auto">
                  <QuantityStepper value={item.qty} onChange={(v) => updateQty(item.id, v)} />
                  <span className="font-semibold text-sm">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SheetFooter className="flex-col gap-3 px-6 py-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">Shipping & taxes calculated at checkout</p>
          <Button className="w-full" size="lg">Checkout →</Button>
          <Button variant="ghost" className="w-full">Continue shopping</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

## Trust Badges

```tsx
import { Shield, RotateCcw, Truck } from "lucide-react";

const badges = [
  { icon: Truck,      label: "Free shipping",  sub: "On orders over $50" },
  { icon: RotateCcw,  label: "30-day returns", sub: "Hassle-free policy" },
  { icon: Shield,     label: "Secure checkout", sub: "256-bit encryption" },
];

function TrustBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {badges.map(({ icon: Icon, label, sub }) => (
        <div key={label} className="flex items-center gap-2.5 text-sm">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium leading-none">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Empty Cart State

```tsx
function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <ShoppingCart className="w-7 h-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">Your cart is empty</p>
        <p className="text-sm text-muted-foreground mt-1">Add items to get started</p>
      </div>
      <Button>Browse products</Button>
    </div>
  );
}
```

## Quality Checklist

- [ ] Product images use `aspect-[4/5]` — never unconstrained height
- [ ] Wishlist button has `aria-pressed` and `aria-label`
- [ ] Color swatches use `role="radiogroup"` + `role="radio"` with `aria-checked`
- [ ] Size buttons use `role="radiogroup"` + `role="radio"` with `aria-checked`
- [ ] Out-of-stock sizes are `disabled` with strikethrough style
- [ ] Quantity stepper shows live count via `aria-live="polite"`
- [ ] Cart item count badge hidden (or `aria-hidden`) when 0
- [ ] Cart total formatted to 2 decimal places with `toFixed(2)`
- [ ] Trust badges are text + icon, never image-based
- [ ] Quick-add slide uses CSS transform, not `display:none` toggle
