"use client";

import React, { useState, useEffect, lazy, Suspense } from "react";
import "toastify-js/src/toastify.css";
import Navbar from "../components/Navbar";
import Header from "../components/header";
import LogoSection from "../components/LogoSection";
import Footer from "../components/Footer";
import MobileTopBar from "../components/HomePageTop";
import Link from "next/link";
import {
  FaEnvelopeOpenText,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
} from "react-icons/fa";
import Toastify from "toastify-js";
import { API_BASE_URL } from "../utils/api";
import { ChatBot } from "../components/ChatBot";

// 🔐 Frontend key helper (adds X-Frontend-Key to requests)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

// Lazy-loaded heavy sections
const Carousel = lazy(() => import("../components/Carousel"));
const Reviews = lazy(() => import("../components/reviews"));
const SecondCarousel = lazy(() => import("../components/second_carousel"));

export default function PrintingServicePage() {
  const fallbackImage =
    "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ymeg8jht_expires_30_days.png";

  const [desktopImages, setDesktopImages] = useState<string[]>([fallbackImage]);
  const [mobileImages, setMobileImages] = useState<string[]>([fallbackImage]);
  const [desktopIndex, setDesktopIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/hero-banner/`, withFrontendKey())
      .then((res) => res.json())
      .then((data) => {
        const all = data?.images || [];

        const desktop = all
          .filter((img: any) => img.device_type === "desktop")
          .map((img: any) => img.url);

        const mobile = all
          .filter((img: any) => img.device_type === "mobile")
          .map((img: any) => img.url);

        const mid = Math.ceil(all.length / 2);

        setDesktopImages(
          desktop.length
            ? desktop
            : all.slice(0, mid).map((img: any) => img.url) || [fallbackImage]
        );
        setMobileImages(
          mobile.length
            ? mobile
            : all.slice(mid).map((img: any) => img.url) || [fallbackImage]
        );
      })
      .catch(() => {
        setDesktopImages([fallbackImage]);
        setMobileImages([fallbackImage]);
      });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/show-categories/`, withFrontendKey())
      .then((res) => res.json())
      .then((data) => {
        const visible = data.filter(
          (category) => category.status === "visible"
        );
        setCategories(visible);
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDesktopIndex((prev) => (prev + 1) % desktopImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [desktopImages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMobileIndex((prev) => (prev + 1) % mobileImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [mobileImages]);

  const contactItems = [
    {
      icon: <FaWhatsapp className="text-[#014C3D] text-[44px]" />,
      title: "Whatsapp",
      value: "+971 50 279 3948",
      href: "https://wa.me/971502793948",
      color: "#014C3D",
    },
    {
      icon: <FaPhoneAlt className="text-[#00B7FF] text-[44px]" />,
      title: "Call",
      value: "+971 54 539 6249",
      href: "tel:+971545396249",
      color: "#00B7FF",
    },
    {
      icon: <FaMapMarkerAlt className="text-[#891F1A] text-[44px]" />,
      title: "Find Us",
      value: "Naif – Deira – Dubai",
      href: "https://maps.google.com/?q=Naif+Deira+Dubai",
      color: "#891F1A",
    },
    {
      icon: <FaEnvelopeOpenText className="text-[#E6492D] text-[44px]" />,
      title: "Email",
      value: "ccaddxb@gmail.com",
      href: "mailto:ccaddxb@gmail.com",
      color: "#E6492D",
    },
  ];

  const [isSubmitted, setIsSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitted(true);

    Toastify({
      text: "We'll Call you back soon",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
    }).showToast();

    e.currentTarget.reset();
    setTimeout(() => setIsSubmitted(false), 4000);
  };

  return (
    <div className="flex flex-col bg-white">
      <Header />
      <LogoSection />
      <Navbar />
      <MobileTopBar />

      {/* Hero Images */}
      <img
        loading="lazy"
        width="1440"
        height="400"
        src={desktopImages[desktopIndex]}
        alt="Hero Desktop"
        className="hidden sm:block w-full h-auto mx-auto"
      />
      <img
        loading="lazy"
        width="768"
        height="300"
        src={mobileImages[mobileIndex]}
        alt="Hero Mobile"
        className="block sm:hidden w-full h-auto object-cover mx-auto"
      />

      <Carousel />
      <img
        height="250"
        src="/images/Banner3.jpg"
        alt="Banner Image"
        className="block bg-[#D9D9D9] w-full h-auto mx-auto"
      />
      <div className="px-4 sm:px-6 lg:px-24 py-8">
        <h2 className="text-[#891F1A] text-2xl sm:text-3xl font-bold text-center mb-6">
          Discover our categories
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {categories.map((category) => {
            const formattedUrl = `/home/${category.name
              .toLowerCase()
              .replace(/\s+/g, "-")}`;

            return (
              <Link key={category.id} href={formattedUrl} passHref>
                <div className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-300">
                  <img
                    src={`${API_BASE_URL}${category.image}`}
                    alt={category.name}
                    className="w-full h-auto object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/img1.jpg";
                    }}
                  />
                  <h3 className="mt-2 text-md font-semibold text-[#333] text-center">
                    {category.name}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <img
        height="250"
        src="/images/Banner2.jpg"
        alt="Banner Image"
        className="block bg-[#D9D9D9]  w-full h-auto"
      />
      <SecondCarousel />
      <Reviews />

      {/* CTA */}
      <section className="flex flex-col lg:flex-row gap-8 items-center px-4 sm:px-6 lg:px-24 py-12 bg-white">
        <div className="flex-1">
          <p className="text-[#837E8C] text-sm font-semibold mb-2">
            Call To Action
          </p>
          <h2 className="text-[#0E0E0E] text-3xl sm:text-4xl font-bold leading-tight mb-4">
            Let's Bring Your Ideas to Life
          </h2>
          <p className="text-[#868686] max-w-xl">
            Scelerisque in dolor donec neque velit. Risus aenean integer
            elementum odio sed adipiscing. Sem id scelerisque nunc quis.
            Imperdiet nascetur consequat.
          </p>

          {/* Callback Form */}
          <form onSubmit={handleSubmit} className="mt-10 space-y-6 max-w-md">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="Enter your full name"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
              />
            </div>

            <div className="mt-6">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                placeholder="e.g. +971-50-123-4567"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                placeholder="Briefly tell us what this is about"
                className="w-full border border-gray-300 rounded-md p-3 text-gray-700 bg-white"
              />
            </div>

            <div className="flex justify-left">
              <button
                type="submit"
                className="bg-[#891F1A] text-white px-8 py-3 rounded-md hover:bg-[#6f1814] transition"
              >
                Send Request
              </button>
            </div>
          </form>
        </div>

        <div className="w-full mr-[10px] sm:w-[500px] h-[600px] bg-[#8B8491] rounded-xl" />
      </section>
      <div className="w-full bg-white h-[100px]"></div>

      {/* Contact Info */}
      <section className="bg-[#FAFAFA] px-4 sm:px-6 lg:px-24 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {contactItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center sm:items-start transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                {item.icon}
                <div>
                  <h3 className="text-[28px]" style={{ color: item.color }}>
                    {item.title}
                  </h3>
                  <p className="text-[16px]" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
              </div>
              <div
                className="mt-2 w-0 group-hover:w-24 h-[2px] transition-all duration-300"
                style={{ backgroundColor: item.color }}
              />
            </a>
          ))}
        </div>
      </section>

      <Footer />
      <ChatBot />
    </div>
  );
}
