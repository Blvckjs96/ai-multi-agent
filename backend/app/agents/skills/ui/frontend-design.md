# Frontend Design

## Core Principle
Pick a visual direction and commit to it. Safe-average UI is worse than a strong, coherent aesthetic.

## Design Directions
Choose ONE and execute cleanly: brutally minimal | editorial | luxury | playful | geometric | retro-futurist | organic | maximalist

## Design Workflow

### 1. Visual System (define before coding)
- Type hierarchy (display face + body face pairing)
- Color variables (one dominant field + selective accents)
- Spacing rhythm (avoid uniform padding everywhere)
- Surface / border / shadow treatment
- Motion rules (compositor-only: transform, opacity, clip-path)

### 2. Composition
- Prefer asymmetry when it sharpens hierarchy
- Use overlap and layering for depth
- Break the grid when the composition benefits from it
- Avoid defaulting to symmetrical card grids

### 3. Motion
- Use animation to reveal hierarchy, stage information, reinforce action
- One well-directed load sequence > twenty random hover effects
- Always respect `prefers-reduced-motion`

## Anti-Patterns (NEVER default to)
- Interchangeable SaaS hero sections
- Generic card piles with no hierarchy
- Placeholder-feeling typography with no character
- Motion that exists only because it was easy to add
- Generic AI-looking UI with uniform spacing and shadows

## Tech Stack Defaults
- React + TypeScript + Tailwind CSS (utility-first)
- Framer Motion for declarative animations
- shadcn/ui as headless component base (always override for design intent)
- CSS custom properties for design tokens

## Quality Gate
- Clear visual point of view
- Typography and spacing feel intentional
- Result does NOT look like generic AI-generated UI
