// app/sitemap.xml/route.ts

export const revalidate = 60 * 60; // regenerate hourly
export const dynamic = "force-static";

const SITE = "https://app.click2print.store";

// Pages you want in the sitemap (order matters if you care)
const PAGES: Array<{ path: string; priority: string }> = [
  { path: "/home",      priority: "1.00" },
  { path: "/checkout2", priority: "0.80" },
  { path: "/blog",      priority: "0.80" },
  { path: "/contact",   priority: "0.80" },
  { path: "/about",     priority: "0.80" },
];

function iso8601WithOffset(date: Date) {
  // "2025-08-29T12:18:29+00:00"
  return date.toISOString().replace("Z", "+00:00");
}

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const lastmod = iso8601WithOffset(new Date());

  const urls = PAGES.map(({ path, priority }) => {
    const loc = `${SITE}${path}`;
    return `
<url>
  <loc>${xmlEscape(loc)}</loc>
  <lastmod>${lastmod}</lastmod>
  <priority>${priority}</priority>
</url>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}

</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
