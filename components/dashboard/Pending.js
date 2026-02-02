"use client";

import { useEffect, useMemo, useState } from "react";
import CustomerProfileModal from "@/components/CustomerProfileModal";

function pickTs(c) {
  // best guess fields
  const t =
    c?.pausedAt ||
    c?.restoredAt ||
    c?.createdAt ||
    c?.updatedAt ||
    null;

  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

export default function Pending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openProfile, setOpenProfile] = useState(false);
  const [selected, setSelected] = useState(null);

  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/customers/pending");
    const data = await res.json().catch(() => ({}));
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const { recent24, older } = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    const now = Date.now();
    const limit = 24 * 60 * 60 * 1000;

    let arr = items;

    if (term) {
      arr = arr.filter((c) => {
        const name = String(c?.name || "").toLowerCase();
        const roll = String(c?.rollNo || "").toLowerCase();
        return name.includes(term) || roll.includes(term);
      });
    }

    const r = [];
    const o = [];

    for (const c of arr) {
      const ts = pickTs(c);
      if (ts && now - ts <= limit) r.push(c);
      else o.push(c);
    }

    r.sort((a, b) => pickTs(b) - pickTs(a));
    o.sort((a, b) => pickTs(b) - pickTs(a));

    return { recent24: r, older: o };
  }, [items, q]);

  const total = recent24.length + older.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-white font-semibold text-lg">
          Pending{" "}
          <span className="text-white/50 text-sm">({total})</span>
        </h2>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / rollNo..."
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-blue-500/30"
          />

          <button
            onClick={load}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : total === 0 ? (
        <div className="text-white/60">
          {q.trim() ? `No pending customers matching "${q.trim()}".` : "No pending customers."}
        </div>
      ) : (
        <div className="space-y-5">
          {recent24.length > 0 ? (
            <div>
              <div className="text-xs text-white/60 mb-2">
                Recently (last 24 hours) — {recent24.length}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent24.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelected(c); setOpenProfile(true); }}
                    className="text-left rounded-2xl p-4 border border-emerald-400/20 bg-emerald-500/10 hover:bg-emerald-500/15 transition"
                  >
                    <div className="text-xs text-white/70">Pending (Recent)</div>
                    <div className="text-white font-semibold mt-1">{c.name}</div>
                    <div className="text-white/70 text-sm">Age: {c.age || "-"}</div>
                    <div className="mt-3 inline-flex px-2 py-1 rounded-full text-[11px] bg-yellow-500/20 border border-yellow-400/20 text-yellow-200">
                      Status: PENDING
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {older.length > 0 ? (
            <div>
              <div className="text-xs text-white/60 mb-2">
                Others — {older.length}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {older.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelected(c); setOpenProfile(true); }}
                    className="text-left rounded-2xl p-4 border border-white/10 bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="text-xs text-white/60">Pending Profile</div>
                    <div className="text-white font-semibold mt-1">{c.name}</div>
                    <div className="text-white/70 text-sm">Age: {c.age || "-"}</div>
                    <div className="mt-3 inline-flex px-2 py-1 rounded-full text-[11px] bg-yellow-500/20 border border-yellow-400/20 text-yellow-200">
                      Status: PENDING
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <CustomerProfileModal
        open={openProfile}
        onClose={() => setOpenProfile(false)}
        customer={selected}
        source="PENDING"
        onChanged={load}
      />
    </div>
  );
}
