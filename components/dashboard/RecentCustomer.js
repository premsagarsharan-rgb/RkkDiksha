"use client";

import { useEffect, useMemo, useState } from "react";
import CustomerProfileModal from "@/components/CustomerProfileModal";

export default function RecentCustomer() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openProfile, setOpenProfile] = useState(false);
  const [selected, setSelected] = useState(null);

  const [q, setQ] = useState("");

  const queryUrl = useMemo(() => {
    const s = q.trim();
    return s ? `/api/customers/today?q=${encodeURIComponent(s)}` : "/api/customers/today";
  }, [q]);

  async function load(url = queryUrl) {
    setLoading(true);
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(queryUrl), 250);
    return () => clearTimeout(t);
  }, [queryUrl]);

  function open(c) {
    setSelected(c);
    setOpenProfile(true);
  }

  function close() {
    setOpenProfile(false);
    setSelected(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">Recent Customer</h2>
          <p className="text-xs text-white/60">Search by Roll / Name / Pincode</p>
        </div>

        <div className="flex gap-2 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search roll, name, pincode..."
            className="w-72 max-w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            onClick={() => load(queryUrl)}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-white/60">No recent customers.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div
              key={c._id}
              onClick={() => open(c)}
              className="text-left rounded-2xl p-4 border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-[0_0_30px_rgba(59,130,246,0.10)] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-white/60">Profile Card</div>
                  <div className="text-white font-semibold text-base mt-1">{c.name}</div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-white/60">Roll</div>
                  <div className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white text-xs font-semibold">
                    {c.rollNo || "—"}
                  </div>
                </div>
              </div>

              <div className="text-white/70 text-sm mt-2">Age: {c.age || "-"}</div>
              <div className="text-white/60 text-xs mt-1 line-clamp-2">Address: {c.address || "-"}</div>
              <div className="text-white/60 text-xs mt-1">Pincode: {c.pincode || "-"}</div>

              <div className="mt-3 inline-flex px-2 py-1 rounded-full text-[11px] bg-white/10 border border-white/10 text-white/80">
                Status: {c.status || "RECENT"}
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerProfileModal
        open={openProfile}
        onClose={close}
        customer={selected}
        source="TODAY"
        onChanged={() => load(queryUrl)}
      />
    </div>
  );
}
