'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function BlogAdminManager() {
  const [blogs, setBlogs] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [viewBlog, setViewBlog] = useState<any>(null);
  const [editBlog, setEditBlog] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = () => {
    const keys = JSON.parse(localStorage.getItem('blogKeys') || '[]');
    const loadedBlogs = keys
      .map((key) => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      })
      .filter(Boolean);
    setBlogs(loadedBlogs);
  };

  const handleDelete = (id: number) => {
    localStorage.removeItem(`blog-${id}`);
    const updatedKeys = JSON.parse(localStorage.getItem('blogKeys') || '[]').filter((k: string) => k !== `blog-${id}`);
    localStorage.setItem('blogKeys', JSON.stringify(updatedKeys));
    setBlogs((prev: any) => prev.filter((b: any) => b.id !== id));
    toast.success('🗑️ Blog deleted');
  };

  const handleEditSave = () => {
    localStorage.setItem(`blog-${editBlog.id}`, JSON.stringify(editBlog));
    toast.success('✅ Blog updated');
    setEditMode(false);
    setEditBlog(null);
    loadBlogs();
  };

  return (
    <AdminAuthGuard>
      <ToastContainer />
      <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <div className="lg:w-64">
          <AdminSidebar />
        </div>
        <main className="flex-1 p-4 sm:p-6 space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-[#891F1A]">Blog Manager</h1>
            <button
              className="bg-[#891F1A] text-white px-4 py-2 rounded"
              onClick={() => router.push('/admin/blog')}
            >
              + Add Blog
            </button>
          </div>

          <select
            className="w-full input bg-white border border-gray-300 rounded px-3 py-2 text-sm text-black"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {[...new Set(blogs.map((b: any) => b.category))].map((cat, i) => (
              <option key={i}>{cat}</option>
            ))}
          </select>

          <div className="shadow-lg rounded-2xl border overflow-auto max-h-[500px]">
            <table className="w-full text-sm bg-white text-black">
              <thead className="bg-[#891F1A] text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">Thumbnail</th>
                  <th className="px-2 py-2 text-left">Title</th>
                  <th className="px-2 py-2 text-left">Author</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Created</th>
                  <th className="px-2 py-2 text-left">Updated</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs
                  .filter((blog: any) => !filterCategory || blog.category === filterCategory)
                  .map((blog: any) => (
                    <tr key={blog.id}>
                      <td className="px-2 py-2">{blog.id}</td>
                      <td className="px-2 py-2">
                        <img src={blog.thumbnail} alt="thumb" className="w-12 h-12 object-cover rounded border" />
                      </td>
                      <td className="px-2 py-2">{blog.title}</td>
                      <td className="px-2 py-2">{blog.author}</td>
                      <td className="px-2 py-2">{blog.category}</td>
                      <td className="px-2 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          blog.status === 'Published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {blog.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">{blog.created}</td>
                      <td className="px-2 py-2">{blog.updated}</td>
                      <td className="px-2 py-2 space-x-2">
                        <button className="text-blue-600 hover:underline" onClick={() => setViewBlog(blog)}>View</button>
                        <button className="text-indigo-600 hover:underline" onClick={() => { setEditBlog(blog); setEditMode(true); }}>Edit</button>
                        <button className="text-red-600 hover:underline" onClick={() => handleDelete(blog.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* View Modal */}
      {viewBlog && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center p-6 overflow-auto">
          <div className="bg-white text-black w-full max-w-3xl rounded-xl shadow-lg p-6 relative">
            <button className="absolute top-2 right-4 text-lg" onClick={() => setViewBlog(null)}>✖</button>
            <h2 className="text-2xl font-bold mb-2">{viewBlog.title}</h2>
            <img src={viewBlog.thumbnail} alt="thumb" className="w-48 h-32 rounded border mb-4" />
            <p><strong>Author:</strong> {viewBlog.author}</p>
            <p><strong>Category:</strong> {viewBlog.category}</p>
            <p><strong>Status:</strong> {viewBlog.status}</p>
            <p><strong>Created:</strong> {viewBlog.created}</p>
            <p><strong>Updated:</strong> {viewBlog.updated}</p>
            <div className="mt-4">
              <h3 className="font-semibold">Content:</h3>
              <div className="text-sm text-black leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: viewBlog.content }} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMode && editBlog && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center p-6 overflow-auto">
          <div className="bg-white text-black w-full max-w-3xl rounded-xl shadow-lg p-6 relative">
            <button className="absolute top-2 right-4 text-lg" onClick={() => setEditMode(false)}>✖</button>
            <h2 className="text-2xl font-bold mb-4">Edit Blog</h2>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full px-4 py-2 border rounded bg-white text-black"
                value={editBlog.title}
                onChange={(e) => setEditBlog((prev: any) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                className="w-full px-4 py-2 border rounded bg-white text-black h-40"
                value={editBlog.content}
                onChange={(e) => setEditBlog((prev: any) => ({ ...prev, content: e.target.value }))}
              />
              <input
                type="text"
                className="w-full px-4 py-2 border rounded bg-white text-black"
                value={editBlog.author}
                onChange={(e) => setEditBlog((prev: any) => ({ ...prev, author: e.target.value }))}
              />
              <input
                type="text"
                className="w-full px-4 py-2 border rounded bg-white text-black"
                value={editBlog.category}
                onChange={(e) => setEditBlog((prev: any) => ({ ...prev, category: e.target.value }))}
              />
              <button
                className="bg-[#891F1A] text-white px-4 py-2 rounded"
                onClick={handleEditSave}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminAuthGuard>
  );
}