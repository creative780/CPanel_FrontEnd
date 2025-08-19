'use client';

import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSideBar';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import Modal from '../components/Modal';
import { formatDistanceToNow } from 'date-fns'; // ✅ fixed import
import { ToastContainer, toast } from 'react-toastify';
import Checkbox from '@mui/material/Checkbox';
import 'react-toastify/dist/ReactToastify.css';
import { API_BASE_URL } from '../../utils/api';

type AdminUser = {
  admin_id: string;
  admin_name: string;
  password_hash: string;
  role_id: string;
  role_name: string;
  access_pages: string[];
  created_at: string;
};

// 🔐 Frontend key helper
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

// NOTE: We keep only "Blog" visible here.
// "Blog View" will be auto-added under the hood when saving.
const sidebarLinks = [
  'Dashboard', 'Products Section', 'Blog', 'Settings', 'First Carousel',
  'Media Library', 'Notifications', 'Testimonials', 'Second Carousel',
  'Hero Banner', 'Manage Categories', 'Orders', 'Inventory', 'Google Analytics',
  'New Account', 'Google Settings'
];

const rolePermissionsMap: { [key: string]: string[] } = {
  'Super Admin': [...sidebarLinks],
  'Admin': ['Products Section', 'Settings', 'Blog', 'Orders', 'Inventory', 'Manage Categories'],
  'Product Manager': ['Products Section', 'Inventory', 'Orders', 'Manage Categories'],
  'Marketing Manager': ['Blog', 'Testimonials', 'First Carousel', 'Second Carousel', 'Hero Banner'],
  'Content Editor': ['Media Library', 'Blog', 'Hero Banner'],
  'Customer Support': ['Orders', 'Notifications', 'Testimonials'],
  'Developer': [...sidebarLinks],
  'Analyst': ['Dashboard', 'Google Analytics', 'Google Settings'],
  'Custom Role': [],
  'Temp Access': ['Dashboard', 'Media Library'],
};

// ✅ Helper: normalize permissions so "Blog" ⇒ adds hidden "Blog View"
const normalizePermissions = (perms: string[]) => {
  const next = new Set(perms);
  if (next.has('Blog')) next.add('Blog View'); // invisible auto-grant
  return Array.from(next);
};

