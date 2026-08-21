"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";
import { dismissPasswordReminderAction } from "@/lib/business/actions";

// Panele ilk girişte gösterilen, kapatılabilir ama göz ardı edilemeyecek
// şifre hatırlatması (bkz. P28). Sahada hızı bozmaması için hiçbir zaman
// engelleyici bir modal DEĞİL — sadece "Kapat"a basılana kadar üstte kalan
// bir şerit. Kapatma durumu businesses.password_reminder_dismissed_at'e
// yazılır, bu yüzden bir daha görünmez.
export default function PasswordReminderBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    startTransition(() => {
      dismissPasswordReminderAction();
    });
  }

  return (
    <div className="flex items-start gap-3 border-b border-discount-200 bg-discount-50 px-4 py-3 md:px-8">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-discount-700" />
      <div className="flex-1 text-sm text-discount-900">
        <span className="font-semibold">Şifreni güçlendir. </span>
        Kayıt sırasında girdiğin şifre kolay tahmin edilebiliyorsa, müşteri verilerini korumak için{" "}
        <Link href="/panel/ayarlar" className="font-semibold underline underline-offset-2">
          Ayarlar
        </Link>{" "}
        bölümünden değiştir.
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Hatırlatmayı kapat"
        className="shrink-0 rounded-md p-1 text-discount-700 transition-colors hover:bg-discount-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
