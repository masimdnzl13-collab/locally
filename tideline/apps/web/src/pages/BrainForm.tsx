import { useEffect, useState } from "react";
import { api, userMessage } from "../api";
import { useAuth } from "../auth";

// Owner-friendly editor for the two Brain sections every restaurant needs:
// opening hours and the menu. It only talks to the existing Brain CRUD API
// (/brain/hours, /brain/categories, /brain/items) — the same records the JSON
// editor writes. PATCH replaces the whole record (zod defaults fill anything
// missing), so edits always start from the loaded row to keep fields this form
// does not show (allergens, dietary info, availability…).

type HoursRow = { id: string; weekday: number; start_time: string; end_time: string };
type CategoryRow = { id: string; name: string; description: string | null; display_order: number; active: boolean };
type ItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  active: boolean;
  available: boolean;
  unavailable_reason: string | null;
  dietary_information: string[];
  allergens: { name: string; status: string }[];
  display_order: number;
};

const orUndefined = (value: string | null | undefined) => (value ? value : undefined);
const hhmm = (time: string) => time.slice(0, 5);

function useBrain(restaurantId: string) {
  const { session } = useAuth();
  const base = `/api/v1/restaurants/${restaurantId}/brain`;
  return <T,>(path: string, init: RequestInit = {}) => api<T>(`${base}/${path}`, init, session!.token);
}

/* ---------------------------------- Hours --------------------------------- */

// Sunday = 0 (the API's weekday); shown Monday-first like most US menus.
const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

type DayState = { open: boolean; start: string; end: string; rows: HoursRow[]; touched: boolean };

function toDays(rows: HoursRow[]): Record<number, DayState> {
  const days: Record<number, DayState> = {};
  for (const [weekday] of DAYS) {
    const own = rows.filter((r) => r.weekday === weekday);
    days[weekday] = {
      open: own.length > 0,
      start: own[0] ? hhmm(own[0].start_time) : "11:00",
      end: own.length ? hhmm(own[own.length - 1].end_time) : "22:00",
      rows: own,
      touched: false,
    };
  }
  return days;
}

