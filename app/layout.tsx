import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

async function detectLangFromHeaders(): Promise<string> {
  try {
    const headersList = await headers();
    const acceptLang = headersList.get("accept-language") || "";
    const primary = acceptLang.split(",")[0]?.split(";")[0]?.trim().toLowerCase() || "en";
    if (primary.startsWith("nl")) return "nl";
    if (primary.startsWith("de")) return "de";
    if (primary.startsWith("fr")) return "fr";
    if (primary.startsWith("es")) return "es";
    if (primary.startsWith("pt")) return "pt";
    return "en";
  } catch {
    return "en";
  }
}

const descriptions: Record<string, string> = {
  nl: "OpenLura is jouw persoonlijke AI-werkruimte die leert hoe jij werkt. Onthoudt context, verbetert met feedback en helpt je sneller werken. Probeer gratis.",
  de: "OpenLura ist dein persönlicher KI-Arbeitsbereich, der lernt, wie du arbeitest. Kontext wird gespeichert, Feedback verbessert die KI. Kostenlos testen.",
  fr: "OpenLura est votre espace de travail IA personnel qui apprend comment vous travaillez. Mémorise le contexte et s'améliore. Essai gratuit.",
  es: "OpenLura es tu espacio de trabajo IA personal que aprende cómo trabajas. Recuerda contexto y mejora con feedback. Pruébalo gratis.",
  en: "OpenLura is your personal AI workspace that learns how you work. Remembers context, improves with feedback, and helps you move faster. Try it free.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenLura – Adaptive AI Workspace | Personal AI Chat",
  description: "OpenLura is your personal AI workspace that learns how you work. Remembers context, improves with feedback, and helps you move faster. Try it free.",
  icons: {
    icon: "/openlura-logo.png",
    apple: "/openlura-logo.png",
  },
  alternates: {
    languages: {
      "nl": "/",
      "de": "/",
      "fr": "/",
      "es": "/",
      "en": "/",
      "x-default": "/",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await detectLangFromHeaders();
  const description = descriptions[lang] ?? descriptions["en"];

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="description" content={description} />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6179971963487173"
          crossOrigin="anonymous"
        />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-16726641191"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-16726641191');
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
