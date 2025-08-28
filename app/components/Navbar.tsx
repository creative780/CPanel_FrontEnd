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
  const [isDropdownHovered, setIsDropdownHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // NEW: which subcategory is currently hovered in the left rail
  const [hoveredSubForProducts, setHoveredSubForProducts] = useState<string | null>(null);

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

  // 🔒 Disable background scroll while dropdown is visible
  useEffect(() => {
    if (dropdownVisible) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [dropdownVisible]);

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
        setHoveredSubForProducts(null);
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
      setHoveredSubForProducts(null);
      setTimeout(() => setOpenIndex(null), 300);
    }, 300);
  };

  // Helpers
  const getCategoryByTitle = (title: string) =>
    productData.find((c: any) => c.name === title);

  const buildProductHref = (category: any, sub: any, product: any) => {
    if (product?.url) {
      return product.url.startsWith("/home")
        ? product.url
        : `/home/${category.url}/${sub.url}/products/${product.url}`;
    }
    return `/home/${category.url}/${sub.url}/products/${product?.id}`;
  };

  if (loading || !navItemsData.length) return null;

  return (
    <div style={{ fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif" }}>
      <nav
        className="w-full bg-white border-b border-gray-200 m-0 min-h-[68px] md:min-h-[80px] flex items-center font-medium"
        aria-label="Primary"
        role="navigation"
      >
        {/* Navigation Links */}
        <div className={`${mobileOpen ? "flex flex-col py-2 space-y-1" : "hidden"} md:flex md:justify-center w-full`}>
          <div className="flex flex-wrap flex-col md:flex-row gap-[clamp(0.35rem,0.6vw,1rem)] py-2 md:py-3">
            {navItemsData.map((item, idx) => (
              <div
                key={item.id || idx}
                className="relative"
                onMouseEnter={() => handleNavEnter(idx)}
                onMouseLeave={handleNavLeave}
              >
                {/* a/nav items → Medium (500) */}
                <Link
                  href={item.url || "#"}
                  className={`block text-center whitespace-nowrap overflow-ellipsis max-w-[20vw] md:max-w-none transition-colors ${
                    openIndex === idx ? "text-red-600" : "text-gray-800 hover:text-red-600"
                  } font-medium`}
                  style={{
                    fontSize: "clamp(0.7rem, 1.1vw, 0.95rem)",
                    padding: "clamp(0.4rem, 0.7vw, 0.75rem) clamp(0.6rem, 0.9vw, 1rem)",
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
          <section
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleDropdownLeave}
            className={`fixed top-[200px] left-0 right-0 z-50 w-[97%] mx-auto px-2 transition-all duration-300 ease-out ${
              dropdownVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            }`}
            aria-label="Category mega menu"
          >
            <div className="bg-white/70 backdrop-blur-md border-2 rounded-xl shadow-xl flex flex-col md:flex-row p-4 md:p-8 space-y-4 md:space-y-0 md:space-x-0 min-h-[340px]">
              {/* Left Column */}
              <aside
                className="w-full md:w-auto md:min-w-[180px] border-b md:border-b-0 md:border-r-2 border-gray-500 border-opacity-10 pr-4 mr-3"
                onMouseLeave={() => setHoveredSubForProducts(null)}
                aria-label="Subcategories"
              >
                {/* h2 → Semi Bold (600) */}
                <h2 className="text-base font-semibold mb-2 text-black">
                  {navItemsData[openIndex].dropdownContent.title}
                </h2>
                <ul className="flex flex-col gap-1">
                  {navItemsData[openIndex].dropdownContent.columns?.map((col: any, colIdx: number) => (
                    <li key={colIdx}>
                      {/* nav item link → Medium (500) */}
                      <Link
                        href={col.url || "#"}
                        className={`${getDropdownItemColorClass(col.color || "black")} text-sm py-1 hover:underline font-medium`}
                        onMouseEnter={() => setHoveredSubForProducts(col.label)}
                        onClick={() => setMobileOpen(false)}
                      >
                        {col.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Right Column */}
              <div className="w-full md:w-[86%] pl-3">
                {(() => {
                  const catTitle = navItemsData[openIndex].dropdownContent.title;
                  const category = getCategoryByTitle(catTitle);
                  const subs = category?.subcategories || [];

                  if (hoveredSubForProducts) {
                    const sub = subs.find((s: any) => s.name === hoveredSubForProducts);
                    const products: any[] = sub?.products || [];
                    const first16 = products.slice(0, 16);

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2" role="list">
                        {first16.map((prod: any, i: number) => {
                          const img = prod?.images?.[0];
                          const imgUrl = img?.url || "https://i.ibb.co/ynT1dLc/image-not-found.png";
                          const imgAlt = img?.alt_text || prod?.name || "Product";
                          const href = buildProductHref(category, sub, prod);

                          return (
                            <Link
                              key={i}
                              href={href || "#"}
                              className="w-[120px] mx-auto"
                              onClick={() => setMobileOpen(false)}
                            >
                              <figure className="w-[120px] h-[120px] rounded-md overflow-hidden flex items-center justify-center">
                                <img
                                  src={imgUrl}
                                  alt={imgAlt}
                                  loading="lazy"
                                  className="object-cover w-full h-full rounded-md"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    target.src = "https://i.ibb.co/ynT1dLc/image-not-found.png";
                                  }}
                                />
                              </figure>
                              <div className="mt-1 text-center">
                                {/* product name → Regular (400) */}
                                <p className="text-xs font-normal text-gray-900 line-clamp-2">
                                  {prod?.name}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2" role="list">
                      {subs.map((sub: any, i: number) => {
                        const subImage = sub?.images?.[0];
                        const imgUrl = subImage?.url || "https://i.ibb.co/ynT1dLc/image-not-found.png";
                        const imgAlt = subImage?.alt_text || sub?.name || "Image";
                        const subHref = `/home/${category?.url}/${sub?.url}`;

                        return (
                          <Link
                            key={i}
                            href={subHref || "#"}
                            className="w-[120px] mx-auto"
                            onClick={() => setMobileOpen(false)}
                          >
                            <figure className="w-[120px] h-[120px] rounded-md overflow-hidden flex items-center justify-center">
                              <img
                                src={imgUrl}
                                alt={imgAlt}
                                loading="lazy"
                                className="object-cover w-full h-full rounded-md"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = "https://i.ibb.co/ynT1dLc/image-not-found.png";
                                }}
                              />
                            </figure>
                            <div className="mt-1 text-center">
                              {/* subcategory label → Medium (500) */}
                              <span className="text-xs font-medium text-gray-900">{sub?.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>
        )}
      </nav>
    </div>
  );
}
