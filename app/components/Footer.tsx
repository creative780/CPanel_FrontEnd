"use client";

import React, { useState, useEffect } from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedin,
  FaTwitter,
} from "react-icons/fa";
import { API_BASE_URL } from "../utils/api";

const services = [
  "Digital Printing",
  "Offset Printing",
  "Raised UV | Spot UV",
  "Embossing | Debossing",
  "Foiling | Raised Foiling",
  "Large Format Printing",
  "Direct to Film Printing",
  "Sublimation",
  "UV Printing",
  "Screen Printing",
];

const mapItems = [
  "UAE Location",
  "Branch Map",
  "Google Pin",
  "Nearby Landmarks",
];

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

export default function Footer() {
  const [openCols, setOpenCols] = useState<{ [key: string]: boolean }>({
    services: false,
    map: false,
  });

  const [categories, setCategories] = useState<string[]>([]);

  const toggleDropdown = (key: string) => {
    setOpenCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const slugify = (text: string) =>
    "/" + text.toLowerCase().replace(/[\s|]+/g, "-");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/show_nav_items/`, withFrontendKey())
      .then((res) => res.json())
      .then((data) => {
        const catNames = data
          ?.map((category: any) => category.name)
          .slice(0, 8);
        setCategories(catNames || []);
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  const midPoint = Math.ceil(categories.length / 2);
  const firstCol = categories.slice(0, midPoint);
  const secondCol = categories.slice(midPoint);

  return (
    <footer
      style={{ fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif" }}
      className="bg-[#891F1A] text-white font-normal text-sm"
      role="contentinfo"
    >
      {/* ===================== Top Grid ===================== */}
      <div className="container mx-auto px-5 py-16 flex flex-wrap md:flex-nowrap gap-y-10">
        {/* Column 1: Logo + Company Info */}
        <div className="w-full md:w-1/5 flex flex-col pr-5">
          <img
            src="/images/logowhite.png"
            alt="CreativePrints Logo"
            width={240}
            height={80}
            loading="lazy"
            decoding="async"
            className="object-contain mb-3"
            onError={(e) => (e.currentTarget.src = "/images/default.jpg")}
          />
          {/* p → Regular (400) */}
          <p className="text-sm leading-relaxed font-normal">
            Air plant banjo lyft occupy retro adaptogen indego.
          </p>
        </div>

        {/* Column 2 & 3: Categories */}
        {categories.length > 0 && (
          <div className="w-full md:w-2/5 px-4 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              {/* h2 → Semi Bold (600) */}
              <h2 className="font-semibold tracking-widest text-sm mb-3 uppercase">
                Categories
              </h2>
              <ul className="space-y-2">
                {firstCol.map((cat, idx) => (
                  <li key={idx}>
                    {/* a → Regular / Medium */}
                    <a
                      href={slugify(cat)}
                      className="hover:underline font-normal"
                      aria-label={`Go to ${cat}`}
                    >
                      {cat}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {secondCol.length > 0 && (
              <div className="flex-1">
                <h2 className="sr-only">Categories Column 2</h2>
                <ul className="space-y-2">
                  {secondCol.map((cat, idx) => (
                    <li key={idx}>
                      <a
                        href={slugify(cat)}
                        className="hover:underline font-normal"
                        aria-label={`Go to ${cat}`}
                      >
                        {cat}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Column 4: Services (Toggle) */}
        <div className="w-full md:w-1/5 px-4">
          {/* button → Medium (500) */}
          <button
            onClick={() => toggleDropdown("services")}
            className="flex items-center gap-2 font-medium tracking-widest text-sm mb-3 uppercase"
            aria-expanded={openCols.services}
          >
            <span>{openCols.services ? "▾" : "▸"}</span> Services
          </button>
          <div
            className={`transition-all duration-300 overflow-hidden ${
              openCols.services ? "max-h-[500px] mt-1" : "max-h-0"
            }`}
          >
            <ul className="space-y-2 ml-6">
              {services.map((srv, i) => (
                <li key={i}>
                  <a
                    href={`/services${slugify(srv)}`}
                    className="hover:underline font-normal"
                    aria-label={`Service: ${srv}`}
                  >
                    {srv}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Column 5: Map Info (Toggle) */}
        <div className="w-full md:w-1/5 px-4">
          <button
            onClick={() => toggleDropdown("map")}
            className="flex items-center gap-2 font-medium tracking-widest text-sm mb-3 uppercase"
            aria-expanded={openCols.map}
          >
            <span>{openCols.map ? "▾" : "▸"}</span> Map
          </button>
          <div
            className={`transition-all duration-300 overflow-hidden ${
              openCols.map ? "max-h-[500px] mt-1" : "max-h-0"
            }`}
          >
            <ul className="space-y-2 ml-6">
              {mapItems.map((item, i) => (
                <li key={i}>
                  <a
                    href={`/map${slugify(item)}`}
                    className="hover:underline font-normal"
                    aria-label={`Map link: ${item}`}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ===================== Divider ===================== */}
      <div className="bg-white bg-opacity-10 h-px mx-5 my-2" />

      {/* ===================== Bottom Bar ===================== */}
      <div className="container mx-auto px-5 py-4 flex flex-col sm:flex-row justify-between items-center">
        {/* p → Light (300) for footer info */}
        <p className="text-[#F3EFEE] text-sm text-center sm:text-left font-light">
          © 2025 CreativePrints — All rights reserved.
        </p>
        <div className="flex gap-4 mt-2 sm:mt-0 text-white text-lg">
          <a
            href="https://www.facebook.com/creativeconnectuae/"
            className="hover:text-gray-300 font-normal"
            aria-label="Facebook"
          >
            <FaFacebookF />
          </a>
          <a
            href="https://x.com/"
            className="hover:text-gray-300 font-normal"
            aria-label="Twitter"
          >
            <FaTwitter />
          </a>
          <a
            href="https://www.instagram.com/creativeconnectuae/"
            className="hover:text-gray-300 font-normal"
            aria-label="Instagram"
          >
            <FaInstagram />
          </a>
          <a
            href="https://www.linkedin.com/company/creative-connect-advertising-llc/"
            className="hover:text-gray-300 font-normal"
            aria-label="LinkedIn"
          >
            <FaLinkedin />
          </a>
        </div>
      </div>

      <div className="pb-4" />
    </footer>
  );
}
