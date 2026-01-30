"use client";

import { useEffect, useState } from "react";
import CustomerProfileModal from "@/components/CustomerProfileModal";

export default function Pending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openProfile, setOpenProfile] = useState(false);
  const [selected, setSelected] = useState(null);
  const [initialApproveStep, setInitialApproveStep] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/customers/pending");
    const data = await res.json().catch(() => ({}));
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function open(c) {
    setSelected(c);
    setInitialApproveStep(null);
    setOpenProfile(true);
  }

  function quickApprove(c) {
    setSelected(c);
    setInitialApproveStep("pickDate"); // directly open date picker inside profile
    setOpenProfile(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Pending</h2>
        <button onClick={load} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-white/60">No pending customers.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div
              key={c._id}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-[0_0_35px_rgba(59,130,246,0.08)] p-4"
            >
              <div className="text-xs text-white/60">Pending Profile</div>
              <div className="text-white font-semibold mt-1">{c.name}</div>
              <div className="text-white/70 text-sm">Age: {c.age || "-"}</div>
              <div className="text-white/60 text-xs mt-2 line-clamp-2">Address: {c.address || "-"}</div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => open(c)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-sm"
                >
                  Open
                </button>
                <button
                  onClick={() => quickApprove(c)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white text-black font-semibold text-sm"
                >
                  Approve
                </button>
              </div>

              <div className="mt-3 inline-flex px-2 py-1 rounded-full text-[11px] bg-yellow-500/20 border border-yellow-400/20 text-yellow-200">
                Status: PENDING
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerProfileModal
        open={openProfile}
        onClose={() => setOpenProfile(false)}
        customer={selected}
        source="PENDING"
        onChanged={load}
        initialApproveStep={initialApproveStep}
      />
    </div>
  );
}
