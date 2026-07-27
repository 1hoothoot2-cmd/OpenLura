export type SkyTrackerApiConfigResult =
  | Readonly<{ configured: true; baseUrl: string }>
  | Readonly<{ configured: false; reason: "missing" | "production-localhost" | "invalid" }>;

export function resolveSkyTrackerApiConfig(
  value = process.env.NEXT_PUBLIC_SKYTRACKER_API_BASE_URL,
  environment = process.env.NODE_ENV,
): SkyTrackerApiConfigResult {
  const candidate = value?.trim();
  if (!candidate) return { configured: false, reason: "missing" };
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { configured: false, reason: "invalid" };
    }
    if (
      environment === "production" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      return { configured: false, reason: "production-localhost" };
    }
    return {
      configured: true,
      baseUrl: url.toString().replace(/\/+$/, ""),
    };
  } catch {
    return { configured: false, reason: "invalid" };
  }
}
