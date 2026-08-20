"use client";

import { useEffect } from "react";

// app/error.tsx kök layout İÇİNDEKİ (page/nested layout) hataları yakalar;
// layout.tsx'in kendisi patlarsa (ör. şehir/kullanıcı okuma hatası) devreye
// bu dosya girer — Next.js kuralı gereği kendi <html>/<body>'sini basmalı.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app-global-error]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#FAFAF9",
          color: "#101B29",
        }}
      >
        <div
          style={{
            marginBottom: 20,
            width: 64,
            height: 64,
            borderRadius: "9999px",
            background: "#FDF0EE",
            color: "#7E2B1B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ⚠️
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Bir şeyler ters gitti</h1>
        <p style={{ marginTop: 12, maxWidth: 360, color: "#6F6A5C", fontSize: 14 }}>
          Uygulama beklenmedik bir hatayla karşılaştı. Bu bizim tarafımızdaki bir hata.
        </p>
        <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
          <button
            onClick={() => reset()}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 14,
              background: "#101B29",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
          <a
            href="/"
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 14,
              border: "1px solid #E8E6E1",
              background: "#fff",
              color: "#101B29",
              fontWeight: 600,
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            Ana sayfa
          </a>
        </div>
      </body>
    </html>
  );
}
