import type { Metadata } from "next";
import { SkyGuideDashboard } from "@/features/skytracker/skyguide/presentation/SkyGuideDashboard";

export const metadata: Metadata = {
  title: "SkyGuide",
  description: "Meet SkyGuide, SkyTracker’s focused Aviation Intelligence Assistant.",
  alternates: { canonical: "/skytracker/guide" },
  robots: { index: false, follow: false },
};

export default function SkyGuidePage() {
  return <SkyGuideDashboard />;
}