export default function AdminNewAccountPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/show-admin/`, withFrontendKey());
        const data = await res.json();

        if (data.success && Array.isArray(data.admins)) {
          setUsers(data.admins);
        } else {
          toast.error('❌ Unexpected response format');
        }
      } catch (err) {
        toast.error('❌ Failed to fetch admin users');
      }
    };

    fetchAdmins();
  }, []);

  const togglePermission = (label: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(label);
      const base = exists
        ? prev.permissions.filter((item) => item !== label)
        : [...prev.permissions, label];

      // Keep UI clean (no "Blog View" checkbox), but still normalize in memory
      const normalized = normalizePermissions(base);
      return { ...prev, permissions: normalized.filter(p => p !== 'Blog View') }; // store UI-visible list
    });
  };

  const handleSaveUser = async () => {
    if (!formData.username || !formData.password || !formData.role) {
      toast.error('❌ Username, password and role are required');
      return;
    }

    try {
      // ✅ ensure Blog ⇒ Blog View before sending to backend
      const access_pages = normalizePermissions(formData.permissions);

      const res = await fetch(`${API_BASE_URL}/api/save-admin/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_name: formData.username,
          password: formData.password,
          role_name: formData.role,
          access_pages,
        }),
      }));

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast.error('❌ Error saving admin');
        return;
      }

      toast.success(`✅ Admin created: ${result.admin_id}`);
      setIsModalOpen(false);
      setFormData({ username: '', password: '', role: '', permissions: [] });

      const updated = await fetch(`${API_BASE_URL}/api/show-admin/`, withFrontendKey());
      const data = await updated.json();

      if (data.success && Array.isArray(data.admins)) {
        setUsers(data.admins);
      } else {
        toast.error('❌ Invalid response format after save');
      }
    } catch (error) {
      toast.error('❌ Error saving admin');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdminId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/delete-admin/`, withFrontendKey({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: selectedAdminId }),
      }));

      const result = await res.json();

      if (result.success) {
        toast.success('✅ Admin deleted');
        setUsers((prev) => prev.filter(user => user.admin_id !== selectedAdminId));
      } else {
        toast.error(`❌ ${result.error || 'Failed to delete admin'}`);
      }
    } catch (err) {
      toast.error('❌ Server error during deletion');
    } finally {
      setConfirmDeleteOpen(false);
      setSelectedAdminId(null);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 px-6 py-8 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 bg-gradient-to-r from-white via-[#f8f9fa] to-gray-100 p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">➕ Add a New Account</h1>
                <p className="text-gray-500 mt-1 text-sm">Manage admin users and their access.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-[#891F1A] text-white px-4 py-2 rounded text-sm hover:bg-[#6d1915]"
              >
                + Add New User
              </button>
            </div>

            {/* Table */}
            <div className="overflow-hidden bg-white rounded-2xl shadow-xl border border-gray-200">
              <table className="w-full table-auto text-sm">
                <thead className="bg-[#891F1A] text-white text-xs uppercase tracking-wide">
                  <tr>
                    <th className="p-4 text-left w-20">#</th>
                    <th className="p-4 text-left w-250">Username</th>
                    <th className="p-4 text-left w-250">Password</th>
                    <th className="p-4 text-left w-200">Role</th>
                    <th className="p-4 text-left w-200">Last Active</th>
                    <th className="p-4 text-left w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100">
                  {users.map((user, idx) => (
                    <tr key={user.admin_id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-semibold text-[#891F1A]">{idx + 1}</td>
                      <td className="p-4">{user.admin_name}</td>
                      <td className="p-4 text-gray-600">
                        {user.password_hash.length > 19
                          ? `${user.password_hash.slice(0, 22)}...`
                          : user.password_hash}
                      </td>
                      <td className="p-4">{user.role_name}</td>
                      <td className="p-4 text-gray-500">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedAdminId(user.admin_id);
                            setConfirmDeleteOpen(true);
                          }}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Admin Modal */}
            {isModalOpen && (
              <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-4 sm:p-6">
                  <h2 className="text-xl font-semibold mb-4">Add New Admin User</h2>

                  <div className="mb-4">
                    <label className="block mb-1 font-medium">Username</label>
                    <input
                      className="w-full border rounded p-2"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-1 font-medium">Password</label>
                    <input
                      className="w-full border rounded p-2"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-1 font-medium">Select Role</label>
                    <select
                      className="w-full border rounded p-2"
                      value={formData.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        const basePerms = rolePermissionsMap[role] || [];
                        // ✅ normalize on role change too
                        const normalized = normalizePermissions(basePerms);
                        // Keep UI list clean (no "Blog View" showing as a checkbox)
                        setFormData({ ...formData, role, permissions: normalized.filter(p => p !== 'Blog View') });
                      }}
                    >
                      <option value="">-- Select Role --</option>
                      {Object.keys(rolePermissionsMap).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block font-medium mb-2">Permissions</label>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-8">
                      {sidebarLinks.map((label) => (
                        <div key={label} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.permissions.includes(label)}
                            onChange={() => togglePermission(label)}
                            sx={{
                              color: '#891F1A',
                              '&.Mui-checked': { color: '#891F1A' },
                              padding: 0,
                            }}
                          />
                          <label className="text-gray-700 cursor-pointer">{label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 mt-4">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUser}
                      className="bg-[#891F1A] text-white px-4 py-2 rounded hover:bg-[#6d1915]"
                    >
                      Save User
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {/* Confirm Delete Modal */}
            {confirmDeleteOpen && (
              <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Are you sure?</h2>
                  <p className="text-gray-600 mb-6">
                    Do you really want to delete this admin? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAdmin}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            <ToastContainer />
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
