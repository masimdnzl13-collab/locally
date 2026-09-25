import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, userMessage } from "../api";
import { useAuth } from "../auth";
import { BrainForm } from "./BrainForm";

const SECTIONS = ["profile", "context", "hours", "closures", "categories", "items", "faqs", "settings"] as const;

// Default view: the owner-friendly hours + menu form. The raw JSON editor covers
// every Brain section (profile, closures, FAQs, settings…) and stays one click away.
export function BrainPage({ restaurantId }: { restaurantId: string }) {
  const [params, setParams] = useSearchParams();
  const advanced = params.get("mode") === "json";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Restaurant Brain</h1>
          <p>The knowledge your AI receptionist uses on every call — hours, menu, policies and FAQs.</p>
        </div>
        <button type="button" className="link-button small" onClick={() => setParams(advanced ? {} : { mode: "json" })}>
          {advanced ? "Back to simple editor" : "Advanced (JSON) editor"}
        </button>
      </div>
      {advanced ? <BrainJsonEditor restaurantId={restaurantId} /> : <BrainForm restaurantId={restaurantId} />}
    </>
  );
}

function BrainJsonEditor({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("profile");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const path = `/api/v1/restaurants/${restaurantId}/brain/${section}`;

  async function load() {
    setError("");
    try {
      const value = await api<unknown>(path, {}, session!.token);
      setText(JSON.stringify(value, null, 2));
    } catch (e) {
      setError(userMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, [section, restaurantId]);

  async function save() {
    if (loading) return;
    setLoading(true);
    setSaved("");
    setError("");
    try {
      const value = JSON.parse(text);
      if (section === "context") throw new Error("Context is read-only");
      if (Array.isArray(value)) {
        for (const record of value) await api<unknown>(path, { method: "POST", body: JSON.stringify(record) }, session!.token);
        await load();
      } else {
        const recordId = typeof value === "object" && value !== null && "id" in value ? String((value as { id: unknown }).id) : "";
        const endpoint = recordId && !["profile", "settings"].includes(section) ? `${path}/${recordId}` : path;
        const method = ["profile", "settings"].includes(section) ? "PUT" : recordId ? "PATCH" : "POST";
        const result = await api<unknown>(endpoint, { method, body: JSON.stringify(value) }, session!.token);
        setText(JSON.stringify(result, null, 2));
      }
      setSaved("Saved");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="tabs">
        {SECTIONS.map((x) => (
          <button type="button" key={x} onClick={() => setSection(x)} aria-pressed={section === x}>
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      <div className="card card-pad editor-grid">
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status" className="ok">{saved}</p>}
        <textarea className="code" value={text} onChange={(e) => setText(e.target.value)} aria-label={`${section} JSON`} spellCheck={false} />
        <div className="editor-actions">
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void save()}>
            {loading ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void load()}>
            Reload
          </button>
        </div>
      </div>
    </>
  );
}
