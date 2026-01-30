"use client";

import { useEffect, useState } from "react";
import LayerModal from "@/components/LayerModal";

export default function CustomerHistoryModal({ open, onClose, customerId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customerId) return;

    (async () => {
      setLoading(true);
      const res = await fetch(`/api/commits/${customerId}`);
      const data = await res.json().catch(() => ({}));
      setItems(data.items || []);
      setLoading(false);
    })();
  }, [open, customerId]);

  if (!open) return null;

  return (
    <LayerModal
      open={open}
      layerName="HMM"
      title="Commit History"
      sub="ROLE:username : message"
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="text-white/60 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-white/60 text-sm">No commits yet.</div>
      ) : (
        <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
          {items.map((c) => (
            <div
              key={c._id}
              className="rounded-2xl border border-white/10 bg-black/30 p-3"
            >
              <div className="text-sm font-semibold">
                {(c.actorLabel || c.userId) + ": "}
                <span className="font-normal">{c.message}</span>
              </div>
              <div className="text-[11px] text-white/45 mt-1">
                {new Date(c.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </LayerModal>
  );
}
