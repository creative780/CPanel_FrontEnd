'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '../components/AdminSideBar';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import { toast } from 'react-hot-toast';
import { FiSave, FiTrash2 } from 'react-icons/fi';
import { MdReviews } from 'react-icons/md';
import { FaStar } from 'react-icons/fa';
import dynamic from 'next/dynamic';

const STORAGE_KEY = 'admin_testimonials_data';
const TestimonialsTable = dynamic(() => import('../testimonialsTable/page'), { ssr: false });

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState([createEmptyTestimonial()]);
  const [showBlogTable, setShowBlogTable] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setTestimonials(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleAddTestimonial = () => {
    setTestimonials((prev) => {
      const updated = [...prev, createEmptyTestimonial()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleDelete = (index: number) => {
    const updated = [...testimonials];
    updated.splice(index, 1);
    setTestimonials(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleChange = (index: number, key: string, value: any) => {
    const updated = [...testimonials];
    (updated[index] as any)[key] = value;
    setTestimonials(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testimonials));
    toast.success('✅ Testimonials saved!');
    console.log(testimonials);
  };

  return (
    <AdminAuthGuard>
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 px-6 py-8 bg-gray-50 min-h-screen">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 bg-gradient-to-r from-white via-[#f8f9fa] to-gray-100 p-6 rounded-2xl shadow border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-2 items-center flex-wrap">
                <h1 className="text-3xl font-bold text-[#891F1A] flex items-center gap-2">
                    <MdReviews className="text-4xl" /> Testimonial Management (CMS)
                </h1>
                <button
                    onClick={() => setShowBlogTable(!showBlogTable)}
                    className="ml-8 bg-red-100 text-red-800 border border-red-300 rounded-lg px-4 py-2 text-sm hover:bg-red-200 transition"
                >
                    {showBlogTable ? 'Hide Testimonials Table' : 'Show Testimonials Table'}
                </button>
                </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-[#891F1A] hover:bg-[#6d1915] text-white px-5 py-2.5 rounded-xl text-sm shadow transition"
                >
                  <FiSave className="text-lg" /> Save All
                </button>
              </div>
            </div>

            {showBlogTable && (
              <div className="mb-10">
                <TestimonialsTable />
              </div>
            )}

            <div className="space-y-8">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="md:grid md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow border flex flex-col"
                >
                  <div className="space-y-4">
                    <InputField
                      label="Customer Name"
                      value={testimonial.name}
                      onChange={(e: any) => handleChange(index, 'name', e.target.value)}
                    />
                    <InputField
                      label="Role / Designation"
                      value={testimonial.role}
                      onChange={(e: any) => handleChange(index, 'role', e.target.value)}
                    />
                    <InputField
                      label="Image URL"
                      value={testimonial.image}
                      onChange={(e: any) => handleChange(index, 'image', e.target.value)}
                    />
                    <InputField
                      label="Rating (1-5)"
                      type="number"
                      value={testimonial.rating}
                      onChange={(e: any) =>
                        handleChange(
                          index,
                          'rating',
                          Math.max(1, Math.min(5, Number(e.target.value)))
                        )
                      }
                    />
                    <TextareaField
                      label="Testimonial Content"
                      value={testimonial.content}
                      onChange={(e: any) => handleChange(index, 'content', e.target.value)}
                    />
                    <button
                      onClick={() => handleDelete(index)}
                      className="text-sm text-red-600 border border-red-300 hover:bg-red-100 rounded px-3 py-1 mt-2 flex items-center gap-2"
                    >
                      <FiTrash2 /> Delete
                    </button>
                  </div>

                  <div className="border border-[#891F1A] rounded-xl p-4 bg-white shadow-sm mt-6 md:mt-0 flex flex-col relative">
                    <div className="absolute -top-8 left-4">
                      <img
                        src={testimonial.image || '/default-avatar.jpg'}
                        onError={(e) => (e.currentTarget.src = '/default-avatar.jpg')}
                        alt="avatar"
                        className="w-16 h-16 rounded-full border-2 border-[#891F1A] object-cover"
                      />
                    </div>
                    <div className="pt-8 pl-4 pr-4">
                      <div className="flex justify-end text-[#891F1A] mb-2">
                        {Array.from({ length: testimonial.rating }, (_, i) => (
                          <FaStar key={i} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-800 mb-2 leading-relaxed">
                        {testimonial.content || 'This customer left a great review about your service!'}
                      </p>
                      <p className="font-bold text-[#891F1A] leading-tight">
                        {testimonial.name || 'Customer Name'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {testimonial.role || 'Designation'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="text-center">
                <button
                  onClick={handleAddTestimonial}
                  className="mt-6 bg-blue-100 text-blue-700 border border-blue-300 px-4 py-2 rounded-lg hover:bg-blue-200"
                >
                  + Add New Testimonial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}

const createEmptyTestimonial = () => ({
  name: '',
  role: '',
  image: '',
  rating: 5,
  content: '',
});

function InputField({ label, value, onChange, type = 'text' }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-1 w-full bg-white text-gray-800 border px-4 py-2 rounded-md shadow-sm"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={3}
        className="mt-1 w-full bg-white text-gray-800 border px-4 py-2 rounded-md shadow-sm"
      />
    </div>
  );
}
