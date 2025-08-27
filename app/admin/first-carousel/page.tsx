'use client';

import { useState, useEffect } from 'react';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { API_BASE_URL } from '../../utils/api';

// ⬇️ Frontend key helper (unchanged)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

// Types
type Category = { id: string; name: string; slug?: string };

type ImageRow = {
  type: 'url' | 'file';
  value: string;
  file: File | null;
  title: string;
  categoryId: string;    // always string for DOM <select>
  categoryName: string;  // text input; source of truth on save
};

export default function FirstCarouselPage() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ImageRow[]>([
    { type: 'url', value: '', file: null, title: '', categoryId: '', categoryName: '' }
  ]);

  // Helpers
  const findCategoryById = (id: string) => categories.find(c => c.id === id);
  const findCategoryByName = (name: string) => {
    const n = (name || '').trim().toLowerCase();
    if (!n) return undefined;
    return categories.find(c => c.name.trim().toLowerCase() === n);
  };
  const getLastLinkedCategory = (rows: ImageRow[], stopIndex: number) => {
    for (let i = stopIndex - 1; i >= 0; i--) {
      const r = rows[i];
      if ((r.categoryName ?? '').toString().trim()) {
        const byName = findCategoryByName(r.categoryName);
        if (byName) return byName;
      }
      if ((r.categoryId ?? '').toString().trim()) {
        const byId = findCategoryById(r.categoryId);
        if (byId) return byId;
      }
    }
    return undefined;
  };
  // ✅ Keep IDs as strings (Category PK is CharField)
  const toStringIdOrNull = (idStr: string) => {
    const v = (idStr ?? '').toString().trim();
    return v ? v : null;
  };

  // Fetch existing carousel + normalize into rows
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/first-carousel/`, withFrontendKey())
      .then(res => res.json())
      .then(data => {
        if (data?.title) setTitle(data.title);
        if (data?.description) setDescription(data.description);

        if (Array.isArray(data?.images) && data.images.length) {
          const formatted: ImageRow[] = data.images.map((img: any, idx: number) => {
            const src = typeof img === 'string' ? img : (img?.src || '');
            const cleanedUrl = src.replace(`${API_BASE_URL}`, '').replace(`${API_BASE_URL}`, '');
            // Backend now returns {"category": {"id": <PK string>, ...}}
            const idStr = img?.category?.id != null ? String(img.category.id) : '';
            const nameStr = img?.category?.name ? String(img.category.name) : '';

            return {
              type: 'url',
              value: cleanedUrl || '',
              file: null,
              title: img?.title || `Product ${idx + 1}`,
              categoryId: idStr,        // string
              categoryName: nameStr,    // string
            };
          });

          // Pre-hydrate missing rows with the latest previously linked category
          const hydrated = formatted.map((row, idx, arr) => {
            if (!(row.categoryName ?? '').toString().trim() && !(row.categoryId ?? '').toString().trim()) {
              const last = getLastLinkedCategory(arr, idx);
              if (last) {
                return { ...row, categoryName: last.name, categoryId: last.id };
              }
            }
            return row;
          });

          setImages(hydrated);
        }
      })
      .catch(err => console.error('Error fetching carousel data:', err));
  }, []);

  // Fetch categories for dropdown
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey())
      .then(res => res.json())
      .then((list) => {
        const normalized: Category[] = Array.isArray(list)
          ? list.map((c: any) => ({
              // whatever your backend key is, normalize to string
              id: c?.id != null ? String(c.id) : String(c?.category_id ?? ''),
              name: String(c?.name ?? c?.title ?? ''),
              slug: String(c?.slug ?? ''),
            }))
          : [];
        setCategories(normalized);
      })
      .catch(err => {
        console.error('Error fetching categories:', err);
        setCategories([]);
      });
  }, []);

  // 🔁 Reconcile rows AFTER categories are loaded so the <select> has a matching option
  useEffect(() => {
    if (!categories.length) return;
    setImages(prev => {
      const next = prev.map((row, idx, arr) => {
        const id = (row.categoryId ?? '').toString().trim();

        // If current id matches an option, keep it
        if (id && categories.some(c => c.id === id)) {
          // Also normalize name from id if the name is empty
          if (!((row.categoryName ?? '').toString().trim())) {
            const byId = findCategoryById(id);
            if (byId) return { ...row, categoryName: byId.name };
          }
          return row;
        }

        // Else try to resolve by categoryName
        const byName = findCategoryByName(row.categoryName);
        if (byName) return { ...row, categoryId: byName.id, categoryName: byName.name };

        // Else fallback to last linked category in earlier rows
        const last = getLastLinkedCategory(arr, idx);
        if (last) return { ...row, categoryId: last.id, categoryName: last.name };

        return row; // remains unselected
      });
      return next;
    });
  }, [categories]);

  const handleAddImage = () => {
    setImages(prev => {
      const last = getLastLinkedCategory(prev, prev.length);
      return [
        ...prev,
        {
          type: 'url',
          value: '',
          file: null,
          title: '',
          categoryId: last?.id ?? '',
          categoryName: last?.name ?? '',
        }
      ];
    });
  };

  const handleRemoveLastImage = () => {
    setImages(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleImageChange = (index: number, field: keyof ImageRow, value: any) => {
    setImages(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'categoryId') {
        // Dropdown changed → sync text input with selected name
        row.categoryId = value as string;
        const match = findCategoryById(row.categoryId);
        row.categoryName = match ? match.name : row.categoryName;
      } else if (field === 'categoryName') {
        // Text changed → attempt resolve ID by exact name
        row.categoryName = String(value);
        const match = findCategoryByName(row.categoryName);
        row.categoryId = match ? match.id : row.categoryId;
      } else {
        (row as any)[field] = value;
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      const uploadedImageData = await Promise.all(
        images.map(async (img, idx, arr) => {
          let src = '';

          // ⛔ IMAGE LOGIC UNCHANGED
          if (img.type === 'url') {
            const trimmed = img.value.trim();
            if (!trimmed) return null;
            src = trimmed.startsWith('/media/uploads/')
              ? trimmed.replace('/media', '')
              : trimmed;
          } else if (img.type === 'file' && img.file) {
            const reader = new FileReader();
            src = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64String = reader.result?.toString();
                base64String?.startsWith('data:image/')
                  ? resolve(base64String)
                  : reject(new Error('Invalid base64'));
              };
              reader.onerror = () => reject(new Error('File read error'));
              reader.readAsDataURL(img.file);
            });
          }

          // CATEGORY RESOLUTION PRIORITY:
          // 1) categoryName → exact match to ID
          // 2) categoryId (dropdown)
          // 3) fallback to most recently linked category
          let chosenId: string | '' = '';
          const byName = findCategoryByName(img.categoryName);   // 👈 text input is the source of truth
          if (byName) chosenId = byName.id;
          else if (img.categoryId) chosenId = img.categoryId;
          else {
            const last = getLastLinkedCategory(arr, idx);
            if (last) chosenId = last.id;
          }

          return {
            src,
            title: img.title || `Product ${idx + 1}`,   // mirror server’s default pattern
            category_id: toStringIdOrNull(chosenId),     // 👈 keep string IDs intact (CharField PK)
          };
        })
      );

      const validImages = uploadedImageData.filter(Boolean);

      const response = await fetch(
        `${API_BASE_URL}/api/first-carousel/`,
        withFrontendKey({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            images: validImages,
          }),
        })
      );

      const result = await response.json();
      if (response.ok) {
        alert('✅ Saved successfully!');
      } else {
        alert('❌ Failed to save: ' + (result?.error || 'Unknown error'));
      }
    } catch (error: any) {
      alert('❌ Save error: ' + (error?.message || String(error)));
    }
  };

  return (
    <AdminAuthGuard>
      <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
        {/* Sidebar */}
        {showSidebar && (
          <div className="lg:w-64 w-full">
            <AdminSidebar />
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6">
          {/* Toggle Sidebar */}
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-black">First Carousel</h1>
            <button
              className="lg:hidden px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? 'Hide Sidebar ◀' : 'Show Sidebar ▶'}
            </button>
          </div>

          {/* Title Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Carousel Title
            </label>
            <input
              type="text"
              placeholder="First Carousel Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border text-black px-3 py-2 rounded shadow-sm"
            />
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Carousel Description
            </label>
            <input
              type="text"
              placeholder="First Carousel Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border text-black px-3 py-2 rounded shadow-sm"
            />
          </div>

          {/* Image Inputs */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black">Carousel Images</h2>
              <span className="text-xs text-gray-500">Link each image to a Category</span>
            </div>

            {images.map((img, index) => (
              <div key={index} className="bg-white p-4 rounded shadow-sm space-y-3">
                <label className="block font-medium text-sm text-gray-700">
                  Image #{index + 1}
                </label>

                {/* URL Input */}
                <input
                  type="text"
                  placeholder="Image URL"
                  value={img.type === 'url' ? img.value : ''}
                  onChange={(e) => handleImageChange(index, 'value', e.target.value)}
                  className="w-full border px-3 py-2 rounded text-black"
                />

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageChange(index, 'file', file);
                      handleImageChange(index, 'type', 'file');  // keep explicit
                    }
                  }}
                  className="w-full border px-3 py-2 rounded text-black"
                />

                {/* Image Title */}
                <input
                  type="text"
                  placeholder="Image Title"
                  value={img.title}
                  onChange={(e) => handleImageChange(index, 'title', e.target.value)}
                  className="w-full border px-3 py-2 rounded text-black"
                />

                {/* Category Dropdown + Text Input */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category (Select)
                    </label>
                    <select
                      value={img.categoryId}
                      onChange={(e) => handleImageChange(index, 'categoryId', e.target.value)}
                      className="w-full border border-[#891F1A] rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#891F1A]"
                    >
                      <option value="">Select a Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Changing this also fills the text field with the same name.
                    </p>
                  </div>

                  {/* Text input (source of truth) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category (Text)
                    </label>
                    <input
                      type="text"
                      placeholder="Type or confirm category name"
                      value={img.categoryName}
                      onChange={(e) => handleImageChange(index, 'categoryName', e.target.value)}
                      className="w-full border px-3 py-2 rounded text-black"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If empty, we auto-fill the most recently used category. On save, this field decides.
                    </p>
                  </div>
                </div>

                {/* Image Preview */}
                {img.type === 'url' && img.value && (
                  <div className="pt-2">
                    <img
                      src={
                        img.value.startsWith('http')
                          ? img.value
                          : `${API_BASE_URL}${img.value}`
                      }
                      alt={`Preview ${index + 1}`}
                      width={240}
                      height={120}
                      className="rounded border object-contain max-h-40"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/img1.jpg';
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-3">
            <button
              onClick={handleAddImage}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
            >
              + Add More Images
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full sm:w-auto"
            >
              💾 Save Section
            </button>
            <button
              onClick={handleRemoveLastImage}
              disabled={images.length <= 1}
              className={`px-4 py-2 text-white rounded w-full sm:w-auto transition-opacity ${
                images.length <= 1
                  ? 'bg-red-500 opacity-50 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              🗑 Remove Last Section
            </button>
          </div>
        </main>
      </div>
    </AdminAuthGuard>
  );
}
