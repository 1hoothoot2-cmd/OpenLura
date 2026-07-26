import { ImageResponse } from "next/og";

export const alt = "OpenLura — Specialized AI Products";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenLuraOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background:
            "radial-gradient(circle at 78% 18%, rgba(20,184,212,.3), rgba(37,99,235,.14) 38%, rgba(5,5,16,0) 72%), #050510",
          color: "white",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, Helvetica, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "72px 76px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid rgba(103,232,249,.08)",
            borderRadius: "50%",
            display: "flex",
            height: 520,
            position: "absolute",
            right: -110,
            top: -240,
            width: 520,
          }}
        />
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <div
            style={{
              alignItems: "center",
              background: "#0b1125",
              border: "1px solid rgba(96,165,250,.3)",
              borderRadius: 16,
              color: "#60a5fa",
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              height: 54,
              justifyContent: "center",
              width: 54,
            }}
          >
            OL
          </div>
          <span style={{ fontSize: 28, fontWeight: 700 }}>OpenLura</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "rgba(219,234,254,.76)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 5,
            }}
          >
            SPECIALIZED AI PRODUCTS
          </span>
          <span
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.04,
              marginTop: 28,
              maxWidth: 900,
            }}
          >
            Technology shaped around its domain.
          </span>
          <span
            style={{
              color: "rgba(255,255,255,.56)",
              fontSize: 24,
              marginTop: 34,
            }}
          >
            Focused products for real interests and practical use cases.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
