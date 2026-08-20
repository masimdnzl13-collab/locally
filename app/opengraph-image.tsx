import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Locally — Kasabanın kışı da güzel";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#101B29",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#DD6B0F",
              display: "flex",
            }}
          />
          <span style={{ fontSize: 28, color: "#3AA5A5", fontWeight: 700, letterSpacing: 2 }}>
            LOCALLY
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#FAFAF9", lineHeight: 1.15 }}>
          Kasabanın kışı
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#FAFAF9", lineHeight: 1.15 }}>
          da güzel.
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 26, color: "#8497B3" }}>
          Sezon dışında Bodrum&apos;da yerel fırsatları keşfet
        </div>
      </div>
    ),
    { ...size }
  );
}
