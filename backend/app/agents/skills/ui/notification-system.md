---
name: notification-system
description: Generate notification UIs — toast stack, in-app notification feed, badge counts, real-time indicator, notification bell popover, and empty state. Uses sonner, shadcn/ui Popover, and Framer Motion.
---

## Toast / Sonner Setup

```tsx
// app/layout.tsx (or root)
import { Toaster } from "sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          expand
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
```

## Toast Variants

```tsx
import { toast } from "sonner";

// Success
toast.success("Changes saved", { description: "Your profile has been updated." });

// Error
toast.error("Something went wrong", { description: "Please try again or contact support." });

// Info
toast.info("New update available", { action: { label: "Reload", onClick: () => location.reload() } });

// Warning
toast.warning("Storage almost full", { description: "You've used 90% of your 1 GB limit." });

// Promise (loading → success/error)
toast.promise(saveData(), {
  loading: "Saving…",
  success: "Saved!",
  error:   "Could not save",
});

// Custom with JSX
toast.custom((id) => (
  <div className="flex items-start gap-3 bg-card border rounded-xl p-4 shadow-lg w-80">
    <img src="/avatar.png" alt="" className="w-8 h-8 rounded-full" />
    <div className="flex-1">
      <p className="text-sm font-semibold">Jason liked your post</p>
      <p className="text-xs text-muted-foreground mt-0.5">2 minutes ago</p>
    </div>
    <button onClick={() => toast.dismiss(id)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
      ✕
    </button>
  </div>
));
```

## Notification Bell Popover

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  avatar?: string;
}

function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const dismiss = (id: string) => setItems((prev) => prev.filter((n) => n.id !== id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary
                         text-primary-foreground text-[10px] font-bold flex items-center justify-center px-0.5"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Feed */}
        <ScrollArea className="max-h-80">
          <AnimatePresence initial={false}>
            {items.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              items.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NotificationRow
                    notification={n}
                    onDismiss={() => dismiss(n.id)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-4 py-2.5">
            <button className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              View all notifications
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

## Notification Row

```tsx
function NotificationRow({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group",
        !notification.read && "bg-primary/5"
      )}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {!notification.read ? (
          <div className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
        ) : (
          <div className="w-2 h-2" />
        )}
      </div>

      {/* Avatar */}
      {notification.avatar && (
        <img src={notification.avatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{notification.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{notification.body}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{notification.time}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

## Notification Empty State

```tsx
import { BellOff } from "lucide-react";

function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
      <BellOff className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">All caught up</p>
      <p className="text-xs text-muted-foreground">No new notifications right now.</p>
    </div>
  );
}
```

## Real-time Online Indicator

```tsx
function OnlineIndicator({
  online,
  size = "sm",
}: {
  online: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  return (
    <span className="relative inline-flex" aria-label={online ? "Online" : "Offline"}>
      {online && (
        <span
          className={cn("absolute inline-flex rounded-full bg-green-400 opacity-75 animate-ping", dim)}
          aria-hidden="true"
        />
      )}
      <span
        className={cn("relative inline-flex rounded-full", dim, online ? "bg-green-500" : "bg-muted-foreground/40")}
      />
    </span>
  );
}

// Usage — Avatar with indicator
<div className="relative inline-block">
  <img src="/avatar.png" alt="Jason" className="w-10 h-10 rounded-full" />
  <OnlineIndicator online={true} size="sm" className="absolute bottom-0 right-0 border-2 border-background" />
</div>
```

## In-Page Alert Banner

```tsx
import { AlertCircle, CheckCircle2, Info, XCircle, X } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

const alertConfig: Record<AlertVariant, { icon: typeof Info; classes: string }> = {
  info:    { icon: Info,          classes: "bg-blue-50  border-blue-200  text-blue-800  dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300" },
  success: { icon: CheckCircle2,  classes: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300" },
  warning: { icon: AlertCircle,   classes: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300" },
  error:   { icon: XCircle,       classes: "bg-red-50   border-red-200   text-red-800   dark:bg-red-950/30 dark:border-red-800 dark:text-red-300" },
};

function AlertBanner({
  variant,
  title,
  body,
  onDismiss,
}: {
  variant: AlertVariant;
  title: string;
  body?: string;
  onDismiss?: () => void;
}) {
  const { icon: Icon, classes } = alertConfig[variant];

  return (
    <div role="alert" className={cn("flex gap-3 items-start rounded-lg border px-4 py-3 text-sm", classes)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        {body && <p className="mt-0.5 opacity-80">{body}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100 shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
```

## Quality Checklist

- [ ] `<Toaster>` placed once at app root — never per-page
- [ ] Unread badge hidden (`aria-hidden`) when count is 0; shows via `aria-label` on bell trigger
- [ ] Badge count capped at `99+` — never overflows
- [ ] `AnimatePresence` wraps notification list for smooth enter/exit
- [ ] Online indicator uses `animate-ping` for living pulse effect
- [ ] Notification rows use `group-hover` to reveal dismiss button — not always visible
- [ ] `role="alert"` on inline banners for screen reader announcement
- [ ] Alert variants use semantic color tokens — never hardcoded hex
- [ ] `toast.promise()` used for async operations — shows loading state automatically
- [ ] Empty state shown when feed is empty — never an empty `<ScrollArea>`
