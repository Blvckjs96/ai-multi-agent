# Framer Motion

## Core Motion Components
```tsx
import { motion, AnimatePresence } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 40 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.5, ease: "easeOut" }}
/>
```

## Transition Types
```tsx
// Duration-based
transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}

// Spring (preferred for interactive elements)
transition={{ type: "spring", stiffness: 300, damping: 20, mass: 1 }}

// Named eases
ease: "circOut" | "expoOut" | "backOut" | "anticipate"
```

## Variants — Staggered Lists
```tsx
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((i) => <motion.li key={i.id} variants={item}>{i.title}</motion.li>)}
</motion.ul>
```

## Gestures
```tsx
<motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  drag="x"
  dragConstraints={{ left: -100, right: 100 }}
/>
```

## AnimatePresence (mount/unmount)
```tsx
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

## Layout Animations
```tsx
<motion.div layout layoutId="shared-element" />
```

## Reduced Motion
```tsx
// Check in component
import { useReducedMotion } from "framer-motion";
const reduced = useReducedMotion();
const transition = reduced ? { duration: 0 } : { duration: 0.5 };
```
