'use client';

import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../utils/api';

// ================= Types =================
export type LinkItem = {
  label: string;
  href?: string; // href is optional when item is a group
  children?: { label: string; href: string }[]; // for grouped links
};

type Notification = {
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
};

// ================= Constants =================
const GROUP_LABEL = 'Home Settings';

// Map of backend source to page label (must match your access-pages labels)
const sourceTableToPageLabel: Record<string, string> = {
  category: 'Manage Categories',
  subcategory: 'Manage Categories',
  orders: 'Orders',
  product: 'Products Section',
  inventory: 'Inventory',
  admin: 'New Account',
  blog: 'Blog',
};

// If you ever need routing by source_table again
const sourceToPath: Record<string, string> = {
  category: '/admin/manage-categories',
  subcategory: '/admin/manage-categories',
  orders: '/admin/orders',
  product: '/admin/products',
  inventory: '/admin/inventory',
  admin: '/admin/new-account',
  blog: '/admin/blogView',
};

// ADD: frontend key passthrough (kept consistent with your Notifications page)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return { ...init, headers };
};

// NOTE: Removed "Notifications" from ALL_LINKS
const ALL_LINKS: LinkItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Manage Categories', href: '/admin/manage-categories' },
  { label: 'Products Section', href: '/admin/products' },
  { label: 'Inventory', href: '/admin/inventory' },
  // { label: 'Notifications', href: '/admin/notifications' }, // REMOVED
  {
    label: GROUP_LABEL,
    children: [
      { label: 'NavBar', href: '/admin/navbar' },
      { label: 'Hero Banner', href: '/admin/hero-banner' },
      { label: 'First Carousel', href: '/admin/first-carousel' },
      { label: 'Second Carousel', href: '/admin/second-carousel' },
      { label: 'Testimonials', href: '/admin/testimonials' },
    ],
  },
  { label: 'Media Library', href: '/admin/media-library' },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Google Analytics', href: '/admin/G-Analytics' },
  { label: 'Google Settings', href: '/admin/G-Settings' },
  { label: 'Blog', href: '/admin/blogView' },
  { label: 'New Account', href: '/admin/new-account' },
  { label: 'User View', href: '/home' },
];

