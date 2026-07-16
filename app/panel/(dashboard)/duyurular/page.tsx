import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getMyBusiness } from "@/lib/business/current";
import { getAnnouncementHistory } from "@/lib/announcements/queries";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Duyurular
        </h1>
        <Link
          href="/panel/duyurular/yeni"
          className={cn(buttonVariants({ variant: "teal", size: "sm" }))}
        >
          + Yeni Duyuru
        </Link>
      </div>

      {history.length === 0 ? (
        <EmptyState icon={Megaphone} title="Henüz duyuru göndermedin" />
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="teal">{CHANNEL_LABEL[item.channel] ?? item.channel}</Badge>
                  <Badge variant="neutral">{SEGMENT_LABEL[item.target_segment] ?? item.target_segment}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.sent_at ? formatDateTime(item.sent_at) : formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-foreground">{item.content}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {item.recipient_count} alıcı
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
