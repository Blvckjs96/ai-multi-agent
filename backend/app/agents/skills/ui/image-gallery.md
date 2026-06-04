---
name: image-gallery
description: Generate image gallery UIs — masonry grid, lightbox with keyboard nav, infinite scroll, filter tabs, aspect-ratio cards, zoom on hover, and skeleton loading. Uses Framer Motion and shadcn/ui.
---

## Masonry Grid (CSS columns)

```tsx
interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

function MasonryGrid({ images }: { images: GalleryImage[] }) {
  return (
    <div
      className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3"
      role="list"
      aria-label="Image gallery"
    >
      {images.map((img, i) => (
        <motion.div
          key={img.id}
          role="listitem"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-3 break-inside-avoid"
        >
          <GalleryCard image={img} />
        </motion.div>
      ))}
    </div>
  );
}
```

## Gallery Card (hover overlay)

```tsx
import { motion } from "framer-motion";
import { Expand, Heart } from "lucide-react";
import { useState } from "react";

function GalleryCard({
  image,
  onExpand,
}: {
  image: GalleryImage;
  onExpand?: (image: GalleryImage) => void;
}) {
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      whileHover="hover"
      className="group relative overflow-hidden rounded-xl cursor-pointer bg-muted"
    >
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
      />

      {/* Overlay */}
      <motion.div
        variants={{ hover: { opacity: 1 }, initial: { opacity: 0 } }}
        initial="initial"
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20
                   flex flex-col justify-between p-3"
      >
        {/* Top actions */}
        <div className="flex justify-end gap-2">
          <motion.button
            variants={{ hover: { y: 0, opacity: 1 }, initial: { y: -8, opacity: 0 } }}
            transition={{ delay: 0.05 }}
            onClick={() => setLiked((v) => !v)}
            aria-label={liked ? "Unlike" : "Like"}
            aria-pressed={liked}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            <Heart
              className="w-4 h-4 transition-colors"
              fill={liked ? "#ef4444" : "none"}
              color={liked ? "#ef4444" : "white"}
            />
          </motion.button>
          {onExpand && (
            <motion.button
              variants={{ hover: { y: 0, opacity: 1 }, initial: { y: -8, opacity: 0 } }}
              transition={{ delay: 0.1 }}
              onClick={() => onExpand(image)}
              aria-label="View full size"
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <Expand className="w-4 h-4 text-white" />
            </motion.button>
          )}
        </div>

        {/* Alt caption */}
        <motion.p
          variants={{ hover: { y: 0, opacity: 1 }, initial: { y: 8, opacity: 0 } }}
          className="text-white text-xs font-medium truncate"
        >
          {image.alt}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
```

## Lightbox

```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const image = index !== null ? images[index] : null;

  // Keyboard navigation
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  onNavigate(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onNavigate(Math.min(images.length - 1, index + 1));
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNavigate]);

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 bg-black/95 border-none overflow-hidden">
        <div className="relative flex items-center justify-center min-h-[60vh]">
          {/* Prev */}
          <button
            onClick={() => index !== null && onNavigate(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label="Previous image"
            className="absolute left-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Image */}
          <AnimatePresence mode="wait">
            {image && (
              <motion.img
                key={image.id}
                src={image.src}
                alt={image.alt}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="max-h-[80vh] max-w-full object-contain"
              />
            )}
          </AnimatePresence>

          {/* Next */}
          <button
            onClick={() => index !== null && onNavigate(Math.min(images.length - 1, index + 1))}
            disabled={index === images.length - 1}
            aria-label="Next image"
            className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close lightbox"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Counter */}
        {index !== null && (
          <p className="text-center text-white/50 text-xs pb-3">
            {index + 1} / {images.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

## Filter Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const categories = ["All", "Architecture", "Nature", "People", "Abstract"];

function FilteredGallery({ images }: { images: (GalleryImage & { category: string })[] }) {
  return (
    <Tabs defaultValue="All">
      <TabsList className="mb-6">
        {categories.map((cat) => (
          <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
        ))}
      </TabsList>
      {categories.map((cat) => (
        <TabsContent key={cat} value={cat}>
          <MasonryGrid
            images={cat === "All" ? images : images.filter((i) => i.category === cat)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

## Skeleton Loading Grid

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function GallerySkeleton({ count = 8 }: { count?: number }) {
  const heights = [200, 280, 160, 320, 240, 200, 300, 180];

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mb-3 break-inside-avoid">
          <Skeleton
            className="w-full rounded-xl"
            style={{ height: heights[i % heights.length] }}
          />
        </div>
      ))}
    </div>
  );
}
```

## Infinite Scroll Hook

```tsx
import { useRef, useCallback, useEffect } from "react";

function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const observe = useCallback(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) onLoadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  useEffect(observe, [observe]);

  return sentinelRef;
}

// Usage
function InfiniteGallery() {
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    const next = await fetchMoreImages(images.length);
    setImages((prev) => [...prev, ...next]);
    if (next.length < 12) setHasMore(false);
    setLoading(false);
  }, [images.length, loading]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

  return (
    <>
      <MasonryGrid images={images} />
      {loading && <GallerySkeleton count={4} />}
      <div ref={sentinelRef} aria-hidden="true" />
    </>
  );
}
```

## Aspect-Ratio Grid (uniform)

```tsx
function AspectGrid({ images }: { images: GalleryImage[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {images.map((img) => (
        <div key={img.id} className="aspect-square overflow-hidden rounded-lg bg-muted group cursor-pointer">
          <img
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      ))}
    </div>
  );
}
```

## Quality Checklist

- [ ] All `<img>` have `alt` text — empty `alt=""` for purely decorative images
- [ ] Images have explicit `width` and `height` to prevent CLS
- [ ] Below-fold images use `loading="lazy"` + `decoding="async"`
- [ ] Hero/first images use `loading="eager"` + `fetchpriority="high"`
- [ ] Lightbox traps focus and returns focus to trigger on close
- [ ] Arrow key navigation handled inside lightbox (`keydown` listener)
- [ ] `AnimatePresence mode="wait"` for lightbox image transitions
- [ ] Infinite scroll sentinel uses `IntersectionObserver` — never scroll event listener
- [ ] Filter tabs maintain scroll position when switching categories
- [ ] Skeleton heights vary to mimic masonry — never uniform
