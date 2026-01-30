// components/CustomerCard.js
"use client";

import { useMemo, useState } from "react";

export default function CustomerCard({
  customer,
  onEdit,
  onOut,
  onSend,
  compact = false,
}) {
  const theme = useMemo(() => {
    if (customer.gender === "MALE")
      return {
        wrap: "bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white",
        glow: "shadow-[0_0_25px_rgba(255,255,255,0.08)] ring-1 ring-white/10",
        badge: "bg-white/10 text-white",
      };
    if (customer.gender === "FEMALE")
      return {
        wrap: "bg-gradient-to-br from-pink-700 via-fuchsia-700 to-pink-600 text-white",
        glow: "shadow-[0_0_28px_rgba(236,72,153,0.35)] ring-1 ring-white/15",
        badge: "bg-white/15 text-white",
      };
    return {
      wrap: "bg-gradient-to-br from-emerald-200 via-green-200 to-lime-200 text-black",
      glow: "shadow-[0_0_26px_rgba(34,197,94,0.22)] ring-1 ring-black/10",
      badge: "bg-black/10 text-black",
    };
  }, [customer.gender]);

  const statusLabel = customer.status || "ACTIVE";

  const statusColor = useMemo(() => {
    if (statusLabel === "ACTIVE") return "bg-emerald-500 text-white";
    if (statusLabel === "IN_EVENT") return "bg-blue-600 text-white";
    if (statusLabel === "PAUSED") return "bg-yellow-500 text-black";
    return "bg-gray-400 text-white";
  }, [statusLabel]);

  const [busy, setBusy] = useState(false);

  async function safeAction(fn) {
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-xl p-3 ${theme.wrap} ${theme.glow} relative overflow-hidden`}>
      {/* cinematic overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs ${statusColor}`}>
            <span className="font-semibold">Status</span>
            <span className="opacity-95">{statusLabel}</span>
          </div>

          <div className="mt-2 font-semibold text-base truncate">{customer.name}</div>
          <div className="text-sm opacity-90 truncate">{customer.phone}</div>

          {!compact && customer.notes ? (
            <div className="text-xs mt-2 opacity-80 line-clamp-2">Notes: {customer.notes}</div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => safeAction(onEdit)}
            className="px-2 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            title="Edit"
          >
            ✏️
          </button>

          <button
            disabled={busy}
            onClick={() => safeAction(onOut)}
            className="px-2 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            title="Pause → Out"
          >
            ⏸️
          </button>

          <button
            disabled={busy}
            onClick={() => safeAction(onSend)}
            className="px-2 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            title="Send (future)"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );
}
