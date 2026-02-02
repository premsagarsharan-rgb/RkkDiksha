"use client";

import { useEffect, useMemo, useState } from "react";

export default function CustomerLocationTracker() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/customers/location");
    const data = await res.json().catch(() => ({}));
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((x) => {
      const name = String(x?.name || "").toLowerCase();
      const roll = String(x?.rollNo || "").toLowerCase();
      const loc = String(x?.locationLabel || "").toLowerCase();
      const date = String(x?.date || "").toLowerCase();
      const mode = String(x?.mode || "").toLowerCase();
      return name.includes(term) || roll.includes(term) || loc.includes(term) || date.includes(term) || mode.includes(term);
    });
  }, [items, q]);

  const summary = useMemo(() => {
    const s = { SITTING: 0, MEETING: 0, DIKSHA: 0, PENDING: 0, UNKNOWN: 0, TOTAL: filtered.length };
    for (const x of filtered) {
      s[x.locationType] = (s[x.locationType] || 0) + 1;
    }
    return s;
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">Customer Location Tracker</h2>
          <div className="text-xs text-white/60">
            Shows where customers currently are (Sitting / Meeting / Diksha / Pending).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / roll / location / date..."
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

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <Badge label={`Total ${summary.TOTAL}`} />
        <Badge label={`Sitting ${summary.SITTING}`} />
        <Badge label={`Meeting ${summary.MEETING}`} />
        <Badge label={`Diksha ${summary.DIKSHA}`} />
        <Badge label={`Pending ${summary.PENDING}`} />
        <Badge label={`Unknown ${summary.UNKNOWN}`} />
      </div>

      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/60">No customers found.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((x) => (
            <div key={x._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{x.name}</div>
                  <div className="text-xs text-white/60 truncate">
                    Roll: {x.rollNo || "—"} • Gender: {x.gender || "—"}
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`px-2 py-1 rounded-full text-[11px] border ${locCls(x.locationType)}`}>
                    {x.locationLabel}
                  </span>
                </div>
              </div>

              {/* Pending info */}
              {x.locationType === "PENDING" ? (
                <div className="mt-3 text-xs text-white/70 space-y-1">
                  <div>
                    Paused At: <b className="text-white">{x.pausedAt ? new Date(x.pausedAt).toLocaleString() : "—"}</b>
                  </div>

                  {x.date || x.mode ? (
                    <>
                      <div>Last Date: <b className="text-white">{x.date || "—"}</b></div>
                      <div>Last Mode: <b className="text-white">{x.mode || "—"}</b></div>
                      <div className="text-[11px] text-white/50 break-all">
                        Last ContainerId: {x.containerId || "—"}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-white/50">No last container found.</div>
                  )}
                </div>
              ) : x.locationType !== "SITTING" ? (
                <div className="mt-3 text-xs text-white/70 space-y-1">
                  <div>Date: <b className="text-white">{x.date || "—"}</b></div>
                  <div>Mode: <b className="text-white">{x.mode || "—"}</b></div>
                  <div className="text-[11px] text-white/50 break-all">
                    ContainerId: {x.containerId || "—"}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-white/60">
                  Status: <b className="text-white">{x.sittingStatus || "—"}</b>
                </div>
              )}

              {x.occupiedDate ? (
                <div className="mt-3 text-[11px] text-emerald-200 border border-emerald-400/20 bg-emerald-500/10 rounded-xl px-3 py-2">
                  Occupied (hold): {x.occupiedDate}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ label }) {
  return (
    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80">
      {label}
    </span>
  );
}

function locCls(t) {
  if (t === "DIKSHA") return "bg-blue-500/15 border-blue-400/20 text-blue-200";
  if (t === "MEETING") return "bg-fuchsia-500/15 border-fuchsia-400/20 text-fuchsia-200";
  if (t === "PENDING") return "bg-yellow-500/15 border-yellow-400/20 text-yellow-200";
  if (t === "SITTING") return "bg-emerald-500/15 border-emerald-400/20 text-emerald-200";
  return "bg-zinc-500/15 border-zinc-400/20 text-zinc-200";
}
