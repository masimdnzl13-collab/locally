import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getAnnouncementHistory } from "@/lib/announcements/queries";

const SEGMENT_LABEL: Record<string, string> = {
  tumu: "Tüm müşterilerim",
  yeni: "Yeni",
  sadik: "Sadık",
  uyuyan: "Uyuyan",
};

const CHANNEL_LABEL: Record<string, string> = {
  sms: "SMS",
  email: "E-posta",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DuyurularPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const history = await getAnnouncementHistory(business.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">Duyurular</h1>
        <Link
          href="/panel/duyurular/yeni"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          + Yeni Duyuru
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">Henüz duyuru göndermedin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-700">
                    {CHANNEL_LABEL[item.channel] ?? item.channel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {SEGMENT_LABEL[item.target_segment] ?? item.target_segment}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {item.sent_at ? formatDateTime(item.sent_at) : formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-dark-900">{item.content}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {item.recipient_count} alıcı
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
