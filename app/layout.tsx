'use client';

import './globals.css';
import 'aos/dist/aos.css'; // AOS styles
import 'react-toastify/dist/ReactToastify.css'; // Toastify styles

import AOS from 'aos';
import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);

  return (
    <html lang="en">
      <body>
        {children}
        {/* Toast container globally mounted */}
        <ToastContainer
          position="top-center"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          className="z-[9999]" // Ensure it's above modals
        />
      </body>
    </html>
  );
}
