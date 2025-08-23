"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSideBar";
import AdminAuthGuard from "../../components/AdminAuthGaurd";
import { motion } from "framer-motion";
import axios, { AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  FaBoxOpen,
  FaTruck,
  FaCheck,
  FaClock,
  FaStickyNote,
  FaShoppingCart,
  FaUserAlt,
  FaSyncAlt,
} from "react-icons/fa";
import { API_BASE_URL } from "../../../utils/api";

// ---------- Types ----------
type AttributeOption = {
  id: string;
  label: string;
  image_id?: string | null;
  image_url?: string | null;
  price_delta: number;
  is_default: boolean;
};

type ProductAttribute = {
  id: string;
  name: string;
  options: AttributeOption[];
};

type OrderItem = {
  title: string;
  quantity: number;
  price: number;
  productId?: string;
};

type LoadedOrder = {
  id: string;
  date: string;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  items: OrderItem[];
  total: number;
  status: string;
  notes: string[];
};

// ---------- Axios with Frontend Key ----------
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();

const axiosWithKey = axios.create();
axiosWithKey.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  } else if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = AxiosHeaders.from(config.headers);
  }
  (config.headers as AxiosHeaders).set("X-Frontend-Key", FRONTEND_KEY);
  return config;
});

// ---------- helpers ----------
const toAbsUrl = (src?: string | null) => {
  if (!src) return "";
  if (/^https?:/i.test(src)) return src;
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = String(src).replace(/^\/+/, "");
  return `${base}/${path}`;
};

const norm = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

// Try to extract product IDs from multiple possible shapes of `found.item`
function extractIdsFlexible(found: any): string[] | null {
  const item = found?.item;

  if (Array.isArray(item?.ids) && item.ids.length) return item.ids.map(String);
  if (Array.isArray(item?.product_ids) && item.product_ids.length)
    return item.product_ids.map(String);
  if (Array.isArray(item?.productIds) && item.productIds.length)
    return item.productIds.map(String);

  if (Array.isArray(item?.items) && item.items.length) {
    const ids = item.items
      .map((x: any) => x?.product_id ?? x?.id ?? x?.productId)
      .filter(Boolean)
      .map(String);
    if (ids.length) return ids;
  }

  return null;
}

// Extract selected attributes mapping in flexible ways.
// Returns: { [productId]: { [attrId]: optionId } }
function extractSelectionsFlexible(
  found: any,
  idsAligned?: string[] | null
): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  const item = found?.item;

  // Case A: item.items = [{ product_id, selected_attributes }, ...]
  if (Array.isArray(item?.items)) {
    for (const it of item.items) {
      const pid = String(it?.product_id ?? it?.productId ?? it?.id ?? "");
      if (!pid) continue;
      if (
        it?.selected_attributes &&
        typeof it.selected_attributes === "object"
      ) {
        map[pid] = it.selected_attributes;
      }
    }
    if (Object.keys(map).length) return map;
  }

  // Case B: item.selected_attributes_map = { [productId]: { attrId: optionId } }
  if (
    item?.selected_attributes_map &&
    typeof item.selected_attributes_map === "object"
  ) {
    for (const [pid, sel] of Object.entries(item.selected_attributes_map)) {
      if (sel && typeof sel === "object")
        map[String(pid)] = sel as Record<string, string>;
    }
    if (Object.keys(map).length) return map;
  }

  // Case C: arrays aligned to ids/names: item.selected_attributes (array)
  // e.g., selected_attributes[i] corresponds to ids[i]
  if (
    Array.isArray(item?.selected_attributes) &&
    Array.isArray(idsAligned) &&
    idsAligned?.length
  ) {
    const arr = item.selected_attributes;
    for (let i = 0; i < Math.min(arr.length, idsAligned.length); i++) {
      const pid = String(idsAligned[i] || "");
      if (!pid) continue;
      const sel = arr[i];
      if (sel && typeof sel === "object")
        map[pid] = sel as Record<string, string>;
    }
    if (Object.keys(map).length) return map;
  }

  // Case D: nothing recognized
  return {};
}

// Fallback: build name→id map from /api/show-product/ then align by names[]
async function fallbackIdsByName(names: string[]): Promise<string[] | null> {
  try {
    const res = await axiosWithKey.get(`${API_BASE_URL}/api/show-product/`);
    const arr = Array.isArray(res.data) ? res.data : res.data?.products;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const byName = new Map<string, string>();
    const byNameNorm = new Map<string, string>();
    for (const p of arr) {
      const id = String(p.id);
      const name = String(p.name ?? "");
      if (name) {
        if (!byName.has(name)) byName.set(name, id);
        const n = norm(name);
        if (!byNameNorm.has(n)) byNameNorm.set(n, id);
      }
    }

    const ids: string[] = [];
    for (const title of names) {
      const exact = byName.get(String(title));
      const loose = byNameNorm.get(norm(title));
      ids.push(String(exact || loose || ""));
    }

    if (ids.some(Boolean)) return ids;
    return null;
  } catch {
    return null;
  }
}

