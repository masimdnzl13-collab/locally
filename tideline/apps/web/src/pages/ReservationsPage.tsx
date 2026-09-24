import { useEffect, useState } from "react";
import { api, userMessage, type ReservationRow } from "../api";
import { useAuth } from "../auth";
import { DataTable, Skeleton, StatusBadge } from "../ui";

export function ReservationsPage({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [rows, setRows] = useState<ReservationRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    setError("");
    api<{ reservations: ReservationRow[] }>(`/api/v1/restaurants/${restaurantId}/reservations?limit=100`, {}, session!.token)
      .then((x) => setRows(x.reservations))
      .catch((e) => setError(userMessage(e)));
  }, [restaurantId]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reservations</h1>
          <p>Table reservations booked through your AI receptionist.</p>
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
            empty="No reservations yet. Bookings taken by phone will appear here."
            columns={[
              { header: "Code", render: (r) => r.confirmation_code },
              { header: "Guest", render: (r) => r.guest_name },
              { header: "Party", render: (r) => `${r.party_size} guests` },
              { header: "Status", render: (r) => <StatusBadge status={r.status} kind="reservation" /> },
              { header: "Date", render: (r) => new Date(`${r.reservation_date}T${r.reservation_time}`).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) },
              { header: "Phone", render: (r) => r.guest_phone },
            ]}
          />
        )}
      </div>
    </>
  );
}
