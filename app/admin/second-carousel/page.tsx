'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { API_BASE_URL } from '../../utils/api';

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

export default function SecondCarouselPage() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([
    { type: 'url', value: '', file: null, title: '', caption: '' }
  ]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/second-carousel/`, withFrontendKey())
      .then(res => res.json())
      .then(data => {
        if (data?.title) setTitle(data.title);
        if (data?.description) setDescription(data.description);
        if (data?.images?.length) {
          const formatted = data.images.map((img: any) => {
            const url = typeof img === 'string' ? img : img?.src || '';
            const cleanedUrl = url
              .replace(`${API_BASE_URL}`, '')
              .replace(`${API_BASE_URL}`, '');

            return {
              type: 'url',
              value: cleanedUrl || '',
              file: null,
              title: img?.title || '',
              caption: img?.caption || '',
            };
          });
          setImages(formatted);
        }
      })
      .catch(err => console.error('Error fetching carousel data:', err));
  }, []);

  const handleAddImage = () => {
    setImages(prev => [
      ...prev,
      { type: 'url', value: '', file: null, title: '', caption: '' }
    ]);
  };

  const handleRemoveLastImage = () => {
    if (images.length > 1) {
      setImages(prev => prev.slice(0, -1));
    }
  };

  const handleImageChange = (index, field, value) => {
    const updated = [...images];
    updated[index][field] = value;
    setImages(updated);
  };

  const handleSave = async () => {
    try {
      const uploadedImageData = await Promise.all(
        images.map(async (img) => {
          let src = '';

          if (img.type === 'url') {
            const trimmed = img.value.trim();
            if (!trimmed) return null;
            src = trimmed.startsWith('/media/uploads/') ? trimmed.replace('/media', '') : trimmed;
          } else if (img.type === 'file' && img.file) {
            const reader = new FileReader();
            src = await new Promise((resolve, reject) => {
              reader.onloadend = () => {
                const base64String = reader.result?.toString();
                base64String?.startsWith('data:image/')
                  ? resolve(base64String)
                  : reject('Invalid base64');
              };
              reader.onerror = reject;
              reader.readAsDataURL(img.file);
            });
          }

          return {
            src,
            title: img.title || `Product`,
            caption: img.caption || `Catchy tagline`,
          };
        })
      );

      const validImages = uploadedImageData.filter(Boolean);

      const response = await fetch(`${API_BASE_URL}/api/second-carousel/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          images: validImages,
        }),
      }));

      const result = await response.json();
      if (response.ok) {
        alert('✅ Saved successfully!');
      } else {
        alert('❌ Failed to save: ' + result.error);
      }
    } catch (error: any) {
      alert('❌ Save error: ' + error.message);
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
            <h1 className="text-2xl font-bold text-black">Second Carousel</h1>
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
              Second Carousel Title
            </label>
            <input
              type="text"
              placeholder="Second Carousel Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border text-black px-3 py-2 rounded shadow-sm"
            />
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Second Carousel Description
            </label>
            <input
              type="text"
              placeholder="Second Carousel Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border text-black px-3 py-2 rounded shadow-sm"
            />
          </div>

          {/* Image Inputs */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-black mb-2">Carousel Images</h2>

            {images.map((img, index) => (
              <div key={index} className="bg-white p-4 rounded shadow-sm space-y-2">
                <label className="block font-medium text-sm text-gray-700">
                  Image #{index + 1}
                </label>

                {/* URL Input */}
                <input
                  type="text"
                  placeholder="Image URL"
                  value={img.type === 'url' ? img.value : ''}
                  onChange={(e) => handleImageChange(index, 'value', e.target.value)}
                  className="w-full border px-3 py-2 rounded text:black"
                />

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageChange(index, 'file', file);
                      handleImageChange(index, 'type', 'file');  // ✅ Explicitly set type
                    }
                  }}
                  className="w-full border px-3 py-2 rounded text-black"
                />
                <input
                  type="text"
                  placeholder="Image Title"
                  value={img.title}
                  onChange={(e) => handleImageChange(index, 'title', e.target.value)}
                  className="w-full border px-3 py-1 rounded text-black"
                />
                <input
                  type="text"
                  placeholder="Image Caption"
                  value={img.caption}
                  onChange={(e) => handleImageChange(index, 'caption', e.target.value)}
                  className="w-full border px-3 py-1 rounded text-black"
                />

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
                      width={200}
                      height={100}
                      className="rounded border object-contain"
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