// ---------- Component ----------
export default function OrderDetailPage() {
  const params = useParams();
  const orderId = (
    Array.isArray((params as any)?.orderId)
      ? (params as any).orderId[0]
      : (params as any)?.orderId
  ) as string;

  const [order, setOrder] = useState<LoadedOrder | null>(null);
  const [status, setStatus] = useState("");
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState("");

  // product_id -> attributes[]
  const [attributesByProduct, setAttributesByProduct] = useState<
    Record<string, ProductAttribute[]>
  >({});

  // product_id -> { attrId: optionId }
  const [selectedByProduct, setSelectedByProduct] = useState<
    Record<string, Record<string, string>>
  >({});

  const capitalizeStatus = (s: string): string => {
    const v = s?.toLowerCase();
    if (v === "pending") return "Pending";
    if (v === "processing") return "Processing";
    if (v === "shipped") return "Shipped";
    if (v === "completed") return "Completed";
    return "Pending";
  };

  const fetchProductAttributes = async (productId: string) => {
    if (!productId) return;
    try {
      const { data } = await axiosWithKey.post(
        `${API_BASE_URL}/api/show_product_attributes/`,
        { product_id: productId }
      );

      const normalized: ProductAttribute[] = (
        Array.isArray(data) ? data : []
      ).map((a: any) => ({
        id: a.id,
        name: a.name,
        options: (a.options || []).map((o: any) => ({
          id: o.id,
          label: o.label,
          image_id: o.image_id ?? null,
          image_url: toAbsUrl(o.image_url),
          price_delta:
            o.price_delta === null || o.price_delta === undefined
              ? 0
              : Number(o.price_delta),
          is_default: !!o.is_default,
        })),
      }));

      setAttributesByProduct((prev) => ({
        ...prev,
        [productId]: normalized,
      }));
    } catch (e) {
      setAttributesByProduct((prev) => ({ ...prev, [productId]: [] }));
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axiosWithKey.get(`${API_BASE_URL}/api/show-order/`);
        const orders = res.data?.orders || [];
        const found = orders.find((o: any) => o.orderID === orderId);

        if (!found) {
          setError("❌ Invalid order ID");
          return;
        }

        const names: string[] = found.item?.names || [];
        const count = Number(found.item?.count) || names.length || 1;
        const unitPrice = count > 0 ? (Number(found.total) || 0) / count : 0;

        let ids: string[] | null = extractIdsFlexible(found);
        if (!ids || ids.length === 0) {
          ids = await fallbackIdsByName(names);
        }
        if (!ids || ids.length !== names.length) {
          console.warn("Order items missing aligned product IDs.", {
            names,
            ids,
          });
        }

        const items: OrderItem[] = names.map((title: string, i: number) => ({
          title,
          quantity: 1,
          price: unitPrice,
          productId: ids?.[i] || undefined,
        }));

        // Parse selected attributes (if provided)
        const selectedMap = extractSelectionsFlexible(found, ids);

        const hydrated: LoadedOrder = {
          id: String(found.orderID),
          date: String(found.Date || "").split(" ")[0] || "",
          customer: {
            name: found.UserName || "N/A",
            email: found.email || "N/A",
            address: `${found.Address?.street || ""}, ${
              found.Address?.city || ""
            }, ${found.Address?.zip || ""}`,
          },
          items,
          total: Number(found.total) || 0,
          status: String(found.status || "pending"),
          notes: [`Order placed on ${found.Date}`].filter(Boolean),
        };

        setOrder(hydrated);
        setStatus(capitalizeStatus(hydrated.status));
        setSelectedByProduct(selectedMap);

        // Fetch attributes for rows that have productId
        const pids = items
          .map((it) => it.productId)
          .filter(Boolean) as string[];
        if (pids.length) {
          await Promise.all(pids.map((pid) => fetchProductAttributes(pid)));
        }
      } catch (err) {
        console.error(err);
        setError("❌ Failed to fetch order");
      }
    };

    if (orderId) fetchOrder();
  }, [orderId]);

  // Push status changes to backend
  useEffect(() => {
    if (!order || !status) return;
    if (status.toLowerCase() === order.status.toLowerCase()) return;

    const updateStatus = async () => {
      try {
        await axiosWithKey.put(`${API_BASE_URL}/api/edit-order/`, {
          order_id: order.id,
          status: status.toLowerCase(),
        });
        toast.success(`Status updated to ${status}`);
      } catch (err) {
        toast.error("❌ Failed to update order status");
      }
    };

    updateStatus();
  }, [status, order]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: [
          ...prev.notes,
          `${newNote} (added on ${new Date().toLocaleDateString()})`,
        ],
      };
    });
    setNewNote("");
  };

  const statusBadge = (s: string) => {
    const base =
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide";
    switch (s) {
      case "Pending":
        return (
          <span className={`${base} bg-yellow-100 text-yellow-700`}>
            <FaClock /> Pending
          </span>
        );
      case "Processing":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            <FaSyncAlt /> Processing
          </span>
        );
      case "Shipped":
        return (
          <span className={`${base} bg-indigo-100 text-indigo-700`}>
            <FaTruck /> Shipped
          </span>
        );
      case "Completed":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            <FaCheck /> Completed
          </span>
        );
      default:
        return (
          <span className={`${base} bg-gray-200 text-gray-700`}>Unknown</span>
        );
    }
  };

  // pickSelectedLabel: given a productId and attribute, find the chosen option.
  const pickSelectedLabel = (
    productId: string,
    attr: ProductAttribute
  ): { label: string; price_delta?: number } | null => {
    const chosenMap = selectedByProduct[productId] || {};
    const chosenOptId = chosenMap[attr.id];

    // 1) If we have a selection, use it
    if (chosenOptId) {
      const opt = (attr.options || []).find((o) => o.id === chosenOptId);
      if (opt) return { label: opt.label, price_delta: opt.price_delta };
    }
    // 2) Fallback to default
    const def = (attr.options || []).find((o) => o.is_default);
    if (def) return { label: def.label, price_delta: def.price_delta };
    // 3) Fallback to first option
    const first = attr.options?.[0];
    if (first) return { label: first.label, price_delta: first.price_delta };
    return null;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-red-600 text-lg">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-400 text-lg">
        Fetching order...
      </div>
    );
  }

  return (
    <AdminAuthGuard>
      <div className="flex">
        <AdminSidebar />

        <motion.div
          className="flex-1 px-4 sm:px-6 py-8 bg-gray-50 min-h-screen"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <motion.div
              className="bg-gradient-to-r from-white via-gray-100 to-white px-6 py-5 rounded-xl border shadow-sm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                🧾 Order #{order.id}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {order.date}
              </p>
            </motion.div>

            <motion.div
              className="bg-white rounded-2xl border shadow-lg p-6 space-y-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Customer */}
              <section>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700 mb-3">
                  <FaUserAlt /> Customer Info
                </h2>
                <div className="space-y-1 text-sm text-gray-600 pl-1">
                  <p>
                    <strong>Name:</strong> {order.customer.name}
                  </p>
                  <p>
                    <strong>Email:</strong> {order.customer.email}
                  </p>
                  <p>
                    <strong>Address:</strong> {order.customer.address}
                  </p>
                </div>
              </section>

              {/* Items + Selected Attributes ONLY */}
              <section>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700 mb-3">
                  <FaShoppingCart /> Ordered Items
                </h2>

                <ul className="divide-y divide-gray-100 text-sm text-gray-700">
                  {order.items.map((item, i) => {
                    const pid = item.productId;
                    const attrs = pid ? attributesByProduct[pid] : undefined;

                    return (
                      <motion.li
                        key={i}
                        className="py-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        {/* Line item header */}
                        <div className="flex items-start justify-between">
                          <span className="text-sm text-gray-800">
                            {item.title}{" "}
                            <span className="text-gray-500">
                              (x{item.quantity})
                            </span>
                          </span>
                          <span className="font-semibold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {/* Selected attribute lines */}
                        {pid ? (
                          attrs?.length ? (
                            <div className="mt-2 space-y-1">
                              {attrs.map((attr) => {
                                const picked = pickSelectedLabel(pid, attr);
                                if (!picked) return null;
                                return (
                                  <div
                                    key={attr.id}
                                    className="text-xs text-gray-700 pl-1"
                                  >
                                    <span className="font-semibold">
                                      {attr.name}:
                                    </span>{" "}
                                    <span>{picked.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-gray-400">
                              Attributes unavailable
                            </div>
                          )
                        ) : (
                          <div className="mt-2 text-xs text-orange-600">
                            No product ID available — cannot resolve attributes
                          </div>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>

                <p className="mt-4 font-semibold text-right text-lg text-green-700">
                  Total: ${order.total.toFixed(2)}
                </p>
              </section>

              {/* Status */}
              <section>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700 mb-3">
                  <FaBoxOpen /> Order Status
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div>{statusBadge(status)}</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full sm:w-64 border-gray-300 focus:ring-2 focus:ring-red-700 focus:border-red-700 rounded-md px-4 py-2 text-sm text-gray-700 transition-all shadow-sm"
                  >
                    <option>Pending</option>
                    <option>Processing</option>
                    <option>Shipped</option>
                    <option>Completed</option>
                  </select>
                </div>
              </section>

              {/* Notes */}
              <section>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700 mb-3">
                  <FaStickyNote /> Internal Notes
                </h2>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note (admin only)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-md p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-700 transition shadow-sm"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddNote}
                  className="mt-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md text-sm transition"
                >
                  ➕ Add Note
                </motion.button>
                <ToastContainer position="top-right" autoClose={3000} />
                <ul className="mt-4 space-y-3 text-sm text-gray-600">
                  {order.notes.map((note: string, i: number) => (
                    <motion.li
                      key={i}
                      className="bg-gray-50 border border-gray-200 rounded-md p-3"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 + 0.3 }}
                    >
                      {note}
                    </motion.li>
                  ))}
                </ul>
              </section>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AdminAuthGuard>
  );
}
