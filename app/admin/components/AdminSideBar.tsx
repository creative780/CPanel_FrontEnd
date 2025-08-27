'use client';

import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type LinkItem = { label: string; href: string };

const ALL_LINKS: LinkItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Blog', href: '/admin/blogView' },
  { label: 'Manage Categories', href: '/admin/manage-categories' },
  { label: 'Products Section', href: '/admin/products' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Hero Banner', href: '/admin/hero-banner' },
  { label: 'Navbar', href: '/admin/navbar'},
  { label: 'First Carousel', href: '/admin/first-carousel' },
  { label: 'Second Carousel', href: '/admin/second-carousel' },
  { label: 'Testimonials', href: '/admin/testimonials' },
  { label: 'Media Library', href: '/admin/media-library' },
  { label: 'Notifications', href: '/admin/notifications' },
  { label: 'User View', href: '/home'},
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Google Settings', href: '/admin/G-Settings' },
  { label: 'Google Analytics', href: '/admin/G-Analytics' },
  { label: 'New Account', href: '/admin/new-account' },
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

  // Load auth state & access list
  useEffect(() => {
    // guard CSR
    const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('admin-auth') === 'true';
    setIsAuthed(!!isLoggedIn);

    if (!isLoggedIn) {
      // redirect away if not authed
      router.replace('/home');
      return;
    }

    // read access pages
    const pages = safeParseAccessPages(localStorage.getItem('access-pages'));
    setAccessPages(pages);
    setLoading(false);

    // listen for cross-tab changes (logout/login)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin-auth') {
        const nowAuthed = localStorage.getItem('admin-auth') === 'true';
        setIsAuthed(nowAuthed);
        if (!nowAuthed) router.replace('/admin/login');
      }
      if (e.key === 'access-pages') {
        setAccessPages(safeParseAccessPages(localStorage.getItem('access-pages')));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [router]);

  // Filter allowed links (case-insensitive label match)
  const allowedLinks = useMemo(() => {
    if (!accessPages.length) return [];
    const setLower = new Set(accessPages.map((s) => s.toLowerCase().trim()));
    return ALL_LINKS.filter((lnk) => setLower.has(lnk.label.toLowerCase()));
  }, [accessPages]);

  if (loading || !isAuthed) {
    // tiny skeleton to avoid layout shift
    return (
      <aside className="w-full lg:w-64 h-screen sticky top-0 bg-white border-r shadow-sm animate-pulse" />
    );
  }

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

      {/* Heading */}
      <div className="bg-white text-red-800 py-3 px-6 mb-3 border-2 border-red-800 -mt-4 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold">Admin Panel</h2>
        <button
          type="button"
          onClick={() => router.push('/admin/notifications')}
          title="Notifications"
          className="ml-2 p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
          aria-label="Notifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-red-800"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>
      </div>

      {/* Sidebar Links */}
      <ul className="text-black text-sm sm:text-base space-y-3 px-4">
        {allowedLinks.map(({ label, href }) => {
          // active for nested paths: /admin/orders/... etc.
          const isActive =
            pathname === href ||
            (pathname?.startsWith(href + '/') && href !== '/admin/dashboard');

          return (
            <li key={href}>
              <button
                type="button"
                onClick={() => router.push(href)}
                className={[
                  'w-full text-left py-3 px-4 border-b rounded transition-colors duration-200',
                  isActive
                    ? 'bg-[#891F1A] text-white hover:bg-[#a14d4d]'
                    : 'hover:bg-gray-100 text-black',
                ].join(' ')}
              >
                {label}
              </button>
            </li>
          );
        })}

        {/* Optional: if no access, show a friendly note */}
        {!allowedLinks.length && (
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
