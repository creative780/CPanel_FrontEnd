"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../../utils/api";

//
// ---- Frontend key helper (required for FrontendOnlyPermission) ----
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};
//
// -------------------------------------------------------------------

type OrderStatus = "Pending" | "Processing" | "Shipped" | "Completed";

type OrderFormData = {
  customer: string;
  items: number;
  total: string;
  status: OrderStatus;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  notes?: string;
  date?: string;
};

type OrderPayload = {
  user_name: string;
  delivery: {
    name: string;
    email: string;
    phone: string;
    street_address: string;
    city: string;
    zip_code: string;
    instructions: string;
  };
  status: OrderStatus;
  total_price: string;
  notes: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    selected_attributes?: Record<string, string>; // attrId -> optionId
  }[];
};

type Product = {
  id: string | number;
  name: string;
  price: string | number;
  image?: string;
  subcategory?: { id: string | number | null; name: string | null };
  stock_status?: string | null;
  stock_quantity?: number | null;
  printing_methods?: string[];
};

// ----- Attribute Types (match product detail page) -----
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
// -------------------------------------------------------

interface OrderFormProps {
  onClose: () => void;
  onSave: (order: OrderPayload) => void;
}

export default function OrderForm({ onClose, onSave }: OrderFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Selected product state now also tracks editable unitPrice
  const [selectedProducts, setSelectedProducts] = useState<{
    [id: string]: { quantity: number; unitPrice: number };
  }>({});

  // Per-product attributes + selections
  const [attributesByProduct, setAttributesByProduct] = useState<
    Record<string, CustomAttribute[]>
  >({});
  const [selectedAttrByProduct, setSelectedAttrByProduct] = useState<
    Record<string, Record<string, string>>
  >({});

  // Warn once if key missing
  const warnedMissingKey = useRef(false);
  useEffect(() => {
    if (!FRONTEND_KEY && !warnedMissingKey.current) {
      warnedMissingKey.current = true;
      console.warn(
        "NEXT_PUBLIC_FRONTEND_KEY is empty; requests may be rejected (401)."
      );
      toast.warn(
        "Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY to avoid 401."
      );
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/show-product/`,
          withFrontendKey({
            headers: { "Content-Type": "application/json" },
            method: "GET",
          })
        );

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          setProducts([]);
          setErrorMsg(`Fetch failed (${res.status}).`);
          console.error("show-product non-OK:", res.status, txt);
          const msg =
            res.status === 401
              ? "Products fetch failed (401). Check X-Frontend-Key."
              : `Products fetch failed (${res.status}).`;
          toast.error(msg);
          return;
        }

        const data = await res.json();
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          "detail" in data
        ) {
          setProducts([]);
          const msg =
            (data as any).detail || "Not authorized to fetch products.";
          setErrorMsg(String(msg));
          toast.error(String(msg));
          return;
        }

        const maybeArray = Array.isArray(data)
          ? data
          : data && (data as any).products;
        if (Array.isArray(maybeArray)) {
          setProducts(maybeArray as Product[]);
          if (maybeArray.length === 0) {
            setErrorMsg("No products returned by API.");
            toast.info("No products found.");
          }
        } else {
          setProducts([]);
          setErrorMsg("Unexpected API response shape.");
          toast.error("Unexpected products response. Check API payload.");
        }
      } catch (err: any) {
        console.error("Failed to fetch products", err);
        setProducts([]);
        setErrorMsg("Network or parsing error while fetching products.");
        toast.error("Could not load products (network or JSON error).");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const [formData, setFormData] = useState<OrderFormData>({
    customer: "",
    items: 1,
    total: "",
    status: "Pending",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip_code: "",
    notes: "",
    date: today,
  });

  // ---- Attribute helpers ----

  const fetchProductAttributes = async (productId: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/show_product_attributes/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        })
      );
      const raw = res.ok ? await res.json() : [];
      const attrs: CustomAttribute[] = (Array.isArray(raw) ? raw : [])
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          options: (a.options || []).map((o: any) => ({
            id: o.id,
            label: o.label,
            image_url: absolutize(o.image_url),
            price_delta:
              o.price_delta === null || o.price_delta === undefined
                ? null
                : Number(o.price_delta),
            is_default: !!o.is_default,
          })),
        }))
        .filter((a: CustomAttribute) => (a.options || []).length > 0);

      setAttributesByProduct((prev) => ({ ...prev, [productId]: attrs }));

      // Set defaults (is_default or first option)
      const defaults: Record<string, string> = {};
      attrs.forEach((a) => {
        const def = a.options.find((o) => o.is_default) || a.options[0];
        if (def) defaults[a.id] = def.id;
      });
      setSelectedAttrByProduct((prev) => ({ ...prev, [productId]: defaults }));
    } catch (e) {
      console.warn("Failed to load attributes for", productId, e);
      setAttributesByProduct((prev) => ({ ...prev, [productId]: [] }));
    }
  };

  const absolutize = (src?: string | null) => {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    const base = API_BASE_URL.replace(/\/$/, "");
    const path = String(src).replace(/^\/+/, "");
    return `${base}/${path}`;
  };

  const setAttrSelection = (
    productId: string,
    attrId: string,
    optionId: string
  ) => {
    setSelectedAttrByProduct((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [attrId]: optionId },
    }));
  };

  const getAttrDeltaSum = (productId: string): number => {
    const attrs = attributesByProduct[productId] || [];
    const selection = selectedAttrByProduct[productId] || {};
    let sum = 0;
    for (const a of attrs) {
      const sel = selection[a.id];
      if (!sel) continue;
      const opt = a.options.find((o) => o.id === sel);
      if (!opt) continue;
      const d = Number(opt.price_delta ?? 0);
      if (Number.isFinite(d)) sum += d;
    }
    return sum;
  };

  // Build selected items from state (uses editable unitPrice + attribute deltas)
  const selectedItems = useMemo(() => {
    return Object.entries(selectedProducts).map(
      ([product_id, { quantity, unitPrice }]) => {
        const safeUnit = Number.isFinite(unitPrice) ? unitPrice : 0;
        const delta = getAttrDeltaSum(product_id);
        const finalUnit = safeUnit + delta;
        return {
          product_id,
          quantity,
          unit_price: finalUnit,
          total_price: finalUnit * quantity,
          selected_attributes: selectedAttrByProduct[product_id] || {},
        };
      }
    );
  }, [selectedProducts, selectedAttrByProduct, attributesByProduct]);

  // Compute total from selected items
  const computedTotal = useMemo(() => {
    return selectedItems.reduce(
      (acc, item) => acc + (item.total_price || 0),
      0
    );
  }, [selectedItems]);

  // Keep the visible total in sync (read-only display)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, total: computedTotal.toFixed(2) }));
  }, [computedTotal]);

  const handleAddSelectedProduct = async (productId: string) => {
    if (!productId) return;
    if (selectedProducts[productId]) return; // already added
    const prod = products.find((p) => String(p.id) === String(productId));
    const defaultPrice = parseFloat(String(prod?.price ?? "0")) || 0;
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: { quantity: 1, unitPrice: defaultPrice },
    }));
    // load attributes for that product
    await fetchProductAttributes(productId);
  };

  const handleSubmit = async () => {
    if (!formData.customer.trim()) {
      toast.error("Please enter the customer name.");
      return;
    }
    if (!formData.address?.trim()) {
      toast.error("Please enter the address.");
      return;
    }
    if (!formData.city?.trim()) {
      toast.error("Please enter the city.");
      return;
    }
    if (!formData.zip_code?.trim()) {
      toast.error("Please enter the zip code.");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Please select at least one product.");
      return;
    }

    const payload: OrderPayload = {
      user_name: formData.customer,
      delivery: {
        name: formData.customer,
        email: formData.email || "NA",
        phone: formData.phone || "NA",
        street_address: formData.address!,
        city: formData.city!,
        zip_code: formData.zip_code!,
        instructions: formData.notes || "",
      },
      status: formData.status,
      total_price: computedTotal.toFixed(2),
      notes: formData.notes || "",
      items: selectedItems,
    };

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/save-order/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Order saved successfully!");
        onSave(payload);
        onClose();
      } else {
        const msg =
          res.status === 401
            ? "Save failed (401). Check X-Frontend-Key."
            : (result as any)?.error ||
              `Failed to save the order. (${res.status})`;
        toast.error(msg);
      }
    } catch (error) {
      console.error("Failed to save order:", error);
      toast.error("Failed to save the order. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-blur-400 bg-opacity-40 backdrop-blur-md flex items-center justify-center px-4"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Header */}
        <header className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-2xl font-extrabold text-[#891F1A]">
            Add New Order
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-red-600 text-2xl font-bold focus:outline-none"
          >
            &times;
          </button>
        </header>

        {/* Form */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Customer Name *"
            value={formData.customer}
            onChange={(e) =>
              setFormData({ ...formData, customer: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          <input
            type="tel"
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          <textarea
            placeholder="Street Address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
            rows={3}
          />

          <input
            type="text"
            placeholder="City *"
            value={formData.city || ""}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          <input
            type="text"
            placeholder="Zip Code *"
            value={formData.zip_code || ""}
            onChange={(e) =>
              setFormData({ ...formData, zip_code: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          {/* Products */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#891F1A]">
                Add Products
              </h3>
              <span className="text-xs text-gray-500">
                {loading
                  ? "Loading..."
                  : errorMsg
                  ? "Error"
                  : `${products.length} product${
                      products.length === 1 ? "" : "s"
                    }`}
              </span>
            </div>

            <div className="flex gap-2 items-center">
              <select
                className="w-full border rounded px-3 py-2"
                onChange={async (e) => {
                  const productId = e.target.value;
                  if (productId) await handleAddSelectedProduct(productId);
                  e.target.value = "";
                }}
                defaultValue=""
                disabled={loading || !!errorMsg || products.length === 0}
              >
                <option value="" disabled>
                  {loading
                    ? "Loading products..."
                    : errorMsg
                    ? "Unable to load products"
                    : products.length === 0
                    ? "No products found"
                    : "Select a product"}
                </option>

                {Array.isArray(products) &&
                  products.map((product) => (
                    <option key={String(product.id)} value={String(product.id)}>
                      {product.name} - ${String(product.price)}
                    </option>
                  ))}
              </select>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600">
                {errorMsg}
                {errorMsg.includes("401")
                  ? " Ensure NEXT_PUBLIC_FRONTEND_KEY is set."
                  : ""}
              </p>
            )}
          </div>

          {/* Selected products list with editable price + ATTRIBUTE SELECTION */}
          {Object.entries(selectedProducts).map(
            ([productId, { quantity, unitPrice }]) => {
              const product = products.find(
                (p) => String(p.id) === String(productId)
              );
              if (!product) return null;

              const deltaSum = getAttrDeltaSum(productId);
              const effectiveUnit =
                (Number.isFinite(unitPrice) ? unitPrice : 0) + deltaSum;
              const lineTotal = effectiveUnit * (quantity || 0);

              const attrs = attributesByProduct[productId] || [];

              return (
                <div
                  key={productId}
                  className="flex flex-col gap-3 border rounded px-3 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-gray-500">
                        Default: ${String(product.price)} • ID:{" "}
                        {String(product.id)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const updated = { ...selectedProducts };
                        delete updated[productId];
                        setSelectedProducts(updated);

                        // cleanup attrs state
                        setAttributesByProduct((prev) => {
                          const cp = { ...prev };
                          delete cp[productId];
                          return cp;
                        });
                        setSelectedAttrByProduct((prev) => {
                          const cp = { ...prev };
                          delete cp[productId];
                          return cp;
                        });
                      }}
                      className="ml-3 text-red-600 font-bold text-lg"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Editable base price & qty */}
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-gray-600">Quantity</span>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => {
                          const qty = Math.max(
                            1,
                            parseInt(e.target.value || "1", 10)
                          );
                          setSelectedProducts((prev) => ({
                            ...prev,
                            [productId]: { ...prev[productId], quantity: qty },
                          }));
                        }}
                        className="border rounded px-2 py-2"
                      />
                    </label>

                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-gray-600">
                        Base Unit Price ($)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={Number.isFinite(unitPrice) ? unitPrice : 0}
                        onChange={(e) => {
                          const v = e.target.value;
                          const priceNum = Math.max(0, parseFloat(v || "0"));
                          setSelectedProducts((prev) => ({
                            ...prev,
                            [productId]: {
                              ...prev[productId],
                              unitPrice: priceNum,
                            },
                          }));
                        }}
                        className="border rounded px-2 py-2"
                      />
                    </label>

                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-gray-600">Line Total ($)</span>
                      <input
                        type="text"
                        readOnly
                        value={lineTotal.toFixed(2)}
                        className="border rounded px-2 py-2 bg-gray-50"
                      />
                    </label>
                  </div>

                  {/* Attribute selection UI (same behavior as product detail) */}
                  {attrs.length > 0 && (
                    <div className="space-y-4 pt-1">
                      <p className="text-xs text-gray-500">
                        Attribute adjustments: {deltaSum >= 0 ? "+" : ""}
                        {deltaSum.toFixed(2)} per unit → Effective Unit: $
                        {effectiveUnit.toFixed(2)}
                      </p>

                      {attrs.map((attr) => {
                        const selection =
                          selectedAttrByProduct[productId] || {};
                        return (
                          <div key={attr.id} className="space-y-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {attr.name}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {attr.options.map((opt) => {
                                const selected = selection[attr.id] === opt.id;
                                const delta = Number(opt.price_delta ?? 0);
                                const positive = delta > 0;
                                const negative = delta < 0;

                                return (
                                  <div key={opt.id} className="relative">
                                    {positive ? (
                                      <span className="absolute -top-2 -right-1 z-10 text-[10px] font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-700 border border-green-200">
                                        +{Math.round(delta)}$
                                      </span>
                                    ) : negative ? (
                                      <span className="absolute -top-2 -right-1 z-10 text-[10px] font-medium rounded-full px-2 py-0.5 bg-rose-100 text-[#7f1d1d] border border-rose-200">
                                        {Math.round(delta)}$
                                      </span>
                                    ) : null}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAttrSelection(
                                          productId,
                                          attr.id,
                                          opt.id
                                        )
                                      }
                                      className={`group w-20 rounded-lg border-2 bg-white text-center transition-all relative ${
                                        selected
                                          ? "border-red-600 shadow"
                                          : "border-gray-300 hover:border-gray-400"
                                      }`}
                                      aria-pressed={selected}
                                    >
                                      <div className="p-1">
                                        <div className="w-12 h-12 mx-auto rounded border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                                          {opt.image_url ? (
                                            <img
                                              src={opt.image_url}
                                              alt={opt.label}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                (
                                                  e.currentTarget as HTMLImageElement
                                                ).style.display = "none";
                                              }}
                                            />
                                          ) : (
                                            <svg
                                              className="w-4 h-4 text-gray-300"
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

                                      <div className="px-1 pb-2 relative">
                                        <p
                                          className={`text-xs font-medium ${
                                            selected
                                              ? "text-gray-900"
                                              : "text-gray-600"
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
          )}

          {/* Total (computed) */}
          <input
            type="text"
            placeholder="Total ($) *"
            value={formData.total}
            readOnly
            className="w-full px-4 py-3 border rounded-md bg-gray-50 focus:ring-2 focus:ring-[#891F1A]"
          />

          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as OrderStatus,
              })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          >
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Completed">Completed</option>
          </select>

          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
          />

          <textarea
            placeholder="Order Notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#891F1A]"
            rows={3}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onClose}
            className="bg-gray-200 text-black px-5 py-2 rounded hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary">
            Save Order
          </button>
        </div>
      </div>
    </div>
  );
}
