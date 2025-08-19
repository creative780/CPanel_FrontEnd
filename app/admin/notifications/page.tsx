'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '../components/AdminSideBar';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import { FaEye } from 'react-icons/fa';
import { API_BASE_URL } from '../../utils/api';
// ADD:
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

interface Notification {
  notification_id: string;
  message: string;
  created_at: string;
  type: string;
  status: 'read' | 'unread';
  source_table?: string;
  source_id?: string;
  order_id?: string;
  sku?: string;
  user?: string;
}

const sourceTableToPageLabel: Record<string, string> = {
  category: 'Manage Categories',
  subcategory: 'Manage Categories',
  orders: 'Orders',
  product: 'Products Section',
  inventory: 'Inventory',
  admin: 'New Account',
  blog: 'Blog',

};

const sourceToPath: Record<string, string> = {
  category: '/admin/manage-categories',
  subcategory: '/admin/manage-categories',
  orders: '/admin/orders',
  product: '/admin/products',
  inventory: '/admin/inventory',
  admin: '/admin/new-account',
  blog: '/admin/blogView',
};

export default function AdminNotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [accessibleSources, setAccessibleSources] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const accessPages = localStorage.getItem('access-pages');
    if (accessPages) {
      const pages = JSON.parse(accessPages) as string[];

      const allowedSources = Object.entries(sourceTableToPageLabel)
        .filter(([_, label]) => pages.includes(label))
        .map(([source]) => source.toLowerCase());

      setAccessibleSources(allowedSources);
    }

    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/` , withFrontendKey() );
      const data = await res.json();

      // Remove AdminRole/AdminRoleMap and apply access filter
      const filtered = data.filter((n: Notification) => {
        const src = (n.source_table || '').toLowerCase();
        return (
          src !== 'adminrole' &&
          src !== 'adminrolemap' &&
          Object.keys(sourceToPath).includes(src)
        );
      });

      setNotifications(filtered);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const updateStatus = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/notification-update`, withFrontendKey({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notification_id: id, status: 'read' }),
}));

      setNotifications(prev =>
        prev.map(n => (n.notification_id === id ? { ...n, status: 'read' } : n))
      );
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  };

  const markAllAsRead = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map(id =>
         fetch(`${API_BASE_URL}/api/notification-update`, withFrontendKey({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notification_id: id, status: 'read' }),
}))

        )
      );
      setNotifications(prev =>
        prev.map(n => (ids.includes(n.notification_id) ? { ...n, status: 'read' } : n))
      );
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const getFilteredNotifications = () => {
    let filtered = notifications.filter(n =>
      accessibleSources.includes((n.source_table || '').toLowerCase())
    );

    if (activeTab === 'unread') {
      filtered = filtered.filter(n => n.status === 'unread');
    } else if (activeTab !== 'all') {
      filtered = filtered.filter(n =>
        (n.source_table || '').toLowerCase() === activeTab.toLowerCase()
      );
    }

    return filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === 'latest' ? bTime - aTime : aTime - bTime;
    });
  };

  const sorted = getFilteredNotifications();

  const uniqueSources = Array.from(
    new Set(
      notifications
        .map(n => (n.source_table || 'unknown').toLowerCase())
        .filter(src => accessibleSources.includes(src))
    )
  );

  const getRedirectPath = (source: string) => {
    const lower = source.toLowerCase();
    return sourceToPath[lower] || '/admin/notifications';
  };

  return (
    <AdminAuthGuard>
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 px-6 py-8 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 bg-gradient-to-r from-white via-[#f8f9fa] to-gray-100 p-6 rounded-2xl shadow-sm border border-gray-200">
              <h1 className="text-3xl font-bold text-[#891F1A] mb-1">🔔 Notifications</h1>
              <p className="text-gray-500 text-sm">Browse and manage your system alerts</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 flex-wrap border-b mb-6">
              {['all', 'unread', ...uniqueSources].map(tab => {
                const unreadCount = notifications.filter(
                  n =>
                    n.status === 'unread' &&
                    (tab === 'all' ||
                      (n.source_table || 'unknown').toLowerCase() === tab.toLowerCase())
                ).length;

                const isActive = activeTab === tab;
                const showBadge = tab !== 'unread' && unreadCount > 0;

                return (
                  <div key={tab} className="relative">
                    {showBadge && (
                      <span className="absolute -top-1 left-8 text-xs px-2 py-0.5 rounded-full bg-[#891F1A] text-white shadow">
                        {unreadCount}
                      </span>
                    )}
                    <button
                      onClick={() => setActiveTab(tab)}
                      className={`capitalize px-4 py-2 font-medium border-b-2 ${
                        isActive
                          ? 'border-[#891F1A] text-[#891F1A]'
                          : 'border-transparent text-gray-500 hover:text-[#891F1A]'
                      }`}
                    >
                      {tab === 'all' ? 'All' : tab === 'unread' ? 'Unread' : tab}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Mark all as read */}
            {sorted.length > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => markAllAsRead(sorted.map(n => n.notification_id))}
                  className="bg-[#891F1A] text-white px-4 py-2 rounded-md shadow hover:bg-[#6e1815] transition"
                >
                  Mark All as Read
                </button>
              </div>
            )}

            {/* Notification Cards */}
            {sorted.length > 0 ? (
              <div className="space-y-4">
                {sorted.map(n => (
                  <div
                    key={n.notification_id}
                    onClick={() => {
                      updateStatus(n.notification_id);
                      const path = getRedirectPath(n.source_table || '');
                      router.push(path);
                    }}
                    className={`cursor-pointer bg-white border rounded-xl p-4 shadow flex flex-col sm:flex-row justify-between sm:items-center hover:ring-1 hover:ring-[#891F1A] transition duration-200 ${
                      n.status === 'unread' ? 'border-[#fcd34d]' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${n.status === 'unread' ? 'text-[#891F1A]' : 'text-gray-900'}`}>
                        {n.message}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Source: <b>{n.source_table}</b> • ID:{' '}
                        <span className="text-gray-700 font-semibold">{n.source_id || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="mt-3 sm:mt-0 text-sm text-right">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium ${
                          n.status === 'unread'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <FaEye /> {n.status.toUpperCase()}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-10">
                No notifications to show.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
