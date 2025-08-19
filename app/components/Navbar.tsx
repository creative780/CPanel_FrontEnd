"use client";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../utils/api";

const getDropdownItemColorClass = (color: string) => {
  switch (color) {
    case "red":
      return "text-red-600";
    default:
      return "text-gray-800";
  }
};

/** 🔐 Inject X-Frontend-Key on every request */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const fetchWithKey = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return fetch(url, { ...init, headers });
};

export default function Navbar() {
  const [navItemsData, setNavItemsData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [hoveredSubcategory, setHoveredSubcategory] = useState<string | null>(null);
  const [isDropdownHovered, setIsDropdownHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetchWithKey(`${API_BASE_URL}/api/show_nav_items/?_=${Date.now()}`);
        const nav = await res.json();
        setProductData(nav);

        const navFormatted = nav.map((cat: any) => ({
          id: cat.id,
          label: cat.name,
          url: `/home/${cat.url}`,
          dropdownContent: {
            title: cat.name,
            columns:
              cat.subcategories?.map((sub: any) => ({
                label: sub.name,
                url: `/home/${cat.url}/${sub.url}`,
                color: "red",
              })) || [],
          },
        }));

        setNavItemsData(navFormatted);
      } catch (err) {
        console.error("❌ Failed to fetch nav items:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleNavEnter = (idx: number) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setOpenIndex(idx);
    setDropdownVisible(true);
  };

  const handleNavLeave = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      if (!isDropdownHovered) {
        setDropdownVisible(false);
        setHoveredSubcategory(null);
        setTimeout(() => setOpenIndex(null), 300);
      }
    }, 300);
  };

  const handleDropdownEnter = () => {
    setIsDropdownHovered(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };

  const handleDropdownLeave = () => {
    setIsDropdownHovered(false);
    closeTimeoutRef.current = setTimeout(() => {
      setDropdownVisible(false);
      setHoveredSubcategory(null);
      setTimeout(() => setOpenIndex(null), 300);
    }, 300);
  };

  const getImageGrid = (categoryName: string, subcategoryName: string | null) => {
    const category = productData.find((c: any) => c.name === categoryName);
    if (!category) return [];

    if (subcategoryName) {
      const subcategory = category.subcategories?.find((s: any) => s.name === subcategoryName);
      if (!subcategory) return [];

      const productImages = subcategory.products?.flatMap((p: any) => p.images || []) || [];
      return productImages.slice(0, 16);
    }

    return category.subcategories?.flatMap((s: any) => s.images || []).slice(0, 16) || [];
  };

  if (loading || !navItemsData.length) return null;

  return (
    <nav className="w-full bg-white border-b border-gray-200 m-0">
      {/* Mobile Toggle */}
      <div className="flex py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1 rounded-md text-gray-700 hover:bg-gray-100"
          aria-label="Toggle navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation Links */}
      <div className={`${mobileOpen ? "flex flex-col py-2 space-y-1" : "hidden"} md:flex md:justify-center`}>
        <div className="flex flex-wrap flex-col md:flex-row gap-[clamp(0.25rem,0.5vw,0.75rem)]">
          {navItemsData.map((item, idx) => (
            <div
              key={item.id || idx}
              className="relative"
              onMouseEnter={() => handleNavEnter(idx)}
              onMouseLeave={handleNavLeave}
            >
              <Link
                href={item.url || "#"}
                className={`block text-center whitespace-nowrap overflow-ellipsis max-w-[20vw] md:max-w-none transition-colors ${
                  openIndex === idx ? "text-red-600" : "text-gray-800 hover:text-red-600"
                }`}
                style={{
                  fontSize: "clamp(0.6rem, 1.25vw, 0.875rem)",
                  padding: "clamp(0.2rem, 0.5vw, 0.5rem) clamp(0.4rem, 0.75vw, 1rem)",
                }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Dropdown Content */}
      {openIndex !== null && navItemsData[openIndex]?.dropdownContent && (
        <div
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
          className={`fixed left-1/2 top-[200px] -translate-x-1/2 z-50 w-full max-w-[1400px] px-2 transition-all duration-300 ease-out ${
            dropdownVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <div className="bg-white/70 backdrop-blur-md border-2 rounded-xl shadow-xl flex flex-col md:flex-row p-4 md:p-8 space-y-4 md:space-y-0 md:space-x-0 min-h-[320px]">
            {/* Left Column */}
            <div className="w-full md:w-auto md:min-w-[140px] border-b md:border-b-0 md:border-r-2 border-gray-500 border-opacity-10 pr-4 mr-3">
              <h3 className="text-base font-bold mb-2 text-black">
                {navItemsData[openIndex].dropdownContent.title}
              </h3>
              <div className="flex flex-col gap-1">
                {navItemsData[openIndex].dropdownContent.columns?.map((col: any, colIdx: number) => (
                  <Link
                    key={colIdx}
                    href={col.url || "#"}
                    className={`${getDropdownItemColorClass(col.color || "black")} text-sm py-1 hover:underline`}
                    onMouseEnter={() => setHoveredSubcategory(col.label)}
                    onMouseLeave={() => setHoveredSubcategory(null)}
                    onClick={() => setMobileOpen(false)}
                  >
                    {col.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="w-full md:w-[86%] pl-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {getImageGrid(
                navItemsData[openIndex].dropdownContent.title,
                hoveredSubcategory
              ).map((img: any, i: number) => (
                <div
                  key={i}
                  className="w-[120px] h-[120px] rounded-md overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={img.url}
                    alt={img.alt_text || "Image"}
                    loading="lazy"
                    className="object-cover w-full h-full rounded-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "https://i.ibb.co/ynT1dLc/image-not-found.png";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
