"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Header from "../components/header";
import MobileTopBar from "../components/HomePageTop";
import LogoSection from "../components/LogoSection";
import Footer from "../components/Footer";

const fallbackPosts = [
  {
    id: 1,
    title: "Design Thinking in Print",
    description:
      "Explore how creative process maps into physical printing for high-conversion marketing materials.",
    thumbnail: "/images/m2.jpg",
    category: "Inspiration",
  },
  {
    id: 2,
    title: "Typography Trends 2025",
    description:
      "See how typography evolves across digital and print. Use it to grab attention and guide flow.",
    thumbnail: "/images/m3.jpg",
    category: "Design",
  },
  {
    id: 3,
    title: "Eco-Friendly Print Tips",
    description:
      "Sustainable choices in printing for a greener business. Learn the best materials and vendors.",
    thumbnail: "/images/m4.jpg",
    category: "Sustainability",
  },
  {
    id: 4,
    title: "Why Brand Colors Matter",
    description:
      "Consistency in branding begins with color. See real-world examples that nailed their print identity.",
    thumbnail: "/images/m5.jpg",
    category: "Branding",
  },
];

export default function BlogPage() {
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const keys = JSON.parse(localStorage.getItem("blogKeys") || "[]");
      const loaded = keys
        .map((key) => {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.id - a.id);
      setBlogs(loaded.length > 0 ? loaded : fallbackPosts);
    }
  }, []);

  const featured = blogs[blogs.length - 1];
  const others = blogs.slice(0, -1).reverse(); // show newest at the top

  return (
    <div className="flex flex-col bg-white">
      <Header />
      <MobileTopBar />
      <LogoSection />
      <Navbar />

      {/* Blog Section */}
      <div className="px-4 md:px-12 lg:px-24 py-16 bg-white">
        {/* Hero Article */}
        {featured && (
          <div className="mb-10 flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-[500px] flex-shrink-0">
              <img
                src={featured.thumbnail}
                alt={featured.title}
                className="w-full h-auto object-cover rounded-xl shadow-md"
              />
            </div>
            <div className="flex flex-col mt-6 md:mt-0">
              <p className="text-sm uppercase text-[#891F1A] font-semibold mb-2">
                Featured
              </p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
                {featured.title}
              </h1>
              <p className="text-gray-600 text-sm md:text-base mb-4 line-clamp-[8]">
                {featured.metaDescription || featured.description}
              </p>
              <button className="self-start bg-[#891F1A] text-white text-sm px-5 py-2 rounded-md hover:bg-[#701912] transition-all duration-200">
                Show more →
              </button>
            </div>
          </div>
        )}

        {/* Blog Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {others.map((post: any) => (
            <div
              key={post.id}
              className="relative rounded-xl overflow-hidden h-[320px] group shadow-md bg-cover bg-center"
              style={{ backgroundImage: `url(${post.thumbnail})` }}
              role="img"
              aria-label={`${post.title}: ${post.metaDescription || post.description}`}
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all duration-300" />
              <div className="absolute bottom-0 p-5 text-white z-10">
                <span className="inline-block bg-white/80 text-black text-xs font-medium px-3 py-1 rounded-full mb-3">
                  {post.category || "General"}
                </span>
                <h3 className="text-lg font-semibold leading-tight mb-2">{post.title}</h3>
                <p className="text-sm text-white/90">
                  {post.metaDescription || post.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}