function HoursEditor({ restaurantId }: { restaurantId: string }) {
  const brain = useBrain(restaurantId);
  const [days, setDays] = useState<Record<number, DayState> | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      setDays(toDays(await brain<HoursRow[]>("hours")));
    } catch (e) {
      setError(userMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, [restaurantId]);

  const update = (weekday: number, patch: Partial<DayState>) => {
    setSaved("");
    setDays((prev) => prev && { ...prev, [weekday]: { ...prev[weekday], ...patch, touched: true } });
  };

  function copyMondayToAll() {
    if (!days) return;
    const monday = days[1];
    setSaved("");
    setDays(
      Object.fromEntries(
        DAYS.map(([weekday]) => [weekday, { ...days[weekday], open: monday.open, start: monday.start, end: monday.end, touched: true }]),
      ),
    );
  }

  async function save() {
    if (!days || saving) return;
    for (const [weekday, label] of DAYS) {
      const d = days[weekday];
      if (d.touched && d.open && !(d.start < d.end)) {
        setError(`${label}: closing time must be after opening time. For hours past midnight, use the advanced editor.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    setSaved("");
    // Work on a copy: each finished day is marked saved, so after a failure the
    // owner keeps the unsaved edits and a retry only redoes what did not go through.
    const work = { ...days };
    try {
      for (const [weekday] of DAYS) {
        const d = work[weekday];
        // Untouched days keep whatever is stored (including split lunch/dinner shifts).
        if (!d.touched) continue;
        const body = JSON.stringify({ weekday, startTime: d.start, endTime: d.end });
        let rows = d.rows;
        if (d.open && rows.length === 1) {
          const [row] = rows;
          if (hhmm(row.start_time) !== d.start || hhmm(row.end_time) !== d.end)
            rows = [await brain<HoursRow>(`hours/${row.id}`, { method: "PATCH", body })];
        } else {
          for (const row of d.rows) {
            await brain(`hours/${row.id}`, { method: "DELETE" });
            rows = rows.filter((r) => r.id !== row.id);
            work[weekday] = { ...d, rows };
          }
          if (d.open) rows = [await brain<HoursRow>("hours", { method: "POST", body })];
        }
        work[weekday] = { ...d, rows, touched: false };
      }
      setDays(toDays(await brain<HoursRow[]>("hours")));
      setSaved("Hours saved");
    } catch (e) {
      setDays(work);
      setError(userMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card card-pad brain-form-section">
      <div className="card-head">
        <h2>Opening hours</h2>
        <button type="button" className="link-button" onClick={copyMondayToAll} disabled={!days}>
          Copy Monday to all days
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status" className="ok">{saved}</p>}
      {!days ? (
        <p className="muted-text">Loading…</p>
      ) : (
        <div className="hours-list">
          {DAYS.map(([weekday, label]) => {
            const d = days[weekday];
            return (
              <div className="hours-row" key={weekday}>
                <label className="hours-day">
                  <input type="checkbox" checked={d.open} onChange={(e) => update(weekday, { open: e.target.checked })} />
                  {label}
                </label>
                {d.open ? (
                  <div className="hours-times">
                    <input type="time" aria-label={`${label} opening time`} value={d.start} onChange={(e) => update(weekday, { start: e.target.value })} />
                    <span aria-hidden="true">–</span>
                    <input type="time" aria-label={`${label} closing time`} value={d.end} onChange={(e) => update(weekday, { end: e.target.value })} />
                    {d.rows.length > 1 && !d.touched && <span className="muted-text">{d.rows.length} shifts</span>}
                  </div>
                ) : (
                  <span className="muted-text">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="editor-actions">
        <button type="button" className="btn btn-primary btn-inline" disabled={!days || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save hours"}
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------- Menu ---------------------------------- */

type ItemDraft = { key: string; row?: ItemRow; name: string; price: string; description: string };
type CategoryDraft = { key: string; row?: CategoryRow; name: string; items: ItemDraft[] };
type MenuDraft = { categories: CategoryDraft[]; removedItems: string[]; removedCategories: string[] };

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;
const dollars = (cents: number) => (cents / 100).toFixed(2);
function parseCents(price: string): number | null {
  const cleaned = price.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function toDraft(categories: CategoryRow[], items: ItemRow[]): MenuDraft {
  return {
    categories: categories.map((c) => ({
      key: c.id,
      row: c,
      name: c.name,
      items: items
        .filter((i) => i.category_id === c.id)
        .map((i) => ({ key: i.id, row: i, name: i.name, price: dollars(i.price_cents), description: i.description ?? "" })),
    })),
    removedItems: [],
    removedCategories: [],
  };
}

function MenuEditor({ restaurantId }: { restaurantId: string }) {
  const brain = useBrain(restaurantId);
  const [menu, setMenu] = useState<MenuDraft | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchMenu() {
    const [categories, items] = await Promise.all([brain<CategoryRow[]>("categories"), brain<ItemRow[]>("items")]);
    return toDraft(categories, items);
  }
  useEffect(() => {
    setError("");
    fetchMenu().then(setMenu, (e) => setError(userMessage(e)));
  }, [restaurantId]);

  const edit = (fn: (draft: MenuDraft) => MenuDraft) => {
    setSaved("");
    setMenu((prev) => prev && fn(prev));
  };
  const editCategory = (key: string, fn: (c: CategoryDraft) => CategoryDraft) =>
    edit((m) => ({ ...m, categories: m.categories.map((c) => (c.key === key ? fn(c) : c)) }));
  const editItem = (categoryKey: string, itemKey: string, patch: Partial<ItemDraft>) =>
    editCategory(categoryKey, (c) => ({ ...c, items: c.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) }));

  const addCategory = () =>
    edit((m) => ({ ...m, categories: [...m.categories, { key: newKey(), name: "", items: [{ key: newKey(), name: "", price: "", description: "" }] }] }));
  const addItem = (categoryKey: string) =>
    editCategory(categoryKey, (c) => ({ ...c, items: [...c.items, { key: newKey(), name: "", price: "", description: "" }] }));
  const removeItem = (categoryKey: string, item: ItemDraft) =>
    edit((m) => ({
      ...m,
      removedItems: item.row ? [...m.removedItems, item.row.id] : m.removedItems,
      categories: m.categories.map((c) => (c.key === categoryKey ? { ...c, items: c.items.filter((i) => i.key !== item.key) } : c)),
    }));
  const removeCategory = (category: CategoryDraft) =>
    edit((m) => ({
      categories: m.categories.filter((c) => c.key !== category.key),
      removedItems: [...m.removedItems, ...category.items.flatMap((i) => (i.row ? [i.row.id] : []))],
      removedCategories: category.row ? [...m.removedCategories, category.row.id] : m.removedCategories,
    }));

  function validate(draft: MenuDraft): string | null {
    const names = new Set<string>();
    for (const c of draft.categories) {
      if (!c.name.trim()) return "Every category needs a name.";
      for (const i of c.items) {
        // A completely empty new row is just an unused slot; skip it.
        if (!i.row && !i.name.trim() && !i.price.trim() && !i.description.trim()) continue;
        if (!i.name.trim()) return `An item in "${c.name}" is missing its name.`;
        if (parseCents(i.price) === null) return `"${i.name}" needs a price like 12.50.`;
        const lower = i.name.trim().toLowerCase();
        if (names.has(lower)) return `"${i.name}" appears twice — item names must be unique.`;
        names.add(lower);
      }
    }
    return null;
  }

  async function save() {
    if (!menu || saving) return;
    const problem = validate(menu);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    setSaved("");
    // Work on a copy that records every finished step (new ids, applied updates,
    // completed deletes). After a failure the owner keeps the unsaved edits and a
    // retry neither duplicates created records nor repeats finished ones.
    const work: MenuDraft = {
      removedItems: [...menu.removedItems],
      removedCategories: [...menu.removedCategories],
      categories: menu.categories.map((c) => ({ ...c, items: [...c.items] })),
    };
    try {
      // Items before categories: a category with items cannot be deleted.
      while (work.removedItems.length) {
        await brain(`items/${work.removedItems[0]}`, { method: "DELETE" });
        work.removedItems.shift();
      }
      while (work.removedCategories.length) {
        await brain(`categories/${work.removedCategories[0]}`, { method: "DELETE" });
        work.removedCategories.shift();
      }

      for (const [order, c] of work.categories.entries()) {
        const name = c.name.trim();
        if (!c.row) {
          c.row = await brain<CategoryRow>("categories", { method: "POST", body: JSON.stringify({ name, displayOrder: order }) });
        } else if (c.row.name !== name || c.row.display_order !== order) {
          c.row = await brain<CategoryRow>(`categories/${c.row.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name, description: orUndefined(c.row.description), displayOrder: order, active: c.row.active }),
          });
        }
        const categoryId = c.row.id;

        for (const [itemOrder, i] of c.items.entries()) {
          const itemName = i.name.trim();
          if (!i.row && !itemName) continue;
          const priceCents = parseCents(i.price)!;
          const description = orUndefined(i.description.trim());
          if (!i.row) {
            const row = await brain<ItemRow>("items", {
              method: "POST",
              body: JSON.stringify({ categoryId, name: itemName, priceCents, description, displayOrder: itemOrder }),
            });
            c.items[itemOrder] = { ...i, row };
          } else if (
            i.row.name !== itemName ||
            i.row.price_cents !== priceCents ||
            (i.row.description ?? "") !== (description ?? "") ||
            i.row.display_order !== itemOrder
          ) {
            const row = await brain<ItemRow>(`items/${i.row.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                categoryId: i.row.category_id,
                name: itemName,
                description,
                priceCents,
                active: i.row.active,
                available: i.row.available,
                unavailableReason: orUndefined(i.row.unavailable_reason),
                dietaryInformation: i.row.dietary_information,
                allergens: i.row.allergens,
                displayOrder: itemOrder,
              }),
            });
            c.items[itemOrder] = { ...i, row };
          }
        }
      }
      setMenu(await fetchMenu());
      setSaved("Menu saved");
    } catch (e) {
      setMenu(work);
      setError(userMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const itemCount = menu?.categories.reduce((n, c) => n + c.items.filter((i) => i.row || i.name.trim()).length, 0) ?? 0;

  return (
    <section className="card card-pad brain-form-section">
      <div className="card-head">
        <h2>Menu</h2>
        <span className="hint">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status" className="ok">{saved}</p>}
      {!menu ? (
        <p className="muted-text">Loading…</p>
      ) : (
        <>
          {menu.categories.length === 0 && <p className="muted-text">Start with a category, like “Pizzas” or “Drinks”.</p>}
          {menu.categories.map((c) => (
            <div className="menu-category" key={c.key}>
              <div className="menu-category-head">
                <input
                  className="menu-category-name"
                  aria-label="Category name"
                  placeholder="Category name (e.g. Pizzas)"
                  value={c.name}
                  maxLength={120}
                  onChange={(e) => editCategory(c.key, (x) => ({ ...x, name: e.target.value }))}
                />
                <button type="button" className="link-button danger" onClick={() => removeCategory(c)}>
                  Remove category
                </button>
              </div>
              <div className="menu-items">
                {c.items.map((i) => (
                  <div className="menu-item" key={i.key}>
                    <input aria-label="Item name" placeholder="Item name" value={i.name} maxLength={160} onChange={(e) => editItem(c.key, i.key, { name: e.target.value })} />
                    <input aria-label="Price in dollars" placeholder="Price" inputMode="decimal" value={i.price} onChange={(e) => editItem(c.key, i.key, { price: e.target.value })} />
                    <input aria-label="Description" placeholder="Description (optional)" value={i.description} maxLength={2000} onChange={(e) => editItem(c.key, i.key, { description: e.target.value })} />
                    <button type="button" className="icon-button" aria-label={`Remove ${i.name || "item"}`} onClick={() => removeItem(c.key, i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="link-button" onClick={() => addItem(c.key)}>
                + Add item
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addCategory}>
            + Add category
          </button>
        </>
      )}
      <div className="editor-actions">
        <button type="button" className="btn btn-primary btn-inline" disabled={!menu || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save menu"}
        </button>
      </div>
    </section>
  );
}

export function BrainForm({ restaurantId }: { restaurantId: string }) {
  return (
    <div className="brain-form">
      <HoursEditor restaurantId={restaurantId} />
      <MenuEditor restaurantId={restaurantId} />
    </div>
  );
}
