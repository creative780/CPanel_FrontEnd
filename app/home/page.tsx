"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Suspense,
} from "react";
import "toastify-js/src/toastify.css"; // ✅ static CSS import (no TS errors)
import dynamic from "next/dynamic";
import Image from "next/image";
import Navbar from "../components/Navbar";
import Header from "../components/header";
import LogoSection from "../components/LogoSection";
import MobileTopBar from "../components/HomePageTop";
import Link from "next/link";
import {
  FaEnvelopeOpenText,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
} from "react-icons/fa";
import { API_BASE_URL } from "../utils/api";

// 🔐 Frontend key helper (adds X-Frontend-Key to requests)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (FRONTEND_KEY) headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

// Code-split heavy modules (with safe loaders)
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
// ✅ ChatBot is a NAMED export; pick it off the module
const ChatBot = dynamic(
  () => import("../components/ChatBot").then((m) => m.ChatBot),
  { ssr: false, loading: () => null }
);
// Footer likely default export; keep it split too
const Footer = dynamic(() => import("../components/Footer"), {
  loading: () => <div className="h-24 w-full bg-gray-100 animate-pulse" />,
});

// Types
type Category = {
  id: number | string;
  name: string;
  image?: string;
  status?: "visible" | "hidden";
};

const FALLBACK_IMG =
  "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ymeg8jht_expires_30_days.png";

/* ----------------------------- utils -------------------------------- */
const safeJoin = (base: string, path?: string) => {
  if (!path) return "";
  if (!base || /^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};
const toKebab = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");

/* -------------------------- slider hook ------------------------------ */
function useAutoSlider(
  length: number,
  delayMs: number,
  rootRef: React.RefObject<HTMLElement | null>
) {
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);
  const visible = useRef(true);
  const onScreen = useRef(true);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const clear = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    const onVis = () => {
      visible.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis, { passive: true });
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        onScreen.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [rootRef]);

  useEffect(() => {
    clear();
    if (length <= 1 || reduceMotion) return;

    timer.current = window.setInterval(() => {
      if (!visible.current || !onScreen.current) return;
      setIndex((i) => ((i + 1) % (length || 1)) as number);
    }, delayMs);

    return clear;
  }, [length, delayMs, reduceMotion]);

  return [index, setIndex] as const;
}

/* --------------------------- memo children --------------------------- */
const ContactItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  href: string;
  color: string;
}> = React.memo(({ icon, title, value, href, color }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex flex-col items-center sm:items-start transition-all duration-300"
  >
    <div className="flex items-center gap-4">
      {icon}
      <div>
        <h3 className="text-[28px]" style={{ color }}>
          {title}
        </h3>
        <p className="text-[16px]" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
    <div
      className="mt-2 w-0 group-hover:w-24 h-[2px] transition-all duration-300"
      style={{ backgroundColor: color }}
    />
  </a>
));

const CategoryCard: React.FC<{ category: Category; apiBase: string }> =
  React.memo(({ category, apiBase }) => {
    const href = `/home/${toKebab(category.name)}`;
    const imgSrc = safeJoin(apiBase, category.image) || "/images/img1.jpg";
    return (
      <Link href={href} passHref>
        <div className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-300">
          <Image
            src={imgSrc}
            alt={category.name}
            width={640}
            height={480}
            className="w-full h-auto object-cover rounded-lg"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 320px"
            // Next/Image doesn't let us easily change src in onError reliably across versions.
            // We rely on server-provided URLs; if broken, Next shows a broken icon.
            // Optional: add blurDataURL + placeholder="blur" if you have tiny thumbs.
          />
          <h3 className="mt-2 text-md font-semibold text-[#333] text-center">
            {category.name}
          </h3>
        </div>
      </Link>
    );
  });

