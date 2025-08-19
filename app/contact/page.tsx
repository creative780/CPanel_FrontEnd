'use client'
import React, { useState} from "react";
import Header from "../components/header";
import LogoSection from "../components/LogoSection";
import Footer from "../components/Footer";
import MobileTopBar from "../components/HomePageTop";
import Toastify from "toastify-js";

export default function Contact() {
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

    return(
        <>
        <Header />
      <MobileTopBar />
        <LogoSection />
      
    <section className="relative px-4 sm:px-6 lg:px-24 py-24 bg-white" id="contact-form">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#891F1A] mb-10">
            Request a Call-Back
        </h2>

        <div className="relative z-20 -mt-24 px-4 sm:px-6 lg:px-24">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1">
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

                <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1">
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
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-1">
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
                <div className="flex justify-center">
                <button
                    type="submit"
                    className="bg-[#891F1A] text-white px-8 py-3 rounded-md hover:bg-[#6f1814] transition"
                >
                    Send Request
                </button>
                </div>
            </form>
            </div>
        </div>
        </section>
        
        <Footer />
</>
    )   
}