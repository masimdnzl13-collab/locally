import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Session } from "./api";
import { useAuth } from "./auth";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<Session>(`/api/v1/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setSession(result);
      nav("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark">R</span>
          <span>Restaurant AI Receptionist</span>
        </div>
        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p className="subtitle">{register ? "Set up access to your restaurant's operations dashboard." : "Sign in to your operations dashboard."}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input required id="email" name="email" type="email" autoComplete="email" placeholder="owner@restaurant.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input required id="password" name="password" type="password" minLength={12} autoComplete={register ? "new-password" : "current-password"} placeholder="At least 12 characters" />
          </div>
          {error && <p role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          ) : (
            <>
              Need an account? <Link to="/register">Create one</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
