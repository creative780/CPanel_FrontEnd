'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { API_BASE_URL } from '../utils/api';

interface CarouselImage {
  src: string;
  title: string;
  caption: string;
  categoryName?: string;
  categorySlug: string; // always resolved (from backend slug, name, or title)
}

interface CarouselData {
  title: string;
  description: string;
  images: CarouselImage[];
}

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

// Per your spec: lowercase + spaces -> hyphens
const makeSlug = (val: string): string =>
  (val || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export default function SecondCarousel() {
  const [carouselData, setCarouselData] = useState<CarouselData>({
    title: '',
    description: '',
    images: [],
  });

  // Slider state
  const [currentIndex, setCurrentIndex] = useState(0);

  // Layout constants
  const ITEMS_PER_VIEW = 5;
  const GAP_PX = 10; // must match the gap utility below

  // Dynamic card width based on viewport
  const [cardWidth, setCardWidth] = useState<number>(0);

  // Refs
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Derived
  const total = carouselData.images.length;
  const maxIndex = Math.max(total - ITEMS_PER_VIEW, 0);
  const hasImages = total > 0;
  const totalPages = hasImages ? Math.ceil(total / ITEMS_PER_VIEW) : 0;
  const currentPage = hasImages ? Math.floor(currentIndex / ITEMS_PER_VIEW) : 0;

  // Clamp index if data changes
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  // Fetch carousel data from backend only (no dummy fallback)
  useEffect(() => {
    const baseUrl = `${API_BASE_URL}`.replace(/\/+$/, ''); // trim trailing slash
    const url = `${baseUrl}/api/second-carousel/?_=${Date.now()}`;

    fetch(url, withFrontendKey())
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.images)) {
          const newImages: CarouselImage[] = data.images.map((img: any, i: number) => {
            const raw = typeof img.src === 'string' ? img.src : '';
            const src =
              raw.startsWith('http') ? raw : `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;

            const catName: string =
              (img?.category?.name != null ? String(img.category.name) : '') || '';

            // Prefer backend slug if present, else generate from category name, else from title
            const preferredSlug =
              (img?.category?.slug != null ? String(img.category.slug) : '') || '';
            const computedSlug = preferredSlug || makeSlug(catName || img?.title || `Product ${i + 1}`);

            return {
              src,
              title: img?.title || `Product ${i + 1}`,
              caption: img?.caption || '',
              categoryName: catName || undefined,
              categorySlug: computedSlug, // always set
            };
          });

          setCarouselData({
            title: data.title || '',
            description: data.description || '',
            images: newImages,
          });
        } else {
          setCarouselData({
            title: data?.title || '',
            description: data?.description || '',
            images: [],
          });
        }
      })
      .catch(() => {
        setCarouselData((prev) => ({ ...prev, images: [] }));
      });
  }, []);

  // Measure viewport and compute card width = (viewportWidth - totalGap) / ITEMS_PER_VIEW
  useLayoutEffect(() => {
    const measure = () => {
      if (!viewportRef.current) return;
      const viewportWidth = viewportRef.current.clientWidth;
      const totalGap = GAP_PX * (ITEMS_PER_VIEW - 1);
      const w = Math.max(Math.floor((viewportWidth - totalGap) / ITEMS_PER_VIEW), 0);
      setCardWidth(w);
    };

    measure();

    // Use ResizeObserver for precise layout tracking
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && viewportRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(viewportRef.current);
    } else {
      // Fallback
      window.addEventListener('resize', measure);
    }

    return () => {
      if (ro && viewportRef.current) ro.unobserve(viewportRef.current);
      else window.removeEventListener('resize', measure);
    };
  }, []);

  // Translate track when index or cardWidth changes
  useEffect(() => {
    if (!trackRef.current) return;
    const offset = currentIndex * (cardWidth + GAP_PX);
    trackRef.current.style.transform = `translateX(-${offset}px)`;
  }, [currentIndex, cardWidth]);

  const scrollLeft = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const scrollRight = () => setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));

  return (
    <section
      // Force Poppins here regardless of global setup
      style={{ fontFamily: 'var(--font-poppins), Arial, Helvetica, sans-serif' }}
      className="w-full py-3 px-1 md:px-0 flex flex-col items-center font-normal"
    >
      <header className="text-center w-3/4 m-0">
        <h1 className="text-[#891F1A] text-5xl font-bold">{carouselData.title}</h1>
        <p className="text-[#757575] text-sm font-normal ">{carouselData.description}</p>
      </header>

      <div className="relative w-[calc(100%-30px)] -mt-10">
        {/* viewport */}
        <div
          ref={viewportRef}
          className="overflow-hidden px-[6px] sm:px-[10px] md:px-[14px]"
        >
          {hasImages ? (
            <div
              ref={trackRef}
              className="flex items-end gap-[10px] transition-transform duration-300 ease-in-out will-change-transform"
              style={{ width: cardWidth > 0 ? undefined : '100%' }}
            >
              {carouselData.images.map((item, index) => {
                const href = `/home/${item.categorySlug}`;
                return (
                  <Link
                    key={`${item.src}-${index}`}
                    href={href}
                    prefetch={true}
                    className="flex-shrink-0 rounded-[10px] overflow-hidden scroll-snap-start group focus:outline-none focus:ring-2 focus:ring-[#891F1A]"
                    style={{ width: `${cardWidth}px` }}
                    aria-label={`Go to ${item.categoryName || item.title} category`}
                  >
                    <div className="w-full aspect-square overflow-hidden rounded-t-md flex items-end cursor-pointer">
                      <img
                        src={item.src}
                        loading={index < ITEMS_PER_VIEW ? 'eager' : 'lazy'}
                        decoding="async"
                        alt={item.title || 'Carousel image'}
                        onError={(e) => (e.currentTarget.src = '/images/img1.jpg')}
                        className="object-contain w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>

                    {(item.title || item.caption) && (
                      <div className="py-2 flex justify-between items-start gap-2">
                        <div className="flex-1">
                          {item.title && (
                            <h3 className="text-sm font-medium text-[#333] text-left">
                              {item.title}
                            </h3>
                          )}
                          {item.caption && (
                            <p className="text-xs font-normal text-[#666] text-left">
                              {item.caption}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="w-full flex items-center justify-center" />
          )}
        </div>
      </div>

      {/* Pagination & Controls */}
      {hasImages && (
        <nav className="flex flex-col items-center gap-4" aria-label="carousel navigation">
          {totalPages > 1 && (
            <div className="flex gap-2">
              {Array.from({ length: totalPages }).map((_, index) => (
                <span
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentPage
                      ? 'bg-[#891F1A]'
                      : 'bg-[#D9D9D9] border border-[#891F1A]'
                  }`}
                  aria-label={`Page ${index + 1}`}
                />
              ))}
            </div>
          )}

          <div className="flex gap-6 mt-2">
            <button
              onClick={scrollLeft}
              disabled={currentIndex === 0}
              aria-label="Scroll left"
              className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={scrollRight}
              disabled={currentIndex >= maxIndex}
              aria-label="Scroll right"
              className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <FaChevronRight />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
