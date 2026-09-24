import { useState, type FormEvent } from "react";
import { api, userMessage, type Restaurant } from "../api";
import { useAuth } from "../auth";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateRestaurantPage({ onCreated }: { onCreated: (r: Restaurant) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const slug = slugify(name);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { restaurant } = await api<{ restaurant: { id: string; name: string } }>(
        "/api/v1/restaurants",
        { method: "POST", body: JSON.stringify({ name, slug, timezone }) },
        session!.token,
      );
      onCreated({ ...restaurant, role: "OWNER" });
      setName("");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form onSubmit={submit} className="auth-card">
        <h1>Create your restaurant</h1>
        <p className="subtitle">You don't belong to any restaurant yet. Add one to unlock your operations dashboard — you'll be its owner.</p>
        {error && <p role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="restaurant-name">Restaurant name</label>
          <input required id="restaurant-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Harbor House Bistro" />
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Creating…" : "Create restaurant"}
        </button>
      </form>
    </main>
  );
}
