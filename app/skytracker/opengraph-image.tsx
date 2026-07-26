import { ImageResponse } from "next/og";

export const alt =
  "SkyTracker by OpenLura — Aircraft tracking, thoughtfully presented";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function SkyTrackerOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "radial-gradient(circle at 82% 18%, rgba(14,116,144,.46), rgba(23,37,84,.2) 48%, rgba(3,7,18,0) 78%), #030712",
          color: "white",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, Helvetica, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "66px 70px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid rgba(103,232,249,.12)",
            borderRadius: "50%",
            display: "flex",
            height: 420,
            position: "absolute",
            right: -35,
            top: -155,
            width: 420,
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "rgba(251,191,36,.06)",
            border: "1px solid rgba(253,230,138,.24)",
            borderRadius: 24,
            color: "rgba(254,243,199,.9)",
            display: "flex",
            fontSize: 15,
            fontWeight: 700,
            gap: 14,
            letterSpacing: 2,
            padding: "12px 20px",
            width: 285,
          }}
        >
          <span
            style={{
              background: "#fcd34d",
              borderRadius: "50%",
              display: "flex",
              height: 8,
              width: 8,
            }}
          />
          ANDROID IN DEVELOPMENT
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            SkyTracker
          </span>
          <span
            style={{
              color: "rgba(165,243,252,.72)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 5,
              marginTop: 22,
            }}
          >
            BY OPENLURA
          </span>
          <span
            style={{
              color: "rgba(255,255,255,.72)",
              fontSize: 29,
              marginTop: 62,
            }}
          >
            Aircraft tracking, thoughtfully presented.
          </span>
          <span
            style={{
              color: "rgba(255,255,255,.42)",
              fontSize: 21,
              marginTop: 28,
            }}
          >
            Smooth movement · Aircraft identity · Flight context
          </span>
        </div>
        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(59,130,246,.12), #67e8f9)",
            borderRadius: 3,
            bottom: 146,
            display: "flex",
            height: 5,
            position: "absolute",
            right: 60,
            transform: "rotate(-15deg)",
            width: 390,
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "rgba(251,191,36,.12)",
            border: "2px solid rgba(253,230,138,.58)",
            borderRadius: "50%",
            bottom: 184,
            color: "#fef3c7",
            display: "flex",
            fontSize: 28,
            height: 56,
            justifyContent: "center",
            position: "absolute",
            right: 220,
            transform: "rotate(-12deg)",
            width: 56,
          }}
        >
          ✈
        </div>
      </div>
    ),
    size,
  );
}
