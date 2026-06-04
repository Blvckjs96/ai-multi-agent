---
name: data-table
description: Generate interactive data tables with shadcn/ui Table/Input/Badge/DropdownMenu, Framer Motion row entrance animations, and kit motion tokens
---

## Interactive Data Table Strategy

### shadcn/ui Components to Use
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` — table structure
- `Input` — search/filter field
- `Button` — sort headers (`variant="ghost" size="sm"`), pagination, row actions
- `Badge` — status column values (color-coded by value)
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` — row action menus (Edit, Delete, etc.)
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` — rows-per-page selector
- `Checkbox` — row selection (if needed)
- `Skeleton` — loading rows placeholder

### shadcn Table Structure
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

<div className="space-y-4">
  <Input placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} className="max-w-sm" />
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(col => (
            <TableHead key={col.key}>
              {col.sortable ? (
                <Button variant="ghost" size="sm" onClick={() => handleSort(col.key)} className="-ml-3 h-8 gap-1">
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                </Button>
              ) : col.label}
            </TableHead>
          ))}
          <TableHead className="w-[70px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? rows.map((row, i) => (
          <TableRow key={row.id} className="hover:bg-muted/50 transition-colors duration-150">
            ...cells...
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="animate-in zoom-in-95 fade-in duration-150">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        )) : (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="text-center h-32 text-muted-foreground">
              No results found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
  {/* Pagination */}
</div>
```

### Tailwind Animate (from kit animation library)
```tsx
// Table container entrance
<div className="animate-in fade-in duration-200 rounded-md border">

// Dropdown menu — zoom-in-95 + fade-in (150ms, dropdown-enter preset)
<DropdownMenuContent className="animate-in zoom-in-95 fade-in duration-150">

// Skeleton loading rows
<Skeleton className="h-10 w-full animate-pulse" />
```

### Framer Motion — Row Entrance Animation
```tsx
import { motion, AnimatePresence } from "framer-motion";

// Animate rows entering/leaving (filter changes)
<AnimatePresence mode="popLayout">
  {rows.map((row, i) => (
    <motion.tr
      key={row.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, delay: i * 0.03 }}
      className="border-b hover:bg-muted/50 transition-colors duration-150"
    >
      {/* cells */}
    </motion.tr>
  ))}
</AnimatePresence>
```

### State & Data Pipeline
```tsx
const [query, setQuery]     = useState('');
const [sortKey, setSortKey] = useState<keyof Row | null>(null);
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
const [page, setPage]       = useState(1);
const PAGE_SIZE = 10;

// Pipeline
const filtered = data.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
const sorted   = sortKey ? [...filtered].sort((a, b) => { const av = String(a[sortKey]), bv = String(b[sortKey]); return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }) : filtered;
const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

### Status Badge Colors
```tsx
const STATUS_VARIANTS: Record<string, string> = {
  active:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  error:   "bg-red-100 text-red-700 border-red-200",
  inactive:"bg-muted text-muted-foreground",
};
<Badge variant="outline" className={STATUS_VARIANTS[row.status]}>{row.status}</Badge>
```

### Pagination
```tsx
<div className="flex items-center justify-between py-2">
  <p className="text-sm text-muted-foreground">
    Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, sorted.length)} of {sorted.length}
  </p>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={() => setPage(p=>p-1)} disabled={page===1}>Previous</Button>
    <Button variant="outline" size="sm" onClick={() => setPage(p=>p+1)} disabled={page===totalPages}>Next</Button>
  </div>
</div>
```

### Motion Token Reference
| Element | Duration | Notes |
|---------|----------|-------|
| Table entrance | 200ms | `fade-in` |
| Dropdown menu | 150ms | `zoom-in-95 fade-in` |
| Row entrance | 150ms | stagger 30ms |
| Row exit | instant | `AnimatePresence` |
| Row hover | 150ms | `transition-colors` |

### Quality Checklist
- [ ] shadcn `Table` components (not `<table>` HTML directly)
- [ ] Sort via `Button variant="ghost"` in `TableHead`
- [ ] Row actions via `DropdownMenu`
- [ ] `AnimatePresence` on rows for filter transition
- [ ] `Badge` for status with color-coded variants
- [ ] `Skeleton` for loading state
- [ ] Pagination with "Showing X–Y of Z" label
- [ ] `motion-reduce:transition-none` on animated rows
- [ ] App.tsx has `export default function App()`
