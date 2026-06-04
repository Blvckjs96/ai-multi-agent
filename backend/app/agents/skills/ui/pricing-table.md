---
name: pricing-table
description: Generate SaaS pricing UI — tiered cards with highlighted plan, monthly/annual toggle, feature comparison table, usage-based pricing, and FAQ section. Uses shadcn/ui Card, Badge, Switch.
---

## Tiered Pricing Cards

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: { monthly: 0, annual: 0 },
    description: "For individuals and small experiments.",
    features: ["5 projects", "1 GB storage", "Community support", "Basic analytics"],
    cta: "Get started free",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: { monthly: 29, annual: 19 },
    description: "For growing teams that need more power.",
    features: ["Unlimited projects", "50 GB storage", "Priority support", "Advanced analytics", "Custom domains", "API access"],
    cta: "Start free trial",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: { monthly: 99, annual: 79 },
    description: "For organizations with advanced needs.",
    features: ["Everything in Pro", "Unlimited storage", "Dedicated support", "SSO & SAML", "SLA guarantee", "Audit logs", "Custom contracts"],
    cta: "Contact sales",
    variant: "outline" as const,
    popular: false,
  },
];

function PricingCards({ annual }: { annual: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto px-4">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={cn(
            "relative flex flex-col",
            plan.popular && "border-primary shadow-xl shadow-primary/10 scale-[1.03]"
          )}
        >
          {plan.popular && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">
              Most popular
            </Badge>
          )}

          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">
                ${annual ? plan.price.annual : plan.price.monthly}
              </span>
              <span className="text-muted-foreground text-sm">/mo</span>
              {annual && plan.price.annual < plan.price.monthly && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save ${(plan.price.monthly - plan.price.annual) * 12}/yr
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1">
            <ul className="flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="pt-4">
            <Button variant={plan.variant} className="w-full" size="lg">
              {plan.cta}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

## Monthly / Annual Toggle

```tsx
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-20">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
        <p className="text-muted-foreground text-lg mb-8">Start free. Scale as you grow.</p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={cn("text-sm font-medium", !annual && "text-foreground", annual && "text-muted-foreground")}>
            Monthly
          </span>
          <Switch
            checked={annual}
            onCheckedChange={setAnnual}
            aria-label="Toggle annual billing"
          />
          <span className={cn("text-sm font-medium flex items-center gap-1.5", annual && "text-foreground", !annual && "text-muted-foreground")}>
            Annual
            <Badge variant="secondary" className="text-xs">Save up to 35%</Badge>
          </span>
        </div>
      </div>

      <PricingCards annual={annual} />
    </section>
  );
}
```

## Feature Comparison Table

```tsx
const features = [
  { name: "Projects",          starter: "5",           pro: "Unlimited",  enterprise: "Unlimited" },
  { name: "Storage",           starter: "1 GB",        pro: "50 GB",      enterprise: "Unlimited" },
  { name: "Team members",      starter: "1",           pro: "Up to 20",   enterprise: "Unlimited" },
  { name: "API access",        starter: false,         pro: true,         enterprise: true },
  { name: "SSO / SAML",        starter: false,         pro: false,        enterprise: true },
  { name: "SLA",               starter: false,         pro: false,        enterprise: true },
  { name: "Support",           starter: "Community",   pro: "Priority",   enterprise: "Dedicated" },
];

function ComparisonTable() {
  return (
    <div className="overflow-x-auto max-w-4xl mx-auto px-4 mt-16">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 pr-8 font-medium text-muted-foreground w-1/3">Feature</th>
            {["Starter", "Pro", "Enterprise"].map((plan) => (
              <th key={plan} className="py-3 px-4 font-semibold text-center">{plan}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((row, i) => (
            <tr key={row.name} className={cn("border-b last:border-0", i % 2 === 0 && "bg-muted/30")}>
              <td className="py-3 pr-8 font-medium">{row.name}</td>
              {([row.starter, row.pro, row.enterprise] as (string | boolean)[]).map((val, j) => (
                <td key={j} className="py-3 px-4 text-center">
                  {typeof val === "boolean" ? (
                    val ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground/40">—</span>
                  ) : (
                    <span>{val}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## FAQ Accordion

```tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const faqs = [
  { q: "Can I change plans later?", a: "Yes, upgrade or downgrade at any time. Changes take effect immediately." },
  { q: "Is there a free trial?",    a: "Pro includes a 14-day free trial with no credit card required." },
  { q: "How does billing work?",    a: "We bill monthly or annually. Annual plans are charged upfront." },
  { q: "Do you offer refunds?",     a: "Yes, contact us within 30 days of your payment for a full refund." },
];

function PricingFAQ() {
  return (
    <div className="max-w-2xl mx-auto px-4 mt-20">
      <h3 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h3>
      <Accordion type="single" collapsible className="flex flex-col gap-1">
        {faqs.map(({ q, a }) => (
          <AccordionItem key={q} value={q} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-medium text-left">{q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
```

## Quality Checklist

- [ ] Popular plan uses `scale-[1.03]` + `shadow-xl` + `border-primary`
- [ ] Popular badge positioned with `absolute -top-3 left-1/2 -translate-x-1/2`
- [ ] Annual savings computed and shown (price difference × 12)
- [ ] Toggle has `aria-label="Toggle annual billing"`
- [ ] All feature lists use `<Check>` icons — never emoji
- [ ] CTA buttons full-width in card footer
- [ ] `<table>` used for comparison — never CSS grid for tabular data
- [ ] FAQ uses `<Accordion>` with `type="single" collapsible`
- [ ] Enterprise CTA leads to "Contact sales" — not a payment flow
