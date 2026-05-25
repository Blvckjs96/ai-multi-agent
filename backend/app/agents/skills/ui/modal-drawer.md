---
name: modal-drawer
description: Generate overlays with shadcn/ui — Dialog, Sheet (drawer), AlertDialog, Popover, Tooltip, DropdownMenu. Covers accessibility, focus trap, keyboard dismiss, and animation patterns.
---

## Dialog (Modal)

```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function EditProfileDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit profile</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile. Click save when done.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-col gap-4 py-2">
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Display name" />
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Bio" />
        </div>

        <DialogFooter className="gap-2">
          <DialogTrigger asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogTrigger>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## AlertDialog (destructive confirmation)

```tsx
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

function DeleteConfirm({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Delete</Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The item will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Sheet (Drawer — slides from side / bottom)

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter } from "@/components/ui/sheet";

// side: "top" | "right" | "bottom" | "left"
function CartDrawer({ itemCount }: { itemCount: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          Cart
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Your cart ({itemCount})</SheetTitle>
          <SheetDescription>Review your items before checkout.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Cart items list */}
        </div>

        <SheetFooter className="flex-col gap-2 border-t pt-4">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span>Total</span>
            <span>$128.00</span>
          </div>
          <Button className="w-full">Checkout →</Button>
          <Button variant="ghost" className="w-full">Continue shopping</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

## Popover (anchor-relative overlay)

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="gap-2">
      <CalendarIcon className="w-4 h-4" />
      Pick date
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    {/* Calendar or date picker content */}
    <div className="p-4 text-sm">Calendar goes here</div>
  </PopoverContent>
</Popover>
```

## Tooltip

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// Wrap your app with <TooltipProvider> once at root
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button aria-label="More information">
        <Info className="w-4 h-4 text-muted-foreground" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top">
      <p>This field is required for verification</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## DropdownMenu

```tsx
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Share } from "lucide-react";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Open menu">
      <MoreHorizontal className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="gap-2 cursor-pointer">
      <Edit className="w-4 h-4" /> Edit
    </DropdownMenuItem>
    <DropdownMenuItem className="gap-2 cursor-pointer">
      <Share className="w-4 h-4" /> Share
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
      <Trash2 className="w-4 h-4" /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Controlled Dialog with state

```tsx
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button onClick={() => setOpen(true)}>Open</Button>
  </DialogTrigger>
  <DialogContent>
    {/* content */}
    <Button onClick={() => setOpen(false)}>Close</Button>
  </DialogContent>
</Dialog>
```

## Quality Checklist

- [ ] `Dialog` used for standard modals; `AlertDialog` for destructive confirmations
- [ ] `DialogTitle` always present (screen reader requirement)
- [ ] `DialogDescription` present when content needs context
- [ ] `DialogTrigger asChild` — wraps existing elements, never creates extra DOM
- [ ] Destructive actions use `AlertDialog` (not plain `Dialog`)
- [ ] `Sheet` side matches UX intent: `"right"` for panels, `"bottom"` for mobile
- [ ] `Tooltip` trigger has `aria-label` if it's an icon-only button
- [ ] `DropdownMenu` trigger has `aria-label` for icon-only triggers
- [ ] All overlays dismissible via Escape key (shadcn handles this automatically)
- [ ] Focus returns to trigger element after close
