import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://openlura.ai",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://openlura.ai/skytracker",
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://openlura.ai/skytracker/live",
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