/* ------------------------------ page -------------------------------- */
export default function PrintingServicePage() {
  const [desktopImages, setDesktopImages] = useState<string[]>([FALLBACK_IMG]);
  const [mobileImages, setMobileImages] = useState<string[]>([FALLBACK_IMG]);
  const [categories, setCategories] = useState<Category[]>([]);

  // hero container refs for slider pause when off-screen
  const desktopHeroRef = useRef<HTMLDivElement | null>(null);
  const mobileHeroRef = useRef<HTMLDivElement | null>(null);

  const [desktopIndex, setDesktopIndex] = useAutoSlider(
    desktopImages.length,
    4000,
    desktopHeroRef
  );
  const [mobileIndex, setMobileIndex] = useAutoSlider(
    mobileImages.length,
    4000,
    mobileHeroRef
  );

  // Fetch hero images
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/hero-banner/`, {
          ...withFrontendKey(),
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const all = Array.isArray(data?.images) ? data.images : [];
        const desktop = all
          .filter((i: any) => i?.device_type === "desktop")
          .map((i: any) => i?.url)
          .filter(Boolean);
        const mobile = all
          .filter((i: any) => i?.device_type === "mobile")
          .map((i: any) => i?.url)
          .filter(Boolean);
        const mid = Math.ceil(all.length / 2);
        setDesktopImages(
          desktop.length
            ? desktop
            : all
                .slice(0, mid)
                .map((i: any) => i?.url)
                .filter(Boolean) || [FALLBACK_IMG]
        );
        setMobileImages(
          mobile.length
            ? mobile
            : all
                .slice(mid)
                .map((i: any) => i?.url)
                .filter(Boolean) || [FALLBACK_IMG]
        );
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          setDesktopImages([FALLBACK_IMG]);
          setMobileImages([FALLBACK_IMG]);
        }
      } finally {
        // reset indexes so Image 'priority' logic stays sane
        setDesktopIndex(0);
        setMobileIndex(0);
      }
    })();
    return () => ac.abort();
  }, [setDesktopIndex, setMobileIndex]);

  // Fetch categories
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/show-categories/`, {
          ...withFrontendKey(),
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: Category[] = await res.json();
        setCategories(
          (Array.isArray(data) ? data : []).filter(
            (c) => c?.status === "visible"
          )
        );
      } catch {
        /* silent fail */
      }
    })();
    return () => ac.abort();
  }, []);

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

  // Toast on-demand import (JS only; CSS is already at top)
  const [isSubmitted, setIsSubmitted] = useState(false);
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitted(true);

      const { default: Toastify } = await import("toastify-js");

      Toastify({
        text: "We'll Call you back soon",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
      }).showToast();

      e.currentTarget.reset();
      window.setTimeout(() => setIsSubmitted(false), 4000);
    },
    []
  );

  /* -------------------------------- UI ------------------------------- */
  return (
    <div className="flex flex-col bg-white">
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      {/* Hero Images (desktop) */}
      <div ref={desktopHeroRef}>
        <Image
          src={desktopImages[desktopIndex] || FALLBACK_IMG}
          alt="Hero Desktop"
          width={1440}
          height={400}
          className="hidden sm:block w-full h-auto mx-auto"
          priority
          sizes="100vw"
        />
      </div>

      {/* Hero Images (mobile) */}
      <div ref={mobileHeroRef}>
        <Image
          src={mobileImages[mobileIndex] || FALLBACK_IMG}
          alt="Hero Mobile"
          width={768}
          height={300}
          className="block sm:hidden w-full h-auto object-cover mx-auto"
          sizes="100vw"
        />
      </div>

      <Suspense
        fallback={
          <div className="h-[220px] sm:h-[280px] w-full animate-pulse bg-gray-100" />
        }
      >
        <Carousel />
      </Suspense>

      <Image
        src="/images/Banner3.jpg"
        alt="Banner Image"
        width={1920}
        height={250}
        className="block bg-[#D9D9D9] w-full h-auto mx-auto"
        sizes="100vw"
      />

      {/* Categories */}
      <div className="px-4 sm:px-6 lg:px-24 py-8">
        <h2 className="text-[#891F1A] text-2xl sm:text-3xl font-bold text-center mb-6">
          Discover our categories
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {categories.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-full aspect-[4/3] rounded-lg bg-gray-100 animate-pulse" />
                  <div className="mt-2 h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              ))
            : categories.map((c) => (
                <CategoryCard key={c.id} category={c} apiBase={API_BASE_URL} />
              ))}
        </div>
      </div>

      <Image
        src="/images/Banner2.jpg"
        alt="Banner Image"
        width={1920}
        height={250}
        className="block bg-[#D9D9D9] w-full h-auto"
        sizes="100vw"
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
          {contactItems.map((it, idx) => (
            <ContactItem
              key={idx}
              icon={it.icon}
              title={it.title}
              value={it.value}
              href={it.href}
              color={it.color}
            />
          ))}
        </div>
      </section>

      <Footer />
      <ChatBot />
    </div>
  );
}
