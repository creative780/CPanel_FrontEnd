"use client";
import React, { useRef } from "react";

const HorizontalScroll = ({ children, scrollAmount = 320 }) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "next" ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative w-full">
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full shadow p-2"
        onClick={() => scroll("prev")}
        aria-label="Scroll left"
        type="button"
      >
        &#8592;
      </button>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 scrollbar-hide scroll-smooth px-10"
        style={{ scrollBehavior: "smooth" }}
      >
        {children}
      </div>
      <button
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full shadow p-2"
        onClick={() => scroll("next")}
        aria-label="Scroll right"
        type="button"
      >
        &#8594;
      </button>
    </div>
  );
};

export default HorizontalScroll;