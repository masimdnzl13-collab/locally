import { Undo2 } from "lucide-react";
import { getPendingRefunds } from "@/lib/admin/queries";
import RefundReviewRow from "@/components/admin/refund-review-row";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminRefundsPage() {
  const refunds = await getPendingRefunds();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-ink-900">İade Talepleri</h1>

      {refunds.length === 0 ? (
        <EmptyState icon={Undo2} title="Bekleyen iade talebi yok" />
      ) : (
        <div className="space-y-3">
          {refunds.map((refund) => (
            <RefundReviewRow key={refund.purchaseId} refund={refund} />
          ))}
        </div>
      )}
    </div>
  );
}
