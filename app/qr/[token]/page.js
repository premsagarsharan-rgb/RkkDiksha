// app/qr/[token]/page.js
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function QRFormPage() {
  const { token } = useParams();

  const [form, setForm] = useState({ name: "", phone: "", gender: "MALE", notes: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/qr/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Submit failed");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_50px_rgba(59,130,246,0.18)] p-6">
        {done ? (
          <div className="text-center">
            <div className="text-2xl font-bold">Submitted</div>
            <div className="text-white/60 text-sm mt-1">
              Your data is sent. Staff will verify it.
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-white/60">Customer Form</div>
            <h1 className="text-xl font-bold">Registration</h1>

            {error ? (
              <div className="mt-3 rounded-xl bg-red-500/15 border border-red-400/20 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              <select
                className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="MALE">MALE</option>
                <option value="FEMALE">FEMALE</option>
                <option value="OTHER">OTHER</option>
              </select>
              <textarea
                className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10"
                rows={3}
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <button
                disabled={loading}
                className="w-full px-4 py-2 rounded-xl bg-white text-black font-semibold shadow-[0_0_35px_rgba(255,255,255,0.12)] disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
