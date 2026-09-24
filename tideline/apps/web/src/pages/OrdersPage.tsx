import { useEffect, useState } from "react";
import { api, money, userMessage, type OrderRow } from "../api";
import { useAuth } from "../auth";
import { DataTable, Skeleton, StatusBadge } from "../ui";

export function OrdersPage({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    setError("");
    api<{ orders: OrderRow[] }>(`/api/v1/restaurants/${restaurantId}/orders?limit=100`, {}, session!.token)
      .then((x) => setRows(x.orders))
      .catch((e) => setError(userMessage(e)));
  }, [restaurantId]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p>Phone orders placed through your AI receptionist.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="card">
        {!rows ? (
          <div className="card-pad">
            <Skeleton height={220} />
          </div>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty="No orders yet. Orders taken by phone will appear here."
            columns={[
              { header: "Order #", render: (r) => r.order_number },
              { header: "Customer", render: (r) => r.customer_name },
              { header: "Type", render: (r) => r.order_type.replace("_", " ") },
              { header: "Status", render: (r) => <StatusBadge status={r.status} kind="order" /> },
              { header: "Total", render: (r) => money(r.total_cents, r.currency) },
              { header: "Placed", render: (r) => new Date(r.created_at).toLocaleString() },
            ]}
          />
        )}
      </div>
    </>
  );
}
