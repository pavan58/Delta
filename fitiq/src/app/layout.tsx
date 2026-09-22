import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/client/store";
import { Nav, MobileNav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "FITIQ — Your Body. Your Style. Your Budget.", template: "%s · FITIQ" },
  description: "AI-powered men's fit & shopping intelligence for Indian shoppers. Fit risk, complete outfits within budget, wardrobe gaps and price comparison.",
};

export const viewport: Viewport = { themeColor: "#15130F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans">
        <StoreProvider>
          <DemoBanner />
          <Nav />
          <main className="pb-24 md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
        </StoreProvider>
      </body>
    </html>
  );
}
