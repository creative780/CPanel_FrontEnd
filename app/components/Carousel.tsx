'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { API_BASE_URL } from '../utils/api';

interface CarouselImage {
  src: string;
  title: string;
  caption: string;
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

export default function FirstCarousel() {
  const [carouselData, setCarouselData] = useState<CarouselData>({
    title: '',
    description: '',
    images: [],
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);

  // Layout constants
  const itemsPerView = 5;
  const itemWidth = 240;

  const maxIndex = Math.max(carouselData.images.length - itemsPerView, 0);

  // Clamp index if data changes (e.g., fewer images than before)
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  // Fetch carousel data from backend only (no dummy fallback)
  useEffect(() => {
    const baseUrl = `${API_BASE_URL}`;
    const url = `${baseUrl}/api/first-carousel/?_=${Date.now()}`;

    fetch(url, withFrontendKey())
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.images)) {
          const newImages: CarouselImage[] = data.images.map((img: any, i: number) => ({
            src: typeof img.src === 'string' && img.src.startsWith('http')
              ? img.src
              : `${baseUrl}${img.src}`,
            title: img.title || `Product ${i + 1}`,
            caption: img.caption || '',
          }));

          setCarouselData({
            title: data.title || '',
            description: data.description || '',
            images: newImages,
          });
        } else {
          // If API returns no images array, keep empty state
          setCarouselData({ title: data?.title || '', description: data?.description || '', images: [] });
        }
      })
      .catch(() => {
        // No silent dummy injection. Stay empty on error.
        setCarouselData((prev) => ({ ...prev, images: [] }));
      });
  }, []);

  // Translate track on desktop when index changes
  useEffect(() => {
    if (!trackRef.current) return;
    if (window.innerWidth >= 768) {
      trackRef.current.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
    } else {
      trackRef.current.style.transform = 'none';
    }
  }, [currentIndex]);

  // Recompute transform on resize
  useEffect(() => {
    const handleResize = () => {
      if (!trackRef.current) return;
      if (window.innerWidth < 768) {
        trackRef.current.style.transform = 'none';
      } else {
        trackRef.current.style.transform = `translateX(-${currentIndex * itemWidth}px)`;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex]);

  const scrollLeft = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const scrollRight = () => setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));

  const hasImages = carouselData.images.length > 0;
  const currentPage = hasImages ? Math.floor(currentIndex / itemsPerView) : 0;
  const totalPages = hasImages ? Math.ceil(carouselData.images.length / itemsPerView) : 0;

  return (
    <section className="w-full py-7 px-1 md:px-0 flex flex-col items-center">
      <header className="text-center max-w-[800px] mb-8">
        {carouselData.title ? (
          <h1 className="text-[#891F1A] text-[32px] font-bold">{carouselData.title}</h1>
        ) : (
          <h1 className="text-[#891F1A] text-[32px] font-bold"> </h1>
        )}
        {carouselData.description ? (
          <p className="text-[#757575] text-sm mt-2">{carouselData.description}</p>
        ) : (
          <p className="text-[#757575] text-sm mt-2"> </p>
        )}
      </header>

      <div className="relative w-full max-w-screen-xl mb-6">
        <div className="overflow-x-auto md:overflow-hidden px-[6px] sm:px-[10px] md:px-[14px]">
          {hasImages ? (
            <div
              ref={trackRef}
              className="flex gap-[10px] transition-transform duration-300 ease-in-out md:pointer-events-none scroll-smooth"
            >
              {carouselData.images.map((item, index) => (
                <div
                  key={`${item.src}-${index}`}
                  className="flex-shrink-0 w-[240px] rounded-[10px] overflow-hidden scroll-snap-start"
                >
                  <img
                    src={item.src}
                    width={240}
                    height={150}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    alt={item.title || 'Carousel image'}
                    onError={(e) => (e.currentTarget.src = '/images/img1.jpg')}
                    className="object-cover w-full h-[150px] rounded-t-md"
                  />
                  <div className="py-2 flex justify-between items-start gap-2">
                    <div className="flex-1">
                      {item.title && (
                        <h3 className="text-sm font-semibold text-[#333] text-left">{item.title}</h3>
                      )}
                      {item.caption && (
                        <p className="text-xs text-[#666] text-left">{item.caption}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full flex items-center justify-center py-10 h-[0px]">
            </div>
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
                    index === currentPage ? 'bg-[#891F1A]' : 'bg-[#D9D9D9] border border-[#891F1A]'
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
              className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={scrollRight}
              disabled={currentIndex >= maxIndex}
              aria-label="Scroll right"
              className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaChevronRight />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
