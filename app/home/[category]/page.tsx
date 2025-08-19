'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import SecondCarousel from '../../components/second_carousel';
import Header from '../../components/header';
import LogoSection from '../../components/LogoSection';
import Footer from '../../components/Footer';
import MobileTopBar from '../../components/HomePageTop';
import { API_BASE_URL } from '../../utils/api';
import { ChatBot } from '../../components/ChatBot';

interface Props {
  params: Promise<{
    category: string;
  }>;
}

interface Product {
  id: string;
  name: string;
  url: string;
  images: { url: string; alt_text?: string }[];
}

interface Subcategory {
  id: string;
  name: string;
  url: string;
  images: { url: string; alt_text?: string }[];
  products: Product[];
}

interface Category {
  id: string;
  name: string;
  url: string;
  images: { url: string; alt_text?: string }[];
  subcategories: Subcategory[];
}

interface HeroImage {
  url: string;
  device_type: string;
}

/** 🔐 Inject X-Frontend-Key on every request */
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || '').trim();
const fetchWithKey = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('X-Frontend-Key', FRONTEND_KEY);
  return fetch(url, { ...init, headers });
};

const CategoryPage: React.FC<Props> = ({ params }) => {
  const { category: categorySlug } = use(params);
  const [categoryInfo, setCategoryInfo] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  const [heroImages, setHeroImages] = useState<HeroImage[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        const res = await fetchWithKey(`${API_BASE_URL}/api/show_nav_items/`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to fetch nav items');
        const data: Category[] = await res.json();

        const matchedCategory = data.find(
          (cat) => cat.url.toLowerCase() === categorySlug.toLowerCase()
        );

        setCategoryInfo(matchedCategory || null);
      } catch (error) {
        console.error('❌ Category fetch error:', error);
        setCategoryInfo(null);
      } finally {
        setLoading(false);
      }
    };

    const fetchHeroImages = async () => {
      try {
        const res = await fetchWithKey(`${API_BASE_URL}/api/hero-banner/`);
        if (!res.ok) throw new Error('Failed to fetch hero images');
        const data = await res.json();
        setHeroImages(data.images || []);
      } catch (error) {
        console.error('❌ Hero banner fetch error:', error);
      }
    };

    fetchCategoryData();
    fetchHeroImages();
  }, [categorySlug]);

  useEffect(() => {
    if (heroImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [heroImages]);

  const formatCategoryName = (slug: string) =>
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  if (loading) return null;

  if (!categoryInfo) {
    return (
      <div className="p-10 text-center text-red-600">
        <h2 className="text-2xl font-semibold">Category not found</h2>
      </div>
    );
  }

  const categoryText = formatCategoryName(categorySlug);
  const description = 'Explore our product range.';

  return (
    <div className="flex flex-col bg-white">
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      {/* Hero Banner */}
      <div className="w-full h-auto overflow-hidden relative">
        {heroImages.length > 0 && (
          <img
            src={heroImages[currentSlide]?.url}
            alt={`Hero Image ${currentSlide + 1}`}
            className="w-full h-full object-cover transition-opacity duration-500"
          />
        )}
      </div>

      {/* Subcategories */}
      <section className="px-4 sm:px-6 lg:px-24 py-10">
        <h2 className="text-[#891F1A] text-2xl sm:text-3xl font-bold text-center mb-6">
          {categoryText}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryInfo.subcategories.map((subcat, index) => {
            const subcatImage = subcat.images?.[0]?.url || '/images/default.jpg';
            const subcatSlug = subcat.url;

            return (
              <Link
                href={`/home/${categorySlug}/${subcatSlug}`}
                key={index}
                className="block"
              >
                <div className="bg-white cursor-pointer hover:scale-105 transition-transform duration-200 overflow-hidden">
                  <img
                    src={subcatImage}
                    alt={subcat.name}
                    width={500}
                    height={250}
                    loading="lazy"
                    className="w-full h-auto object-cover"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Category Info */}
      <section className="text-gray-600 body-font overflow-hidden">
        <div className="container px-5 py-24 mx-auto">
          <div className="lg:w-full mx-auto flex flex-wrap justify-center">
            <img
              loading="lazy"
              alt="Category Description"
              src={categoryInfo.images?.[0]?.url || '/images/default.jpg'}
              width={492}
              height={326}
              className="object-cover object-center rounded mb-5"
            />
            <div className="lg:w-1/2 w-full mt-3 lg:pl-12 lg:py-4 lg:mt-0">
              <h1 className="text-red-700 text-4xl font-bold mb-1">
                {categoryText}
              </h1>
              <p className="leading-relaxed">{description}</p>
            </div>
          </div>
        </div>
      </section>

      <SecondCarousel />
      <Footer />
      <ChatBot />
    </div>
  );
};

export default CategoryPage;
