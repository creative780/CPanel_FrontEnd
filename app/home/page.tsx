"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  Suspense,
  memo,
} from "react";
import "toastify-js/src/toastify.css";
import dynamic from "next/dynamic";
import Head from "next/head";
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

/* ----------------------------- frontend key ----------------------------- */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (FRONTEND_KEY) headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

/* --------------------------- dynamic imports ---------------------------- */
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
const ChatBot = dynamic(
  () => import("../components/ChatBot").then((m) => m.ChatBot),
  { ssr: false, loading: () => null }
);
const Footer = dynamic(() => import("../components/Footer"), {
  ssr: false,
  loading: () => <div className="h-24 w-full bg-gray-100 animate-pulse" />,
});

/* -------------------------------- types -------------------------------- */
type Category = {
  id: number | string;
  name: string;
  image?: string;
  status?: "visible" | "hidden";
};

const FALLBACK_IMG =
  "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ymeg8jht_expires_30_days.png";

/* ------------------------------- helpers -------------------------------- */
const safeJoin = (base: string, path?: string) => {
  if (!path) return "";
  if (!base || /^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};
const toKebab = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");

/* --------------------------- intersection utils ------------------------- */
// Single hook factory so we don't spin up extra observers unnecessarily.
function useInView(rootMargin = "200px 0px", threshold = 0.01) {
  const ref = useRef<Element | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [rootMargin, threshold]);
  return { ref, inView } as const;
}

/* ------------------------------ slider hook ----------------------------- */
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

