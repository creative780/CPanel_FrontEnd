"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Truck,
  Calendar,
} from "lucide-react";
import Head from "next/head";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import { API_BASE_URL } from "../../../utils/api";
import Header from "../../../components/header";
import Navbar from "../../../components/Navbar";
import LogoSection from "../../../components/LogoSection";
import MobileTopBar from "../../../components/HomePageTop";
import CardActionButtons from "../../../components/CardActionButtons";
import { ChatBot } from "../../../components/ChatBot";
import Footer from "../../../components/Footer";



/* ──────────────────────────────────────────────────────────────────────────
   🔐 Frontend key helper (adds X-Frontend-Key to requests)
   Mirrors your ProductDetailPage style
   ────────────────────────────────────────────────────────────────────────── */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

/* ──────────────────────────────────────────────────────────────────────────
   🆔 Stable device token (same key as ProductDetailPage)
   ────────────────────────────────────────────────────────────────────────── */
function getOrCreateUserToken() {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("cart_user_id");
  if (!token) {
    token = crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    localStorage.setItem("cart_user_id", token);
  }
  return token;
}

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */
type ProductCard = {
  id: string;
  name: string;
  image: string;
  badge: string; // stock_status
  rating: number; // optional UI
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="text-sm mt-1 font-normal" aria-label={`Rating: ${rating} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < rating ? "text-yellow-400" : "text-gray-300"}>★</span>
    ))}
  </div>
);

export default function SubCategoryPage() {
  const BATCH_SIZE = 100;

  const { category, subcategory } = useParams() as { category?: string; subcategory?: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [allProducts, setAllProducts] = useState<ProductCard[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);

  // ❤️/🛒 UI state with local persistence
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());

  const LS_FAVORITES = useMemo(() => "cc_favorites", []);
  const LS_CART = useMemo(() => "cc_cart", []);

  /* ──────────────────────────────────────────────────────────────────────
     Load persisted favourites/cart
     ────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem(LS_FAVORITES);
      const cartRaw = localStorage.getItem(LS_CART);
      if (favRaw) setFavoriteIds(new Set(JSON.parse(favRaw)));
      if (cartRaw) setCartIds(new Set(JSON.parse(cartRaw)));
    } catch {
      // ignore
    }
  }, [LS_FAVORITES, LS_CART]);

  const persistFavorites = useCallback((s: Set<string>) => {
    localStorage.setItem(LS_FAVORITES, JSON.stringify(Array.from(s)));
  }, [LS_FAVORITES]);

  const persistCart = useCallback((s: Set<string>) => {
    localStorage.setItem(LS_CART, JSON.stringify(Array.from(s)));
  }, [LS_CART]);

  /* ──────────────────────────────────────────────────────────────────────
     Data fetch (mirrors your “fetch all data like this” structure)
     - show_nav_items: to locate current subcategory & its products
     - show-product: to enrich with stock/price/details
     ────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const fetchData = async () => {
      if (!category || !subcategory) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [navRes, stockRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show_nav_items/`, withFrontendKey({ cache: "no-store" })),
          fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey({ cache: "no-store" })),
        ]);

        if (!navRes.ok || !stockRes.ok) throw new Error("Failed to fetch data");

        const [navData, stockData] = await Promise.all([navRes.json(), stockRes.json()]);

        // Find the current category/subcategory entries
        const matchedCategory = Array.isArray(navData)
          ? navData.find((cat: any) => cat?.url === category)
          : null;

        const matchedSubcat = matchedCategory?.subcategories?.find(
          (sub: any) => sub?.url === subcategory
        );

        if (!matchedSubcat || !matchedSubcat.products?.length) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Build product cards, enriching with stock/status from show-product payload
        const formatted: ProductCard[] = matchedSubcat.products.map((prod: any) => {
          const stockMatch = Array.isArray(stockData)
            ? stockData.find((p: any) => `${p.id}` === `${prod.id}`)
            : undefined;

        const image =
            prod.images?.[0]?.url ||
            prod.image?.url ||
            stockMatch?.image ||
            "/images/img1.jpg";

          const badge = `${stockMatch?.stock_status || ""}`.trim() || "Unknown";

          return {
            id: String(prod.id),
            name: prod.name ?? "Unnamed Product",
            image,
            badge,
            rating: Number(prod.rating ?? 0),
          };
        });

        setAllProducts(formatted);
        setProducts(formatted.slice(0, BATCH_SIZE));
        setVisibleCount(BATCH_SIZE);
        setNotFound(false);
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to fetch subcategory products:", err);
        setNotFound(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [category, subcategory]);

  /* ──────────────────────────────────────────────────────────────────────
     Cart API (same contract as Product Detail page)
     - Add: /api/save-cart/
     - Remove: /api/delete-cart-item/
     ────────────────────────────────────────────────────────────────────── */
  const addToCart = useCallback(
    async (
      productId: string,
      selectedSize: string | null = null,
      selectedAttrOptions: Record<string, string> | null = null
    ) => {
      const deviceUUID = getOrCreateUserToken();
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/save-cart/`,
          withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              device_uuid: deviceUUID,
              product_id: productId,
              quantity: 1,
              selected_size: selectedSize,
              selected_attributes: selectedAttrOptions, // grid passes null for now
            }),
          })
        );

        const data = await res.json();

        Toastify({
          text: res.ok ? "✔️ Added to cart!" : `❌ ${data?.error || "Try again!"}`,
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: res.ok
            ? "linear-gradient(to right, #af4c4cff, #d30000ff)"
            : "linear-gradient(to right, #b00020, #ff5a5a)",
        }).showToast();

        if (res.ok) {
          setCartIds((prev) => {
            const next = new Set(prev);
            next.add(productId);
            persistCart(next);
            return next;
          });
        }
      } catch (error) {
        console.error("Cart error:", error);
        Toastify({
          text: "❌ Network error",
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "linear-gradient(to right, #b00020, #ff5a5a)",
        }).showToast();
      }
    },
    [persistCart]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      const userId = getOrCreateUserToken(); // backend expects `user_id`
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/delete-cart-item/`,
          withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, product_id: productId }),
          })
        );

        const data = await res.json();

        if (res.ok) {
          setCartIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            persistCart(next);
            return next;
          });

          Toastify({
            text: "🗑️ Removed from cart",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "linear-gradient(to right, #af4c4cff, #d30000ff)",
          }).showToast();
        } else {
          Toastify({
            text: `❌ ${data?.error || "Try again!"}`,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "linear-gradient(to right, #b00020, #ff5a5a)",
          }).showToast();
        }
      } catch (error) {
        console.error("Cart error:", error);
        Toastify({
          text: "❌ Network error",
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "linear-gradient(to right, #b00020, #ff5a5a)",
        }).showToast();
      }
    },
    [persistCart]
  );

  const handleCartToggle = useCallback(
    (product: ProductCard) => async (e?: React.MouseEvent) => {
      e?.stopPropagation?.();
      // @ts-ignore
      e?.nativeEvent?.stopImmediatePropagation?.();

      const isOut =
        product.badge?.toString().trim().toLowerCase().includes("out") ||
        product.badge?.toString().trim().toLowerCase() === "out of stock";

      if (!cartIds.has(product.id) && isOut) {
        Toastify({
          text: "❌ Out of Stock",
          duration: 2500,
          gravity: "top",
          position: "right",
          backgroundColor: "linear-gradient(to right, #b00020, #ff5a5a)",
        }).showToast();
        return;
      }

      if (cartIds.has(product.id)) {
        await removeFromCart(product.id);
      } else {
        await addToCart(product.id, null, null);
      }
    },
    [cartIds, addToCart, removeFromCart]
  );

  /* ──────────────────────────────────────────────────────────────────────
     FAVOURITES: DEDUP TOAST + CLICK GUARD (per-product, ~400ms window)
     Root cause tends to be both an inner icon and its wrapper firing.
     This ensures a single state change + a single toast per click burst.
     ────────────────────────────────────────────────────────────────────── */
  const favInvokeAt = useRef<Record<string, number>>({});
  const toastStamp = useRef<Record<string, number>>({});

  const toastOnce = useCallback((key: string, text: string, ok: boolean) => {
    const now = Date.now();
    if (toastStamp.current[key] && now - toastStamp.current[key] < 400) return;
    toastStamp.current[key] = now;

    Toastify({
      text,
      duration: 2500,
      gravity: "top",
      position: "right",
      backgroundColor: ok
        ? "linear-gradient(to right, #af4c4cff, #d30000ff)"
        : "linear-gradient(to right, #b00020, #ff5a5a)",
    }).showToast();
  }, []);

  const handleToggleFavorite = useCallback(
    (id: string) => (e?: React.MouseEvent) => {
      e?.stopPropagation?.();
      // @ts-ignore
      e?.nativeEvent?.stopImmediatePropagation?.();

      const now = Date.now();
      if (favInvokeAt.current[id] && now - favInvokeAt.current[id] < 400) {
        // swallow duplicate rapid invocations
        return;
      }
      favInvokeAt.current[id] = now;

      // Functional update so we can compute isAdding from prev (no stale closure)
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        const isAdding = !prev.has(id);

        if (isAdding) next.add(id);
        else next.delete(id);

        // Single toast per burst
        toastOnce(
          `fav:${id}`,
          isAdding ? "✔️ Added to favourites" : "🗑️ Removed from favourites",
          isAdding
        );

        persistFavorites(next);
        return next;
      });
    },
    [persistFavorites, toastOnce]
  );

  /* ──────────────────────────────────────────────────────────────────────
     UI helpers
     ────────────────────────────────────────────────────────────────────── */
  const loadMoreProducts = () => {
    const nextCount = visibleCount + BATCH_SIZE;
    setProducts(allProducts.slice(0, nextCount));
    setVisibleCount(nextCount);
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

  return (
    <div className="flex flex-col bg-white" style={{ fontFamily: "var(--font-poppins), Arial, sans-serif" }}>
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      <div className="bg-gradient-to-b from-white via-gray-50 to-gray-100 min-h-screen py-10 px-4 sm:px-10">
        <div
          className="bg-gradient-to-r from-red-100 via-white to-red-50 rounded-xl shadow-md p-6 sm:p-10 mb-10 text-center relative overflow-hidden"
        >
          <h1 className="text-4xl font-extrabold text-red-600 tracking-tight mb-2 capitalize">
            {subcategory?.toString().replace(/-/g, " ")}
          </h1>
          <p className="text-gray-600 text-lg">Browse popular products in this subcategory.</p>
          <div className="absolute bottom-0 left-1/2 w-1/2 h-1 bg-red-500 translate-x-[-50%] animate-pulse" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="group relative rounded-2xl overflow-hidden transition-transform"
              tabIndex={0}
            >
              {/* Stock badge */}
              <span
                className={`absolute top-2 left-2 text-white text-xs px-3 py-1 rounded-full z-20 ${
                  product.badge?.toLowerCase().includes("out") ? "bg-black text-white" : "bg-red-600"
                }`}
              >
                {product.badge}
              </span>

              {/* Action buttons (top-right) */}
              <CardActionButtons
                isFavorite={favoriteIds.has(product.id)}
                isInCart={cartIds.has(product.id)}
                onToggleFavorite={handleToggleFavorite(product.id)}
                onAddToCart={handleCartToggle(product)}
              />

              {/* Image wrapper: keeps layout fixed; image zooms inside */}
              <div className="relative w-full aspect-square overflow-hidden rounded-xl">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/img1.png";
                  }}
                  onClick={() =>
                    router.push(
                      `/home/${encodeURIComponent(category!)}/${encodeURIComponent(subcategory!)}/products/${product.id}`
                    )
                  }
                />
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mt-5">{product.name}</h2>
              <StarRating rating={product.rating} />
            </div>
          ))}
        </div>

        {/* Load more */}
        <div className="flex justify-center mt-10">
          {visibleCount < allProducts.length && (
            <button
              onClick={loadMoreProducts}
              className="bg-[#7f1d1d] text-white px-6 py-3 rounded-full font-semibold hover:bg-red-700 transition"
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
