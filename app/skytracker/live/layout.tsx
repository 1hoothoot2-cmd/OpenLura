import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "Live Map | SkyTracker",
  description:
    "Explore the interactive SkyTracker web map foundation while live aircraft features remain in development.",
  alternates: {
    canonical: "/skytracker/live",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function SkyTrackerLiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