/* ---------------------------- memoized items ---------------------------- */
const ContactItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  href: string;
  color: string;
}> = memo(({ icon, title, value, href, color }) => (
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

const CategoryCard: React.FC<{ category: Category; apiBase: string }> = memo(
  ({ category, apiBase }) => {
    const href = `/home/${toKebab(category.name)}`;
    const imgSrc = safeJoin(apiBase, category.image) || "/images/img1.jpg";
    return (
      <Link href={href} passHref prefetch={false}>
        <div className="flex flex-col items-center cursor-pointer sm:hover:scale-105 sm:transition-transform sm:duration-300">
          <Image
            src={imgSrc}
            alt={category.name}
            width={640}
            height={480}
            className="w-full h-auto object-cover rounded-lg"
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 320px"
            decoding="async"
          />
          <h3 className="mt-2 text-md font-semibold text-[#333] text-center">
            {category.name}
          </h3>
        </div>
      </Link>
    );
  }
);

/* --------------------------- static contact data ------------------------ */
const CONTACT_ITEMS = [
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
] as const;

/* --------------------------------- page -------------------------------- */
export default function PrintingServicePage() {
  const [desktopImages, setDesktopImages] = useState<string[]>([FALLBACK_IMG]);
  const [mobileImages, setMobileImages] = useState<string[]>([FALLBACK_IMG]);
  const [categories, setCategories] = useState<Category[]>([]);

  // media query: heavy stuff only on ≥sm
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(q.matches);
    apply();
    q.addEventListener?.("change", apply);
    return () => q.removeEventListener?.("change", apply);
  }, []);

  // hero refs + sliders
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

  // in-view sentinels (reuse single hook pattern)
  const firstCarouselSentinel = useInView();
  const secondCarouselSentinel = useInView();
  const reviewsSentinel = useInView();
  const chatBotSentinel = useInView();

  // idle flags (mount only when the main thread is free)
  const [idleReady, setIdleReady] = useState(false);
  useEffect(() => {
    const cb = () => setIdleReady(true);
    // @ts-ignore
    (window.requestIdleCallback || window.setTimeout)(cb, { timeout: 2200 });
  }, []);

  /* ----------------------------- fetch hero ---------------------------- */
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
        setDesktopIndex(0);
        setMobileIndex(0);
      }
    })();
    return () => ac.abort();
  }, [setDesktopIndex, setMobileIndex]);

  /* --------------------------- fetch categories ------------------------- */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/show-categories/`, {
          ...withFrontendKey(),
          signal: ac.signal,
          cache: "force-cache", // better for phones
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: Category[] = await res.json();
        setCategories(
          (Array.isArray(data) ? data : []).filter(
            (c) => c?.status === "visible"
          )
        );
      } catch {
        /* silent */
      }
    })();
    return () => ac.abort();
  }, []);

  /* ------------------------------ toast/form ---------------------------- */
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

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="flex flex-col bg-white">
      {/* network hints (cheaper TTFB for API/images on mobile) */}
      <Head>
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
      </Head>

      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      {/* Hero Images (desktop) */}
      <div ref={desktopHeroRef as any}>
        <Image
          src={desktopImages[desktopIndex] || FALLBACK_IMG}
          alt="Hero Desktop"
          width={1440}
          height={400}
          className="hidden sm:block w-full h-auto mx-auto"
          priority={false}
          sizes="100vw"
          decoding="async"
        />
      </div>

      {/* Hero Images (mobile) */}
      <div ref={mobileHeroRef as any}>
        <Image
          src={mobileImages[mobileIndex] || FALLBACK_IMG}
          alt="Hero Mobile"
          width={768}
          height={300}
          className="block sm:hidden w-full h-auto object-cover mx-auto"
          sizes="100vw"
          priority
          // @ts-ignore — next/image supports this prop in modern versions
          fetchPriority="high"
        />
      </div>

      {/* First Carousel - lazy mount when visible */}
      <div
        ref={firstCarouselSentinel.ref as any}
        style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
      >
        <Suspense
          fallback={
            <div className="h-[220px] sm:h-[280px] w-full animate-pulse bg-gray-100" />
          }
        >
          {firstCarouselSentinel.inView ? (
            <Carousel />
          ) : (
            <div className="h-[220px] sm:h-[280px] w-full bg-gray-100" />
          )}
        </Suspense>
      </div>

      <Image
        src="/images/Banner3.jpg"
        alt="Banner Image"
        width={1920}
        height={250}
        className="block bg-[#D9D9D9] w-full h-auto mx-auto"
        sizes="100vw"
        loading="lazy"
        decoding="async"
      />

      {/* Categories */}
      <section
        className="px-3 sm:px-6 lg:px-24 py-6 sm:py-8"
        style={{ contentVisibility: "auto", containIntrinsicSize: "800px" }}
      >
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
      </section>

      <Image
        src="/images/Banner2.jpg"
        alt="Banner Image"
        width={1920}
        height={250}
        className="block bg-[#D9D9D9] w-full h-auto"
        sizes="100vw"
        loading="lazy"
        decoding="async"
      />

      {/* Second Carousel (desktop only, in view, and after idle) */}
      <div
        ref={secondCarouselSentinel.ref as any}
        style={{ contentVisibility: "auto", containIntrinsicSize: "260px" }}
      >
        <Suspense
          fallback={
            <div className="h-[200px] sm:h-[260px] w-full animate-pulse bg-gray-100" />
          }
        >
          {isDesktop && idleReady && secondCarouselSentinel.inView ? (
            <SecondCarousel />
          ) : (
            <div className="h-[200px] sm:h-[260px] w-full bg-gray-100" />
          )}
        </Suspense>
      </div>

      {/* Reviews (desktop only, in view, and after idle) */}
      <div
        ref={reviewsSentinel.ref as any}
        style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }}
      >
        <Suspense
          fallback={
            <div className="h-[320px] w-full animate-pulse bg-gray-100" />
          }
        >
          {isDesktop && idleReady && reviewsSentinel.inView ? (
            <Reviews />
          ) : (
            <div className="h-[320px] w-full bg-gray-100" />
          )}
        </Suspense>
      </div>

      {/* CTA */}
      <section
        className="flex flex-col lg:flex-row gap-8 items-center px-3 sm:px-6 lg:px-24 py-10 sm:py-12 bg-white"
        style={{ contentVisibility: "auto", containIntrinsicSize: "700px" }}
      >
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
            className="mt-8 space-y-5 max-w-md"
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

            <div>
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

        {/* gray brick hidden on mobile */}
        <div className="hidden lg:block w-[500px] h-[600px] bg-[#8B8491] rounded-xl" />
      </section>

      <div className="w-full bg-white h-[72px]" />

      {/* Contact Info */}
      <section
        className="bg-[#FAFAFA] px-3 sm:px-6 lg:px-24 py-6"
        style={{ contentVisibility: "auto", containIntrinsicSize: "300px" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CONTACT_ITEMS.map((it, idx) => (
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

      {/* Footer waits for idle to avoid competing with LCP on phones */}
      {idleReady ? <Footer /> : <div className="h-24 w-full bg-gray-100" />}

      {/* Chatbot: desktop only, in view, and idle */}
      <div ref={chatBotSentinel.ref as any}>
        {isDesktop && idleReady && chatBotSentinel.inView && <ChatBot />}
      </div>
    </div>
  );
}
