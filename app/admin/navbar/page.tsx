"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../components/AdminSideBar";
import AdminAuthGuard from "../components/AdminAuthGaurd";
import { API_BASE_URL } from "../../utils/api";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

// ---- Frontend key passthrough ----
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

// ---- Types ----
interface FlatProduct {
  id: string;
  name: string;
  image?: string; // primary (or first) URL per backend
  subcategory?: { id: string | null; name: string | null } | null;
  stock_status?: string | null;
  stock_quantity?: number | null;
  price?: string;
  printing_methods?: string[];
}

interface ProductImageItem {
  id: string | null;      // Image.image_id (nullable to be safe)
  url: string;
  is_primary?: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  thumbnail: string | null;     // selected thumbnail (or first image)
  images: ProductImageItem[];   // used by modal
  subcategoryId: string | null;
  subcategoryName: string | null;
}

// ---- small fetch helpers ----
const fetchJSON = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, withFrontendKey(init));
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

const postJSON = async <T,>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, withFrontendKey({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status}${msg ? ` - ${msg}` : ""}`);
  }
  return res.json();
};

const reorder = <T,>(list: T[], startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// ---------------- Images Modal ----------------
function ImagesModal({
  open,
  onClose,
  productId,
  currentThumb,
  images,
  onSelectThumbnail,
  onLoadImagesForProduct,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  currentThumb: string | null;
  images: ProductImageItem[];
  onSelectThumbnail: (img: ProductImageItem) => Promise<void>;
  onLoadImagesForProduct: (productId: string) => Promise<void>;
}) {
  useEffect(() => {
    if (open && productId) onLoadImagesForProduct(productId);
  }, [open, productId, onLoadImagesForProduct]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="mt-[50px] h-[500px] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#891F1A]/20 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#891F1A]/20 p-4">
          <h3 className="text-lg font-bold text-[#891F1A]">Images for {productId}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#891F1A] px-3 py-1 text-sm text-[#891F1A] hover:bg-[#891F1A] hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          {(!images || images.length === 0) && (
            <p className="text-sm text-gray-500">No images found for this product.</p>
          )}

          {images && images.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {images.map((img) => (
                <div
                  key={img.url}
                  className={`group relative overflow-hidden rounded-xl border border-[#891F1A]/20 ${
                    currentThumb === img.url ? "ring-2 ring-[#891F1A]" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt="Product image"
                    className="h-48 w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/images/img1.jpg";
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/95 p-2 text-xs">
                    <button
                      className="rounded-md border border-[#891F1A] px-2 py-1 text-[#891F1A] hover:bg-[#891F1A] hover:text-white"
                      onClick={() => onSelectThumbnail(img)}
                    >
                      Set as thumbnail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Page ----------------
export default function AdminNavBarViewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductRow[]>([]);

  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | "ALL">("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalProductId, setModalProductId] = useState<string>("");
  const [modalCurrentThumb, setModalCurrentThumb] = useState<string | null>(null);

  const toast = (msg: string, type: "success" | "error" | "info" = "info") => {
    console[type === "error" ? "error" : type === "success" ? "log" : "log"](`[${type}] ${msg}`);
  };

  // Load products (primary thumbnail already surfaced by backend)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const flat = await fetchJSON<FlatProduct[]>(`${API_BASE_URL}/api/show-product/`);
        if (!mounted) return;

        const built: ProductRow[] = flat.map((p) => ({
          id: p.id,
          name: p.name,
          thumbnail: p.image || null, // backend gives primary or first
          images: [],                 // lazy-load per product in modal
          subcategoryId: p.subcategory?.id ?? null,
          subcategoryName: p.subcategory?.name ?? null,
        }));

        setRows(built);
      } catch (e: any) {
        setError(e?.message || "Failed to load products");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allSubcategoriesForSelect = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.subcategoryId && r.subcategoryName) {
        map.set(r.subcategoryId, r.subcategoryName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => selectedSubcategoryId === "ALL" || r.subcategoryId === selectedSubcategoryId);
  }, [rows, selectedSubcategoryId]);

  // Modal handlers
  const handleOpenModal = (productId: string, currentThumb: string | null) => {
    setModalProductId(productId);
    setModalCurrentThumb(currentThumb);
    setModalOpen(true);
  };

  const loadImagesForProduct = async (productId: string) => {
    try {
      const details = await postJSON<{
        images?: string[];
        images_with_ids?: { id: string | null; url: string; is_primary?: boolean }[];
      }>(`${API_BASE_URL}/api/show_product_other_details/`, { product_id: productId });

      const images: ProductImageItem[] =
        (details.images_with_ids && details.images_with_ids.length
          ? details.images_with_ids
          : (details.images || []).map((u) => ({ id: null, url: u })));

      setRows((prev) =>
        prev.map((r) => (r.id === productId ? { ...r, images } : r))
      );
    } catch (e: any) {
      toast(e?.message || "Failed to load product images", "error");
    }
  };

  const handleSelectNewThumb = async (img: ProductImageItem) => {
    if (!img.id) {
      toast("Cannot set thumbnail: missing image_id from backend.", "error");
      return;
    }
    try {
      const resp = await postJSON<{ success: boolean; thumbnail_url?: string }>(
        `${API_BASE_URL}/api/set-product-thumbnail/`,
        { product_id: modalProductId, image_id: img.id }
      );

      const newThumb = resp.thumbnail_url || img.url;

      // Update current row thumbnail + modal highlight
      setRows((prev) =>
        prev.map((r) => (r.id === modalProductId ? { ...r, thumbnail: newThumb } : r))
      );
      setModalCurrentThumb(newThumb);

      // Also re-mark images list primary flag locally
      setRows((prev) =>
        prev.map((r) =>
          r.id === modalProductId
            ? {
                ...r,
                images: r.images.map((x) => ({ ...x, is_primary: x.url === newThumb })),
              }
            : r
        )
      );

      toast("Thumbnail updated", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to set thumbnail", "error");
    }
  };

  // DnD reorder (persist order for the visible subset)
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source } = result;
    if (!destination || destination.index === source.index) return;

    const newFiltered = reorder(filteredRows, source.index, destination.index);
    const visibleIds = filteredRows.map((r) => r.id);

    const nextRows = [...rows];
    let j = 0;
    for (let i = 0; i < rows.length; i++) {
      if (visibleIds.includes(rows[i].id)) {
        nextRows[i] = newFiltered[j++];
      }
    }
    setRows(nextRows);

    try {
      await fetch(
        `${API_BASE_URL}/api/update-product-order/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: newFiltered.map((r) => ({ id: r.id })) }),
        })
      );
    } catch {
      // non-blocking
    }
  };

  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />

        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#891F1A]">
              NavBar View
            </h1>
          </div>

          <div className="mb-4 grid gap-3 text-black sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-medium">Subcategory</label>
              <select
                className="rounded-xl border border-[#891F1A]/40 bg-white p-2 text-sm outline-none hover:border-[#891F1A]/60 focus:ring-2 focus:ring-[#891F1A]/30"
                value={selectedSubcategoryId}
                onChange={(e) => setSelectedSubcategoryId(e.target.value as any)}
              >
                <option value="ALL">All Subcategories</option>
                {allSubcategoriesForSelect.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#891F1A]/20 bg-white text-black shadow">
            <div className="grid grid-cols-12 border-b bg-[#891F1A] p-3 text-xs font-semibold uppercase text-white">
              <div className="col-span-2">ID</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Thumbnail</div>
              <div className="col-span-3">SubCategory</div>
              <div className="col-span-2">Action</div>
            </div>

            {loading && <div className="p-4 text-sm text-gray-600">Loading data…</div>}
            {error && <div className="p-4 text-sm text-red-600">{error}</div>}

            {!loading && !error && filteredRows.length === 0 && (
              <div className="p-4 text-sm text-gray-600">No products found.</div>
            )}

            {!loading && !error && filteredRows.length > 0 && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="products">
                  {(provided) => (
                    <ul className="divide-y" ref={provided.innerRef} {...provided.droppableProps}>
                      {filteredRows.map((r, index) => (
                        <Draggable key={r.id} draggableId={r.id} index={index}>
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`grid grid-cols-12 items-center p-3 ${snapshot.isDragging ? "bg-yellow-50" : ""}`}
                            >
                              <div className="col-span-2 truncate font-mono text-sm">{r.id}</div>
                              <div className="col-span-3 truncate text-sm">{r.name}</div>
                              <div className="col-span-2">
                                <div className="h-12 w-16 overflow-hidden rounded-lg border border-[#891F1A]/20 bg-gray-50">
                                  {r.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={r.thumbnail}
                                      alt={r.name}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = "/images/default.jpg";
                                      }}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                      No image
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="col-span-3 truncate text-sm">
                                {r.subcategoryName || "—"}
                              </div>
                              <div className="col-span-2">
                                <button
                                  className="rounded-xl border border-[#891F1A] px-3 py-1 text-sm text-[#891F1A] transition hover:bg-[#891F1A] hover:text-white"
                                  onClick={() => handleOpenModal(r.id, r.thumbnail)}
                                  aria-label={`View/Edit images for ${r.name}`}
                                >
                                  view/edit
                                </button>
                              </div>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </main>
      </div>

      <ImagesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        productId={modalProductId}
        currentThumb={modalCurrentThumb}
        images={rows.find((r) => r.id === modalProductId)?.images || []}
        onSelectThumbnail={handleSelectNewThumb}
        onLoadImagesForProduct={loadImagesForProduct}
      />
    </AdminAuthGuard>
  );
}
