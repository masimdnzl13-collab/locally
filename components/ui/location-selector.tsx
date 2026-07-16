"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Search, Check, X } from "lucide-react";
import { TOWNS, type Town } from "@/lib/locations";
import { setCityAction } from "@/lib/locations-actions";
import { cn } from "@/lib/utils";

const RECENTS_KEY = "locally:recent-cities";
const MAX_RECENTS = 3;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(city: string) {
  const next = [city, ...readRecents().filter((c) => c !== city)].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function LocationSelector({ city, className }: { city: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setRecents(readRecents());
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return TOWNS;
    return TOWNS.filter((t) => t.label.toLocaleLowerCase("tr-TR").includes(q));
  }, [query]);

  const recentTowns = useMemo(
    () => recents.map((label) => TOWNS.find((t) => t.label === label)).filter(Boolean) as Town[],
    [recents]
  );
  const popularTowns = useMemo(
    () => filtered.filter((t) => !recentTowns.some((r) => r.slug === t.slug)),
    [filtered, recentTowns]
  );

  function select(town: Town) {
    pushRecent(town.label);
    setOpen(false);
    startTransition(async () => {
      await setCityAction(town.label);
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MapPin size={16} />
        {city}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[60] bg-navy-950/40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-24 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            >
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Search size={18} className="shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sezonluk rota ara..."
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Kapat"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {recentTowns.length > 0 && !query && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Son ziyaret edilenler
                    </p>
                    {recentTowns.map((town) => (
                      <TownRow key={town.slug} town={town} active={town.label === city} onSelect={select} />
                    ))}
                  </div>
                )}

                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {query ? "Sonuçlar" : "Popüler sezonluk rotalar"}
                  </p>
                  {popularTowns.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">Eşleşen rota bulunamadı.</p>
                  ) : (
                    popularTowns.map((town) => (
                      <TownRow key={town.slug} town={town} active={town.label === city} onSelect={select} />
                    ))
                  )}
                </div>
              </div>
              {isPending && (
                <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Konum güncelleniyor...
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TownRow({
  town,
  active,
  onSelect,
}: {
  town: Town;
  active: boolean;
  onSelect: (town: Town) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(town)}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
        active && "bg-teal-50"
      )}
    >
      <span className={cn("font-medium", active ? "text-teal-700" : "text-foreground")}>
        {town.label}
      </span>
      {active && <Check size={16} className="text-teal-600" />}
    </button>
  );
}
