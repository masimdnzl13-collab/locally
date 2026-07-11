import { getPendingRefunds } from "@/lib/admin/queries";
import RefundReviewRow from "@/components/admin/refund-review-row";

export default async function AdminRefundsPage() {
  const refunds = await getPendingRefunds();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-xl font-extrabold tracking-tight text-dark-900">İade Talepleri</h1>

      {refunds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
          Bekleyen iade talebi yok.
        </p>
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
