---
name: auth-form
description: Generate login/signup forms with shadcn/ui Form/Input/Label/Button, Framer Motion shake error animation, and kit motion tokens
---

## Auth Form Strategy

### shadcn/ui Components to Use
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` — full react-hook-form integration
- `Input` — text/email/password fields (use `type="password"` with toggle)
- `Button` — submit (`variant="default"`) + social OAuth (`variant="outline"`) + show/hide toggle (`variant="ghost" size="icon"`)
- `Label` — standalone labels if not using Form
- `Checkbox` + `Label` — "Remember me" / "Accept terms"
- `Separator` — between social buttons and main form
- `Card`, `CardHeader`, `CardContent`, `CardFooter` — outer container

### shadcn Form Setup
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  pass: z.string().min(8, "Must be at least 8 characters"),
});

const form = useForm({ resolver: zodResolver(schema) });
```

### Tailwind Animate (from kit animation library)
```tsx
// Card entrance — zoom-in-95 + fade-in (200ms, modal-enter preset)
<Card className="animate-in zoom-in-95 fade-in duration-200 ease-out">

// Error message appear — slide-in-from-top (150ms)
<FormMessage className="animate-in slide-in-from-top-1 fade-in duration-150" />

// Loading spinner — animate-spin
<span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
```

### Framer Motion — Shake on Error
```tsx
import { motion, useAnimation } from "framer-motion";

function ShakeForm({ children }: { children: React.ReactNode }) {
  const controls = useAnimation();

  const shake = async () => {
    await controls.start({
      x: [0, -8, 8, -8, 8, -4, 4, 0],
      transition: { duration: 0.4, ease: "easeInOut" }
    });
  };

  // Call shake() on submit error
  return <motion.div animate={controls}>{children}</motion.div>;
}
```

### Show/Hide Toggle for Entry Field
```tsx
const [showPass, setShowPass] = useState(false);

<div className="relative">
  <Input
    type={showPass ? "text" : "password"}
    placeholder="••••••••"
    className="pr-10"
  />
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
    onClick={() => setShowPass(v => !v)}
  >
    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </Button>
</div>
```

### Social OAuth Buttons
```tsx
<div className="grid grid-cols-2 gap-3">
  <Button variant="outline" className="gap-2 hover:bg-muted transition-colors duration-150">
    {/* Google SVG */} Google
  </Button>
  <Button variant="outline" className="gap-2 hover:bg-muted transition-colors duration-150">
    {/* GitHub SVG */} GitHub
  </Button>
</div>
<div className="relative my-4">
  <Separator />
  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">or</span>
</div>
```

### Hover & Interaction Effects (from kit effects library)
```tsx
// Submit button states
<Button
  type="submit"
  disabled={isLoading}
  className="w-full active:scale-[0.98] transition-transform duration-50 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isLoading ? <Spinner /> : mode === 'login' ? 'Sign in' : 'Create account'}
</Button>
```

### Motion Token Reference
| Element | Duration | Notes |
|---------|----------|-------|
| Card entrance | 200ms | `zoom-in-95 fade-in` — modal-enter preset |
| Error message | 150ms | `slide-in-from-top-1 fade-in` |
| Submit button press | 50ms | `active:scale-[0.98]` |
| Shake on error | 400ms | Framer `x: [0,-8,8,-8,8,0]` |
| Social button hover | 150ms | `transition-colors` |

### Quality Checklist
- [ ] shadcn `Form` + `FormField` + `FormMessage` — not manual state
- [ ] `Input` with `type="password"` + show/hide toggle Button
- [ ] Framer Motion shake on submit error
- [ ] `Card` container with `animate-in zoom-in-95 duration-200`
- [ ] Social buttons use shadcn `Button variant="outline"`
- [ ] `Separator` between social and email form
- [ ] `disabled:opacity-50 disabled:cursor-not-allowed` on submit
- [ ] `motion-reduce:transition-none` on shake animation
- [ ] App.tsx has `export default function App()`
