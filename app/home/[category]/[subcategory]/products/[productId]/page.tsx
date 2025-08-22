"use client";

import React, { useEffect, useState } from "react";
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

import Header from "../../../../../components/header";
import LogoSection from "../../../../../components/LogoSection";
import Footer from "../../../../../components/Footer";
import MobileTopBar from "../../../../../components/HomePageTop";
import { API_BASE_URL } from "../../../../../utils/api";
import { ChatBot } from "../../../../../components/ChatBot";

// 🔐 Frontend key helper (adds X-Frontend-Key to requests)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

function getOrCreateUserToken() {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("cart_user_id");
  if (!token) {
    token = crypto?.randomUUID?.() || Math.random().toString(36).substring(2);
    localStorage.setItem("cart_user_id", token);
  }
  return token;
}

/* ---------- Types for Custom Attributes (from backend) ---------- */
type AttributeOption = {
  id: string;
  label: string;
  image_url?: string | null;
  price_delta?: number | null;
  is_default?: boolean;
};

type CustomAttribute = {
  id: string;
  name: string;
  options: AttributeOption[];
};
/* ---------------------------------------------------------------- */

export default function ProductDetailPage() {
  const { productId } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [shippingInfo, setShippingInfo] = useState<any>({});
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [loading, setLoading] = useState(true);

  // Custom attributes
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    []
  );
  const [selectedAttrOptions, setSelectedAttrOptions] = useState<
    Record<string, string>
  >({});

  // Normalize/ensure absolute URL (works for /relative and absolute)
  const toAbsUrl = (src?: string | null) => {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    const base = API_BASE_URL.replace(/\/$/, "");
    const path = String(src).replace(/^\/+/, "");
    return `${base}/${path}`;
  };

  useEffect(() => {
    if (!productId) return;

    const fetchAllProductData = async () => {
      try {
        setLoading(true);

        const [
          productRes,
          imagesRes,
          variantRes,
          shippingRes,
          seoRes,
          navRes,
          attrsRes, // NEW: attributes
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/show_specific_product/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_other_details/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_variant/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_shipping_info/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_seo/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_nav_items/`,
            withFrontendKey({
              cache: "no-store",
            })
          ),
          // ←—— NEW real attributes endpoint
          fetch(
            `${API_BASE_URL}/api/show_product_attributes/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
        ]);

        if (!productRes.ok) throw new Error("Failed to fetch product");

        const productData = await productRes.json();
        const imageData = imagesRes.ok ? await imagesRes.json() : {};
        const variantData = variantRes.ok ? await variantRes.json() : {};
        const shippingData = shippingRes.ok ? await shippingRes.json() : {};
        // const seoData = seoRes.ok ? await seoRes.json() : {}; // reserved
        const navItems = navRes.ok ? await navRes.json() : [];

        // --- Attributes from backend (no dummy) ---
        const attrsRaw = attrsRes.ok ? await attrsRes.json() : [];
        // Ensure any image_url is absolute
        const attrs: CustomAttribute[] = (Array.isArray(attrsRaw) ? attrsRaw : [])
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            options: (a.options || []).map((o: any) => ({
              id: o.id,
              label: o.label,
              image_url: toAbsUrl(o.image_url),
              price_delta:
                o.price_delta === null || o.price_delta === undefined
                  ? null
                  : Number(o.price_delta),
              is_default: !!o.is_default,
            })),
          }))
          // Keep only attributes that have at least one option
          .filter((a: CustomAttribute) => (a.options || []).length > 0);

        setCustomAttributes(attrs);

        // Default selections from backend (is_default) or first option
        const defaults: Record<string, string> = {};
        attrs.forEach((a) => {
          const def = a.options.find((o) => o.is_default) || a.options[0];
          if (def) defaults[a.id] = def.id;
        });
        setSelectedAttrOptions(defaults);

        const fullProduct = {
          ...productData,
          sizes: variantData.sizes || [],
          printing_methods: variantData.printing_methods || [],
          fabric_finish: variantData.fabric_finish || [],
          color_variants: variantData.color_variants || [],
          material_types: variantData.material_types || [],
          add_on_options: variantData.add_on_options || [],
        };

        const productImages = (imageData.images || ["/images/img1.jpg"]).map(
          (u: string) => toAbsUrl(u)
        );
        setImages(productImages);
        setProduct(fullProduct);
        setShippingInfo(shippingData || { processing_time: "3–5" });

        // Default a size if any
        if (fullProduct.sizes?.length) {
          setSelectedSize(fullProduct.sizes[0]);
        }

        // Related Products (same subcategory)
        let foundCategory: any = null;
        let foundSubCategory: any = null;

        for (const category of navItems) {
          for (const sub of category.subcategories || []) {
            for (const prod of sub.products || []) {
              if (`${prod.id}` === `${productId}`) {
                foundCategory = category;
                foundSubCategory = sub;
                break;
              }
            }
          }
        }

        const allProductsRes = await fetch(
          `${API_BASE_URL}/api/show-product/`,
          withFrontendKey({ cache: "no-store" })
        );
        const allProductsData = allProductsRes.ok
          ? await allProductsRes.json()
          : [];

        if (foundSubCategory?.products && allProductsData.length > 0) {
          const related = foundSubCategory.products
            .filter((p: any) => `${p.id}` !== `${productId}`)
            .map((p: any) => {
              const fullDetails = allProductsData.find(
                (item: any) => `${item.id}` === `${p.id}`
              );
              return {
                ...p,
                image:
                  fullDetails?.image ||
                  p.images?.[0]?.url ||
                  "/images/img1.jpg",
                price: fullDetails?.price || "N/A",
                printing_methods: fullDetails?.printing_methods || [],
                stock_status: fullDetails?.stock_status || "",
                stock_quantity: fullDetails?.stock_quantity || 0,
                category_slug: foundCategory?.url,
                subcategory_slug: foundSubCategory?.url,
              };
            });

          setRelatedProducts(related.slice(0, 4));
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Product fetch error:", err);
        setProduct(null);
        setLoading(false);
      }
    };

    fetchAllProductData();
  }, [productId]);

  const handleAddToCart = async () => {
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
            selected_attributes: selectedAttrOptions, // now real selections (attrId -> optionId)
          }),
        })
      );

      const data = await res.json();

      Toastify({
        text: res.ok ? "✔️ Added to cart!" : `❌ ${data.error || "Try again!"}`,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: res.ok
          ? "linear-gradient(to right, #af4c4cff, #d30000ff)"
          : "linear-gradient(to right, #b00020, #ff5a5a)",
      }).showToast();

      console.log("Added to cart:", data);
    } catch (error) {
      console.error("Cart error:", error);
    }
  };

  const nextImage = () => setCurrentImageIndex((i) => (i + 1) % images.length);
  const prevImage = () =>
    setCurrentImageIndex((i) => (i - 1 + images.length) % images.length);

  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) =>
    setTouchEnd(e.touches[0].clientX);
  const handleTouchEnd = () => {
    const delta = touchStart - touchEnd;
    if (delta > 50) nextImage();
    if (delta < -50) prevImage();
  };

  const selectAttrOption = (attrId: string, optionId: string) => {
    setSelectedAttrOptions((prev) => ({ ...prev, [attrId]: optionId }));
  };

  const isSelected = (attrId: string, optionId: string) =>
    selectedAttrOptions[attrId] === optionId;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Product not found.
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{product.name} | Your Store</title>
        <meta
          name="description"
          content={product.fit_description?.slice(0, 160)}
        />
      </Head>

      <div className="bg-white min-h-screen">
        <Header />
        <LogoSection />
        <MobileTopBar />

        {/* Product Details */}
        <div className="max-w-6xl mx-auto mt-10 px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div
              className="relative bg-gray-100 rounded-2xl overflow-hidden aspect-[5/5] group"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={images[currentImageIndex] || "/images/img1.jpg"}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.src = "/images/img1.jpg")}
              />
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block group-hover:opacity-100 opacity-0 transition bg-white p-2 rounded-full text-black"
              >
                <ChevronLeft />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block group-hover:opacity-100 opacity-0 transition bg-white p-2 rounded-full text-black"
              >
                <ChevronRight />
              </button>
              <span className="absolute top-4 right-4 bg-red-700 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {images.length}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={`w-16 h-16 overflow-hidden rounded ${
                    i === currentImageIndex
                      ? "ring-2 ring-red-700"
                      : "ring-1 ring-gray-300"
                  }`}
                >
                  <img
                    src={img}
                    alt={`thumb-${i}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-red-700 font-semibold text-2xl">AED: {product.price}</p>
            <p
              className={`text-sm ${
                product.stock_status === "out of stock"
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {product.stock_status === "out of stock"
                ? "Out of Stock"
                : `In Stock (${product.stock_quantity})`}
            </p>

            {/* Sizes */}
            {product.sizes?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Select Size
                </p>
                <div className="flex gap-2">
                  {product.sizes.map((s: string) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`px-5 py-2 rounded-full text-sm font-medium ${
                        selectedSize === s
                          ? "bg-[#7f1d1d] text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Printing Methods */}
            {product.printing_methods?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Printing Methods
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.printing_methods.map((pm: string, i: number) => {
                    let label = pm;
                    if (pm === "DP") label = "Digital Printing";
                    else if (pm === "SP") label = "Screen Printing";
                    else if (pm === "OP") label = "Off Set Printing";

                    return (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-xs text-gray-600 bg-white-800 border border-gray-300"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------- Custom Attributes (from backend) BEFORE Add to Cart ---------- */}
            {customAttributes?.length > 0 && (
              <section className="space-y-6">
                {customAttributes.map((attr) => (
                  <div key={attr.id} className="space-y-3">
                    <p className="text-sm font-semibold text-gray-800">
                      {attr.name}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {attr.options.map((opt) => {
                        const selected = isSelected(attr.id, opt.id);
                        const delta = Number(opt.price_delta ?? 0);
                        const positive = delta > 0;
                        const negative = delta < 0;

                        return (
                          <div key={opt.id} className="relative">
                            {/* Price delta badge: green for +, maroon for - , nothing for 0 */}
                            {positive ? (
                              <span className="absolute -top-2 -right-1 z-10 text-xs font-medium rounded-full px-2 py-1 bg-green-100 text-green-700 border border-green-200  w-full">
                                +{Math.round(delta)} AED
                              </span>
                            ) : negative ? (
                              <span className="absolute -top-2 -right-1 z-10 text-xs font-medium rounded-full px-2 py-1 border bg-rose-100 text-[#7f1d1d] border-rose-200 w-full">
                                {Math.round(delta)} AED
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => selectAttrOption(attr.id, opt.id)}
                              className={`group w-16 rounded-lg border-2 bg-white text-center transition-all relative ${
                                selected
                                  ? "border-red-600 shadow-md"
                                  : "border-gray-300 hover:border-gray-400"
                              }`}
                              aria-pressed={selected}
                            >
                              <div className="p-0.5">
                                <div className="w-10 h-10 mx-auto rounded border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                                  {opt.image_url ? (
                                    <img
                                      src={opt.image_url}
                                      alt={opt.label}
                                      className="w-full h-full object-cover"
                                      onError={(e) =>
                                        (e.currentTarget.src =
                                          "/images/img1.jpg")
                                      }
                                    />
                                  ) : (
                                    <svg
                                      className="w-3.5 h-3.5 text-gray-300"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2z"
                                      />
                                    </svg>
                                  )}
                                </div>
                              </div>

                              <div className="px-0.5 pb-1.5 relative">
                                <p
                                  className={`text-xs font-medium ${
                                    selected ? "text-gray-900" : "text-gray-600"
                                  }`}
                                >
                                  {opt.label}
                                </p>

                                {selected && (
                                  <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2">
                                    <div className="w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                      <svg
                                        className="w-2 h-2 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}
            {/* ------------------------------------------------------------------ */}

            {/* Add to Cart */}
            <div className="flex gap-4 items-center">
              <button
                onClick={handleAddToCart}
                disabled={
                  product.stock_status?.trim().toLowerCase() !== "in stock"
                }
                className={`flex-1 py-4 rounded-full font-medium ${
                  product.stock_status?.toLowerCase() !== "in stock"
                    ? "bg-gray-300 text-black"
                    : "bg-[#7f1d1d] text-white hover:bg-red-700"
                }`}
              >
                {product.stock_status?.trim().toLowerCase() !== "in stock"
                  ? "Out Of Stock"
                  : "Add to Cart"}
              </button>
            </div>

            {/* Description */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg text-black">
                  Description & Fit
                </span>
                <ChevronDown />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {product.fit_description || "No description available."}
              </p>
            </div>

            {/* Shipping */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg text-black">
                  Shipping
                </span>
                <ChevronDown />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-700">
                <div className="flex gap-2 items-center">
                  <Truck className="w-4 h-4" />
                  <span>
                    Within {shippingInfo.processing_time || "3–5"} days
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <Calendar className="w-4 h-4" />
                  <span>Est. arrival: in fortnight</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        <div className="max-w-6xl mx-auto mt-20 px-4 mb-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            You might also like
          </h2>
          {relatedProducts.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((item, i) => (
                <div
                  key={i}
                  onClick={() =>
                    router.push(
                      `/home/${item.category_slug}/${item.subcategory_slug}/products/${item.id}`
                    )
                  }
                  className="border rounded-xl cursor-pointer overflow-hidden hover:shadow-md transition"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-60 object-cover"
                  />
                  <div className="p-4">
                    <p className="font-medium text-gray-800 truncate">
                      {item.name}
                    </p>
                    <span className="text-sm font-semibold text-red-700">
                      RS: {item.price}
                    </span>
                    {item.printing_methods?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Print: {item.printing_methods.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No related products found.</p>
          )}
        </div>

        <Footer />
        <ChatBot />
      </div>
    </>
  );
}
