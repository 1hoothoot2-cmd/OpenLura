import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "Live Map | SkyTracker",
  description:
    "Explore live aircraft worldwide with SkyTracker's interactive aviation map.",
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
