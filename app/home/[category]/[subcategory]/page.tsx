"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

import Header from "../../../components/header";
import LogoSection from "../../../components/LogoSection";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import MobileTopBar from "../../../components/HomePageTop";
import { API_BASE_URL } from "../../../utils/api";
import { ChatBot } from "../../../components/ChatBot";

/** 🔐 Inject X-Frontend-Key on every request */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const fetchWithKey = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return fetch(url, { ...init, headers });
};

/**
 * Types
 */
type Product = {
  id: string;
  name: string;
  image: string;
  badge: string;
  rating: number;
};

const StarRating = ({ rating }: { rating: number }) => (
  <div
    className="text-sm mt-1 font-normal"
    aria-label={`Rating: ${rating} out of 5 stars`}
  >
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className={i < rating ? "text-yellow-400" : "text-gray-300"}
      >
        ★
      </span>
    ))}
  </div>
);

export default function SubCategoryPage() {
  const BATCH_SIZE = 100;

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const { category, subcategory } = useParams() as {
    category?: string;
    subcategory?: string;
  };

  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.innerWidth > 768) {
      AOS.init({ duration: 800, once: true });
    }

    const loadProducts = async () => {
      if (!category || !subcategory) {
        setNotFound(true);
        return;
      }

      setLoading(true);

      try {
        const [navRes, stockRes] = await Promise.all([
          fetchWithKey(`${API_BASE_URL}/api/show_nav_items/`, { cache: "no-store" }),
          fetchWithKey(`${API_BASE_URL}/api/show-product/`, { cache: "no-store" }),
        ]);

        if (!navRes.ok || !stockRes.ok) throw new Error("Failed to fetch data");

        const [navData, stockData] = await Promise.all([navRes.json(), stockRes.json()]);

        const matchedCategory = navData.find((cat: any) => cat.url === category);
        const matchedSubcat = matchedCategory?.subcategories?.find(
          (sub: any) => sub.url === subcategory
        );

        if (!matchedSubcat || !matchedSubcat.products?.length) {
          setNotFound(true);
          return;
        }

        const formatted: Product[] = matchedSubcat.products.map((prod: any) => {
          const stockMatch = stockData.find((p: any) => p.id === prod.id);
          return {
            id: prod.id,
            name: prod.name,
            image: prod.images?.[0]?.url || "/images/img1.jpg",
            badge: stockMatch?.stock_status?.trim() || "Unknown",
            rating: 0,
          };
        });

        setAllProducts(formatted);
        setProducts(formatted.slice(0, BATCH_SIZE));
        setVisibleCount(BATCH_SIZE);
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to fetch nav or stock items", err);
        setNotFound(true);
        setLoading(false);
      }
    };

    loadProducts();
  }, [category, subcategory]);

  const goToProductsPage = () => {
    if (category && subcategory) {
      router.push(`/home/${category}/${subcategory}/products`);
    }
  };

  if (loading) {
    return (
      <div
        className="p-10 text-center text-gray-500 text-xl font-normal"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Loading products...
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="p-10 text-center text-red-600 text-xl font-normal"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        Subcategory not found. Please check the URL.
      </div>
    );
  }

  const loadMoreProducts = () => {
    const nextCount = visibleCount + BATCH_SIZE;
    const nextBatch = allProducts.slice(0, nextCount);
    setProducts(nextBatch);
    setVisibleCount(nextCount);
  };

  return (
    <div
      className="flex flex-col bg-white"
      style={{ fontFamily: "var(--font-poppins), Arial, sans-serif" }}
    >
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      <div className="bg-gradient-to-b from-white via-gray-50 to-gray-100 min-h-screen py-10 px-4 sm:px-10">
        <div
          className="bg-gradient-to-r from-red-100 via-white to-red-50 rounded-xl shadow-md p-6 sm:p-10 mb-10 text-center relative overflow-hidden"
          data-aos="zoom-in"
        >
          {/* h1 → SemiBold */}
          <h1 className="text-4xl font-semibold text-red-600 tracking-tight mb-2 capitalize">
            {subcategory?.replace(/-/g, " ")}
          </h1>
          {/* p → Regular */}
          <p className="text-gray-600 text-lg font-normal">
            Browse popular products in this subcategory.
          </p>
          <div className="absolute bottom-0 left-1/2 w-1/2 h-1 bg-red-500 translate-x-[-50%] animate-pulse" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-transform transform hover:-translate-y-1 duration-300 cursor-pointer"
              data-aos="fade-up"
              data-aos-delay={index * 100}
              onClick={() =>
                router.push(
                  `/home/${encodeURIComponent(category!)}/${encodeURIComponent(
                    subcategory!
                  )}/products/${product.id}`
                )
              }
            >
              {/* badge → span regular */}
              <span
                className={`absolute top-2 left-2 text-white text-xs px-3 py-1 rounded-full z-30 font-normal ${
                  product.badge.toLowerCase().includes("out")
                    ? "bg-black text-white"
                    : "bg-red-600"
                }`}
              >
                {product.badge}
              </span>

              <div className="relative group">
                <img
                  src={product.image}
                  alt={product.name}
                  width={400}
                  height={224}
                  loading="lazy"
                  className="w-full h-56 object-cover rounded-t-2xl transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/img1.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20 rounded-t-2xl">
                  <div className="text-white text-center transform translate-y-6 group-hover:translate-y-0 transition-transform duration-500">
                    {/* h2 → SemiBold */}
                    <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
                    {/* p → Regular */}
                    <p className="text-xs font-normal">Preview – click to view all</p>
                  </div>
                </div>
              </div>

              <div className="p-4 text-center bg-white">
                {/* h2 → SemiBold */}
                <h2 className="text-lg font-semibold text-gray-800">{product.name}</h2>
                <StarRating rating={product.rating} />
                {/* button → Medium */}
                <button className="mt-3 bg-red-500 text-white px-4 py-2 rounded-full text-sm shadow hover:bg-red-600 transition-all duration-300 font-medium">
                  Expand
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center mt-10">
          {visibleCount < allProducts.length && (
            <button
              onClick={loadMoreProducts}
              className="bg-[#7f1d1d] text-white px-6 py-3 rounded-full font-medium hover:bg-red-700 transition"
            >
              Load More Products
            </button>
          )}
        </div>
      </div>

      <Footer />
      <ChatBot />
    </div>
  );
}
