# Navigation Patterns

## Sticky Navbar (scroll-aware)
```tsx
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-300",
      scrolled ? "bg-background/80 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
    )}>
      <nav className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4"
           aria-label="Main navigation">
        <a href="/" className="font-bold text-lg">Brand</a>
        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {["Features", "Pricing", "Docs"].map(item => (
            <a key={item} href={`/${item.toLowerCase()}`}
               className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">
              {item}
            </a>
          ))}
        </div>
        <Button size="sm">Get started</Button>
      </nav>
    </header>
  );
}
```

## Mobile Drawer Menu (shadcn Sheet)
```tsx
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <nav className="flex flex-col gap-1 mt-6">
          {navItems.map(item => (
            <a key={item.href} href={item.href}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-sm">
              <item.icon className="h-4 w-4" />
              {item.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

## Accessibility Rules
- `aria-label` on every `<nav>` element
- `aria-current="page"` on active link
- Keyboard: Tab to navigate, Enter to activate, Escape to close mobile menu
- Focus trap inside open mobile drawer

## Quality Checklist
- [ ] Navbar becomes opaque + blurred on scroll
- [ ] Mobile drawer opens from left with slide animation
- [ ] Active link has visible indicator (color, underline, or bg)
- [ ] All nav items keyboard-navigable
- [ ] `aria-label` on `<nav>` landmarks
