'use client';

import { useState } from 'react';
import AdminSidebar from '../components/AdminSideBar';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiSave } from 'react-icons/fi';
import { MdOutlineArticle } from 'react-icons/md';
import { Editor } from '@tinymce/tinymce-react';
export default function BlogManagementPage() {
  const [form, setForm] = useState({
    id: '',
    title: '',
    slug: '',
    content: '',
    category: '',
    tags: '',
    author: '',
    featuredImage: '',
    metaTitle: '',
    metaDescription: '',
    ogTitle: '',
    ogImage: '',
    schemaEnabled: false,
    publishDate: '',
    draft: true,
  });
  const [imagePreview, setImagePreview] = useState('');
  const [formTouched, setFormTouched] = useState(false);

  const handleChange = (e: any) => {
    const { name, value, type, checked, files } = e.target;
    setFormTouched(true);

    if (type === 'file') {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressBase64Image(base64); // ✅ compress here
        setImagePreview(compressed);
        setForm(prev => ({
          ...prev,
          featuredImage: compressed,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };
  
  const handleSubmit = () => {
    try {
      const id = Date.now();
      const blogWithId = {
        ...form,
        id,
        status: form.draft ? 'Draft' : 'Published',
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
        thumbnail: form.featuredImage || './placeholder.jpg',
      };
      localStorage.setItem(`blog-${id}`, JSON.stringify(blogWithId));

      const blogKeys = JSON.parse(localStorage.getItem('blogKeys') || '[]');
      if (!blogKeys.includes(`blog-${id}`)) {
        blogKeys.push(`blog-${id}`);
        localStorage.setItem('blogKeys', JSON.stringify(blogKeys));
        
      }
      toast.success('✅ Blog post saved!');
      setFormTouched(false);
    } catch (e) {
      toast.error('❌ Storage limit reached. Try compressing more or switch to IndexedDB.');
    }
  };
  const handleSchedule = () => {
    if (!form.publishDate || new Date(form.publishDate) <= new Date()) {
      return toast.error('❌ Enter a valid future date.');
    }
    toast.success(`⏳ Scheduled for ${new Date(form.publishDate).toLocaleString()}`);
    handleSubmit();
  };

  
  return (
    <AdminAuthGuard>
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 px-6 py-8 bg-gray-50 min-h-screen">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8 bg-white p-6 rounded-2xl shadow border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-[#891F1A] flex items-center gap-2">
                <MdOutlineArticle className="text-4xl" />
                Blog Management (CMS)
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-[#891F1A] hover:bg-[#6d1915] text-white px-5 py-2.5 rounded-xl text-sm shadow"
                >
                  <FiSave className="text-lg" /> Save Blog Post
                </button>
                <button
                  onClick={handleSchedule}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm shadow"
                >
                  🕒 Schedule Post
                </button>
              </div>
            </div>

            <div className="bg-white text-black rounded-2xl shadow-xl border p-6 space-y-6">
              <InputField label="Title" name="title" value={form.title} onChange={handleChange} />
              <InputField label="Slug" name="slug" value={form.slug} onChange={handleChange} />
              <Editor
                apiKey=""
                value={form.content}
                init={{
                  height: 400,
                  menubar: true,
                  plugins: ['link', 'image', 'media', 'code', 'lists'],
                  toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist | link image media',
                }}
                onEditorChange={(content) => setForm(prev => ({ ...prev, content }))}
              />

              <div className="grid md:grid-cols-3 gap-4">
                <InputField label="Category" name="category" value={form.category} onChange={handleChange} />
                <InputField label="Tags" name="tags" value={form.tags} onChange={handleChange} />
                <InputField label="Author" name="author" value={form.author} onChange={handleChange} />
              </div>

              <InputField label="Meta Title" name="metaTitle" value={form.metaTitle} onChange={handleChange} />
              <TextareaField label="Meta Description" name="metaDescription" value={form.metaDescription} onChange={handleChange} />
              <InputField label="OG Title" name="ogTitle" value={form.ogTitle} onChange={handleChange} />
              <InputField label="OG Image URL" name="ogImage" value={form.ogImage} onChange={handleChange} />

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Featured Image</label>
                <input type="file" accept="image/*" onChange={handleChange} />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-3 h-32 rounded shadow border" />
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-center">
                <CheckboxField label="Enable Schema" name="schemaEnabled" checked={form.schemaEnabled} onChange={handleChange} />
                <CheckboxField label="Save as Draft" name="draft" checked={form.draft} onChange={handleChange} />
                <div>
                  <label className="text-sm font-medium text-gray-700">Publish Date</label>
                  <input
                    type="datetime-local"
                    name="publishDate"
                    value={form.publishDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded"
                    
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AdminAuthGuard>
  );
}

// Helper Components
function InputField({ label, name, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type="text" name={name} value={value} onChange={onChange} className="w-full px-4 py-2 bg-gray-50 border rounded" />
    </div>
  );
}
function TextareaField({ label, name, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea name={name} value={value} onChange={onChange} className="w-full px-4 py-2 bg-gray-50 border rounded" rows={3} />
    </div>
  );
}
function CheckboxField({ label, name, checked, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="ml-2" />
    </div>
  );
}
// ✅ Compress base64 image before saving
async function compressBase64Image(base64: string, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
  });
}