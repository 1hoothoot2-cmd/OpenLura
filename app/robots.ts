import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/skytracker", "/skytracker/live"],
      disallow: ["/api/"],
    },
    sitemap: "https://openlura.ai/sitemap.xml",
    host: "https://openlura.ai",
  };
}
