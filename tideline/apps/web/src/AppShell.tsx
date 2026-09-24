import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api, ApiError, userMessage, type Restaurant } from "./api";
import { useAuth } from "./auth";
import { Icon, type IconName } from "./ui";
import { OverviewPage } from "./pages/OverviewPage";
import { CallsPage } from "./pages/CallsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { BrainPage } from "./pages/BrainPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { CreateRestaurantPage } from "./pages/CreateRestaurantPage";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "", label: "Overview", icon: "grid" },
  { to: "calls", label: "Calls", icon: "phone" },
  { to: "orders", label: "Orders", icon: "bag" },
  { to: "reservations", label: "Reservations", icon: "calendar" },
];
const NAV_MANAGE: { to: string; label: string; icon: IconName }[] = [
  { to: "brain", label: "Restaurant Brain", icon: "book" },
  { to: "notifications", label: "Notifications", icon: "bell" },
];

// Set by SsoPage when Tideline is framed inside the Locally dashboard: Locally
// owns the brand and sign-out there, so the shell hides its own.
const embedded = () => sessionStorage.getItem("embedded") === "1";

export function AppShell() {
  const { session, setSession } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener("session-expired", expire);
    if (session)
      api<{ restaurants: Restaurant[] }>("/api/v1/me", {}, session.token)
        .then((x) => {
          setRestaurants(x.restaurants);
          const preferred = sessionStorage.getItem("restaurant");
          setSelected(x.restaurants.find((r) => r.id === preferred)?.id ?? x.restaurants[0]?.id ?? "");
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) setSession(null);
          else setError(userMessage(e));
        })
        .finally(() => setLoading(false));
    return () => window.removeEventListener("session-expired", expire);
  }, [session]);

  if (!session && embedded()) {
    window.parent.postMessage({ type: "tideline:session-expired" }, "*");
    return <div className="center-loading">Your session expired. Reconnecting…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (loading) return <div className="center-loading">Loading your dashboard…</div>;
  if (error) return <div className="center-loading" role="alert">{error}</div>;

  if (!selected)
    return (
      <CreateRestaurantPage
        onCreated={(r) => {
          setRestaurants((prev) => [...prev, r]);
          setSelected(r.id);
        }}
      />
    );

  const current = restaurants.find((r) => r.id === selected);

  return (
    <div className={`shell${embedded() ? " embedded" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">R</span>
          <strong>Restaurant AI</strong>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={`/app/${item.to}`} end={item.to === ""} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
          <div className="sidebar-section">Manage</div>
          {NAV_MANAGE.map((item) => (
            <NavLink key={item.to} to={`/app/${item.to}`} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar">{session.user.email[0]?.toUpperCase()}</span>
            <span>{session.user.email}</span>
          </div>
          <button type="button" className="nav-link" style={{ width: "100%", background: "transparent" }} onClick={() => setSession(null)}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">Restaurant</div>
            {restaurants.length > 1 ? (
              <select className="restaurant-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            ) : (
              <h1>{current?.name}</h1>
            )}
          </div>
        </header>
        <div className="content">
          <Routes>
            <Route path="" element={<OverviewPage restaurantId={selected} />} />
            <Route path="calls" element={<CallsPage restaurantId={selected} />} />
            <Route path="orders" element={<OrdersPage restaurantId={selected} />} />
            <Route path="reservations" element={<ReservationsPage restaurantId={selected} />} />
            <Route path="brain" element={<BrainPage restaurantId={selected} />} />
            <Route path="notifications" element={<NotificationsPage restaurantId={selected} />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
