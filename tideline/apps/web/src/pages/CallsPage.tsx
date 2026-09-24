import { useEffect, useState } from "react";
import { api, userMessage, type CallRow } from "../api";
import { useAuth } from "../auth";
import { DataTable, Skeleton, StatusBadge } from "../ui";

export function CallsPage({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [rows, setRows] = useState<CallRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    setError("");
    api<{ calls: CallRow[] }>(`/api/v1/restaurants/${restaurantId}/calls?limit=100`, {}, session!.token)
      .then((x) => setRows(x.calls))
      .catch((e) => setError(userMessage(e)));
  }, [restaurantId]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calls</h1>
          <p>Every inbound call your AI receptionist has answered.</p>
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
            empty="No calls yet. Once your AI receptionist starts answering the phone, calls will show up here."
            columns={[
              { header: "Caller", render: (r) => r.caller_phone_number ?? "Unknown" },
              { header: "Status", render: (r) => <StatusBadge status={r.status} kind="call" /> },
              { header: "Intent", render: (r) => r.initial_intent ?? "—" },
              { header: "Duration", render: (r) => (r.duration_seconds ? `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s` : "—") },
              { header: "Language", render: (r) => r.language ?? "—" },
              { header: "Started", render: (r) => new Date(r.started_at).toLocaleString() },
            ]}
          />
        )}
      </div>
    </>
  );
}
