"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setErr(
            "Access Denied: You are already logged in on another device. Please logout from that device first."
          );
        } else if (data?.error || data?.message) {
          setErr(data.error || data.message);
        } else {
          setErr("Login failed");
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_70px_rgba(59,130,246,0.12)] overflow-hidden fade-up">
        <div className="p-6">
          <div className="text-xs text-white/60">Secure Login</div>
          <h1 className="text-2xl font-bold mt-1">Sysbyte Dashboard</h1>
          <p className="text-sm text-white/60 mt-1">
            Admin (Boss) / User (Employee)
          </p>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <input
              type="password"
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-white text-black font-semibold py-3 shadow-[0_0_40px_rgba(255,255,255,0.10)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] transition disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-white/10 text-xs text-white/50">
          Back button / direct login blocked by middleware.
        </div>
      </div>
    </div>
  );
}
