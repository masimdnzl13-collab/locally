import { useId, useState, type ReactNode } from "react";

export function Icon({ name }: { name: IconName }) {
  const d = icons[name];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
export type IconName = keyof typeof icons;
const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  phone: <path d="M15.5 17.5c-6 0-11-5-11-11 0-1 .5-2 1.3-2.6l1.6-1.2c.6-.5 1.5-.4 2 .2l1.6 2c.4.5.4 1.3-.1 1.8l-1 1c.8 1.7 2.2 3.1 3.9 3.9l1-1c.5-.5 1.3-.5 1.8-.1l2 1.6c.6.5.7 1.4.2 2l-1.2 1.6c-.6.8-1.6 1.3-2.6 1.3Z" />,
  bag: <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  book: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H14v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  message: <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10Z" />,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Badge({ tone, children }: { tone: "good" | "warning" | "serious" | "critical" | "neutral"; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

const CALL_STATUS_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  COMPLETED: "good",
  IN_PROGRESS: "neutral",
  RINGING: "neutral",
  TRANSFERRED: "warning",
  NO_ANSWER: "serious",
  BUSY: "serious",
  FAILED: "critical",
};
const ORDER_STATUS_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  COMPLETED: "good",
  CONFIRMED: "neutral",
  DRAFT: "neutral",
  CANCELLED: "critical",
};
const RESERVATION_STATUS_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  CONFIRMED: "good",
  PENDING: "warning",
  COMPLETED: "neutral",
  CANCELLED: "critical",
  NO_SHOW: "serious",
};
const NOTIFICATION_STATUS_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  SENT: "good",
  QUEUED: "neutral",
  SENDING: "neutral",
  FAILED: "critical",
  SUPPRESSED: "warning",
};
export function StatusBadge({ status, kind }: { status: string; kind: "call" | "order" | "reservation" | "notification" }) {
  const map = kind === "call" ? CALL_STATUS_TONE : kind === "order" ? ORDER_STATUS_TONE : kind === "reservation" ? RESERVATION_STATUS_TONE : NOTIFICATION_STATUS_TONE;
  return <Badge tone={map[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

export function StatTile({
  label,
  value,
  icon,
  delta,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: { direction: "up" | "down"; text: string };
}) {
  return (
    <div className="card stat-tile">
      <div className="label">
        <Icon name={icon} />
        {label}
      </div>
      <div className="value">{value}</div>
      {delta && (
        <div className={`delta ${delta.direction}`}>
          {delta.direction === "up" ? "↑" : "↓"} {delta.text}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

type Point = { day: string; value: number };
function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BarSeriesChart({ points, formatValue = (v: number) => String(v) }: { points: Point[]; formatValue?: (v: number) => string }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 640,
    h = 200,
    padL = 4,
    padB = 22,
    padT = 10;
  const max = Math.max(1, ...points.map((p) => p.value));
  const bw = (w - padL * 2) / points.length;
  const gridSteps = 4;
  const showEvery = Math.ceil(points.length / 10);
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h + padB}`} role="img" aria-label="Chart">
        {Array.from({ length: gridSteps + 1 }).map((_, i) => {
          const y = padT + ((h - padT) / gridSteps) * i;
          return <line key={i} x1={padL} x2={w} y1={y} y2={y} className="chart-gridline" />;
        })}
        {points.map((p, i) => {
          const x = padL + i * bw;
          const barH = ((h - padT) * p.value) / max;
          const y = h - barH;
          return (
            <g key={p.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x + bw * 0.18} y={y} width={Math.max(2, bw * 0.64)} height={Math.max(0, barH)} rx={3} className="chart-bar" opacity={hover === null || hover === i ? 1 : 0.45} />
              <rect x={x} y={padT} width={bw} height={h - padT} fill="transparent" />
              {i % showEvery === 0 && (
                <text x={x + bw / 2} y={h + 16} textAnchor="middle" className="chart-axis-label">
                  {shortDate(p.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && points[hover] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((hover + 0.5) * bw + padL) / w * 100}%`,
            top: `${(1 - points[hover].value / max) * (h / (h + padB)) * 100}%`,
          }}
        >
          {shortDate(points[hover].day)} · {formatValue(points[hover].value)}
        </div>
      )}
      <span className="sr-only" id={gid}>
        {points.map((p) => `${p.day}: ${formatValue(p.value)}`).join(", ")}
      </span>
    </div>
  );
}

export function LineSeriesChart({ points, formatValue = (v: number) => String(v) }: { points: Point[]; formatValue?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640,
    h = 200,
    padL = 6,
    padR = 6,
    padB = 22,
    padT = 10;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = (w - padL - padR) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => ({
    x: padL + i * stepX,
    y: padT + (h - padT) * (1 - p.value / max),
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${path} L ${coords[coords.length - 1]?.x ?? padL} ${h} L ${padL} ${h} Z`;
  const showEvery = Math.ceil(points.length / 10);
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h + padB}`} role="img" aria-label="Chart">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padT + ((h - padT) / 4) * i;
          return <line key={i} x1={0} x2={w} y1={y} y2={y} className="chart-gridline" />;
        })}
        <path d={area} className="chart-line-area" />
        <path d={path} className="chart-line-path" />
        {coords.map((c, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={c.x - stepX / 2} y={0} width={stepX} height={h} fill="transparent" />
            {(hover === i || i === coords.length - 1) && <circle cx={c.x} cy={c.y} r={4} className="chart-dot" />}
            {i % showEvery === 0 && (
              <text x={c.x} y={h + 16} textAnchor="middle" className="chart-axis-label">
                {shortDate(points[i].day)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && points[hover] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(coords[hover].x / w) * 100}%`,
            top: `${(coords[hover].y / (h + padB)) * 100}%`,
          }}
        >
          {shortDate(points[hover].day)} · {formatValue(points[hover].value)}
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: { header: string; render: (row: T) => ReactNode }[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.header}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
