"use client";

import { useEffect, useMemo, useState } from "react";
import CustomerProfileModal from "@/components/CustomerProfileModal";

export default function Pending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openProfile, setOpenProfile] = useState(false);
  const [selected, setSelected] = useState(null);

  // NEW: search (performance + usability)
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

  // NEW: memoized filter
  const filtered = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return items;

    return items.filter((c) => {
      const name = String(c?.name || "").toLowerCase();
      const roll = String(c?.rollNo || "").toLowerCase();
      return name.includes(term) || roll.includes(term);
    });
  }, [items, q]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-white font-semibold text-lg">
          Pending{" "}
          <span className="text-white/50 text-sm">({filtered.length})</span>
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
      ) : filtered.length === 0 ? (
        <div className="text-white/60">
          {q.trim()
            ? `No pending customers matching "${q.trim()}".`
            : "No pending customers."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button
              key={c._id}
              onClick={() => {
                setSelected(c);
                setOpenProfile(true);
              }}
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
