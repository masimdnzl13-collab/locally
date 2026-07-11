import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusinessBySlug } from "@/lib/business/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BusinessProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const business = await getBusinessBySlug(params.slug);

  if (!business) notFound();

  const mapsUrl =
    business.lat && business.lng
      ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          `${business.name} ${business.address ?? ""} ${business.city}`
        )}`;

  return (
    <div>
      <div className="relative h-48 bg-slate-100 sm:h-64">
        {business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.cover_url}
            alt={business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            🏪
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {BUSINESS_CATEGORY_LABELS[business.category]}
        </span>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-dark-900">
          {business.name}
        </h1>
        {business.description && (
          <p className="mt-2 text-sm text-slate-600">{business.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-dark-900 hover:bg-slate-50"
          >
            📍 {business.district ?? business.city}
          </a>
          {business.instagram && (
            <a
              href={`https://instagram.com/${business.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 font-medium text-dark-900 hover:bg-slate-50"
            >
              📷 Instagram
            </a>
          )}
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-dark-900">Paketler</h2>
          {business.packages.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bu işletmenin şu an aktif paketi yok, yakında eklenecek.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {business.packages.map((pkg) => {
                const savings = Math.round(
                  (1 - pkg.sale_price / pkg.summer_reference_price) * 100
                );
                return (
                  <Link
                    key={pkg.id}
                    href={`/paket/${pkg.id}`}
                    className="flex flex-col rounded-2xl border border-slate-200 p-4 hover:shadow-md"
                  >
                    <span className="mb-1 self-start rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {pkg.usage_count} kullanım
                    </span>
                    <h3 className="font-bold text-dark-900">{pkg.title}</h3>
                    <div className="mt-3 flex items-end justify-between rounded-xl bg-slate-50 p-3">
                      <div>
                        <p className="text-xs text-slate-400 line-through decoration-2">
                          Yaz: {formatTL(pkg.summer_reference_price)}
                        </p>
                        <p className="text-xl font-extrabold text-accent-500">
                          Bugün: {formatTL(pkg.sale_price)}
                        </p>
                      </div>
                      <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent-700">
                        %{savings}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-dark-900">
            Yaklaşan Etkinlikler
          </h2>
          {business.events.length === 0 ? (
            <p className="text-sm text-slate-500">
              Şu an yaklaşan bir etkinlik yok.
            </p>
          ) : (
            <div className="space-y-3">
              {business.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-bold text-dark-900">{event.title}</p>
                    <p className="text-sm text-slate-500">
                      {formatEventDate(event.event_at)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary-600">
                    {event.is_paid ? formatTL(event.ticket_price ?? 0) : "Ücretsiz"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
