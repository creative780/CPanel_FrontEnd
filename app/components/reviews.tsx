"use client";
import React, { useRef, useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import Image from "next/image";

export default function CustomerReviews() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [testimonials, setTestimonials] = useState<any[]>([]);

  const itemsPerPage = 3;
  const totalPages = Math.ceil(testimonials.length / itemsPerPage);

  useEffect(() => {
    const data = localStorage.getItem("admin_testimonials_data");
    if (data) {
      try {
        setTestimonials(JSON.parse(data));
      } catch {
        setTestimonials([]);
      }
    }

    const handleStorage = () => {
      const updated = localStorage.getItem("admin_testimonials_data");
      if (updated) {
        setTestimonials(JSON.parse(updated));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const newIndex =
      direction === "left"
        ? Math.max(0, scrollIndex - 1)
        : Math.min(totalPages - 1, scrollIndex + 1);

    container.scrollTo({
      left: newIndex * container.offsetWidth,
      behavior: "smooth",
    });

    setScrollIndex(newIndex);
  };

  useEffect(() => {
    const handler = () => {
      if (!scrollRef.current) return;
      const container = scrollRef.current;
      setScrollIndex(Math.round(container.scrollLeft / container.offsetWidth));
    };
    const ref = scrollRef.current;
    ref?.addEventListener("scroll", handler);
    return () => ref?.removeEventListener("scroll", handler);
  }, []);

  if (testimonials.length === 0) return null;

  return (
    <section
      style={{ fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif" }}
      className="relative w-full py-20 bg-white overflow-hidden px-2 md:px-4"
    >
      {/* h2 → Semi Bold (600) */}
      <h2 className="text-4xl font-semibold text-center text-[#891F1A] mb-3">
        What Our Customers Say
      </h2>

      {/* p → Regular (400) */}
      <p className="text-center text-gray-500 text-lg font-normal mb-12">
        Hear from our incredible customers who are building at lightning speed.
      </p>

      <div className="relative max-w-screen-xl mx-auto">
        <div
          ref={scrollRef}
          className="overflow-x-auto scroll-smooth no-scrollbar"
          tabIndex={0}
        >
          <div className="mt-6 flex gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="relative min-w-[300px] max-w-[300px] flex-shrink-0"
              >
                <article className="relative bg-white border-[2px] border-[#891F1A] rounded-2xl shadow-md px-5 pt-16 pb-6 text-left flex flex-col gap-4 overflow-visible">
                  <figure className="absolute -top-10 w-16 h-16 rounded-full overflow-hidden shadow mt-5 border-[3px] border-[#891F1A] bg-white">
                    <Image
                      src={t.image || "/default-avatar.jpg"}
                      alt={t.name || "Customer"}
                      width={70}
                      height={70}
                      className="object-cover w-full h-full"
                    />
                  </figure>

                  {/* Stars */}
                  <div className="flex justify-end -mt-13">
                    {Array(t.rating || 5)
                      .fill(0)
                      .map((_, i) => (
                        <span
                          key={i}
                          className="text-[#891F1A] text-xl font-medium"
                        >
                          ★
                        </span>
                      ))}
                  </div>

                  {/* Review text → p (Regular 400) */}
                  <p className="text-gray-800 text-[15px] leading-relaxed font-normal">
                    {t.content}
                  </p>

                  <footer>
                    {/* Name → Bold (700) */}
                    <p className="font-bold text-[#891F1A] text-sm">{t.name}</p>
                    {/* Role → Light (300) */}
                    <p className="text-gray-500 text-sm font-light">{t.role}</p>
                  </footer>
                </article>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination dots */}
        <nav
          className="flex justify-center gap-2 mt-6"
          aria-label="Review pages"
        >
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i === scrollIndex
                  ? "bg-[#891F1A]"
                  : "bg-[#D9D9D9] border border-[#891F1A]"
              }`}
            />
          ))}
        </nav>

        {/* Controls */}
        <div className="flex justify-center gap-6 mt-4">
          {/* button → Medium (500) */}
          <button
            onClick={() => scroll("left")}
            disabled={scrollIndex === 0}
            className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            aria-label="Scroll to previous reviews"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={scrollIndex === totalPages - 1}
            className="w-10 h-10 bg-white border-2 border-[#891F1A] text-[#891F1A] rounded-full flex items-center justify-center hover:bg-[#891F1A] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            aria-label="Scroll to next reviews"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
