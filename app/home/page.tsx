"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  useCallback,
} from "react";
import "toastify-js/src/toastify.css";
import Navbar from "../components/Navbar";
import Header from "../components/header";
import LogoSection from "../components/LogoSection";
import Footer from "../components/Footer";
import MobileTopBar from "../components/HomePageTop";
import Link from "next/link";
import {
  FaEnvelopeOpenText,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
} from "react-icons/fa";
import Toastify from "toastify-js";
import { API_BASE_URL } from "../utils/api";
import { ChatBot } from "../components/ChatBot";
import dynamic from "next/dynamic";

// 🔐 Frontend key helper (adds X-Frontend-Key to requests)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (FRONTEND_KEY) headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

// ✂️ Code-split heavy sections with proper Suspense fallbacks
const Carousel = dynamic(() => import("../components/Carousel"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] sm:h-[280px] w-full animate-pulse bg-gray-100" />
  ),
});
const Reviews = dynamic(() => import("../components/reviews"), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse bg-gray-100" />,
});
const SecondCarousel = dynamic(() => import("../components/second_carousel"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] sm:h-[260px] w-full animate-pulse bg-gray-100" />
  ),
});

// Types
type Category = {
  id: number | string;
  name: string;
  image?: string;
  status?: "visible" | "hidden";
};

