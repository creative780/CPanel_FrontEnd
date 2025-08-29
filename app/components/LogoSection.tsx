"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import LoginModal from "./LoginModal";
import Link from "next/link";
import { API_BASE_URL } from "../utils/api";

/** FRONTEND KEY helper (adds header X-Frontend-Key) */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

/* ===================== API TYPES (from your backend response) =====================

Response: Array<CategoryRaw>
CategoryRaw = {
  id: string|number,
  name: string,
  images: string[],
  url: string,
  subcategories: Array<SubcategoryRaw>
}

SubcategoryRaw = {
  id: string|number,
  name: string,
  images: string[],
  url: string,
  products: Array<ProductRaw>
}

ProductRaw = {
  id: string|number,
  name: string,
  images: string[],
  url: string
}
===================================================================================*/

type ID = string | number;

interface ProductRaw {
  id: ID;
  name: string;
  images: string[];
  url: string;
}
interface SubcategoryRaw {
  id: ID;
  name: string;
  images: string[];
  url: string;
  products: ProductRaw[];
}
interface CategoryRaw {
  id: ID;
  name: string;
  images: string[];
  url: string;
  subcategories: SubcategoryRaw[];
}

/** Flattened lookup shapes */
type Cat = { id: ID; name: string; url: string; images: string[] };
type Sub = {
  id: ID;
  name: string;
  url: string;
  images: string[];
  catId: ID;
  catName: string;
};
type Prod = {
  id: ID;
  name: string;
  url: string;
  images: string[];
  catId: ID;
  catName: string;
  subId: ID;
  subName: string;
};

