'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const labelToPath: Record<string, string> = {
  "Dashboard": "/admin/dashboard",
  "Products Section": "/admin/products",
  "Blog View": "/admin/blogView", // keep this if you still want a separate label
  "Blog": "/admin/blogView",
  "Settings": "/admin/settings",
  "First Carousel": "/admin/first-carousel",
  "Media Library": "/admin/media-library",
  "Notifications": "/admin/notifications",
  "Testimonials": "/admin/testimonials",
  "Second Carousel": "/admin/second-carousel",
  "Hero Banner": "/admin/hero-banner",
  "Manage Categories": "/admin/manage-categories",
  "Orders": "/admin/orders",
  "Inventory": "/admin/inventory",
  "Google Settings": "/admin/G-Settings",
  "Google Analytics": "/admin/G-Analytics",
  "New Account": "/admin/new-account",
  "Navbar" : "/admin/navbar",
};

function normalize(p: string) {
  if (!p) return '/';
  return p.replace(/\/+$/, '') || '/';
}

function isAllowedPath(pathname: string, allowedPrefixes: Set<string>) {
  const current = normalize(pathname);
  for (const prefix of allowedPrefixes) {
    const base = normalize(prefix);
    if (current === base) return true;                 // exact page
    if (current.startsWith(base + '/')) return true;   // any sub-route under the page
  }
  return false;
}

export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const isLoggedIn = typeof window !== 'undefined' ? localStorage.getItem('admin-auth') : null;
    const accessPages = typeof window !== 'undefined' ? localStorage.getItem('access-pages') : null;

    if (isLoggedIn === 'true' && accessPages) {
      const allowedLabels: string[] = JSON.parse(accessPages);
      const allowedPaths = new Set<string>();

      for (const label of allowedLabels) {
        const path = labelToPath[label];
        if (path) allowedPaths.add(path);

        // Auto-whitelist both routes if either Blog or Blog View is present
        if (label === 'Blog' || label === 'Blog View') {
          allowedPaths.add('/admin/blog');
          allowedPaths.add('/admin/blogView');
        }
      }

      if (isAllowedPath(pathname, allowedPaths)) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.push('/home');
      }
    } else {
      setAuthorized(false);
      router.push('/home');
    }
  }, [pathname, router]);

  if (!authorized) return null;
  return <>{children}</>;
}
