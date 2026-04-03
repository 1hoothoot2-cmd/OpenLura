import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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
  nl: "AI die leert hoe jij werkt. Jouw adaptieve AI-werkruimte.",
  de: "KI, die lernt, wie du arbeitest. Dein adaptiver KI-Arbeitsbereich.",
  fr: "Une IA qui apprend comment vous travaillez. Votre espace de travail IA adaptatif.",
  es: "IA que aprende cómo trabajas. Tu espacio de trabajo de IA adaptativo.",
  en: "AI that learns how you work. Your adaptive AI workspace.",
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
  title: "OpenLura",
  description: "AI that learns how you work.",
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
      </head>
            <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}