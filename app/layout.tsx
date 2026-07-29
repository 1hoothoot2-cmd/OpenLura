import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://openlura.ai"),
  title: {
    default: "OpenLura | Specialized AI Products",
    template: "%s | OpenLura",
  },
  description:
    "OpenLura is a platform for focused, AI-powered products designed around specific interests, hobbies, and practical use cases.",
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "OpenLura",
    title: "OpenLura | Specialized AI Products",
    description:
      "Focused, AI-powered products designed around specific interests, hobbies, and practical use cases.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OpenLura — Specialized AI Products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenLura | Specialized AI Products",
    description:
      "Focused, AI-powered products designed around specific interests, hobbies, and practical use cases.",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050510",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
