"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Compass, MailCheck, Store, Heart, QrCode, Percent, Megaphone, CalendarClock, ChevronLeft } from "lucide-react";
import { signUpAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

type Role = "user" | "business";

const ROLE_CARDS: {
  role: Role;
  icon: typeof Compass;
  title: string;
  description: string;
  bullets: { icon: typeof Compass; label: string }[];
}[] = [
  {
    role: "user",
    icon: Compass,
    title: "Müşteri",
    description: "Yerel fırsatları keşfetmek istiyorum",
    bullets: [
      { icon: Compass, label: "Kampanyaları keşfet" },
      { icon: Heart, label: "Favorilerine kaydet" },
      { icon: QrCode, label: "QR ile paketini kullan" },
    ],
  },
  {
    role: "business",
    icon: Store,
    title: "İşletme",
    description: "İşletmemi Locally'de yayınlamak istiyorum",
    bullets: [
      { icon: Percent, label: "Paket ve kampanya yayınla" },
      { icon: Megaphone, label: "Flaş fırsat oluştur" },
      { icon: CalendarClock, label: "Etkinlik yayınla" },
    ],
  },
];

export default function SignupForm({
  initialRole,
}: {
  initialRole?: "user" | "business";
}) {
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) setError(result.error);
      if (result?.needsEmailConfirmation) setNotice(result.message ?? null);
    });
  }

  if (notice) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <MailCheck size={22} strokeWidth={1.75} />
        </div>
        <p className="text-sm text-foreground">{notice}</p>
      </div>
    );
  }

  // Step 1 — "Continue as" role chooser
  if (!role) {
    return (
      <div>
        <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
          Nasıl devam etmek istersin?
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_CARDS.map((card) => (
            <button
              key={card.role}
              type="button"
              onClick={() => setRole(card.role)}
              className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-white">
                <card.icon size={18} strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-semibold text-foreground">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
              <ul className="space-y-1.5">
                {card.bullets.map((b) => (
                  <li key={b.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <b.icon size={13} className="shrink-0 text-teal-600" />
                    {b.label}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="font-semibold text-teal-700">
            Giriş yap
          </Link>
        </p>
      </div>
    );
  }

  // Step 2 — account details for the chosen role
  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="role" value={role} />

      <button
        type="button"
        onClick={() => setRole(null)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft size={14} />
        {role === "user" ? "Müşteri" : "İşletme"} olarak devam ediyorsun · değiştir
      </button>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Ad Soyad
        </label>
        <Input
          type="text"
          name="fullName"
          required
          placeholder="Adın Soyadın"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          E-posta
        </label>
        <Input
          type="email"
          name="email"
          required
          placeholder="sen@ornek.com"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Şifre
        </label>
        <Input
          type="password"
          name="password"
          required
          minLength={6}
          placeholder="En az 6 karakter"
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Kayıt Ol</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-semibold text-teal-700">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
