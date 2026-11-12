import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

export const metadata: Metadata = {
  title: { default: "SpeakUp AI – Your Personal English Coach", template: "%s · SpeakUp AI" },
  description: "Stop Hesitating. Start Speaking. Free AI English coach, 30-day speaking challenge, IELTS practice and job interview simulator.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "SpeakUp AI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2747e0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeScript = `try{var t=JSON.parse(localStorage.getItem('speakup:theme')||'"system"');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
