"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type GalleryImage = { type: "image"; src: string; alt: string; featured?: boolean };
type GalleryVideo = { type: "video"; src: string; poster: string; alt: string };
export type GalleryItem = GalleryImage | GalleryVideo;

const TILE =
  "group relative overflow-hidden rounded-sm border border-ink/10 bg-cream-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-hazel";

export default function Gallery({ items }: { items: readonly GalleryItem[] }) {
  const images = items.filter((i): i is GalleryImage => i.type === "image");
  const videos = items.filter((i): i is GalleryVideo => i.type === "video");
  const featured = images.find((i) => i.featured) ?? images[0];
  const others = images.filter((i) => i !== featured);

  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (dir: number) =>
      setOpen((i) => (i === null ? i : (i + dir + images.length) % images.length)),
    [images.length]
  );

  // swipe left/right to swap on touch devices
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, go]);

  return (
    <>
      <div className="space-y-3">
        {/* hero image + stacked video column */}
        <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
          {featured && (
            <button
              type="button"
              onClick={() => setOpen(images.indexOf(featured))}
              aria-label={`${featured.alt} (büyüt)`}
              className={`${TILE} aspect-[4/5]`}
            >
              <Image
                src={featured.src}
                alt={featured.alt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority
              />
            </button>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:grid-rows-3">
            {videos.map((v) => (
              <div key={v.src} className={`${TILE} aspect-[4/5] sm:aspect-auto`}>
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={v.src}
                  poster={v.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={v.alt}
                />
              </div>
            ))}
          </div>
        </div>

        {/* wide banner image(s) below */}
        {others.map((img) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setOpen(images.indexOf(img))}
            aria-label={`${img.alt} (büyüt)`}
            className={`${TILE} aspect-[16/7] w-full`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open !== null && images[open] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fotoğraf görüntüleyici"
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="lb-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-ink/92 p-4 backdrop-blur-sm"
        >
          {/* close */}
          <button
            type="button"
            onClick={close}
            aria-label="Kapat"
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink/40 text-cream/90 backdrop-blur-sm transition-colors hover:bg-ink/70 hover:text-cream"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* prev */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            aria-label="Önceki"
            className="absolute left-2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-ink/40 text-cream/90 backdrop-blur-sm transition-colors hover:bg-ink/70 hover:text-cream sm:left-6"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          {/* image */}
          <figure
            key={open}
            onClick={(e) => e.stopPropagation()}
            className="lb-figure flex max-h-[88vh] max-w-[92vw] flex-col items-center gap-3"
          >
            <div className="relative h-[78vh] w-[92vw] max-w-3xl">
              <Image
                src={images[open].src}
                alt={images[open].alt}
                fill
                sizes="92vw"
                className="object-contain"
                priority
              />
            </div>
            <figcaption className="text-center text-sm text-cream/70">
              {images[open].alt}
              <span className="ml-3 text-cream/40">
                {open + 1} / {images.length}
              </span>
            </figcaption>
          </figure>

          {/* next */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            aria-label="Sonraki"
            className="absolute right-2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-ink/40 text-cream/90 backdrop-blur-sm transition-colors hover:bg-ink/70 hover:text-cream sm:right-6"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