function safeParseAccessPages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [accessPages, setAccessPages] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Load auth state & access list
  useEffect(() => {
    const isLoggedIn =
      typeof window !== 'undefined' && localStorage.getItem('admin-auth') === 'true';
    setIsAuthed(!!isLoggedIn);

    if (!isLoggedIn) {
      router.replace('/home');
      return;
    }

    const pages = safeParseAccessPages(localStorage.getItem('access-pages'));
    setAccessPages(pages);
    setLoading(false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin-auth') {
        const nowAuthed = localStorage.getItem('admin-auth') === 'true';
        setIsAuthed(nowAuthed);
        if (!nowAuthed) router.replace('/admin/login');
      }
      if (e.key === 'access-pages') {
        const updated = safeParseAccessPages(localStorage.getItem('access-pages'));
        setAccessPages(updated);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [router]);

  // Normalize access to be case-insensitive
  const accessSet = useMemo(() => {
    return new Set(accessPages.map((s) => s.toLowerCase().trim()));
  }, [accessPages]);

  // Determine which links to show (respecting access pages)
  const visibleLinks = useMemo(() => {
    if (!accessPages.length) return [] as LinkItem[];

    return ALL_LINKS.reduce<LinkItem[]>((acc, item) => {
      if (item.children && item.children.length) {
        // Filter children by access
        const allowedChildren = item.children.filter((c) =>
          accessSet.has(c.label.toLowerCase())
        );

        // Show the group if: (a) group label is allowed, OR (b) any child is allowed
        if (accessSet.has(item.label.toLowerCase()) || allowedChildren.length) {
          acc.push({ ...item, children: allowedChildren });
        }
      } else if (item.href) {
        if (accessSet.has(item.label.toLowerCase())) acc.push(item);
      }
      return acc;
    }, []);
  }, [accessPages, accessSet]);

  // Fetch notifications & compute unread count that the user is allowed to see
  useEffect(() => {
    // Only run when we know accessPages; otherwise we might miscount
    if (!accessPages.length) {
      setUnreadCount(0);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications/`, withFrontendKey());
        const data: Notification[] = await res.json();

        // Filter out disallowed or irrelevant sources
        const filtered = data.filter((n) => {
          const src = (n.source_table || '').toLowerCase();
          // exclude AdminRole/AdminRoleMap
          if (src === 'adminrole' || src === 'adminrolemap') return false;

          // Only count sources that map to a page AND the user has access to that page
          const label = sourceTableToPageLabel[src];
          if (!label) return false;
          return accessSet.has(label.toLowerCase());
        });

        const unread = filtered.reduce((acc, n) => acc + (n.status === 'unread' ? 1 : 0), 0);
        setUnreadCount(unread);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setUnreadCount(0);
      }
    };

    fetchNotifications();
  }, [accessPages, accessSet]);

  if (loading || !isAuthed) {
    return <aside className="w-full lg:w-64 h-screen sticky top-0 bg-white border-r shadow-sm animate-pulse" />;
  }

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isChildActive = (href: string) => {
    return pathname === href || (pathname?.startsWith(href + '/') && href !== '/admin/dashboard');
  };

  return (
    <aside className="w-full lg:w-64 bg-white border-r shadow-sm h-screen sticky top-0 overflow-y-auto z-40">
      {/* Logo */}
      <div className="flex justify-center items-center py-6 border-b mb-4 px-4">
        <Image
          src="/images/logo.png"
          alt="Printshop logo"
          width={221}
          height={60}
          className="w-28 sm:w-40 lg:w-[221px] h-auto"
          priority
        />
      </div>

      {/* Heading + Notifications pill (replaces bell icon) */}
      <div className="bg-white text-red-800 py-3 px-6 mb-3 border-2 border-red-800 -mt-4 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold">Admin Panel</h2>

        {/* Clickable notifications badge */}
        <button
          type="button"
          onClick={() => router.push('/admin/notifications')}
          title="Notifications"
          className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
          aria-label="Notifications"
        >
          <span className="text-sm font-semibold text-red-900">Notifications</span>
          <span
            className={[
              'min-w-6 h-6 px-2 rounded-full text-white text-xs font-bold flex items-center justify-center',
              unreadCount > 0 ? 'bg-[#891F1A]' : 'bg-gray-400',
            ].join(' ')}
          >
            {unreadCount}
          </span>
        </button>
      </div>

      {/* Sidebar Links */}
      <ul className="text-black text-sm sm:text-base space-y-3 px-4">
        {visibleLinks.map((item) => {
          const isGroup = !!item.children?.length;

          if (!isGroup) {
            // Simple link
            const isActive = isChildActive(item.href!);
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => router.push(item.href!)}
                  className={[
                    'w-full text-left py-3 px-4 border-b rounded transition-colors duration-200',
                    isActive ? 'bg-[#891F1A] text-white hover:bg-[#a14d4d]' : 'hover:bg-gray-100 text-black',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              </li>
            );
          }

          // Group item
          const isOpen = !!openGroups[item.label];
          const anyChildActive = item.children!.some((c) => isChildActive(c.href));

          return (
            <li key={item.label} className="border-b rounded">
              <button
                type="button"
                onClick={() => toggleGroup(item.label)}
                className={[
                  'w-full text-left py-3 px-4 flex items-center justify-between transition-colors duration-200',
                  anyChildActive ? 'bg-[#891F1A] text-white hover:bg-[#a14d4d]' : 'hover:bg-gray-100 text-black',
                ].join(' ')}
                aria-expanded={isOpen}
                aria-controls={`group-${item.label}`}
              >
                <span>{item.label}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path fillRule="evenodd" d="M12 14.5l-6-6 1.5-1.5L12 11.5l4.5-4.5L18 8.5l-6 6z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Children */}
              {isOpen && (
                <ul id={`group-${item.label}`} className="mt-1 mb-3 ml-2 pl-2 border-l">
                  {item.children!.map((child) => (
                    <li key={child.href}>
                      <button
                        type="button"
                        onClick={() => router.push(child.href)}
                        className={[
                          'w-full text-left py-2.5 px-3 rounded-md mb-1 transition-colors duration-200 text-sm',
                          isChildActive(child.href)
                            ? 'bg-[#891F1A] text-white hover:bg-[#a14d4d]'
                            : 'hover:bg-gray-100 text-black',
                        ].join(' ')}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        {/* Optional: if no access, show a friendly note */}
        {!visibleLinks.length && (
          <li className="py-3 px-4 text-gray-500 text-sm">
            No pages assigned to your role. Contact an admin.
          </li>
        )}
      </ul>

      {/* Logout */}
      <div className="px-4 mt-12">
        <button
          className="w-full bg-[#891F1A] text-white px-4 py-2 rounded hover:bg-red-700 text-sm sm:text-base"
          onClick={() => {
            localStorage.removeItem('admin-auth');
            localStorage.removeItem('admin-id');
            localStorage.removeItem('access-pages');
            router.push('/admin/login');
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
