import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Azure Gigs", template: "%s | Azure Gigs" },
  description: "Azure Gigs - a virtual Azure cloud learning simulator. Not affiliated with or endorsed by Microsoft.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c81" };

const themeScript = `try{var t=localStorage.getItem('ag-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
