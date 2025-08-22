'use client';

import { useState, useEffect } from 'react';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../components/ProductModal';
import { Checkbox } from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { API_BASE_URL } from '../../utils/api';
import React from 'react';

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

function addLowStockNotification(productName: string, productId: string, quantity: number) {
  if (typeof window === 'undefined') return;
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
}

const emptyImage = { type: 'file', value: '', file: null };

const createEmptyProduct = () => ({
  id: '',
  name: '',
  brandTitle: '',
  price: '',
  quantity: '',
  fit: '',
  sizeTypes: [''],
  images: [structuredClone(emptyImage)],
  printingMethod: [],
});

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

export default function AdminProductManager() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('__all__');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState(createEmptyProduct());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | ''>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const [catRes, subRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey()),
          fetch(`${API_BASE_URL}/api/show-subcategories/`, withFrontendKey()),
          fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey()),
        ]);

        if (!catRes.ok || !subRes.ok || !prodRes.ok) {
          const texts = await Promise.all([catRes.text(), subRes.text(), prodRes.text()]);
          throw new Error(`Fetch failed: ${texts.map((t) => t.slice(0, 120)).join(' | ')}`);
        }

        const [categoryData, subcategoryData, productData] = await Promise.all([
          catRes.json(),
          subRes.json(),
          prodRes.json(),
        ]);

        const arrCats = Array.isArray(categoryData) ? categoryData : [];
        const arrSubs = Array.isArray(subcategoryData) ? subcategoryData : [];
        const arrProds = Array.isArray(productData) ? productData : [];

        const visibleCategories = arrCats.filter((c: any) => c.status === 'visible');
        const visibleSubcategories = arrSubs.filter((sc: any) => sc.status === 'visible');

        const categoryMap = new Map<string, any>();
        visibleCategories.forEach((c: any) => {
          categoryMap.set(c.name, { ...c, subcategories: [] as any[] });
        });

        visibleSubcategories.forEach((sub: any) => {
          sub.products = arrProds.filter((p: any) => p?.subcategory?.id === sub.id);
          sub.categories.forEach((catName: string) => {
            if (categoryMap.has(catName)) categoryMap.get(catName).subcategories.push(sub);
          });
        });

        const finalData = Array.from(categoryMap.values());
        const allSubcats = finalData.flatMap((c) => c.subcategories);

        const allProds = allSubcats.flatMap((sc: any) =>
          sc.products.map((p: any) => ({
            ...p,
            brand_title: p.brand_title ?? '',
            fit_description: p.fit_description ?? '',
            sizes: Array.isArray(p.sizes) ? p.sizes : [],
            images: [{ type: 'url', value: p.image || '', file: null }],
            printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
            quantity: parseInt(p.stock_quantity, 10) || 0,
            stock_status: (p.stock_status || '').toString(),
          }))
        );

        setRawData(finalData);
        setCategories(finalData.map((c) => c.name));
        setSubcategories(allSubcats);
        setProducts(allProds);
      } catch (err: any) {
        toast.error(`❌ Failed to load data: ${err.message || err}`);
      }
    };

    if (!FRONTEND_KEY) {
      toast.warn('Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY and restart.', { autoClose: 6000 });
      return;
    }
    run();
  }, []);

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
    const notifyLow = (p: any) => {
      const qty = Number(p.quantity ?? p.stock_quantity ?? 0);
      if (qty > 0 && qty <= 5) addLowStockNotification(p.name, p.id, qty);
      return { ...p, quantity: qty };
    };

    if (!selectedCategory && selectedSubCategory === '__all__') {
      const allProds = rawData.flatMap((c) => c.subcategories.flatMap((sc: any) => sc.products.map(notifyLow)));
      setProducts(allProds);
    } else if (selectedCategory && selectedSubCategory === '__all__') {
      const cat = rawData.find((c) => c.name === selectedCategory);
      const catProds =
        cat?.subcategories.flatMap((sc: any) => sc.products.map(notifyLow)) || [];
      setProducts(catProds);
    } else if (selectedSubCategory && selectedSubCategory !== '__all__') {
      const allSubs = rawData.flatMap((c) => c.subcategories);
      const sub = allSubs.find((sc: any) => sc.name === selectedSubCategory);
      const subProds = sub?.products.map(notifyLow) || [];
      setProducts(subProds);
    }
  }, [selectedCategory, selectedSubCategory, rawData]);

  useEffect(() => setIsMounted(true), []);

  const validateData = () => {
    const newErrors: Record<string, string> = {};
    if (!newProduct.name) newErrors['name'] = 'Product Name is required';
    const hasValidImage = newProduct.images.some((img) => img.value || img.file);
    if (!hasValidImage) newErrors['images'] = 'At least one image required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadImage = async (img: any) => {
    if (img.type === 'file' && img.file) {
      const formData = new FormData();
      formData.append('image', img.file);
      const res = await fetch(`${API_BASE_URL}/api/save-image/`, withFrontendKey({
        method: 'POST',
        body: formData,
      }));
      const data = await res.json().catch(() => ({}));
      return res.ok ? data?.url || '' : '';
    }
    return img.value || '';
  };

  const handleSave = async () => {
    if (!validateData()) {
      toast.error('❌ Please fix validation errors');
      return;
    }

    try {
      const imageUrls = await Promise.all(newProduct.images.map(uploadImage));

      const payload = {
        name: newProduct.name,
        brand_title: newProduct.brandTitle || '',
        price: parseFloat(newProduct.price) || 0,
        quantity: parseInt(newProduct.quantity) || 0,
        fit_description: newProduct.fit || '',
        tax_rate: 0,
        price_calculator: '',
        video_url: '',
        status: 'active',
        low_stock_alert: 5,
        shipping_class: 'Standard',
        processing_time: '',
        image_alt_text: 'Product Image',
        meta_title: '',
        meta_description: '',
        meta_keywords: [],
        open_graph_title: '',
        open_graph_desc: '',
        open_graph_image_url: '',
        canonical_url: '',
        json_ld: '',
        sizes: newProduct.sizeTypes.filter((s: string) => s.trim()),
        printingMethod: newProduct.printingMethod || [],
        subcategory_ids: [subcategories.find((sc: any) => sc.name === selectedSubCategory)?.id || ''],
        images: imageUrls,
      };

      let res: Response, responseData: any;

      if (editingProductId) {
        res = await fetch(`${API_BASE_URL}/api/edit-product/${editingProductId}/`, withFrontendKey({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }));
        responseData = await res.json().catch(() => ({}));
      } else {
        res = await fetch(`${API_BASE_URL}/api/save-product/`, withFrontendKey({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }));
        responseData = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        toast.error(`❌ Save failed: ${responseData?.error || 'Unknown error'}`);
        return;
      }

      toast.success(editingProductId ? '✅ Product updated' : '✅ Product saved');
      setNewProduct(createEmptyProduct());
      setEditingProductId(null);
      setIsModalOpen(false);

      const refreshed = await fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey());
      const parsed = await refreshed.json().catch(() => []);
      const refreshedProds = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
        ...p,
        brand_title: p.brand_title ?? '',
        fit_description: p.fit_description ?? '',
        sizes: Array.isArray(p.sizes) ? p.sizes : [],
        images: [{ type: 'url', value: p.image || '', file: null }],
        printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
        quantity: parseInt(p.stock_quantity, 10) || 0,
      }));
      setProducts(refreshedProds);
    } catch (err: any) {
      toast.error(`❌ Save failed: ${err.message}`);
    }
  };

  const handleAddProduct = () => {
    setEditingProductId(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDeleteMultiple = async () => {
    if (selectedProductIds.length === 0) return;

    const confirmDelete = confirm('Are you sure you want to delete selected products?');
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/delete-product/`, withFrontendKey({
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedProductIds, confirm: true }),
      }));

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(`❌ Bulk delete failed: ${result?.error || 'Unknown error'}`);
        return;
      }

      toast.success('🗑️ Selected products deleted');
      setSelectedProductIds([]);

      const refreshed = await fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey());
      const parsed = await refreshed.json().catch(() => []);
      const refreshedProds = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
        ...p,
        brand_title: p.brand_title ?? '',
        fit_description: p.fit_description ?? '',
        sizes: Array.isArray(p.sizes) ? p.sizes : [],
        images: [{ type: 'url', value: p.image || '', file: null }],
        printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
        quantity: parseInt(p.stock_quantity, 10) || 0,
      }));
      setProducts(refreshedProds);
    } catch (err: any) {
      toast.error(`❌ Delete failed: ${err.message}`);
    }
  };

  const handleMarkOutOfStock = async (product: any) => {
    try {
      const payload = {
        name: product.name,
        brand_title: product.brand_title || '',
        price: parseFloat(product.price) || 0,
        quantity: 0,
        fit_description: product.fit_description || '',
        tax_rate: 0,
        price_calculator: '',
        video_url: '',
        status: product.status || 'active',
        low_stock_alert: 5,
        shipping_class: 'Standard',
        processing_time: '',
        image_alt_text: 'Product Image',
        meta_title: '',
        meta_description: '',
        meta_keywords: [],
        open_graph_title: '',
        open_graph_desc: '',
        open_graph_image_url: '',
        canonical_url: '',
        json_ld: '',
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
        printingMethod: Array.isArray(product.printingMethod) ? product.printingMethod : [],
        subcategory_ids: [subcategories.find((sc: any) => product.id?.startsWith?.(sc.id))?.id || ''],
        images: (product.images || []).map((img: any) => (typeof img === 'string' ? img : img.value)),
      };

      const res = await fetch(`${API_BASE_URL}/api/edit-product/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));

      if (!res.ok) {
        toast.error('❌ Failed to mark out of stock');
        return;
      }

      toast.success('📦 Product marked out of stock');

      const refreshed = await fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey());
      const parsed = await refreshed.json().catch(() => []);
      const refreshedProds = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
        ...p,
        brand_title: p.brand_title ?? '',
        fit_description: p.fit_description ?? '',
        sizes: Array.isArray(p.sizes) ? p.sizes : [],
        images: [{ type: 'url', value: p.image || '', file: null }],
        printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
        quantity: parseInt(p.stock_quantity, 10) || 0,
      }));
      setProducts(refreshedProds);
    } catch (err: any) {
      toast.error(`❌ Failed: ${err.message}`);
    }
  };

  const handleBulkMarkOutOfStock = async () => {
    if (selectedProductIds.length === 0) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/edit_product/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: selectedProductIds, quantity: 0 }),
      }));

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(`❌ Failed: ${result?.error || 'Unknown error'}`);
        return;
      }

      toast.success('📦 Selected products marked out of stock');

      const refreshed = await fetch(`${API_BASE_URL}/api/show-product/`, withFrontendKey());
      const parsed = await refreshed.json().catch(() => []);
      const refreshedProds = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
        ...p,
        brand_title: p.brand_title ?? '',
        fit_description: p.fit_description ?? '',
        sizes: Array.isArray(p.sizes) ? p.sizes : [],
        images: [{ type: 'url', value: p.image || '', file: null }],
        printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
        quantity: parseInt(p.stock_quantity, 10) || 0,
      }));

      setProducts(refreshedProds);
      setSelectedProductIds([]);

      if (Array.isArray(parsed)) {
        const allSubcategories = [
          ...new Map(parsed.map((p: any) => [p.subcategory.id, p.subcategory])).values(),
        ];
        const allProducts = (parsed as any[]).map((p: any) => ({
          ...p,
          brand_title: p.brand_title ?? '',
          fit_description: p.fit_description ?? '',
          sizes: Array.isArray(p.sizes) ? p.sizes : [],
          images: [{ type: 'url', value: p.image || '', file: null }],
          printingMethod: Array.isArray(p.printing_methods) ? p.printing_methods : [],
          quantity: parseInt(p.stock_quantity, 10) || 0,
        }));

        setRawData([
          {
            name: 'All',
            subcategories: allSubcategories.map((sub: any) => ({
              ...sub,
              category: 'All',
              products: allProducts.filter((p) => p?.subcategory?.id === sub.id),
            })),
          },
        ]);
      }
    } catch (err: any) {
      toast.error(`❌ Failed: ${err.message}`);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const filteredAndSortedProducts = [...products]
    .filter((prod) => {
      const normalizedStatus = (prod.stock_status || '').trim().toLowerCase();
      const normalizedFilter = stockFilter.trim().toLowerCase();
      const isLow = Number(prod.quantity) > 0 && Number(prod.quantity) <= 5;

      if (normalizedFilter === 'in') return normalizedStatus === 'in stock';
      if (normalizedFilter === 'out') return normalizedStatus === 'out of stock';
      if (normalizedFilter === 'low') return normalizedStatus === 'low stock' || isLow;
      return true;
    })
    .sort((a, b) =>
      sortOrder === 'asc' ? Number(a.price) - Number(b.price) :
      sortOrder === 'desc' ? Number(b.price) - Number(a.price) : 0
    );

  const areAllSelected =
    filteredAndSortedProducts.length > 0 &&
    filteredAndSortedProducts.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    if (areAllSelected) setSelectedProductIds([]);
    else setSelectedProductIds(filteredAndSortedProducts.map((p) => p.id));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const reordered = Array.from(filteredAndSortedProducts);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setProducts((prev) => {
      const idOrder = reordered.map((p) => p.id);
      const mapPrev = new Map(prev.map((p) => [p.id, p]));
      return idOrder.map((id) => mapPrev.get(id)).filter(Boolean) as any[];
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/update-product-order/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: reordered.map((p) => ({ id: p.id })) }),
      }));
      if (!response.ok) throw new Error('Failed to update order');
      toast.success('✅ Product order saved');
    } catch (error) {
      toast.error('❌ Failed to save product order');
    }
  };

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

              <button className="bg-[#891F1A] text-white px-4 py-2 rounded" onClick={handleAddProduct}>
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
                                        onClick={() => handleEditProduct(prod)}
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
                  disabled={selectedProductIds.length === 0}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                    selectedProductIds.length === 0
                      ? 'bg-gray-500 cursor-not-allowed text-white'
                      : 'bg-[#891F1A] hover:bg-red-700 text-white'
                  }`}
                >
                  Mark Out of Stock
                </button>

                <button
                  onClick={handleDeleteMultiple}
                  disabled={selectedProductIds.length === 0}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                    selectedProductIds.length === 0
                      ? 'bg-gray-500 cursor-not-allowed text-white'
                      : 'bg-[#891F1A] hover:bg-red-700 text-white'
                  }`}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>

          <ModalAny
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingProductId(null);
            }}
            onFirstImageUpload={() => {}}
            productId={editingProductId || undefined}
          >
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="mb-2 font-semibold">
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </div>

              <div className="flex justify-end gap-4 sticky bottom-0 bg-white py-3">
                <button onClick={() => setIsModalOpen(false)} className="bg-gray-300 text-black px-4 py-2 rounded">
                  Back
                </button>
                <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded">
                  {editingProductId ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </div>
          </ModalAny>
        </main>
      </div>
    </AdminAuthGuard>
  );
}
