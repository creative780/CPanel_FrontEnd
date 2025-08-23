'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../components/ProductModal';
import { Checkbox } from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { API_BASE_URL } from '../../utils/api';

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();

/** Attach the frontend key only when present. Never send an empty header. */
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  if (FRONTEND_KEY) headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

/** Safer JSON parse + error bubbling for non-2xx results. */
const parseJsonStrict = async (res: Response, label: string) => {
  const bodyText = await res.clone().text().catch(() => '');
  let json: any = {};
  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    // fine; we'll fall back to text body in message
  }
  if (!res.ok) {
    const msg = json?.error || bodyText || `${label}: HTTP ${res.status}`;
    throw new Error(msg.length > 400 ? msg.slice(0, 400) + '…' : msg);
  }
  return json;
};

function addLowStockNotification(productName: string, productId: string, quantity: number) {
  if (typeof window === 'undefined') return;
  try {
    const existing = JSON.parse(localStorage.getItem('notifications') || '[]');
    const alreadyExists = existing.some((n: any) => n.type === 'low_stock' && n.product_id === productId);
    if (alreadyExists) return;

    const newNotification = {
      id: crypto.randomUUID(),
      type: 'low_stock',
      order_id: productId,
      user: 'System',
      status: 'Low Stock',
      message: `⚠️ Product "${productName}" (ID: ${productId}) is low on stock (${quantity} left)`,
      created_at: new Date().toISOString(),
      product_id: productId,
    };

    localStorage.setItem('notifications', JSON.stringify([newNotification, ...existing]));
  } catch {}
}

const printingMethodShortForms: Record<string, string> = {
  'Screen Printing': 'SP',
  'Digital Printing': 'DP',
  'Offset Printing': 'OP',
  'UV Printing': 'UV',
  'Sublimation': 'SB',
  'Pad Printing': 'PP',
  'Laser Engraving': 'LE',
  'Embossing': 'EM',
};

type ServerProduct = {
  id: string;
  name: string;
  image?: string;
  subcategory?: { id: string; name: string };
  stock_status?: string;
  stock_quantity?: number | string;
  price: string | number;
  printing_methods?: string[];
  brand_title?: string;
  fit_description?: string;
  sizes?: string[];
};

const mapServerProduct = (p: ServerProduct) => ({
  ...p,
  brand_title: p.brand_title ?? '',
  fit_description: p.fit_description ?? '',
  sizes: Array.isArray(p.sizes) ? p.sizes : [],
  images: [{ type: 'url', value: p.image || '', file: null }],
  printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
  quantity: Number(p.stock_quantity ?? 0) || 0,
  stock_status: (p.stock_status || '').toString(),
});