export default function PrintingServicePage() {
  const fallbackImage =
    "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ymeg8jht_expires_30_days.png";

  // Hero state
  const [desktopImages, setDesktopImages] = useState<string[]>([fallbackImage]);
  const [mobileImages, setMobileImages] = useState<string[]>([fallbackImage]);
  const [desktopIndex, setDesktopIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);

  // Data state
  const [categories, setCategories] = useState<Category[]>([]);

  // Interval refs to avoid stale closures + guarantee cleanup
  const desktopTimer = useRef<number | null>(null);
  const mobileTimer = useRef<number | null>(null);
  const isPageVisible = useRef<boolean>(true);

  // --- Utilities
  const safeJoin = (base: string, path?: string) => {
    if (!path) return "";
    if (!base) return path;
    return path.startsWith("http")
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const toKebab = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");

  // --- Hero images fetch (abortable + batched state)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/hero-banner/`, {
          ...withFrontendKey(),
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Hero fetch failed: ${res.status}`);
        const data = await res.json();

        const all = Array.isArray(data?.images) ? data.images : [];
        const desktop = all
          .filter((img: any) => img?.device_type === "desktop")
          .map((img: any) => img?.url)
          .filter(Boolean);
        const mobile = all
          .filter((img: any) => img?.device_type === "mobile")
          .map((img: any) => img?.url)
          .filter(Boolean);

        // Fallback split if device types aren’t set
        const mid = Math.ceil(all.length / 2);
        const fallbackDesktop = all
          .slice(0, mid)
          .map((i: any) => i?.url)
          .filter(Boolean);
        const fallbackMobile = all
          .slice(mid)
          .map((i: any) => i?.url)
          .filter(Boolean);

        // Batch updates to avoid double render
        setDesktopImages(
          desktop.length
            ? desktop
            : fallbackDesktop.length
            ? fallbackDesktop
            : [fallbackImage]
        );
        setMobileImages(
          mobile.length
            ? mobile
            : fallbackMobile.length
            ? fallbackMobile
            : [fallbackImage]
        );
        setDesktopIndex(0);
        setMobileIndex(0);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          setDesktopImages([fallbackImage]);
          setMobileImages([fallbackImage]);
          setDesktopIndex(0);
          setMobileIndex(0);
        }
      }
    })();

    return () => ac.abort();
  }, [API_BASE_URL]); // stable in your project, but explicit

  // --- Categories fetch (abortable + filtering)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/show-categories/`, {
          ...withFrontendKey(),
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`);
        const data: Category[] = await res.json();
        const visible = (Array.isArray(data) ? data : []).filter(
          (c) => c?.status === "visible"
        );
        setCategories(visible);
      } catch {
        // Soft-fail; keep empty
      }
    })();

    return () => ac.abort();
  }, [API_BASE_URL]);

  // --- Handle page visibility (pause timers to save CPU)
  useEffect(() => {
    const onVisibility = () => {
      isPageVisible.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // --- Sliders (use single source of truth per list; auto-pause when hidden)
  const startDesktopSlider = useCallback(() => {
    if (desktopTimer.current) window.clearInterval(desktopTimer.current);
    if (desktopImages.length <= 1) return;
    desktopTimer.current = window.setInterval(() => {
      if (!isPageVisible.current) return;
      setDesktopIndex((prev) => (prev + 1) % desktopImages.length);
    }, 4000);
  }, [desktopImages.length]);

  const startMobileSlider = useCallback(() => {
    if (mobileTimer.current) window.clearInterval(mobileTimer.current);
    if (mobileImages.length <= 1) return;
    mobileTimer.current = window.setInterval(() => {
      if (!isPageVisible.current) return;
      setMobileIndex((prev) => (prev + 1) % mobileImages.length);
    }, 4000);
  }, [mobileImages.length]);

  useEffect(() => {
    startDesktopSlider();
    return () => {
      if (desktopTimer.current) window.clearInterval(desktopTimer.current);
    };
  }, [startDesktopSlider]);

  useEffect(() => {
    startMobileSlider();
    return () => {
      if (mobileTimer.current) window.clearInterval(mobileTimer.current);
    };
  }, [startMobileSlider]);

  // --- Static memo (no re-renders)
  const contactItems = useMemo(
    () => [
      {
        icon: <FaWhatsapp className="text-[#014C3D] text-[44px]" />,
        title: "Whatsapp",
        value: "+971 50 279 3948",
        href: "https://wa.me/971502793948",
        color: "#014C3D",
      },
      {
        icon: <FaPhoneAlt className="text-[#00B7FF] text-[44px]" />,
        title: "Call",
        value: "+971 54 539 6249",
        href: "tel:+971545396249",
        color: "#00B7FF",
      },
      {
        icon: <FaMapMarkerAlt className="text-[#891F1A] text-[44px]" />,
        title: "Find Us",
        value: "Naif – Deira – Dubai",
        href: "https://maps.google.com/?q=Naif+Deira+Dubai",
        color: "#891F1A",
      },
      {
        icon: <FaEnvelopeOpenText className="text-[#E6492D] text-[44px]" />,
        title: "Email",
        value: "ccaddxb@gmail.com",
        href: "mailto:ccaddxb@gmail.com",
        color: "#E6492D",
      },
    ],
    []
  );

  // --- CTA form
  const [isSubmitted, setIsSubmitted] = useState(false);
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitted(true);

    Toastify({
      text: "We'll Call you back soon",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
    }).showToast();

    e.currentTarget.reset();
    window.setTimeout(() => setIsSubmitted(false), 4000);
  }, []);

  // --- Render
  return (
    <div className="flex flex-col bg-white">
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      {/* Hero Images */}
      <img
        loading="eager"
        width={1440}
        height={400}
        src={desktopImages[desktopIndex] || fallbackImage}
        alt="Hero Desktop"
        className="hidden sm:block w-full h-auto mx-auto"
      />
      <img
        loading="lazy"
        width={768}
        height={300}
        src={mobileImages[mobileIndex] || fallbackImage}
        alt="Hero Mobile"
        className="block sm:hidden w-full h-auto object-cover mx-auto"
      />

      {/* Carousels with real Suspense fallbacks */}
      <Suspense
        fallback={
          <div className="h-[220px] sm:h-[280px] w-full animate-pulse bg-gray-100" />
        }
      >
        <Carousel />
      </Suspense>

      <img
        height={250}
        src="/images/Banner3.jpg"
        alt="Banner Image"
        className="block bg-[#D9D9D9] w-full h-auto mx-auto"
      />

      {/* Categories */}
      <div className="px-4 sm:px-6 lg:px-24 py-8">
        <h2 className="text-[#891F1A] text-2xl sm:text-3xl font-bold text-center mb-6">
          Discover our categories
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {categories.length === 0
            ? // Lightweight skeleton
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-full aspect-[4/3] rounded-lg bg-gray-100 animate-pulse" />
                  <div className="mt-2 h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              ))
            : categories.map((category) => {
                const href = `/home/${toKebab(category.name)}`;
                const imgSrc =
                  safeJoin(API_BASE_URL, category.image) || "/images/img1.jpg";

                return (
                  <Link key={category.id} href={href} passHref>
                    <div className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-300">
                      <img
                        src={imgSrc}
                        alt={category.name}
                        className="w-full h-auto object-cover rounded-lg"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/images/img1.jpg";
                        }}
                        loading="lazy"
                      />
                      <h3 className="mt-2 text-md font-semibold text-[#333] text-center">
                        {category.name}
                      </h3>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>

      <img
        height={250}
        src="/images/Banner2.jpg"
        alt="Banner Image"
        className="block bg-[#D9D9D9] w-full h-auto"
      />

      <Suspense
        fallback={
          <div className="h-[200px] sm:h-[260px] w-full animate-pulse bg-gray-100" />
        }
      >
        <SecondCarousel />
      </Suspense>

      <Suspense
        fallback={
          <div className="h-[320px] w-full animate-pulse bg-gray-100" />
        }
      >
        <Reviews />
      </Suspense>

      {/* CTA */}
      <section className="flex flex-col lg:flex-row gap-8 items-center px-4 sm:px-6 lg:px-24 py-12 bg-white">
        <div className="flex-1">
          <p className="text-[#837E8C] text-sm font-semibold mb-2">
            Call To Action
          </p>
          <h2 className="text-[#0E0E0E] text-3xl sm:text-4xl font-bold leading-tight mb-4">
            Let's Bring Your Ideas to Life
          </h2>
          <p className="text-[#868686] max-w-xl">
            Scelerisque in dolor donec neque velit. Risus aenean integer
            elementum odio sed adipiscing. Sem id scelerisque nunc quis.
            Imperdiet nascetur consequat.
          </p>

          {/* Callback Form */}
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-6 max-w-md"
            noValidate
          >
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="Enter your full name"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
                autoComplete="name"
              />
            </div>

            <div className="mt-6">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                placeholder="e.g. +971-50-123-4567"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                placeholder="Briefly tell us what this is about"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
              />
            </div>

            <div className="flex justify-left">
              <button
                type="submit"
                className="bg-[#891F1A] text-white px-8 py-3 rounded-md hover:bg-[#6f1814] transition"
                disabled={isSubmitted}
              >
                {isSubmitted ? "Sending..." : "Send Request"}
              </button>
            </div>
          </form>
        </div>

        <div className="w-full mr-[10px] sm:w-[500px] h-[600px] bg-[#8B8491] rounded-xl" />
      </section>

      <div className="w-full bg-white h-[100px]" />

      {/* Contact Info */}
      <section className="bg-[#FAFAFA] px-4 sm:px-6 lg:px-24 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {contactItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center sm:items-start transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                {item.icon}
                <div>
                  <h3 className="text-[28px]" style={{ color: item.color }}>
                    {item.title}
                  </h3>
                  <p className="text-[16px]" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
              </div>
              <div
                className="mt-2 w-0 group-hover:w-24 h-[2px] transition-all duration-300"
                style={{ backgroundColor: item.color }}
              />
            </a>
          ))}
        </div>
      </section>

      <Footer />
      <ChatBot />
    </div>
  );
}
