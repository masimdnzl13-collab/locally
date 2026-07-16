import Link from "next/link";
import { Package } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ComingSoon from "@/components/coming-soon";

export default function KuponlarPage() {
  return (
    <ComingSoon
      title="Tek kullanımlık kuponlar çok yakında"
      description="Şu an paket ve flaş fırsat yayınlayabiliyorsun; ayrı bir kupon kodu sistemi üzerinde çalışıyoruz."
    >
      <Link href="/panel/paketler" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6")}>
        <Package size={15} className="mr-1.5" />
        Paketlerime git
      </Link>
    </ComingSoon>
  );
}