export default function AdminProductManager() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('__all__');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | ''>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  /** UI guards for bulk actions to avoid double submits */
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkOOS, setIsBulkOOS] = useState(false);

  const initialFetchAbortRef = useRef<AbortController | null>(null);

  // ---------- Initial load with abort ----------
  useEffect(() => {
    if (!FRONTEND_KEY) {
      toast.warn('Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY and restart.', { autoClose: 6000 });
      // Still load; some environments may not require the header.
    }

    const controller = new AbortController();
    initialFetchAbortRef.current = controller;

    const run = async () => {
      try {
        const [catRes, subRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey({ signal: controller.signal })),
          fetch(`${API_BASE_URL}/api/show-subcategories/`, withFrontendKey({ signal: controller.signal })),
          fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey({ signal: controller.signal })),
        ]);

        const [categoryData, subcategoryData, productData] = await Promise.all([
          parseJsonStrict(catRes, 'show-categories'),
          parseJsonStrict(subRes, 'show-subcategories'),
          parseJsonStrict(prodRes, 'show-product'),
        ]);

        const arrCats = Array.isArray(categoryData) ? categoryData : [];
        const arrSubs = Array.isArray(subcategoryData) ? subcategoryData : [];
        const arrProds = Array.isArray(productData) ? productData : [];

        const visibleCategories = arrCats.filter((c: any) => c.status === 'visible');
        const visibleSubcategories = arrSubs.filter((sc: any) => sc.status === 'visible');

        // Build category map once (O(n))
        const categoryMap = new Map<string, any>();
        for (const c of visibleCategories) categoryMap.set(c.name, { ...c, subcategories: [] as any[] });

        // Pre-index products by subcategory id for O(n)
        const prodsBySubId = new Map<string, any[]>();
        for (const p of arrProds) {
          const sid = p?.subcategory?.id;
          if (!sid) continue;
          if (!prodsBySubId.has(sid)) prodsBySubId.set(sid, []);
          prodsBySubId.get(sid)!.push(mapServerProduct(p));
        }

        for (const sub of visibleSubcategories) {
          sub.products = prodsBySubId.get(sub.id) || [];
          for (const catName of sub.categories || []) {
            const c = categoryMap.get(catName);
            if (c) c.subcategories.push(sub);
          }
        }

        const finalData = Array.from(categoryMap.values());
        const allSubcats = finalData.flatMap((c) => c.subcategories);
        const allProds = allSubcats.flatMap((sc: any) => sc.products);

        // Only notify low-stock once per fresh fetch
        for (const p of allProds) {
          const qty = Number(p.quantity ?? 0);
          if (qty > 0 && qty <= 5) addLowStockNotification(p.name, p.id, qty);
        }

        setRawData(finalData);
        setCategories(finalData.map((c) => c.name));
        setSubcategories(allSubcats);
        setProducts(allProds);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        toast.error(`❌ Failed to load data: ${err.message || err}`);
      }
    };

    run();
    return () => controller.abort();
  }, []);

  // ---------- Category/Subcategory cascades ----------
  useEffect(() => {
    if (!selectedCategory) {
      const allSubs = rawData.flatMap((c) => c.subcategories);
      setSubcategories(allSubs);
    } else {
      const cat = rawData.find((c) => c.name === selectedCategory);
      setSubcategories(cat?.subcategories || []);
    }
  }, [selectedCategory, rawData]);

  useEffect(() => {
    if (!selectedCategory && selectedSubCategory === '__all__') {
      const allProds = rawData.flatMap((c) => c.subcategories.flatMap((sc: any) => sc.products));
      setProducts(allProds);
    } else if (selectedCategory && selectedSubCategory === '__all__') {
      const cat = rawData.find((c) => c.name === selectedCategory);
      const catProds = cat?.subcategories.flatMap((sc: any) => sc.products) || [];
      setProducts(catProds);
    } else if (selectedSubCategory && selectedSubCategory !== '__all__') {
      const allSubs = rawData.flatMap((c) => c.subcategories);
      const sub = allSubs.find((sc: any) => sc.name === selectedSubCategory);
      setProducts(sub?.products || []);
    }
  }, [selectedCategory, selectedSubCategory, rawData]);

  useEffect(() => setIsMounted(true), []);

  // ---------- Refetch products (single source of truth) ----------
  const refreshProducts = useCallback(async () => {
    try {
      const controller = new AbortController();
      const res = await fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey({ signal: controller.signal }));
      const parsed = await parseJsonStrict(res, 'show-product');
      const refreshedProds = (Array.isArray(parsed) ? parsed : []).map(mapServerProduct);
      setProducts(refreshedProds);
    } catch (err: any) {
      toast.error(`❌ Refresh failed: ${err.message || err}`);
    }
  }, []);

  // ---------- Mark Out Of Stock (bulk) ----------
  const handleBulkMarkOutOfStock = useCallback(async () => {
    if (selectedProductIds.length === 0 || isBulkOOS) return;
    setIsBulkOOS(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/edit-product/`,
        withFrontendKey({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: selectedProductIds, quantity: 0 }),
        })
      );
      await parseJsonStrict(res, 'edit-product');
      toast.success('📦 Selected products marked Out Of Stock');
      setSelectedProductIds([]);
      await refreshProducts();
    } catch (err: any) {
      toast.error(`❌ Failed: ${err.message || err}`);
    } finally {
      setIsBulkOOS(false);
    }
  }, [selectedProductIds, isBulkOOS, refreshProducts]);

  // ---------- Delete ----------
  const handleDeleteMultiple = useCallback(async () => {
    if (selectedProductIds.length === 0 || isDeleting) return;
    const confirmDelete = confirm('Are you sure you want to delete selected products?');
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/delete-product/`,
        withFrontendKey({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedProductIds, confirm: true }),
        })
      );
      await parseJsonStrict(res, 'delete-product');
      toast.success('🗑️ Selected products deleted');
      setSelectedProductIds([]);
      await refreshProducts();
    } catch (err: any) {
      toast.error(`❌ Delete failed: ${err.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProductIds, isDeleting, refreshProducts]);

  // ---------- Selection helpers ----------
  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]));
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    const base = [...products].filter((prod) => {
      const normalizedStatus = (prod.stock_status || '').trim().toLowerCase();
      const normalizedFilter = stockFilter.trim().toLowerCase();
      const isLow = Number(prod.quantity) > 0 && Number(prod.quantity) <= 5;

      if (normalizedFilter === 'in') return normalizedStatus === 'in stock';
      if (normalizedFilter === 'out') return normalizedStatus === 'out of stock';
      if (normalizedFilter === 'low') return normalizedStatus === 'low stock' || isLow;
      return true;
    });

    if (sortOrder === 'asc') {
      return base.sort((a, b) => Number(a.price) - Number(b.price));
    }
    if (sortOrder === 'desc') {
      return base.sort((a, b) => Number(b.price) - Number(a.price));
    }
    return base;
  }, [products, sortOrder, stockFilter]);

  const areAllSelected = useMemo(
    () => filteredAndSortedProducts.length > 0 && filteredAndSortedProducts.every((p) => selectedProductIds.includes(p.id)),
    [filteredAndSortedProducts, selectedProductIds]
  );

  const toggleSelectAll = useCallback(() => {
    if (areAllSelected) setSelectedProductIds([]);
    else setSelectedProductIds(filteredAndSortedProducts.map((p) => p.id));
  }, [areAllSelected, filteredAndSortedProducts]);

  // ---------- Drag & Drop ----------
  const canReorder =
    sortOrder === '' && stockFilter === 'all' && selectedSubCategory === '__all__' && !selectedCategory;

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      if (!canReorder) {
        toast.info('Reordering is available only in the All view without filters/sorting.');
        return;
      }

      const reordered = Array.from(filteredAndSortedProducts);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      // Update local products according to new id order
      setProducts((prev) => {
        const idOrder = reordered.map((p) => p.id);
        const mapPrev = new Map(prev.map((p) => [p.id, p]));
        return idOrder.map((id) => mapPrev.get(id)).filter(Boolean) as any[];
      });

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/update-product-order/`,
          withFrontendKey({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: reordered.map((p) => ({ id: p.id })) }),
          })
        );
        await parseJsonStrict(response, 'update-product-order');
        toast.success('✅ Product order saved');
      } catch (error: any) {
        toast.error(`❌ Failed to save product order: ${error.message || error}`);
      }
    },
    [canReorder, filteredAndSortedProducts]
  );

  const ModalAny = Modal as unknown as React.ComponentType<any>;

  return (
    <AdminAuthGuard>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-white">
        {showSidebar && (
          <div className="lg:w-64 w-full">
            <AdminSidebar />
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 space-y-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-[#891F1A]">Admin Product Manager</h1>
            <div className="flex gap-2 items-center">
              <select
                className="border rounded px-2 py-1 text-sm bg-white text-black"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="">Sort by Price</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
              </select>
              <select
                className="border rounded px-2 py-1 text-sm bg-white text-black"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
              >
                <option value="all">Stock: All</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>

              <button className="bg-[#891F1A] text-white px-4 py-2 rounded" onClick={() => { setEditingProductId(null); setIsModalOpen(true); }}>
                + Add Product
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <select
              className="input w-full"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="input w-full"
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
            >
              <option value="__all__">All Subcategories</option>
              {subcategories.map((sub: any, i: number) => (
                <option key={i} value={sub.name}>{sub.name}</option>
              ))}
            </select>

            <div className="max-h-[500px] overflow-auto shadow-lg rounded-2xl border border-gray-200">
              <table className="w-full table-auto text-sm bg-white rounded-2xl">
                <thead className="text-white bg-[#891F1A] sticky top-0 z-10">
                  <tr>
                    <th className="p-2 text-center w-4">
                      <Checkbox
                        checked={areAllSelected}
                        onChange={toggleSelectAll}
                        color="secondary"
                        size="medium"
                        sx={{ color: '#fff', '&.Mui-checked': { color: '#fff' }, marginLeft: '-13px' }}
                      />
                    </th>
                    <th className="px-2 py-1 text-center">ID</th>
                    <th className="px-2 py-1 text-center">Thumbnail</th>
                    <th className="px-2 py-1 text-center">Name</th>
                    <th className="p-4 text-center">Stock</th>
                    <th className="p-4 text-center">Price</th>
                    <th className="p-4 text-center">Printing</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="products">
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps} className="text-gray-800 divide-y divide-gray-100">
                        {!isMounted ? (
                          <tr>
                            <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                              Loading products...
                            </td>
                          </tr>
                        ) : filteredAndSortedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center text-gray-500 py-6 italic">
                              No products to show
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedProducts.map((prod, pi) => {
                            const imageUrl = prod?.images?.[0]?.value || prod?.image || '/img1.jpg';
                            const printingList = prod.printingMethod ?? prod.printing_methods ?? [];
                            const printingText = Array.isArray(printingList)
                              ? printingList.map((pm: string) => printingMethodShortForms[pm] || pm).join(', ')
                              : '—';

                            const status = (prod.stock_status || '').trim().toLowerCase();
                            const statusColor =
                              status === 'in stock' ? '#28A745' : status === 'low stock' ? '#9B870C' : '#DC3545';

                            const prettyStatus = (prod.stock_status || '')
                              .split(' ')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ');

                            return (
                              <Draggable key={prod.id} draggableId={String(prod.id)} index={pi}>
                                {(prov) => (
                                  <tr
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                    className="hover:bg-gray-50 transition"
                                  >
                                    <td className="p-3 text-center">
                                      <Checkbox
                                        checked={selectedProductIds.includes(prod.id)}
                                        onChange={() => toggleSelectProduct(prod.id)}
                                        color="secondary"
                                        size="medium"
                                        sx={{ color: '#891F1A', '&.Mui-checked': { color: '#891F1A' }, marginLeft: '-13px' }}
                                      />
                                    </td>
                                    <td className="p-4 text-center font-semibold text-[#891F1A]">{prod.id}</td>

                                    <td className="p-4 text-center">
                                      <img
                                        src={imageUrl}
                                        alt={prod.name}
                                        className="w-12 h-12 object-cover rounded shadow mx-auto"
                                      />
                                    </td>

                                    <td className="p-4 text-center">{prod.name}</td>
                                    <td className="p-4 text-center font-medium" style={{ color: statusColor }}>
                                      {prettyStatus || '—'}
                                    </td>
                                    <td className="p-4 text-center font-semibold text-green-700">£{prod.price}</td>
                                    <td className="p-4 text-center text-black">{printingText}</td>

                                    <td className="p-4 text-center">
                                      <button
                                        onClick={() => { setEditingProductId(prod.id); setIsModalOpen(true); }}
                                        className="bg-[#891F1A] hover:bg-[#6e1915] text-white text-xs px-4 py-2 rounded-full transition"
                                      >
                                        View / Edit
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </Draggable>
                            );
                          })
                        )}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </div>

            <div className="flex justify-between items-center mt-2 flex-wrap gap-2 sm:gap-4 text-black">
              <div className="text-sm text-gray-600 italic">
                Note: SP = Screen Printing, DP = Digital Printing, OP = Offset Printing
              </div>

              <div className="flex gap-2 ml-auto">
                <span>Selected: {selectedProductIds.length}</span>
                <button
                  onClick={handleBulkMarkOutOfStock}
                  disabled={selectedProductIds.length === 0 || isBulkOOS}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                    selectedProductIds.length === 0 || isBulkOOS
                      ? 'bg-gray-500 cursor-not-allowed text-white'
                      : 'bg-[#891F1A] hover:bg-red-700 text-white'
                  }`}
                >
                  {isBulkOOS ? 'Marking…' : 'Mark Out of Stock'}
                </button>

                <button
                  onClick={handleDeleteMultiple}
                  disabled={selectedProductIds.length === 0 || isDeleting}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                    selectedProductIds.length === 0 || isDeleting
                      ? 'bg-gray-500 cursor-not-allowed text-white'
                      : 'bg-[#891F1A] hover:bg-red-700 text-white'
                  }`}
                >
                  {isDeleting ? 'Deleting…' : 'Delete Selected'}
                </button>
              </div>
            </div>
          </div>

          <ModalAny
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingProductId(null);
              // On closing the modal, refresh the grid to reflect changes done inside the modal.
              refreshProducts();
            }}
            onFirstImageUpload={() => {}}
            productId={editingProductId || undefined}
          />
        </main>
      </div>
    </AdminAuthGuard>
  );
}
