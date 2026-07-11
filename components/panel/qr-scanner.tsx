"use client";

import { useEffect, useRef, useState } from "react";

const SCANNER_ELEMENT_ID = "locally-qr-scanner";

export default function QrScanner({
  onScan,
  paused,
}: {
  onScan: (code: string) => void;
  paused: boolean;
}) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => onScanRef.current(decodedText),
          () => {
            // okuma denemeleri sürekli tetiklenir, sessizce yok say
          }
        )
        .catch(() => {
          if (!cancelled) {
            setCameraError("Kamera açılamadı. Kodu elle girebilirsin.");
          }
        });
    });

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      if (instance) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const instance = scannerRef.current;
    if (!instance) return;
    if (paused) {
      instance.pause(true);
    } else {
      try {
        instance.resume();
      } catch {
        // henüz başlamamış olabilir
      }
    }
  }, [paused]);

  return (
    <div>
      <div
        id={SCANNER_ELEMENT_ID}
        className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-dark-950"
      />
      {cameraError && (
        <p className="mt-3 text-center text-sm text-red-600">{cameraError}</p>
      )}
    </div>
  );
}
