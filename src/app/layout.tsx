import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: {
    default: "IQRAPRIME — Kahani Jo Dil Chhoo Jaye",
    template: "%s · IQRAPRIME",
  },
  description:
    "IQRAPRIME — stream curated movies and Pakistani dramas. Kahani Jo Dil Chhoo Jaye. Install as an app and watch anywhere.",
  applicationName: "IQRAPRIME",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IQRAPRIME",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#05070B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:bg-gold focus:text-ink focus:px-3 focus:py-2 focus:rounded-lg"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="pt-16 min-h-[calc(100dvh-4rem)]">
          {children}
        </main>
        <Footer />
        <RegisterSW />
      </body>
    </html>
  );
}