export default function LogoSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Search state/refs
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // API data + derived indices
  const [navData, setNavData] = useState<CategoryRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Auth state (kept as-is from your original)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        let displayName: string | null = null;

        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            displayName = (data as any).username;
          }
        } catch {}

        if (!displayName) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/show-user/`,
              withFrontendKey()
            );
            const data = await res.json();
            const found = data.users?.find(
              (u: any) => u.user_id === firebaseUser.uid
            );
            displayName = found?.name || null;
          } catch {}
        }

        if (!displayName)
          displayName = firebaseUser.email?.split("@")[0] || "User";
        setUsername(displayName);
      } else {
        setUsername(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch nav items
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/show_nav_items/`,
          withFrontendKey({ signal: controller.signal, cache: "no-store" })
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: CategoryRaw[] = await res.json();
        if (!cancelled) setNavData(json || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setShowSearch(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowSearch(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const openModal = (m: "signup" | "signin") => {
    setMode(m);
    setIsVisible(true);
  };
  const closeModal = () => setIsVisible(false);
  const toggleMode = () =>
    setMode((p) => (p === "signin" ? "signup" : "signin"));

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Toastify({
        text: "Logged out successfully!",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
      }).showToast();
    } catch (error: any) {
      alert("Error during logout.");
    }
  };

  /* =============================== Derivations =============================== */

  // Real category badge list
  const quickBadges = useMemo<string[]>(
    () => (navData || []).map((c) => c.name),
    [navData]
  );

  // Flatten for lookup + scoring
  const { cats, subs, prods } = useMemo(() => {
    const cats: Cat[] = [];
    const subs: Sub[] = [];
    const prods: Prod[] = [];
    navData.forEach((cat) => {
      cats.push({
        id: cat.id,
        name: cat.name,
        url: cat.url,
        images: cat.images || [],
      });
      cat.subcategories?.forEach((sub) => {
        subs.push({
          id: sub.id,
          name: sub.name,
          url: sub.url,
          images: sub.images || [],
          catId: cat.id,
          catName: cat.name,
        });
        sub.products?.forEach((p) => {
          prods.push({
            id: p.id,
            name: p.name,
            url: p.url,
            images: p.images || [],
            catId: cat.id,
            catName: cat.name,
            subId: sub.id,
            subName: sub.name,
          });
        });
      });
    });
    return { cats, subs, prods };
  }, [navData]);

  /* ============================== Fuzzy Search =============================== */

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "");

  // Basic Damerau–Levenshtein for short strings (fast enough here)
  function editDistance(a: string, b: string) {
    const al = a.length;
    const bl = b.length;
    const INF = al + bl;
    const da: Record<string, number> = {};
    const d = Array.from({ length: al + 2 }, () => Array(bl + 2).fill(0));
    d[0][0] = INF;
    for (let i = 0; i <= al; i++) {
      d[i + 1][1] = i;
      d[i + 1][0] = INF;
    }
    for (let j = 0; j <= bl; j++) {
      d[1][j + 1] = j;
      d[0][j + 1] = INF;
    }
    for (let i = 1; i <= al; i++) {
      let db = 0;
      for (let j = 1; j <= bl; j++) {
        const i1 = da[b[j - 1]] || 0;
        const j1 = db;
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
          db = j;
        }
        d[i + 1][j + 1] = Math.min(
          d[i][j] + cost,
          d[i + 1][j] + 1,
          d[i][j + 1] + 1,
          d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1) // transposition
        );
      }
      da[a[i - 1]] = i;
    }
    return d[al + 1][bl + 1];
  }

  const similarity = (a: string, b: string) => {
    const A = norm(a);
    const B = norm(b);
    if (!A || !B) return 0;
    if (B.includes(A)) {
      // substring strong bonus
      return Math.min(1, 0.8 + Math.max(0, (A.length / B.length) * 0.2));
    }
    const dist = editDistance(A, B);
    const maxLen = Math.max(A.length, B.length);
    return 1 - dist / Math.max(1, maxLen); // 0..1
  };

  // Score arrays
  type Scored<T> = { item: T; score: number };

  function topMatches<T extends { name: string }>(
    arr: T[],
    q: string,
    minScore = 0.45,
    limit = 50
  ): Scored<T>[] {
    const Q = q.trim();
    if (!Q) return [];
    const Qn = norm(Q);
    const results: Scored<T>[] = [];
    for (const it of arr) {
      const s = similarity(Qn, it.name);
      if (s >= minScore) results.push({ item: it, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Determine intent (category, subcategory, product) by best score
  function detectIntent(q: string) {
    const cm = topMatches(cats, q, 0.55, 5);
    const sm = topMatches(subs, q, 0.5, 5);
    const pm = topMatches(prods, q, 0.5, 5);

    const bestCat = cm[0];
    const bestSub = sm[0];
    const bestProd = pm[0];

    // Prefer direct includes > fuzzy if close
    const includesBoost = (name: string) =>
      norm(name).includes(norm(q)) ? 0.05 : 0;

    const catScore = bestCat
      ? bestCat.score + includesBoost(bestCat.item.name)
      : 0;
    const subScore = bestSub
      ? bestSub.score + includesBoost(bestSub.item.name)
      : 0;
    const prodScore = bestProd
      ? bestProd.score + includesBoost(bestProd.item.name)
      : 0;

    if (catScore >= subScore && catScore >= prodScore && catScore >= 0.58) {
      return {
        type: "category" as const,
        target: bestCat!.item,
        suggestions: cm.slice(1, 4),
      };
    }
    if (subScore >= prodScore && subScore >= 0.55) {
      return {
        type: "subcategory" as const,
        target: bestSub!.item,
        suggestions: sm.slice(1, 4),
      };
    }
    if (bestProd && prodScore >= 0.55) {
      return {
        type: "product" as const,
        target: bestProd!.item,
        suggestions: pm.slice(1, 4),
      };
    }
    // fallback: show broad matches grouped by category
    return {
      type: "broad" as const,
      target: null,
      suggestions: [...cm, ...sm, ...pm].slice(0, 3),
    };
  }

  /* ========================= Build Result Collections ========================= */

  // For infinite-ish loading
  const ITEMS_PER_LOAD = 20;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [loadedCount, setLoadedCount] = useState(ITEMS_PER_LOAD);
  useEffect(() => setLoadedCount(ITEMS_PER_LOAD), [debouncedQuery]); // reset on new query

  useEffect(() => {
    function onScroll() {
      const el = scrollerRef.current;
      if (!el) return;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      if (nearBottom) {
        setLoadedCount((c) => c + ITEMS_PER_LOAD);
      }
    }
    const el = scrollerRef.current;
    if (el) el.addEventListener("scroll", onScroll);
    return () => {
      if (el) el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const intent = useMemo(
    () => detectIntent(debouncedQuery),
    [debouncedQuery, cats, subs, prods]
  );

  // Build view model based on intent
  type ViewItem =
    | { kind: "header"; key: string; text: string }
    | { kind: "chips"; key: string; chips: { text: string }[] }
    | { kind: "product"; key: string; prod: Prod };

  const viewItems = useMemo<ViewItem[]>(() => {
    if (!debouncedQuery) return [];

    const items: ViewItem[] = [];

    if (intent.type === "category" && intent.target) {
      const cat = intent.target as Cat;
      // Header: Category
      items.push({ kind: "header", key: `cat-${cat.id}`, text: cat.name });

      // Chips: subcategories
      const subOfCat = subs.filter((s) => s.catId === cat.id);
      if (subOfCat.length) {
        items.push({
          kind: "chips",
          key: `chips-cat-${cat.id}`,
          chips: subOfCat.map((s) => ({ text: s.name })),
        });
      }

      // Products in category (all subcategories)
      const prodsInCat = prods.filter((p) => p.catId === cat.id);
      prodsInCat.forEach((p) =>
        items.push({ kind: "product", key: `p-${p.id}`, prod: p })
      );

      return items;
    }

    if (intent.type === "subcategory" && intent.target) {
      const sub = intent.target as Sub;
      // Header: Category
      items.push({
        kind: "header",
        key: `cat-${sub.catId}`,
        text: sub.catName,
      });
      // Chips: sibling subcategories (same category)
      const siblings = subs.filter((s) => s.catId === sub.catId);
      if (siblings.length) {
        items.push({
          kind: "chips",
          key: `chips-sub-${sub.id}`,
          chips: siblings.map((s) => ({ text: s.name })),
        });
      }
      // Products: first subcategory products
      const subProds = prods.filter((p) => p.subId === sub.id);
      subProds.forEach((p) =>
        items.push({ kind: "product", key: `p-${p.id}`, prod: p })
      );

      // Secondary: rest products in same category
      const catRemainder = prods.filter(
        (p) => p.catId === sub.catId && p.subId !== sub.id
      );
      catRemainder.forEach((p) =>
        items.push({ kind: "product", key: `p2-${p.id}`, prod: p })
      );

      return items;
    }

    if (intent.type === "product" && intent.target) {
      const prodHit = intent.target as Prod;
      // Header: Category
      items.push({
        kind: "header",
        key: `cat-${prodHit.catId}`,
        text: prodHit.catName,
      });
      // Chips: subcategories (same category)
      const siblings = subs.filter((s) => s.catId === prodHit.catId);
      if (siblings.length) {
        items.push({
          kind: "chips",
          key: `chips-prod-${prodHit.id}`,
          chips: siblings.map((s) => ({ text: s.name })),
        });
      }

      // Subcategory products first; ensure hit product appears first
      const subProds = prods.filter((p) => p.subId === prodHit.subId);
      const sortedSubProds = [
        prodHit,
        ...subProds.filter((p) => p.id !== prodHit.id),
      ];
      sortedSubProds.forEach((p) =>
        items.push({ kind: "product", key: `p-${p.id}`, prod: p })
      );

      // Then remainder of category
      const catRemainder = prods.filter(
        (p) => p.catId === prodHit.catId && p.subId !== prodHit.subId
      );
      catRemainder.forEach((p) =>
        items.push({ kind: "product", key: `p2-${p.id}`, prod: p })
      );

      return items;
    }

    // Broad fallback
    const scored = topMatches(prods, debouncedQuery, 0.45, 200);
    const grouped = new Map<ID, { catName: string; items: Prod[] }>();
    for (const { item } of scored) {
      if (!grouped.has(item.catId))
        grouped.set(item.catId, { catName: item.catName, items: [] });
      grouped.get(item.catId)!.items.push(item);
    }
    for (const [catId, group] of grouped.entries()) {
      items.push({
        kind: "header",
        key: `cat-${String(catId)}`,
        text: group.catName,
      });
      const subOfCat = subs.filter((s) => s.catId === catId);
      if (subOfCat.length) {
        items.push({
          kind: "chips",
          key: `chips-broad-${String(catId)}`,
          chips: subOfCat.map((s) => ({ text: s.name })),
        });
      }
      group.items.forEach((p) =>
        items.push({ kind: "product", key: `p-${p.id}`, prod: p })
      );
    }
    return items;
  }, [debouncedQuery, intent, prods, subs]);

  // “Did you mean” line
  const didYouMean = useMemo(() => {
    if (!debouncedQuery) return [];
    if (intent.type === "broad") {
      return intent.suggestions.map((s) => s.item.name);
    }
    const extras =
      intent.suggestions
        ?.map((s: any) => s.item.name)
        .filter((n: string) => !!n) || [];
    return extras.slice(0, 3);
  }, [intent, debouncedQuery]);

  // Visible items by loadedCount
  const visibleItems = useMemo(() => {
    const list: ViewItem[] = [];
    let count = 0;
    for (const it of viewItems) {
      if (it.kind === "product") {
        count++;
        if (count > loadedCount) break;
      }
      list.push(it);
    }
    return list;
  }, [viewItems, loadedCount]);

  const onChipClick = (text: string) => {
    setSearchQuery(text);
  };

  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif",
        }}
        className="flex-col sm:flex-col lg:flex-row bg-white gap-8 items-center justify-center px-4 sm:px-6 lg:px-24 py-4 hidden md:flex mx-auto"
      >
        <div className="flex flex-row flex-wrap w-full lg:w-[80%] gap-8 items-center">
          <Link href="/home">
            <img
              src="/images\\logo.png"
              alt="Printshop logo"
              className="w-28 sm:w-40 lg:w-[221px] h-auto cursor-pointer"
            />
          </Link>

          {/* SEARCH WRAPPER */}
          <div ref={searchWrapRef} className="relative flex-1 min-w-[220px]">
            <div
              className="flex items-center bg-[#F3F3F3] px-3 sm:px-4 py-2 rounded-md gap-3 min-w-0 focus-within:ring-2 focus-within:ring-[#8B1C1C]"
              onClick={() => {
                setShowSearch(true);
                searchInputRef.current?.focus();
              }}
            >
              {/* input → 400 */}
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                placeholder={loading ? "Loading items…" : "Type to explore..."}
                className="flex-1 bg-transparent outline-none text-sm lg:text-base text-[#0E0E0E] placeholder:text-[#0E0E0E] placeholder:opacity-70 font-normal"
                aria-label="Search"
                disabled={loading}
              />

              {/* button → 500 */}
              <button
                type="button"
                className="shrink-0 font-medium"
                aria-label="Search"
                onMouseDown={(e) => e.preventDefault()}
              >
                <img
                  src="https://img.icons8.com/?size=100&id=Y6AAeSVIcpWt&format=png&color=000000"
                  alt="Search icon"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
              </button>
            </div>

            {/* DROPDOWN */}
            {showSearch && (
              <div
                className="absolute left-0 right-0 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50"
                role="listbox"
                aria-label="Search suggestions"
              >
                {/* Status / badges header (acts like a minor heading → keep 600) */}
                <div className="px-4 pt-3 text-xs text-gray-500 font-light">
                  {loading && "Fetching catalog…"}
                  {!loading &&
                    !error &&
                    quickBadges.length > 0 &&
                    "Quick categories:"}
                  {!loading &&
                    !error &&
                    quickBadges.length === 0 &&
                    "No categories found."}
                  {error && <span className="text-red-600">{error}</span>}
                </div>

                {/* Real category badges only (from API) */}
                {quickBadges.length > 0 && (
                  <div className="px-4 pb-3 pt-2 flex flex-wrap gap-2 border-b border-gray-100">
                    {/* nav/chips → treat as navigation items → 500 */}
                    {quickBadges.slice(0, 12).map((b) => (
                      <button
                        key={b}
                        type="button"
                        className="text-xs sm:text-sm rounded-full px-3 py-1 transition text-white bg-[#8B1C1C] hover:bg-[#6f1414] font-medium"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(b);
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}

                {/* “Did you mean” */}
                {debouncedQuery && didYouMean.length > 0 && (
                  <div className="px-4 py-2 text-xs text-gray-600 border-b border-gray-100">
                    <span className="font-normal">Did you mean: </span>
                    {didYouMean.map((s, i) => (
                      <button
                        key={s + i}
                        className="underline decoration-dotted mr-2 hover:text-[#8B1C1C] font-normal"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(s);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Product/Results list */}
                {debouncedQuery ? (
                  <div ref={scrollerRef} className="max-h-96 overflow-y-auto">
                    {visibleItems.length ? (
                      <ul className="divide-y divide-gray-100">
                        {visibleItems.map((it) => {
                          if (it.kind === "header") {
                            return (
                              <li
                                key={it.key}
                                className="py-2 bg-white text-black top-0 z-10"
                              >
                                {/* section header → 600 */}
                                <div className="px-4 py-1 text-xs font-semibold tracking-wide uppercase text-red-700">
                                  {it.text}
                                </div>
                              </li>
                            );
                          }
                          if (it.kind === "chips") {
                            return (
                              <li
                                key={it.key}
                                className="px-4 py-2 bg-white text-black"
                              >
                                <div className="flex flex-wrap gap-2">
                                  {it.chips.map((c, idx) => (
                                    <button
                                      key={c.text + idx}
                                      className="text-xs rounded-full px-3 py-1 bg-gray-100 hover:bg-gray-200 font-medium"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        onChipClick(c.text);
                                      }}
                                    >
                                      {c.text}
                                    </button>
                                  ))}
                                </div>
                              </li>
                            );
                          }
                          // product row
                          const p = it.prod;
                          const img = p.images?.[0] || "/images/img1.jpg";
                          return (
                            <li key={it.key}>
                              <button
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSearchQuery(p.name);
                                }}
                              >
                                <img
                                  src={img}
                                  alt={p.name}
                                  className="w-14 h-14 rounded-md object-cover shrink-0"
                                  width={56}
                                  height={56}
                                />
                                <div className="min-w-0 flex-1">
                                  {/* product name → 500 */}
                                  <span className="block font-medium text-sm sm:text-base text-gray-900 truncate">
                                    {p.name}
                                  </span>
                                  {/* meta → 400 / inner span also 400 */}
                                  <p className="text-xs sm:text-sm text-gray-600 font-normal line-clamp-2">
                                    {p.subName} •{" "}
                                    <span className="text-gray-500 font-normal">
                                      {p.catName}
                                    </span>
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-4 py-6 text-sm text-gray-500 font-normal">
                        No matches for “{searchQuery}”. Try another keyword.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-xs text-gray-500 font-light">
                    Start typing a{" "}
                    <span className="font-semibold text-red-700">Category</span>
                    ,
                    <span className="font-semibold text-red-700">
                      {" "}
                      Subcategory
                    </span>
                    , or a
                    <span className="font-semibold text-red-700"> Product</span>
                    . Results adapt to what you’re looking for.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right-side links */}
        <div className="flex flex-row gap-8 px-1 pt-2 sm:pt-0 flex-wrap sm:flex-nowrap items-center justify-center sm:justify-start">
          <Link
            href="/checkout2"
            className="cursor-pointer flex items-center gap-2 bg-[#8B1C1C] hover:bg-[#6f1414] text-white text-xs font-medium px-10 py-1.5 rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <img
              src="https://img.icons8.com/?size=100&id=ii6Lr4KivOiE&format=png&color=FFFFFF"
              alt="Help Centre icon"
              width={20}
              height={20}
              className="-ml-5 w-5 h-5 left-3"
            />
            <span className="-ml-1 whitespace-nowrap text-sm font-medium text-white">
              Cart
            </span>
          </Link>

          <Link
            href="/blog"
            className="cursor-pointer flex items-center gap-2 bg-[#8B1C1C] hover:bg-[#6f1414] text-white text-xs font-medium px-10 py-1.5 rounded-full transition-all duration-200 shadow-sm hover:shadow-md -ml-5"
          >
            <img
              src="https://img.icons8.com/?size=100&id=WX84CKOI9WcJ&format=png&color=FFFFFF"
              alt="Help Centre icon"
              width={20}
              height={20}
              className="-ml-5 w-5 h-5 left-3"
            />

            <span className="-ml-1 whitespace-nowrap text-sm font-medium text-white">
              Blog
            </span>
          </Link>

          <Link href="/contact">
            <div className="flex gap-3 items-center flex-nowrap">
              <img
                src="https://img.icons8.com/?size=100&id=Ib9FADThtmSf&format=png&color=000000"
                alt="Help Centre icon"
                width={20}
                height={20}
                className="-ml-5 w-5 h-5 left-3"
              />
              {/* link text → 400/500; make it 500 as nav */}
              <span className="-ml-1 whitespace-nowrap text-sm font-medium text-black">
                Contact
              </span>
            </div>
          </Link>

          <div className="flex gap-2 items-center">
            <img
              src="https://img.icons8.com/?size=100&id=s7eHaFDy5Rqu&format=png&color=000000"
              alt="UAE icon"
              width={21}
              height={21}
              className="w-[21px] h-[21px]"
            />
            {/* nav link → 500 */}
            <span className="-ml-1 whitespace-nowrap text-sm font-medium text-black">
              <a href="/about">About</a>
            </span>
          </div>

          <div className="login-signup flex items-center gap-4">
            {!user ? (
              <button
                onClick={() => openModal("signin")}
                className="admin-link focus:outline-none"
                aria-label="Open login modal"
              >
                <div className="flex items-center admin-panel">
                  <img
                    src="https://img.icons8.com/?size=100&id=4kuCnjaqo47m&format=png&color=000000"
                    alt="Login"
                    width={20}
                    height={20}
                    className="mr-1"
                  />
                  {/* span → 400 */}
                  <span className="-ml-1 whitespace-nowrap text-sm font-medium text-black">
                    Login
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex items-center admin-panel gap-2">
                <img
                  src="https://img.icons8.com/?size=100&id=2oz92AdXqQrC&format=png&color=000000"
                  alt="User Profile"
                  width={20}
                  height={20}
                  className="ml-2"
                />
                {/* username → 400 */}
                <span className="-ml-1 whitespace-nowrap text-sm font-medium text-black">
                  {username}
                </span>

                <div className="flex items-center gap-3">
                  {/* buttons → 500 */}
                  <button
                    onClick={handleLogout}
                    aria-label="Logout"
                    className="cursor-pointer flex items-center gap-2 bg-[#8B1C1C] hover:bg-[#6f1414] text-white text-xs font-medium px-6 py-1.5 rounded-full transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none"
                  >
                    <img
                      src="https://img.icons8.com/?size=100&id=NF9Ee0wdJRR1&format=png&color=FFFFFF"
                      alt="User"
                      width={20}
                      height={20}
                      className="-ml-5"
                    />
                    <span className="whitespace-nowrap text-sm font-medium text-white">
                      Log Out
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LoginModal
        isVisible={isVisible}
        mode={mode}
        nameRef={nameRef}
        emailRef={emailRef}
        passwordRef={passwordRef}
        onClose={closeModal}
        onAuth={async () => {
          closeModal();
        }}
        toggleMode={toggleMode}
      />
    </>
  );
}
