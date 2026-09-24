import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, userMessage, type Session } from "./api";
import { useAuth } from "./auth";

// Landing step for the Locally SSO bridge. Locally opens
// /sso#assertion=<short-lived JWT>&embedded=1[&next=/app/brain]; the fragment never reaches a
// server or its logs. The assertion is exchanged once for a normal Tideline
// session, which is stored exactly like a password login (see auth.tsx).
export function SsoPage() {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const assertion = params.get("assertion");
    // Only in-app destinations; anything else (absolute URLs, //host) falls back to /app.
    const requested = params.get("next") ?? "";
    const next = /^\/app(\/[a-z-]*)?$/.test(requested) ? requested : "/app";
    window.history.replaceState(null, "", window.location.pathname);
    if (!assertion) {
      setError("This sign-in link is missing its token. Open Tideline again from Locally.");
      return;
    }
    if (params.get("embedded") === "1") sessionStorage.setItem("embedded", "1");
    else sessionStorage.removeItem("embedded");
    api<Session & { restaurantId: string }>("/api/v1/auth/sso", { method: "POST", body: JSON.stringify({ assertion }) })
      .then(({ restaurantId, ...session }) => {
        sessionStorage.setItem("restaurant", restaurantId);
        setSession(session);
        nav(next, { replace: true });
      })
      .catch((e) => setError(userMessage(e)));
  }, []);

  return (
    <div className="center-loading" role={error ? "alert" : undefined}>
      {error || "Signing you in…"}
    </div>
  );
}
