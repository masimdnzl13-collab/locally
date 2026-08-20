import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { TEST_LAB_ENABLED } from "@/lib/config/pilot";
import { getTestLabQrItems } from "@/lib/test-lab/queries";
import PrintButton from "@/components/test-lab/print-button";

export const metadata = { robots: { index: false, follow: false } };

export default async function TestLabPrintPage() {
  const user = await getCurrentUser();
  const allowed = TEST_LAB_ENABLED || user?.role === "admin";
  if (!allowed) notFound();

  const items = (await getTestLabQrItems()).filter((i) => i.scenario === "valid");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">Yazdırılabilir QR Sayfası</h1>
          <p className="text-sm text-muted-foreground">
            A4&apos;e sığacak şekilde hazırlandı — tarayıcının yazdır (Ctrl/Cmd+P) diyaloğunda
            kağıt boyutu A4, kenar boşluğu &quot;varsayılan&quot; seçili olsun.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Örnek 1: işletme standı — masa üstü kart taklidi */}
      <section className="mb-8 break-inside-avoid rounded-xl border-2 border-dashed border-navy-300 p-6 text-center print:border-navy-900">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Locally</p>
        <h2 className="mt-1 text-lg font-bold text-navy-900">Kampanyanı QR ile Doğrula</h2>
        {items[0]?.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={items[0].qrDataUrl}
            alt="Örnek QR"
            className="mx-auto my-4 h-48 w-48 rounded-lg border border-border bg-white p-2"
          />
        ) : null}
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          Kasadaki telefonu bu kareye tut ya da kodu elle gir. Hakkın anında düşer.
        </p>
        <p className="mt-3 font-mono text-sm font-semibold text-foreground">{items[0]?.code}</p>
        <p className="mt-4 text-[11px] text-muted-foreground">
          — bu, işletmelere basılı olarak verilebilecek örnek bir masa standıdır —
        </p>
      </section>

      {/* Örnek 2: demo QR kodları listesi */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="break-inside-avoid rounded-lg border border-border p-4 text-center"
          >
            <p className="text-xs font-semibold text-muted-foreground">{item.title}</p>
            {item.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.qrDataUrl}
                alt={`QR: ${item.code}`}
                className="mx-auto my-2 h-32 w-32 rounded-md border border-border bg-white p-1"
              />
            ) : null}
            <p className="break-all font-mono text-xs font-semibold text-foreground">
              {item.code}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
