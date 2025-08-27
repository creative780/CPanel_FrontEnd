import "./globals.css";
import "aos/dist/aos.css";
import "react-toastify/dist/ReactToastify.css";

import { Poppins } from "next/font/google";
import Providers from "./providers";


const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      {/* font-sans is mapped to var(--font-poppins) via tailwind config OR body CSS fallback */}
      <body className="font-sans">
        {children}
        {/* Client-only stuff (AOS init, ToastContainer) lives here */}
        <Providers />
      </body>
    </html>
  );
}
