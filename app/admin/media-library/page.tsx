'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Edit2, ImagePlus, X, Download, RefreshCcw, Upload, Eye } from 'lucide-react';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSideBar from '../components/AdminSideBar';
import { getCroppedImg } from '../utils/CropImage';
import { API_BASE_URL } from '../../utils/api';

// 🔐 Add frontend key helper
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

const MediaLibraryPage = () => {
  const [images, setImages] = useState<any[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [modalImage, setModalImage] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceMode, setReplaceMode] = useState<'file' | 'url'>('file');
  const [replaceUrl, setReplaceUrl] = useState('');
  const [resizeWidth, setResizeWidth] = useState(300);
  const [resizeHeight, setResizeHeight] = useState(200);
  const [compress, setCompress] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [sortOption, setSortOption] = useState<'name' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedImages(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/show-all-images/`, withFrontendKey());
        const data = await res.json();
        const updated = data.map((img: any) => ({
          ...img,
          url: img.url?.startsWith('http') ? img.url : `${API_BASE_URL}${img.url}`,
        }));
        setImages(updated);
      } catch (error) {
        console.error("Failed to load images:", error);
      }
    };
    fetchImages();
  }, []);

  const groupedImages = useMemo(() => {
    const filtered = images.filter(img =>
      img.alt_text?.toLowerCase().includes(search.toLowerCase()) ||
      img.tags?.some((tag: string) => tag.toLowerCase().includes(search.toLowerCase()))
    );

    const sorted = [...filtered].sort((a, b) => {
      const compare = sortOption === 'name'
        ? a.alt_text?.localeCompare(b.alt_text || '')
        : (a.size || 0) - (b.size || 0);
      return sortOrder === 'asc' ? compare : -compare;
    });

    const groups: { [key: string]: any[] } = {};
    sorted.forEach(img => {
      const section = img.linked_table || 'uncategorized';
      if (!groups[section]) groups[section] = [];
      groups[section].push(img);
    });

    return groups;
  }, [images, search, sortOption, sortOrder]);

  const handleDrop = async (acceptedFiles: File[]) => {
    const processed = await Promise.all(acceptedFiles.map(async file => {
      const fileToUse = compress
        ? await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 })
        : file;
      return {
        id: `${Date.now()}-${file.name}`,
        url: URL.createObjectURL(fileToUse),
        name: file.name,
        size: Math.round(fileToUse.size / 1024),
        alt_text: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
    }));
    setImages(prev => [...processed, ...prev]);
    setShowUpload(false);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/*': [] },
    multiple: true
  });

  const saveCropped = async () => {
    if (!modalImage || !croppedAreaPixels) return;
    const canvas = await getCroppedImg(modalImage.url, croppedAreaPixels);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const result = await uploadReplacedImage(modalImage.image_id, blob, modalImage.alt_text, modalImage.tags);
        if (result) {
          setImages(prev =>
            prev.map(img =>
              img.image_id === modalImage.image_id
                ? { ...img, url: result.url, version: img.version + 1 }
                : img
            )
          );
          toast.success('Cropped image saved!');
          setCropMode(false);
          setModalImage(null);
        } else {
          toast.error('Failed to save cropped image');
        }
      }
    }, 'image/jpeg');
  };

  const handleReplace = async (file?: File, url?: string) => {
    let blob: Blob | null = null;
    if (file) {
      const fileToUse = compress ? await imageCompression(file, { maxSizeMB: 1 }) : file;
      blob = fileToUse;
    } else if (url) {
      const response = await fetch(url); // external fetch – no header
      blob = await response.blob();
    }

    if (blob) {
      const result = await uploadReplacedImage(modalImage.image_id, blob, modalImage.alt_text, modalImage.tags);
      if (result) {
        setImages(prev =>
          prev.map(img =>
            img.image_id === modalImage.image_id
              ? {
                  ...img,
                  url: result.url,
                  width: resizeWidth,
                  height: resizeHeight,
                  alt_text: modalImage.alt_text,
                  tags: modalImage.tags,
                  version: img.version + 1,
                  updatedAt: new Date().toISOString()
                }
              : img
          )
        );
        toast.success('Image replaced!');
        setShowReplace(false);
        setModalImage(null);
      } else {
        toast.error('Failed to replace image');
      }
    }
  };

  const uploadReplacedImage = async (imageId: string, blob: Blob, alt_text = '', tags: string[] = []) => {
    try {
      const formData = new FormData();
      formData.append('image_file', blob);
      formData.append('alt_text', alt_text);
      formData.append('tags', JSON.stringify(tags));

      const res = await fetch(`${API_BASE_URL}/api/update-image/${imageId}/`, withFrontendKey({
        method: 'POST',
        body: formData,
      }));

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return {
        url: data.url?.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`,
        alt_text: data.alt_text,
        tags: data.tags,
      };
    } catch (err) {
      console.error('Failed to upload replaced image:', err);
      return null;
    }
  };

  const deleteSelected = () => {
    if (confirm(`Delete ${selectedImages.length} images?`)) {
      setImages(prev => prev.filter(img => !selectedImages.includes(img.id)));
      setSelectedImages([]);
    }
  };

  const saveMetadata = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/edit-image`, withFrontendKey({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: modalImage.image_id,
          alt_text: modalImage.alt_text,
          tags: modalImage.tags,
          width: modalImage.width,
          height: modalImage.height,
          linked_id: modalImage.linked_id,
          linked_table: modalImage.linked_table,
          linked_page: modalImage.linked_page,
          image_type: modalImage.image_type,
        }),
      }));

      if (!res.ok) throw new Error('Failed to save metadata');
      const data = await res.json();
      setImages(prev =>
        prev.map(img =>
          img.image_id === modalImage.image_id ? { ...img, ...modalImage } : img
        )
      );
      toast.success('Metadata saved!');
      setModalImage(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save metadata');
    }
  };

  return (
    <AdminAuthGuard>
      <div className="flex bg-white text-gray-800">
        <AdminSideBar />
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="flex justify-between mb-4">
            <h1 className="text-2xl font-bold">Media Library</h1>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search images..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border px-3 py-2 rounded w-60"
              />
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as 'name' | 'size')}
                className="border px-2 py-1 rounded text-sm"
              >
                <option value="name">Sort by Name</option>
                <option value="size">Sort by Size</option>
              </select>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="border px-2 py-1 rounded text-sm"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <button
                onClick={() => setShowUpload(true)}
                className="border px-4 py-2 rounded text-sm flex items-center gap-1 bg-white hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" /> Upload
              </button>
              {selectedImages.length > 0 && (
                <button
                  onClick={deleteSelected}
                  className="bg-red-500 text-white px-4 py-2 rounded text-sm flex items-center gap-1 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" /> Delete Selected ({selectedImages.length})
                </button>
              )}
            </div>
          </div>

          {/* Image Grid */}
          {Object.entries(groupedImages).map(([section, imgs]) => (
            <div key={section} className="mb-8">
              <h2 className="text-red-600 text-xl font-semibold mb-2 capitalize">{section}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {imgs.map((img: any) => (
                  <div
                    key={img.image_id}
                    onClick={() => toggleSelect(img.image_id)}
                    className={`relative cursor-pointer group border rounded ${selectedImages.includes(img.image_id) ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <img
                      src={img.url}
                      onError={e => (e.currentTarget.src = '/images/img1.jpg')}
                      alt={img.alt_text}
                      className="w-full h-36 object-cover"
                      loading="lazy"
                    />
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{img.alt_text || 'No alt text'}</p>
                      <p className="text-xs text-gray-500 truncate">{img.tags?.join(', ') || 'No tags'}</p>
                    </div>
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-2 z-10">
                      <button onClick={e => { e.stopPropagation(); setModalImage(img); }}>
                        <Eye className="w-4 h-4 bg-white rounded p-1" />
                      </button>
                      <a href={img.url} download>
                        <Download className="w-4 h-4 bg-white rounded p-1" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Upload Modal */}
          {showUpload && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                <div className="flex justify-between mb-2">
                  <h2 className="text-lg font-semibold">Upload Images</h2>
                  <X onClick={() => setShowUpload(false)} className="cursor-pointer" />
                </div>
                <div {...getRootProps()} className="h-40 border-2 border-dashed rounded flex flex-col justify-center items-center cursor-pointer">
                  <input {...getInputProps()} />
                  <ImagePlus className="w-8 h-8 text-gray-400" />
                  <p className="text-sm">Drag & drop or click to upload</p>
                </div>
                <label className="flex items-center gap-2 mt-4">
                  <input type="checkbox" checked={compress} onChange={e => setCompress(e.target.checked)} /> Compress Images
                </label>
              </div>
            </div>
          )}

          {/* Image Modal */}
          {modalImage && !cropMode && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-semibold">Edit Image</h3>
                  <X onClick={() => setModalImage(null)} className="cursor-pointer" />
                </div>
                <img
                  src={modalImage.url?.startsWith('http') ? modalImage.url : `${API_BASE_URL}${modalImage.url}`}
                  alt="Preview"
                  className="w-full rounded mb-2"
                  onError={(e) => (e.currentTarget.src = '/images/img1.jpg')}
                />
                <button onClick={() => setCropMode(true)} className="w-full bg-gray-100 py-2 rounded mb-2 flex items-center justify-center gap-2">
                  <RefreshCcw className="w-4 h-4" /> Crop
                </button>
                <button onClick={() => setShowReplace(true)} className="w-full bg-gray-100 py-2 rounded mb-2 flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> Replace Image
                </button>
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={compress} onChange={e => setCompress(e.target.checked)} />
                  Compress on Replace
                </label>
                <input
                  type="text"
                  value={modalImage.alt_text}
                  onChange={e => setModalImage({ ...modalImage, alt_text: e.target.value })}
                  placeholder="Alt text"
                  className="mt-2 mb-1 border px-3 py-2 rounded w-full"
                />
                <input
                  type="text"
                  value={modalImage.tags?.join(', ') || ''}
                  onChange={e => setModalImage({ ...modalImage, tags: e.target.value.split(',').map(t => t.trim()) })}
                  placeholder="Tags (comma separated)"
                  className="mb-2 border px-3 py-2 rounded w-full"
                />
                <button onClick={saveMetadata} className="w-full bg-blue-600 text-white py-2 rounded mt-2">
                  Save Metadata
                </button>
              </div>
            </div>
          )}

          {/* Crop Modal */}
          {cropMode && modalImage && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-2xl h-[500px] relative">
                <Cropper
                  image={modalImage.url}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                />
                <div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between">
                  <button onClick={() => setCropMode(false)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
                  <button onClick={saveCropped} className="bg-blue-600 text-white px-4 py-2 rounded">Save Crop</button>
                </div>
              </div>
            </div>
          )}

          {/* Replace Modal */}
          {showReplace && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-full max-w-lg">
                <div className="flex justify-between mb-2">
                  <h2 className="text-lg font-semibold">Replace Image</h2>
                  <X onClick={() => setShowReplace(false)} className="cursor-pointer" />
                </div>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setReplaceMode('file')}
                    className={`px-3 py-1 rounded ${replaceMode === 'file' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setReplaceMode('url')}
                    className={`px-3 py-1 rounded ${replaceMode === 'url' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                  >
                    From URL
                  </button>
                </div>
                {replaceMode === 'file' && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleReplace(file);
                    }}
                    className="mb-2"
                  />
                )}
                {replaceMode === 'url' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={replaceUrl}
                      onChange={e => setReplaceUrl(e.target.value)}
                      placeholder="Enter image URL"
                      className="border px-3 py-2 w-full rounded"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={resizeWidth}
                        onChange={e => setResizeWidth(Number(e.target.value))}
                        className="border px-2 py-1 rounded w-24"
                        placeholder="Width"
                      />
                      <input
                        type="number"
                        value={resizeHeight}
                        onChange={e => setResizeHeight(Number(e.target.value))}
                        className="border px-2 py-1 rounded w-24"
                        placeholder="Height"
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={compress} onChange={e => setCompress(e.target.checked)} /> Compress
                    </label>
                    <button
                      onClick={() => handleReplace(undefined, replaceUrl)}
                      className="bg-blue-500 text-white px-4 py-2 rounded w-full mt-2"
                    >
                      Replace
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminAuthGuard>
  );
};

export default MediaLibraryPage;
