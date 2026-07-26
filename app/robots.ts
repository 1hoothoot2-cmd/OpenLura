import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/skytracker", "/privacy"],
      disallow: [
        "/api/",
        "/auth/",
        "/chat",
        "/test",
        "/analytics",
        "/login",
        "/brain",
        "/brain/",
        "/personal-dashboard",
        "/personal-workspace",
        "/personal-workspace/",
        "/photo-studio",
      ],
    },
    sitemap: "https://openlura.ai/sitemap.xml",
    host: "https://openlura.ai",
  };
}
