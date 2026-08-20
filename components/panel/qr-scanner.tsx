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
        // Kamera hiç başlamamışsa (izin verilmedi, kamera yok, http
        // bağlamı vb.) html5-qrcode'un stop() metodu bir Promise DÖNMEDEN
        // senkron throw atabilir ("Cannot stop, scanner is not running or
        // paused") — bu durumda .then/.catch zinciri hiç kurulamaz ve hata
        // React'in en yakın hata sınırına kadar yükselip tüm ekranı
        // çökertir (elle kod girip sonucu gördüğün an tetiklenir, çünkü
        // bileşen o an unmount olur). Senkron try/catch bunu önler.
        try {
          instance
            .stop()
            .then(() => instance.clear())
            .catch(() => {});
        } catch {
          // yukarıdaki not
        }
      }
    };
  }, []);

  useEffect(() => {
    const instance = scannerRef.current;
    if (!instance) return;
    if (paused) {
      try {
        instance.pause(true);
      } catch {
        // kamera hiç başlamamışsa (izin yok, HTTPS dışı bağlam vb.) pause
        // atılamaz; elle kod girişi bu durumdan etkilenmez.
      }
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
        className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-navy-950"
      />
      {cameraError && (
        <p className="mt-3 text-center text-sm text-danger-600">{cameraError}</p>
      )}
    </div>
  );
}
