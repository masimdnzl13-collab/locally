import { useEffect, useState, type FormEvent } from "react";
import { api, userMessage } from "../api";
import { useAuth } from "../auth";
import { DataTable, Skeleton, StatusBadge } from "../ui";

type NotificationRow = Record<string, unknown>;

export function NotificationsPage({ restaurantId }: { restaurantId: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>SMS confirmations sent to your customers, and consent preferences.</p>
        </div>
      </div>
      <div className="grid two-col" style={{ alignItems: "start" }}>
        <NotificationHistory restaurantId={restaurantId} />
        <NotificationPreferences restaurantId={restaurantId} />
      </div>
    </>
  );
}

function NotificationHistory({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setRows(null);
    api<{ notifications: NotificationRow[] }>(`/api/v1/restaurants/${restaurantId}/notifications`, {}, session!.token)
      .then((x) => setRows(x.notifications))
      .catch((e) => setError(userMessage(e)));
  }, [restaurantId]);
  return (
    <div className="card">
      <div className="card-pad" style={{ paddingBottom: 0 }}>
        <div className="card-head">
          <h2>Delivery history</h2>
        </div>
      </div>
      {error && (
        <div className="card-pad" style={{ paddingTop: 0 }}>
          <p role="alert">{error}</p>
        </div>
      )}
      {!rows ? (
        <div className="card-pad">
          <Skeleton height={180} />
        </div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r.id)}
          empty="No notifications sent yet."
          columns={[
            { header: "Event", render: (r) => String(r.event_type) },
            { header: "Phone", render: (r) => String(r.recipient_phone) },
            { header: "Status", render: (r) => <StatusBadge status={String(r.status)} kind="notification" /> },
            { header: "Sent", render: (r) => (r.created_at ? new Date(String(r.created_at)).toLocaleString() : "—") },
          ]}
        />
      )}
    </div>
  );
}

function NotificationPreferences({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [language, setLanguage] = useState("EN");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/v1/restaurants/${restaurantId}/notifications/preferences`, { method: "PUT", body: JSON.stringify({ phone, consent, language }) }, session!.token);
      setMessage("Preference saved");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card card-pad" onSubmit={save}>
      <div className="card-head">
        <h2>Add SMS consent</h2>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status" className="ok">{message}</p>}
      <div className="field">
        <label>Phone number</label>
        <input required placeholder="+15551234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field" style={{ flexDirection: "row", alignItems: "center", display: "flex", gap: 8 }}>
        <input type="checkbox" id="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: "auto" }} />
        <label htmlFor="consent" style={{ margin: 0 }}>Allow transactional SMS</label>
      </div>
      <div className="field">
        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option>EN</option>
          <option>ES</option>
        </select>
      </div>
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "Saving…" : "Save preference"}
      </button>
    </form>
  );
}
