"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

// P5 — Tideline paneli (Calls / Orders / Reservations / Brain) Locally
// kabuğunun İÇİNDE, iframe olarak açılır. Yeni sekme yerine iframe seçildi:
// kullanıcı Locally menüsünden ve markasından hiç çıkmıyor, pop-up
// engelleyicisine takılmıyor, oturum düşerse (Tideline'dan gelen
// "tideline:session-expired" mesajıyla) sessizce yeniden bağlanıyor.
// Her açılışta /api/tideline/sso'dan tek kullanımlık, 60 sn'lik yeni bir
// assertion alınır — sunucuda render edilip router cache'inde bayatlamasın
// diye bu istek client'ta yapılıyor.
async function fetchSsoUrl(): Promise<string> {
  const res = await fetch("/api/tideline/sso", { method: "POST", cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Tideline'a bağlanılamadı.");
  return body.url;
}

export default function TidelineFrame() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const connecting = useRef(false);

  const connect = useCallback(async () => {
    if (connecting.current) return;
    connecting.current = true;
    setError("");
    try {
      setSrc(await fetchSsoUrl());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tideline'a bağlanılamadı.");
    } finally {
      connecting.current = false;
    }
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    if (!src) return;
    const tidelineOrigin = new URL(src).origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== tidelineOrigin) return;
      if ((event.data as { type?: string } | null)?.type === "tideline:session-expired") void connect();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src, connect]);

  // Yeni sekme: pencereyi tıklamayla SENKRON aç (pop-up engelleyici), sonra
  // yeni bir assertion alıp oraya yönlendir. embedded=1 düşürülür ki
  // bağımsız sekmede Tideline kendi çıkış butonunu göstersin.
  const openInNewTab = async () => {
    const win = window.open("about:blank", "_blank");
    try {
      const url = (await fetchSsoUrl()).replace("&embedded=1", "");
      if (win) win.location.href = url;
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : "Tideline'a bağlanılamadı.");
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col md:h-dvh">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 md:px-6">
        <h1 className="text-sm font-semibold text-foreground">Tideline</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void connect()}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={14} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => void openInNewTab()}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink size={14} />
            Yeni sekmede aç
          </button>
        </div>
      </div>
      {error ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void connect()}
            className="text-sm font-medium text-teal-600 underline underline-offset-4"
          >
            Tekrar dene
          </button>
        </div>
      ) : src ? (
        <iframe key={src} src={src} title="Tideline" className="w-full flex-1 border-0" />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tideline&apos;a bağlanılıyor…
        </div>
      )}
    </div>
  );
}
