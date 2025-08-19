"use client";

import type React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../../utils/api";

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const MAX_IMAGES = 99;

const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

const addLowStockNotification = (productName: string, sku: string, quantity: number) => {
  if (typeof window === "undefined") return;
  const existing = JSON.parse(localStorage.getItem("notifications") || "[]");
  const alreadyExists = existing.some((n: any) => n.type === "low_stock" && n.sku === sku);
  if (alreadyExists) return;
  const newNotification = {
    id: crypto.randomUUID(),
    type: "low_stock",
    sku,
    order_id: sku,
    user: "System",
    status: "Low Stock",
    message: `⚠️ Product "${productName}" (SKU: ${sku}) has low stock (${quantity} left)`,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem("notifications", JSON.stringify([newNotification, ...existing]));
};

type ModalImage = { src: string; file?: File | null; kind: "file" | "url" | "data" };

const urlForDisplay = (src: string): string => {
  if (/^https?:/i.test(src)) return src;
  return `${API_BASE_URL.replace(/\/$/, "")}/${src.replace(/^\/+/, "")}`;
};

const dirKeyFromDisplayUrl = (displayUrl: string): string => {
  try {
    const u = new URL(displayUrl);
    const parts = u.pathname.split("/");
    parts.pop();
    return u.origin + parts.join("/") + "/";
  } catch {
    const clean = displayUrl.replace(/[#?].*$/, "");
    const parts = clean.split("/");
    parts.pop();
    return parts.join("/") + "/";
  }
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fetchUrlAsDataUrl = async (url: string): Promise<string> => {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("fetch_failed");
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
};

const Modal = ({
  isOpen,
  onClose,
  onFirstImageUpload,
  productId = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onFirstImageUpload?: (f: File) => void;
  productId?: string | null;
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [previewImages, setPreviewImages] = useState<ModalImage[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  const openPreviewAt = useCallback(
    (idx: number) => {
      if (previewImages.length === 0) return;
      setActivePreviewIndex(idx);
      setIsPreviewOpen(true);
    },
    [previewImages.length]
  );

  const closePreview = useCallback(() => setIsPreviewOpen(false), []);
  const nextPreview = useCallback(() => {
    setActivePreviewIndex((i) => (i + 1) % Math.max(previewImages.length, 1));
  }, [previewImages.length]);
  const prevPreview = useCallback(() => {
    setActivePreviewIndex((i) => (i - 1 + Math.max(previewImages.length, 1)) % Math.max(previewImages.length, 1));
  }, [previewImages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPreviewOpen) return;
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowRight") nextPreview();
      if (e.key === "ArrowLeft") prevPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen, closePreview, nextPreview, prevPreview]);

  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const printingMethods = [
    { value: "SP", label: "Screen Printing" },
    { value: "DP", label: "Digital Printing" },
    { value: "OP", label: "Offset Printing" },
  ];

  const [formData, setFormData] = useState<any>({
    title: "",
    description: "",
    sku: "",
    category: "",
    subcategory: "",
    brand: "",
    imageAlt: "",
    videoUrl: "",
    metaTitle: "",
    metaDescription: "",
    metaKeywords: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    canonicalUrl: "",
    jsonLdSchema: "",
    normalPrice: "",
    discountedPrice: "",
    taxRate: "",
    priceCalculator: "",
    stockQuantity: "",
    lowStockAlert: "",
    stockStatus: "",
    size: [],
    colorVariants: [],
    materialType: [],
    fabricFinish: "",
    printingMethod: "",
    addOnOptions: "",
    variantCombinations: "",
    customTags: "",
    groupedFilters: "",
    processingTime: "",
    shippingClass: [],
  });

  const [errors, setErrors] = useState<any>({});
  const [tempMetaKeywords, setTempMetaKeywords] = useState("");
  const [tempSizes, setTempSizes] = useState("");
  const [tempColorVariants, setTempColorVariants] = useState("");
  const [tempMaterialType, setTempMaterialType] = useState("");
  const [tempAddOnOptions, setTempAddOnOptions] = useState("");
  const [tempCustomTags, setTempCustomTags] = useState("");
  const [tempGroupedFilters, setTempGroupedFilters] = useState("");
  const [tempShippingClass, setTempShippingClass] = useState("");
  const [tempVariantCombinations, setTempVariantCombinations] = useState("");

  const categoryName = useMemo(() => {
    if (!formData.category) return "";
    const found = categories.find((c) => c.id?.toString() === formData.category?.toString());
    return found?.name || "";
  }, [categories, formData.category]);

  const subcategoryName = useMemo(() => {
    const subId = formData.subcategory || selectedSubcategories?.[0];
    if (!subId) return "";
    const found = subcategories.find((s) => s.id?.toString() === subId?.toString());
    return found?.name || "";
  }, [subcategories, formData.subcategory, selectedSubcategories]);

  useEffect(() => {
    if (!productId) {
      setFormData({
        title: "",
        description: "",
        sku: "",
        category: "",
        subcategory: "",
        brand: "",
        imageAlt: "",
        videoUrl: "",
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
        canonicalUrl: "",
        jsonLdSchema: "",
        normalPrice: "",
        discountedPrice: "",
        taxRate: "",
        priceCalculator: "",
        stockQuantity: "",
        lowStockAlert: "",
        stockStatus: "",
        size: [],
        colorVariants: [],
        materialType: [],
        fabricFinish: "",
        printingMethod: "",
        addOnOptions: "",
        variantCombinations: "",
        customTags: "",
        groupedFilters: "",
        processingTime: "",
        shippingClass: [],
      });
      setTempMetaKeywords("");
      setTempSizes("");
      setTempColorVariants("");
      setTempMaterialType("");
      setTempAddOnOptions("");
      setTempCustomTags("");
      setTempGroupedFilters("");
      setTempShippingClass("");
      setPreviewImages([]);
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      return;
    }
    const fetchDetails = async () => {
      try {
        const [basicRes, seoRes, variantRes, shipRes, otherRes, comboRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show_specific_product/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
          fetch(`${API_BASE_URL}/api/show_product_seo/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
          fetch(`${API_BASE_URL}/api/show_product_variant/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
          fetch(`${API_BASE_URL}/api/show_product_shipping_info/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
          fetch(`${API_BASE_URL}/api/show_product_other_details/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
          fetch(`${API_BASE_URL}/api/show_product_variants/`, withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: productId }),
          })),
        ]);
        const basic = await basicRes.json();
        const seo = await seoRes.json();
        const variant = await variantRes.json();
        const shipping = await shipRes.json();
        const other = await otherRes.json();
        const combos = await comboRes.json();
        setFormData((prev: any) => ({
          ...prev,
          title: basic.name || "",
          description: basic.fit_description || "",
          sku: basic.id || "",
          category: "",
          subcategory: basic.subcategory?.id || "",
          brand: basic.brand_title || "",
          imageAlt: seo.image_alt_text || "",
          videoUrl: basic.video_url || "",
          metaTitle: seo.meta_title || "",
          metaDescription: seo.meta_description || "",
          metaKeywords: "",
          ogTitle: seo.open_graph_title || "",
          ogDescription: seo.open_graph_desc || "",
          ogImage: seo.open_graph_image_url || "",
          canonicalUrl: seo.canonical_url || "",
          jsonLdSchema: seo.json_ld || "",
          normalPrice: basic.price || "",
          discountedPrice: basic.discounted_price || "",
          taxRate: basic.tax_rate || "",
          priceCalculator: basic.price_calculator || "",
          stockQuantity: basic.stock_quantity || "",
          lowStockAlert: basic.low_stock_alert || "",
          stockStatus: basic.stock_status || "",
          size: variant.sizes || [],
          colorVariants: variant.color_variants || [],
          materialType: variant.material_types || [],
          fabricFinish: (variant.fabric_finish || [])[0] || "",
          printingMethod: variant.printing_methods?.[0] || "",
          addOnOptions: variant.add_on_options || [],
          variantCombinations: combos.variant_combinations || [],
          customTags: seo.custom_tags || [],
          groupedFilters: seo.grouped_filters || [],
          processingTime: shipping.processing_time || "",
          shippingClass: (shipping.shipping_class || "").split(","),
        }));
        const existingArray = Array.isArray(other.images) ? other.images : other.images ? [other.images] : [];
        const displayUrls = existingArray.map((p: string) => urlForDisplay(p));
        let filteredDisplay = displayUrls;
        if (displayUrls.length > 0) {
          const lastDir = dirKeyFromDisplayUrl(displayUrls[displayUrls.length - 1]);
          filteredDisplay = displayUrls.filter((u) => dirKeyFromDisplayUrl(u) === lastDir);
        }
        setPreviewImages(filteredDisplay.map((p: string) => ({ src: p, kind: "url" as const, file: null })));
        if (other.subcategory_ids?.length > 0) setSelectedSubcategories(other.subcategory_ids);
      } catch (err) {
        toast.error("❌ Failed to load product details");
        console.error("Fetch product detail error:", err);
      }
    };
    fetchDetails();
  }, [productId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, subRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey()),
          fetch(`${API_BASE_URL}/api/show-subcategories/`, withFrontendKey()),
        ]);
        if (!catRes.ok || !subRes.ok) throw new Error("Failed to fetch lists");
        const catData = await catRes.json();
        const subData = await subRes.json();
        setCategories(Array.isArray(catData) ? catData : []);
        setSubcategories(Array.isArray(subData) ? subData : []);
      } catch (e) {
        toast.error("Failed to load categories/subcategories.");
        console.error(e);
      }
    };
    if (!FRONTEND_KEY) {
      console.warn("NEXT_PUBLIC_FRONTEND_KEY missing.");
      toast.warn("Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY and restart.");
      return;
    }
    fetchData();
  }, []);

  useEffect(() => setIsEditMode(!!productId), [productId]);

  useEffect(() => {
    if (formData.subcategory && !formData.category) {
      const selectedSub = subcategories.find((s) => s.id.toString() === formData.subcategory.toString());
      if (selectedSub && selectedSub.categories?.length > 0) {
        const firstName = selectedSub.categories[0];
        const match = categories.find((c) => c.name === firstName);
        const firstCategoryId = match?.id || "";
        if (firstCategoryId) {
          setFormData((prev: any) => ({ ...prev, category: firstCategoryId }));
          setSelectedCategories([firstCategoryId]);
        }
      }
    }
  }, [formData.subcategory, formData.category, subcategories, categories]);

  useEffect(() => {
    const qty = parseInt(formData.stockQuantity);
    const alert = parseInt(formData.lowStockAlert);
    let status = "";
    if (!isNaN(qty) && !isNaN(alert)) {
      if (qty === 0) status = "No Stock";
      else if (qty <= alert) status = "Low Stock";
      else status = "In Stock";
      setFormData((prev: any) => ({ ...prev, stockStatus: status }));
    }
  }, [formData.stockQuantity, formData.lowStockAlert]);

  useEffect(() => {
    const generateSku = async () => {
      if (!formData.title.trim() || !formData.subcategory || isEditMode) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/generate-product-id/`, withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.title, subcategory_id: formData.subcategory }),
        }));
        const data = await res.json();
        if (res.ok && data?.product_id) setFormData((prev: any) => ({ ...prev, sku: data.product_id }));
      } catch (err) {
        console.error("Failed to generate product ID:", err);
      }
    };
    generateSku();
  }, [formData.title, formData.subcategory, isEditMode]);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    return () => {
      previewImages.forEach((img) => {
        if (img.kind === "file" && (img.src as any)?.startsWith?.("blob:")) URL.revokeObjectURL(img.src);
      });
    };
  }, [previewImages]);

  if (!isMounted || !isOpen) return null;

  const validate = () => {
    const newErrors: any = {};
    if (!formData.title.trim()) newErrors.title = "Product title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.subcategory) newErrors.subcategory = "Subcategory is required";
    if (!isEditMode && previewImages.length === 0) newErrors.image = "At least one image is required";
    return newErrors;
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const currentCount = previewImages.length;
    const allowed = Math.max(0, MAX_IMAGES - currentCount);
    const chosen = files.slice(0, allowed);
    if (files.length > allowed) {
      toast.warn(`You can upload up to ${MAX_IMAGES} images. Extra ${files.length - allowed} file(s) ignored.`);
    }
    const items: ModalImage[] = chosen.map((file) => ({
      src: URL.createObjectURL(file),
      file,
      kind: "file",
    }));
    setPreviewImages((prev) => [...prev, ...items]);
    if (onFirstImageUpload && previewImages.length === 0 && chosen[0]) {
      onFirstImageUpload(chosen[0]);
    }
    setErrors((prev: any) => {
      const { image, ...rest } = prev;
      return rest;
    });
    e.target.value = "";
  };

  const removeImageAt = (idx: number) => {
    setPreviewImages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.kind === "file" && (removed.src as any)?.startsWith?.("blob:")) URL.revokeObjectURL(removed.src);
      if (isPreviewOpen) {
        if (idx === activePreviewIndex) {
          setActivePreviewIndex((i) => Math.max(0, i - 1));
        } else if (idx < activePreviewIndex) {
          setActivePreviewIndex((i) => Math.max(0, i - 1));
        }
      }
      return copy;
    });
  };

  const handleCategoryChange = (id: any) => {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubcategoryChange = (id: any, linkedCategories?: string[]) => {
    setSelectedSubcategories((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    if (selectedCategories.length === 0 && linkedCategories?.length) {
      const matchedIds = linkedCategories
        .map((catName) => categories.find((c) => c.name === catName)?.id)
        .filter(Boolean);
      setSelectedCategories((prev) => [...new Set([...prev, ...matchedIds])]);
    }
  };

  const filteredSubcategories =
    selectedCategories.length === 0
      ? subcategories
      : subcategories.filter((sub: any) =>
          sub.categories?.some((catName: string) =>
            categories
              .filter((cat: any) => selectedCategories.includes(cat.id))
              .map((cat: any) => cat.name)
              .includes(catName)
          )
        );

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const formErrors = validate();
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) {
      toast.error("Please correct the highlighted fields.");
      return;
    }
    const finalSubcategoryIds = [...new Set([...selectedSubcategories, formData.subcategory].filter(Boolean))];
    if (finalSubcategoryIds.length === 0) {
      toast.error("Please select at least one subcategory.");
      return;
    }
    let toastId: any;
    try {
      toastId = toast.loading("Saving product...");
      const imagesBase64: string[] = [];
      for (const img of previewImages) {
        if (img.kind === "file" && img.file) {
          imagesBase64.push(await fileToBase64(img.file));
        } else if (String(img.src).startsWith("data:")) {
          imagesBase64.push(img.src);
        } else {
          const dataUrl = await fetchUrlAsDataUrl(img.src);
          imagesBase64.push(dataUrl);
        }
      }
      if (isEditMode && imagesBase64.length === 0) {
        toast.dismiss(toastId);
        toast.error("Could not preserve existing images. Please reselect images before saving.");
        return;
      }
      const cleanCommaArray = (val: string) => val.split(",").map((v) => v.trim()).filter(Boolean);
      const parsedCombinations = String(tempVariantCombinations || "")
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [description, price] = entry.split("::").map((v) => v.trim());
          return { description, price_override: parseFloat(price) || 0 };
        });
      const payload: any = {
        name: formData.title,
        description: formData.description,
        brand_title: formData.brand,
        price: parseFloat(formData.normalPrice) || 0,
        discounted_price: parseFloat(formData.discountedPrice) || 0,
        tax_rate: parseFloat(formData.taxRate) || 0,
        price_calculator: formData.priceCalculator,
        video_url: formData.videoUrl,
        fabric_finish: formData.fabricFinish,
        status: "active",
        quantity: parseInt(formData.stockQuantity) || 0,
        low_stock_alert: parseInt(formData.lowStockAlert) || 0,
        stock_status: formData.stockStatus || "in stock",
        category_ids: selectedCategories,
        subcategory_ids: finalSubcategoryIds,
        images: imagesBase64,
        shippingClass: cleanCommaArray(tempShippingClass),
        processing_time: formData.processingTime,
        image_alt_text: formData.imageAlt,
        meta_title: formData.metaTitle,
        meta_description: formData.metaDescription,
        meta_keywords: cleanCommaArray(tempMetaKeywords),
        open_graph_title: formData.ogTitle,
        open_graph_desc: formData.ogDescription,
        open_graph_image_url: formData.ogImage,
        canonical_url: formData.canonicalUrl,
        json_ld: formData.jsonLdSchema,
        printing_method: formData.printingMethod,
        variant_combinations: parsedCombinations,
        size: cleanCommaArray(tempSizes),
        colorVariants: cleanCommaArray(tempColorVariants),
        materialType: cleanCommaArray(tempMaterialType),
        addOnOptions: cleanCommaArray(tempAddOnOptions),
        customTags: cleanCommaArray(tempCustomTags),
        groupedFilters: cleanCommaArray(tempGroupedFilters),
      };
      const res = await fetch(`${API_BASE_URL}/api/save-product/`, withFrontendKey({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      let result: any = {};
      try {
        result = await res.json();
      } catch {}
      toast.dismiss(toastId);
      if (res.ok) {
        toast.success("Product saved successfully!");
        if (payload.quantity <= payload.low_stock_alert && payload.quantity > 0) {
          addLowStockNotification(payload.name, payload.subcategory_ids[0], payload.quantity);
        }
        onClose?.();
      } else {
        const fallbackMsg = `Failed to save product. Status ${res.status}`;
        toast.error(result?.error || fallbackMsg);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Something went wrong while saving.");
      console.error("Save product error:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-blur-500 bg-opacity-40 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div
        className="bg-white text-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-y-auto p-8 flex flex-col sm:flex-row"
        role="dialog"
        aria-modal="true"
      >
        <div className="hidden sm:block sm:w-1/2 pr-6 h-[420px]">
          {previewImages.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-video w-full overflow-hidden rounded-lg shadow-lg w-full h-[420px]">
                <img
                  src={previewImages[0].src}
                  alt="Product Preview"
                  className="w-auto h-full object-cover cursor-zoom-in"
                  onClick={() => openPreviewAt(0)}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {previewImages.map((img, idx) => (
                  <div key={img.src + idx} className="relative group">
                    <img
                      src={img.src}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-md border cursor-zoom-in"
                      onClick={() => openPreviewAt(idx)}
                    />
                    <button
                      type="button"
                      onClick={() => removeImageAt(idx)}
                      className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
              No images selected
            </div>
          )}
          {errors.image && <p className="text-red-600 mt-2">{errors.image}</p>}
          <p className="text-xs text-gray-500 mt-2">You can upload up to {MAX_IMAGES} images.</p>
        </div>
        <div className="w-full sm:w-1/2 h-full overflow-y-auto">
          <header className="flex justify-between items-center border-b border-gray-300 pb-3 mb-6">
            <h2 className="text-2xl font-extrabold tracking-wide text-[#8B1C1C]">
              {isEditMode ? "View / Edit Product" : "Add Product"}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-gray-500 hover:text-[#8B1C1C] transition-colors text-3xl font-bold leading-none focus:outline-none focus:ring-2 focus:ring-[#8B1C1C] rounded"
            >
              ×
            </button>
          </header>
          <form className="space-y-8" onSubmit={handleSubmit} noValidate>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Basic Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <input
                  name="title"
                  type="text"
                  placeholder="Product Title"
                  className={`input-primary ${errors.title ? "border-red-600" : ""}`}
                  value={formData.title}
                  disabled={isEditMode}
                  onChange={handleChange}
                  required
                />
                {errors.title && <p className="text-red-600">{errors.title}</p>}
                <textarea
                  name="description"
                  placeholder="Description (Rich Text)"
                  className={`input-primary col-span-1 sm:col-span-2 h-24 resize-y ${errors.description ? "border-red-600" : ""}`}
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
                {errors.description && <p className="text-red-600">{errors.description}</p>}
                <input
                  name="sku"
                  type="text"
                  placeholder="SKU / Product ID"
                  className="input-primary"
                  value={formData.sku}
                  onChange={handleChange}
                  disabled={isEditMode}
                />
                {!isEditMode ? (
                  <>
                    <div className="relative">
                      <select
                        name="category"
                        className={`input-primary w-full pr-10 ${errors.category ? "border-red-600" : ""} custom-select`}
                        value={formData.category}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setFormData((prev: any) => ({ ...prev, category: selectedId, subcategory: "" }));
                          setSelectedCategories([selectedId]);
                        }}
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="relative">
                      <select
                        name="subcategory"
                        className={`input-primary w-full pr-10 ${errors.subcategory ? "border-red-600" : ""} custom-select`}
                        value={formData.subcategory}
                        onChange={(e) => {
                          const subId = e.target.value;
                          setFormData((prev: any) => ({ ...prev, subcategory: subId }));
                          if (!formData.category) {
                            const selectedSub = subcategories.find((s) => s.id?.toString() === subId?.toString());
                            if (selectedSub && selectedSub.categories?.length > 0) {
                              const matchedCatIds = selectedSub.categories
                                .map((catName: string) => categories.find((c) => c.name === catName)?.id)
                                .filter(Boolean);
                              setSelectedCategories(matchedCatIds);
                              setFormData((prev: any) => ({ ...prev, category: matchedCatIds[0] || "" }));
                            }
                          }
                        }}
                        required
                      >
                        <option value="">Select Subcategory</option>
                        {filteredSubcategories.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      className="input-primary bg-gray-100 cursor-not-allowed"
                      value={categoryName}
                      readOnly
                      aria-label="Category (locked in edit mode)"
                    />
                    <input
                      type="text"
                      className="input-primary bg-gray-100 cursor-not-allowed"
                      value={subcategoryName}
                      readOnly
                      aria-label="Subcategory (locked in edit mode)"
                    />
                  </>
                )}
                {errors.subcategory && <p className="text-red-600">{errors.subcategory}</p>}
                <input
                  name="brand"
                  type="text"
                  placeholder="Brand / Vendor"
                  className={`input-primary ${errors.brand ? "border-red-600" : ""}`}
                  value={formData.brand}
                  onChange={handleChange}
                  required
                />
                {errors.brand && <p className="text-red-600">{errors.brand}</p>}
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Images & Media</h3>
              <div className="grid gap-6">
                <div>
                  <label htmlFor="file-upload" className="btn-primary inline-block cursor-pointer text-center">
                    Choose Image(s)
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <input
                  name="imageAlt"
                  type="text"
                  placeholder="Image alt text for SEO"
                  className={`input-primary ${errors.imageAlt ? "border-red-600" : ""}`}
                  value={formData.imageAlt}
                  onChange={handleChange}
                />
                {errors.imageAlt && <p className="text-red-600">{errors.imageAlt}</p>}
                <input
                  name="videoUrl"
                  type="url"
                  placeholder="Optional video or 360° view embed"
                  className="input-primary"
                  value={formData.videoUrl}
                  onChange={handleChange}
                />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">SEO & Metadata</h3>
              <div className="grid grid-cols-1 gap-6">
                <input name="metaTitle" type="text" placeholder="Meta Title" className="input-primary" value={formData.metaTitle} onChange={handleChange} />
                <textarea name="metaDescription" placeholder="Meta Description" className="input-primary h-20 resize-y" value={formData.metaDescription} onChange={handleChange} />
                <input name="metaKeywords" type="text" placeholder="Meta Keywords (comma-separated)" className="input-primary" value={tempMetaKeywords} onChange={(e) => setTempMetaKeywords(e.target.value)} />
                <input name="ogTitle" type="text" placeholder="Open Graph Title" className="input-primary" value={formData.ogTitle} onChange={handleChange} />
                <textarea name="ogDescription" placeholder="Open Graph Description" className="input-primary h-20 resize-y" value={formData.ogDescription} onChange={handleChange} />
                <input name="ogImage" type="url" placeholder="Open Graph Image URL" className="input-primary" value={formData.ogImage} onChange={handleChange} />
                <input name="canonicalUrl" type="url" placeholder="Canonical URL" className="input-primary" value={formData.canonicalUrl} onChange={handleChange} />
                <textarea name="jsonLdSchema" placeholder="JSON-LD Schema (Structured Data)" className="input-primary h-24 resize-y font-mono text-sm" value={formData.jsonLdSchema} onChange={handleChange} />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Pricing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <input name="normalPrice" type="number" placeholder="Normal Price" className="input-primary" value={formData.normalPrice} onChange={handleChange} />
                <input name="discountedPrice" type="number" placeholder="Discounted Price" className="input-primary" value={formData.discountedPrice} onChange={handleChange} />
                <input name="taxRate" type="number" placeholder="Tax Rate (%)" className="input-primary" value={formData.taxRate} onChange={handleChange} />
                <input name="priceCalculator" type="text" placeholder="Price Calculator" className="input-primary" value={formData.priceCalculator} onChange={handleChange} />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Inventory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <input name="stockQuantity" type="number" placeholder="Stock Quantity" className="input-primary" value={formData.stockQuantity} onChange={handleChange} />
                <input name="lowStockAlert" type="number" placeholder="Low Stock Alert" className="input-primary" value={formData.lowStockAlert} onChange={handleChange} />
                <input name="stockStatus" type="text" placeholder="Stock Status (in stock/out of stock)" className="input-primary" value={formData.stockStatus} onChange={handleChange} />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Product Variations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <input name="size" type="text" placeholder="Enter sizes (comma-separated)" className="input-primary" value={tempSizes} onChange={(e) => setTempSizes(e.target.value)} />
                <input name="colorVariants" type="text" placeholder="Enter color variants (comma-separated)" className="input-primary" value={tempColorVariants} onChange={(e) => setTempColorVariants(e.target.value)} />
                <input name="materialType" type="text" placeholder="Enter material types (comma-separated)" className="input-primary" value={tempMaterialType} onChange={(e) => setTempMaterialType(e.target.value)} />
                <input name="fabricFinish" type="text" placeholder="Fabric Finish" className="input-primary" value={formData.fabricFinish} onChange={handleChange} />
                <div className="relative">
                  <select name="printingMethod" className="input-primary w-full pr-10 custom-select" value={formData.printingMethod} onChange={handleChange}>
                    <option value="">Select Printing Method</option>
                    {printingMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <input name="addOnOptions" type="text" placeholder="Add-On Options" className="input-primary" value={tempAddOnOptions} onChange={(e) => setTempAddOnOptions(e.target.value)} />
                <input
                  name="variantCombinations"
                  type="text"
                  placeholder='Use format: "Size::Price | Size2::Price2"'
                  className="input-primary"
                  value={tempVariantCombinations}
                  onChange={(e) => setTempVariantCombinations(e.target.value)}
                />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Additional Metadata</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <input name="customTags" type="text" placeholder="Custom Tags" className="input-primary" value={tempCustomTags} onChange={(e) => setTempCustomTags(e.target.value)} />
                <input name="groupedFilters" type="text" placeholder="Grouped Filters" className="input-primary" value={tempGroupedFilters} onChange={(e) => setTempGroupedFilters(e.target.value)} />
              </div>
            </section>
            <section>
              <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">Shipping & Processing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <input name="processingTime" type="text" placeholder="Processing Time" className="input-primary" value={formData.processingTime} onChange={handleChange} />
                <input
                  name="shippingClass"
                  type="text"
                  placeholder="Enter shipping classes (comma-separated)"
                  className="input-primary"
                  value={tempShippingClass}
                  onChange={(e) => setTempShippingClass(e.target.value)}
                />
              </div>
            </section>
            <div className="flex justify-center pt-2 mb-4">
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
      {isPreviewOpen && previewImages.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
        >
          <div className="relative max-w-5xl w-[92vw] h-[82vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImages[activePreviewIndex].src}
              alt={`Preview ${activePreviewIndex + 1}`}
              className="w-full h-full object-contain select-none"
            />
            <button
              onClick={closePreview}
              aria-label="Close preview"
              className="absolute top-2 right-2 text-white text-3xl leading-none"
            >
              ×
            </button>
            {previewImages.length > 1 && (
              <>
                <button
                  onClick={prevPreview}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-2xl px-3 py-2 bg-black/40 rounded-full"
                >
                  ‹
                </button>
                <button
                  onClick={nextPreview}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-2xl px-3 py-2 bg-black/40 rounded-full"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-2 py-1 rounded">
                  {activePreviewIndex + 1} / {previewImages.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style jsx>{`
        .custom-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background: transparent;
        }
        .custom-select:focus + svg {
          color: #8B1C1C;
        }
      `}</style>
    </div>
  );
};

export default Modal;
