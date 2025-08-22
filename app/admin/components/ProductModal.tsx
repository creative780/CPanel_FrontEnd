"use client";

import type React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../../utils/api";

type AttributeOption = {
  id: string;
  label: string;
  price_delta: number; // AED
  is_default?: boolean;
  image_id?: string | null;
  _image_file?: File | null;
  _image_preview?: string | null;
  image?: string | null;
};

type CustomAttribute = {
  id: string;
  name: string;
  options: AttributeOption[];
};

type ModalImage = {
  src: string;
  file?: File | null;
  kind: "file" | "url"; // keep existing vs new; we’ll always resubmit full gallery as base64 on save
};

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const MAX_IMAGES = 99;

// --- Helpers ---------------------------------------------------------------

const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (FRONTEND_KEY) headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

const parseJsonSafe = async (res: Response, label: string) => {
  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {}
    throw new Error(`${label}: HTTP ${res.status}${body ? ` • ${body.slice(0, 200)}…` : ""}`);
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const body = await res.text();
    throw new Error(`${label}: Non-JSON response (${ct}). Body: ${body.slice(0, 200)}…`);
  }
  return res.json();
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

const urlForDisplay = (src: string): string => {
  if (/^https?:/i.test(src)) return src;
  const base = API_BASE_URL.replace(/\/+$/, "");
  const rel = String(src || "").replace(/^\/+/, "");
  return `${base}/${rel}`;
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
  if (!res.ok) throw new Error(`fetch_failed: ${url} • HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
};

// --- Component -------------------------------------------------------------

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

  // Attributes
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);

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

  // Comma-string “temp” fields (for controlled inputs)
  const [tempMetaKeywords, setTempMetaKeywords] = useState("");
  const [tempSizes, setTempSizes] = useState("");
  const [tempColorVariants, setTempColorVariants] = useState("");
  const [tempMaterialType, setTempMaterialType] = useState("");
  const [tempAddOnOptions, setTempAddOnOptions] = useState("");
  const [tempCustomTags, setTempCustomTags] = useState("");
  const [tempGroupedFilters, setTempGroupedFilters] = useState("");
  const [tempShippingClass, setTempShippingClass] = useState("");
  const [tempVariantCombinations, setTempVariantCombinations] = useState("");

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

  // Reset for "Add" mode
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
      setTempVariantCombinations("");
      setPreviewImages([]);
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      setCustomAttributes([]);
      return;
    }

    // --- EDIT MODE: fetch all product pieces (including attributes) ---
    const fetchDetails = async () => {
      try {
        const [basicRes, seoRes, variantRes, shipRes, otherRes, comboRes, attrRes] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/show_specific_product/`,
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
            `${API_BASE_URL}/api/show_product_other_details/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_variants/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
          fetch(
            `${API_BASE_URL}/api/show_product_attributes/`,
            withFrontendKey({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            })
          ),
        ]);

        const basic = await parseJsonSafe(basicRes, "show_specific_product");
        const seo = await parseJsonSafe(seoRes, "show_product_seo");
        const variant = await parseJsonSafe(variantRes, "show_product_variant");
        const shipping = await parseJsonSafe(shipRes, "show_product_shipping_info");
        const other = await parseJsonSafe(otherRes, "show_product_other_details");
        const combos = await parseJsonSafe(comboRes, "show_product_variants");

        // Attributes: tolerate 404 (treat as empty)
        let attrs: any[] = [];
        if (attrRes.status === 404) {
          attrs = [];
        } else {
          try {
            attrs = await parseJsonSafe(attrRes, "show_product_attributes");
          } catch (e) {
            console.warn("Attributes load warning:", e);
            attrs = [];
          }
        }

        // Primary form data
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

        // Prefill temp strings
        setTempMetaKeywords(Array.isArray(seo.meta_keywords) ? seo.meta_keywords.join(", ") : "");
        setTempCustomTags(Array.isArray(seo.custom_tags) ? seo.custom_tags.join(", ") : "");
        setTempGroupedFilters(Array.isArray(seo.grouped_filters) ? seo.grouped_filters.join(", ") : "");
        setTempSizes(Array.isArray(variant.sizes) ? variant.sizes.join(", ") : "");
        setTempColorVariants(Array.isArray(variant.color_variants) ? variant.color_variants.join(", ") : "");
        setTempMaterialType(Array.isArray(variant.material_types) ? variant.material_types.join(", ") : "");
        setTempAddOnOptions(Array.isArray(variant.add_on_options) ? variant.add_on_options.join(", ") : "");
        setTempShippingClass(shipping.shipping_class || "");
        setTempVariantCombinations(
          Array.isArray(combos.variant_combinations)
            ? combos.variant_combinations.map((c: any) => `${c.description}::${c.price_override}`).join(" | ")
            : ""
        );

        // Images (preserve & display) — keep ALL existing, no directory trimming
        const existingArray = Array.isArray(other.images) ? other.images : other.images ? [other.images] : [];
        const displayUrls = existingArray.map((p: string) => urlForDisplay(p));
        setPreviewImages(
          displayUrls.map((p: string) => ({
            src: p,
            kind: "url" as const,
            file: null,
          }))
        );

        if (other.subcategory_ids?.length > 0) setSelectedSubcategories(other.subcategory_ids);

        // Attributes (normalize)
        if (Array.isArray(attrs)) {
          const normalized: CustomAttribute[] = attrs.map((a: any) => ({
            id: String(a?.id || crypto.randomUUID()),
            name: String(a?.name || ""),
            options: Array.isArray(a?.options)
              ? a.options.map((o: any) => ({
                  id: String(o?.id || crypto.randomUUID()),
                  label: String(o?.label || ""),
                  price_delta: typeof o?.price_delta === "number" ? o.price_delta : o?.price_delta ? parseFloat(o.price_delta) : 0,
                  is_default: !!o?.is_default,
                  image_id: o?.image_id || null,
                  _image_file: null,
                  _image_preview: o?.image_url ? urlForDisplay(o.image_url) : null,
                  image: null,
                }))
              : [],
          }));
          setCustomAttributes(normalized);
        } else {
          setCustomAttributes([]);
        }
      } catch (err: any) {
        toast.error("❌ Failed to load product details");
        console.error("Fetch product detail error:", err);
      }
    };

    fetchDetails();
  }, [productId]);

  // Static lists (categories/subcategories)
  useEffect(() => {
    if (!FRONTEND_KEY) {
      console.warn("NEXT_PUBLIC_FRONTEND_KEY missing.");
      toast.warn("Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY and restart.");
      return;
    }
    const fetchData = async () => {
      try {
        const [catRes, subRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey()),
          fetch(`${API_BASE_URL}/api/show-subcategories/`, withFrontendKey()),
        ]);
        const catData = await parseJsonSafe(catRes, "show-categories");
        const subData = await parseJsonSafe(subRes, "show-subcategories");
        setCategories(Array.isArray(catData) ? catData : []);
        setSubcategories(Array.isArray(subData) ? subData : []);
      } catch (e) {
        toast.error("Failed to load categories/subcategories.");
        console.error(e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => setIsEditMode(!!productId), [productId]);

  // Auto-set category if a subcategory is preselected
  useEffect(() => {
    if (formData.subcategory && !formData.category) {
      const selectedSub = subcategories.find((s) => s.id?.toString() === formData.subcategory?.toString());
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

  // Stock status helper
  useEffect(() => {
    const qty = parseInt(formData.stockQuantity);
    const alert = parseInt(formData.lowStockAlert);
    let status = formData.stockStatus;
    if (!isNaN(qty) && !isNaN(alert)) {
      if (qty === 0) status = "Out Of Stock";
      else if (qty <= alert) status = "Low Stock";
      else status = "In Stock";
      setFormData((prev: any) => ({ ...prev, stockStatus: status }));
    }
  }, [formData.stockQuantity, formData.lowStockAlert]);

  // Auto SKU on add
  useEffect(() => {
    const generateSku = async () => {
      if (!formData.title.trim() || !formData.subcategory || isEditMode) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/generate-product-id/`,
          withFrontendKey({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formData.title,
              subcategory_id: formData.subcategory,
            }),
          })
        );
        const data = await parseJsonSafe(res, "generate-product-id");
        if (data?.product_id) setFormData((prev: any) => ({ ...prev, sku: data.product_id }));
      } catch (err) {
        console.error("Failed to generate product ID:", err);
      }
    };
    generateSku();
  }, [formData.title, formData.subcategory, isEditMode]);

  useEffect(() => setIsMounted(true), []);

  // Revoke blob URLs
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
    (e.target as any).value = "";
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

  // ======= Attribute helpers =======
  const addAttribute = () => {
    setCustomAttributes((prev) => [...prev, { id: crypto.randomUUID(), name: "", options: [] }]);
  };

  const removeAttribute = (attrId: string) => {
    setCustomAttributes((prev) => prev.filter((a) => a.id !== attrId));
  };

  const updateAttribute = (attrId: string, patch: Partial<CustomAttribute>) => {
    setCustomAttributes((prev) => prev.map((a) => (a.id === attrId ? { ...a, ...patch } : a)));
  };

  const addOption = (attrId: string) => {
    setCustomAttributes((prev) =>
      prev.map((a) =>
        a.id === attrId
          ? {
              ...a,
              options: [
                ...a.options,
                {
                  id: crypto.randomUUID(),
                  label: "",
                  price_delta: 0,
                  is_default: a.options.length === 0,
                  _image_file: null,
                  _image_preview: null,
                  image: null,
                  image_id: null,
                },
              ],
            }
          : a
      )
    );
  };

  const removeOption = (attrId: string, optId: string) => {
    setCustomAttributes((prev) =>
      prev.map((a) => (a.id === attrId ? { ...a, options: a.options.filter((o) => o.id !== optId) } : a))
    );
  };

  const updateOption = (attrId: string, optId: string, patch: Partial<AttributeOption>) => {
    setCustomAttributes((prev) =>
      prev.map((a) =>
        a.id === attrId
          ? {
              ...a,
              options: a.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)),
            }
          : a
      )
    );
  };

  const setDefaultOption = (attrId: string, optId: string) => {
    setCustomAttributes((prev) =>
      prev.map((a) =>
        a.id === attrId
          ? {
              ...a,
              options: a.options.map((o) =>
                o.id === optId ? { ...o, is_default: true, price_delta: 0 } : { ...o, is_default: false }
              ),
            }
          : a
      )
    );
  };

  const handleOptionImageChange = (attrId: string, optId: string, file: File | null) => {
    if (!file) {
      return updateOption(attrId, optId, {
        _image_file: null,
        _image_preview: null,
        image: null,
        image_id: null,
      });
    }
    const preview = URL.createObjectURL(file);
    updateOption(attrId, optId, {
      _image_file: file,
      _image_preview: preview,
      image_id: null,
    });
  };
  // =================================

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
    toastId = toast.loading(isEditMode ? "Updating product..." : "Saving product...");

    // Only NEW images: files or data URLs. Do NOT fetch remote URLs in edit mode.
    const newImagesBase64: string[] = [];
    for (const img of previewImages) {
      if (img.kind === "file" && img.file) newImagesBase64.push(await fileToBase64(img.file));
      else if (typeof img.src === "string" && img.src.startsWith("data:image/")) newImagesBase64.push(img.src);
    }
    const hasNewImages = newImagesBase64.length > 0;

    const cleanCommaArray = (val: string) =>
      String(val || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    const parsedCombinations = String(tempVariantCombinations || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [description, price] = entry.split("::").map((v) => v.trim());
        return { description, price_override: parseFloat(price) || 0 };
      });

    // Build attributes payload (preserve image_id when unchanged; send base64 if replaced)
    const attrsForPayload: any[] = [];
    for (const a of customAttributes) {
      const opts: any[] = [];
      for (const o of a.options) {
        let imageBase64 = o.image || null;
        let imageId = o.image_id || null;
        if (o._image_file) {
          imageBase64 = await fileToBase64(o._image_file);
          imageId = null;
        }
        opts.push({
          id: o.id,
          label: o.label,
          price_delta: Number.isFinite(o.price_delta) ? o.price_delta : 0,
          is_default: !!o.is_default,
          image_id: imageId,  // keep existing image when not replaced
          image: imageBase64, // base64 only when changed
        });
      }
      if (opts.length > 0 && !opts.some((x) => x.is_default)) {
        opts[0].is_default = true;
        opts[0].price_delta = 0;
      }
      attrsForPayload.push({ id: a.id, name: a.name, options: opts });
    }

    const commonFields: any = {
      name: formData.title,
      description: formData.description,
      brand_title: formData.brand,
      price: parseFloat(formData.normalPrice) || 0,
      discounted_price: parseFloat(formData.discountedPrice) || 0,
      tax_rate: parseFloat(formData.taxRate) || 0,
      price_calculator: (formData as any).price_calculator ?? formData.priceCalculator,
      video_url: formData.videoUrl,
      fabric_finish: formData.fabricFinish,
      status: "active",
      quantity: parseInt(formData.stockQuantity) || 0,
      low_stock_alert: parseInt(formData.lowStockAlert) || 0,
      stock_status: formData.stockStatus || "In Stock",
      category_ids: selectedCategories,
      subcategory_ids: finalSubcategoryIds,
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
      customAttributes: attrsForPayload,   // ✅ ensure this is sent on edit
    };

    let res: Response;
    if (isEditMode) {
      const payload: any = {
        product_ids: [formData.sku || productId],
        ...commonFields,
      };
      if (hasNewImages) {
        payload.force_replace_images = true;
        payload.images = newImagesBase64;
      } else {
        payload.force_replace_images = false; // leave existing gallery untouched
      }
      res = await fetch(
        `${API_BASE_URL}/api/edit-product/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    } else {
      const payload = { ...commonFields, images: newImagesBase64, force_replace_images: true };
      res = await fetch(
        `${API_BASE_URL}/api/save-product/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    }

    let result: any = {};
    try { result = await res.clone().json(); } catch {}

    toast.dismiss(toastId);
    if (res.ok) {
      toast.success(isEditMode ? "Product updated successfully!" : "Product saved successfully!");
      onClose?.();
    } else {
      toast.error(result?.error || `Failed to ${isEditMode ? "update" : "save"} product.`);
    }
  } catch (err: any) {
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
        className="bg-white text-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-y-auto p-6 sm:p-8 flex flex-col sm:flex-row"
        role="dialog"
        aria-modal="true"
      >
        {/* Left: gallery */}
        <div className="hidden sm:block sm:w-1/2 pr-0 sm:pr-6 h-[420px] shrink-0">
          {previewImages.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-video w-full overflow-hidden rounded-lg shadow-lg h-[280px]">
                <img
                  src={previewImages[0].src}
                  alt="Product Preview"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => openPreviewAt(0)}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/images/default.jpg";
                  }}
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
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/images/default.jpg";
                      }}
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

        {/* Right: form */}
        <div className="w-full sm:w-1/2 h-full overflow-y-auto">
          <header className="flex justify-between items-center border-b border-gray-300 pb-3 mb-6 sticky top-0 bg-white z-10">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide text-[#8B1C1C]">
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
            {/* Basic Info */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Basic Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                {errors.title && <p className="text-red-600 sm:col-span-2">{errors.title}</p>}

                <textarea
                  name="description"
                  placeholder="Description (Rich Text)"
                  className={`input-primary col-span-1 sm:col-span-2 h-24 resize-y ${errors.description ? "border-red-600" : ""}`}
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
                {errors.description && <p className="text-red-600 sm:col-span-2">{errors.description}</p>}

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
                          setFormData((prev: any) => ({
                            ...prev,
                            category: selectedId,
                            subcategory: "",
                          }));
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
                              setFormData((prev: any) => ({
                                ...prev,
                                category: matchedCatIds[0] || "",
                              }));
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

                {errors.subcategory && <p className="text-red-600 sm:col-span-2">{errors.subcategory}</p>}

                <input
                  name="brand"
                  type="text"
                  placeholder="Brand / Vendor"
                  className={`input-primary ${errors.brand ? "border-red-600" : ""}`}
                  value={formData.brand}
                  onChange={handleChange}
                  required
                />
                {errors.brand && <p className="text-red-600 sm:col-span-2">{errors.brand}</p>}
              </div>
            </section>

            {/* Images & Media */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Images & Media
              </h3>
              <div className="grid gap-4 sm:gap-6">
                <div>
                  <label htmlFor="file-upload" className="btn-primary inline-block cursor-pointer text-center">
                    Choose Image(s)
                  </label>
                  <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
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

            {/* SEO & Metadata */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                SEO & Metadata
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <input name="metaTitle" type="text" placeholder="Meta Title" className="input-primary" value={formData.metaTitle} onChange={handleChange} />
                <textarea name="metaDescription" placeholder="Meta Description" className="input-primary h-20 resize-y" value={formData.metaDescription} onChange={handleChange} />
                <input
                  name="metaKeywords"
                  type="text"
                  placeholder="Meta Keywords (comma-separated)"
                  className="input-primary"
                  value={tempMetaKeywords}
                  onChange={(e) => setTempMetaKeywords(e.target.value)}
                />
                <input name="ogTitle" type="text" placeholder="Open Graph Title" className="input-primary" value={formData.ogTitle} onChange={handleChange} />
                <textarea name="ogDescription" placeholder="Open Graph Description" className="input-primary h-20 resize-y" value={formData.ogDescription} onChange={handleChange} />
                <input name="ogImage" type="url" placeholder="Open Graph Image URL" className="input-primary" value={formData.ogImage} onChange={handleChange} />
                <input name="canonicalUrl" type="url" placeholder="Canonical URL" className="input-primary" value={formData.canonicalUrl} onChange={handleChange} />
                <textarea
                  name="jsonLdSchema"
                  placeholder="JSON-LD Schema (Structured Data)"
                  className="input-primary h-24 resize-y font-mono text-sm"
                  value={formData.jsonLdSchema}
                  onChange={handleChange}
                />
              </div>
            </section>

            {/* Pricing */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Pricing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <input name="normalPrice" type="number" placeholder="Normal Price" className="input-primary" value={formData.normalPrice} onChange={handleChange} />
                <input name="discountedPrice" type="number" placeholder="Discounted Price" className="input-primary" value={formData.discountedPrice} onChange={handleChange} />
                <input name="taxRate" type="number" placeholder="Tax Rate (%)" className="input-primary" value={formData.taxRate} onChange={handleChange} />
                <input name="priceCalculator" type="text" placeholder="Price Calculator" className="input-primary" value={formData.priceCalculator} onChange={handleChange} />
              </div>
            </section>

            {/* Inventory */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Inventory
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <input name="stockQuantity" type="number" placeholder="Stock Quantity" className="input-primary" value={formData.stockQuantity} onChange={handleChange} />
                <input name="lowStockAlert" type="number" placeholder="Low Stock Alert" className="input-primary" value={formData.lowStockAlert} onChange={handleChange} />
                <input name="stockStatus" type="text" placeholder="Stock Status" className="input-primary" value={formData.stockStatus} onChange={handleChange} />
              </div>
            </section>

            {/* Product Variations */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Product Variations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <input name="size" type="text" placeholder="Enter sizes (comma-separated)" className="input-primary" value={tempSizes} onChange={(e) => setTempSizes(e.target.value)} />
                <input
                  name="colorVariants"
                  type="text"
                  placeholder="Enter color variants (comma-separated)"
                  className="input-primary"
                  value={tempColorVariants}
                  onChange={(e) => setTempColorVariants(e.target.value)}
                />
                <input
                  name="materialType"
                  type="text"
                  placeholder="Enter material types (comma-separated)"
                  className="input-primary"
                  value={tempMaterialType}
                  onChange={(e) => setTempMaterialType(e.target.value)}
                />
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
                <input
                  name="addOnOptions"
                  type="text"
                  placeholder="Add-On Options (comma-separated)"
                  className="input-primary"
                  value={tempAddOnOptions}
                  onChange={(e) => setTempAddOnOptions(e.target.value)}
                />
                <input
                  name="variantCombinations"
                  type="text"
                  placeholder='Use format: "Desc::Price | Desc2::Price2"'
                  className="input-primary"
                  value={tempVariantCombinations}
                  onChange={(e) => setTempVariantCombinations(e.target.value)}
                />
              </div>
            </section>

            {/* Custom Attributes */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-semibold border-b border-gray-200 pb-2 text-[#8B1C1C] flex-1">
                  Custom Attributes
                </h3>
                <button type="button" onClick={addAttribute} className="btn-primary text-xs px-3 py-2 flex items-center gap-2 me-1">
                  <span className="text-sm leading-none">+</span>
                  Add Attribute
                </button>
              </div>

              <div className="space-y-6">
                {customAttributes.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No custom attributes yet. Click "Add Attribute" to create one.</p>
                  </div>
                )}

                {customAttributes.map((attr, attrIndex) => (
                  <div key={attr.id} className="border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {/* Attribute Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 bg-[#8B1C1C] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                            {attrIndex + 1}
                          </div>
                          <input
                            type="text"
                            className="input-primary flex-1 bg-white"
                            placeholder="Attribute name (e.g., Size, Color, Print Type)"
                            value={attr.name}
                            onChange={(e) => updateAttribute(attr.id, { name: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttribute(attr.id)}
                          className="btn-primary bg-red-600 hover:bg-red-700 text-xs px-2 py-1 w-full sm:w-auto"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Attribute Options */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-700 text-sm">Options ({attr.options.length})</h4>
                        <button
                          type="button"
                          onClick={() => addOption(attr.id)}
                          className="btn-primary bg-green-600 hover:bg-green-700 text-sm px-3 py-2 flex items-center gap-1"
                        >
                          <span className="text-sm">+</span>
                          Add Option
                        </button>
                      </div>

                      <div className="space-y-4">
                        {attr.options.map((opt, optIndex) => (
                          <div key={opt.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/30 hover:bg-gray-50/50 transition-colors">
                            {/* Option Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                  Option {optIndex + 1}
                                </span>
                                {opt.is_default && (
                                  <span className="text-xs font-medium text-[#8B1C1C] bg-red-100 px-2 py-1 rounded">Default</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeOption(attr.id, opt.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                title="Remove option"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {/* Option Content */}
                            <div className="space-y-4">
                              <div className="flex items-start gap-4">
                                {/* Image section */}
                                <div className="space-y-2">
                                  <label className="block text-xs font-medium text-gray-600">Option Image</label>
                                  <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-white flex items-center justify-center shrink-0">
                                      {opt._image_preview ? (
                                        <img
                                          src={opt._image_preview}
                                          alt={opt.label || "option"}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = "/images/default.jpg";
                                          }}
                                        />
                                      ) : (
                                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                          />
                                        </svg>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 h-20">
                                      <label className="btn-primary cursor-pointer py-2 px-3 text-xs text-center">
                                        {opt._image_preview ? "Change" : "Upload"}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const f = (e.target.files && e.target.files[0]) || null;
                                            handleOptionImageChange(attr.id, opt.id, f);
                                          }}
                                        />
                                      </label>

                                      {opt._image_preview && (
                                        <button
                                          type="button"
                                          className="text-xs text-red-600 hover:text-red-700 underline"
                                          onClick={() => handleOptionImageChange(attr.id, opt.id, null)}
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Default radio */}
                                <div className="flex-1 flex justify-end">
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                      <input
                                        type="radio"
                                        name={`default-${attr.id}`}
                                        checked={!!opt.is_default}
                                        onChange={() => setDefaultOption(attr.id, opt.id)}
                                        className="sr-only"
                                      />
                                      <div
                                        className={`w-4 h-4 rounded-full border-2 transition-colors ${
                                          opt.is_default ? "border-[#8B1C1C] bg-[#8B1C1C]" : "border-gray-300 bg-white"
                                        }`}
                                      >
                                        {opt.is_default && (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">Set as default</span>
                                  </label>
                                </div>
                              </div>

                              {/* Label & price */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Option Label *</label>
                                  <input
                                    type="text"
                                    className="input-primary w-full"
                                    placeholder="e.g., Single Sided, Large, Red"
                                    value={opt.label}
                                    onChange={(e) => updateOption(attr.id, opt.id, { label: e.target.value })}
                                  />
                                </div>

                                <div>
                                  {!opt.is_default ? (
                                    <>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Price Adjustment (AED)</label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          step="0.01"
                                          className="input-primary w-full pl-8"
                                          placeholder="0.00"
                                          value={opt.price_delta}
                                          onChange={(e) =>
                                            updateOption(attr.id, opt.id, {
                                              price_delta: parseFloat(e.target.value || ""),
                                            })
                                          }
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">+</span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Price Adjustment</label>
                                      <div className="input-primary bg-gray-100 text-gray-500 flex items-center justify-center">No adjustment</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {attr.options.length === 0 && (
                          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg bg-gray-50/50">
                            <p className="text-gray-500 text-sm">No options yet. Click "Add Option" to create the first one.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Additional Metadata */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Additional Metadata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <input
                  name="customTags"
                  type="text"
                  placeholder="Custom Tags (comma-separated)"
                  className="input-primary"
                  value={tempCustomTags}
                  onChange={(e) => setTempCustomTags(e.target.value)}
                />
                <input
                  name="groupedFilters"
                  type="text"
                  placeholder="Grouped Filters (comma-separated)"
                  className="input-primary"
                  value={tempGroupedFilters}
                  onChange={(e) => setTempGroupedFilters(e.target.value)}
                />
              </div>
            </section>

            {/* Shipping & Processing */}
            <section>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-gray-200 pb-2 text-[#8B1C1C]">
                Shipping & Processing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <input
                  name="processingTime"
                  type="text"
                  placeholder="Processing Time"
                  className="input-primary"
                  value={formData.processingTime}
                  onChange={handleChange}
                />
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
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>

      {isPreviewOpen && previewImages.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center" role="dialog" aria-modal="true" onClick={closePreview}>
          <div className="relative max-w-5xl w-[92vw] h-[82vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImages[activePreviewIndex].src}
              alt={`Preview ${activePreviewIndex + 1}`}
              className="w-full h-full object-contain select-none"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/images/default.jpg";
              }}
            />
            <button onClick={closePreview} aria-label="Close preview" className="absolute top-2 right-2 text-white text-3xl leading-none">
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
          color: #8b1c1c;
        }
      `}</style>
    </div>
  );
};

export default Modal;
