"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLayerStack } from "@/components/LayerStackProvider";

export default function LayerModal({
  open,
  title,
  sub,
  onClose,
  children,
  maxWidth = "max-w-6xl",
  layerName = "",
  zIndexBoost = 0,

  // ✅ prevent outside click/touch close
  disableBackdropClose = false,
}) {
  const stackApi = useLayerStack();

  const idRef = useRef(`layer_${Math.random().toString(16).slice(2)}_${Date.now()}`);
  const id = idRef.current;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const register = stackApi?.register;
  const unregister = stackApi?.unregister;
  const bringToTop = stackApi?.bringToTop;
  const stack = stackApi?.stack || [];

  useEffect(() => {
    if (!open || !register || !unregister || !bringToTop) return;

    register(id);
    bringToTop(id);

    return () => unregister(id);
  }, [open, id, register, unregister, bringToTop]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, [open]);

  const layerIndex = useMemo(() => {
    const idx = stack.indexOf(id);
    return idx >= 0 ? idx + 1 : 1;
  }, [stack, id]);

  const layerTotal = useMemo(() => (stack.length ? stack.length : 1), [stack]);

  const zIndex = useMemo(() => {
    const base = 60;
    return base + layerIndex * 20 + zIndexBoost;
  }, [layerIndex, zIndexBoost]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex }}
      onPointerDown={(e) => {
        if (disableBackdropClose) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`w-full ${maxWidth} rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_70px_rgba(59,130,246,0.12)] overflow-hidden`}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/25 backdrop-blur-xl">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-1 rounded-full text-[11px] bg-white/10 border border-white/10 text-white/80">
                  Layer {layerIndex}/{layerTotal}
                </span>
                {layerName ? <span className="text-[11px] text-white/60">{layerName}</span> : null}
              </div>

              {sub ? <div className="text-xs text-white/60">{sub}</div> : null}
              {title ? <div className="text-xl font-bold truncate">{title}</div> : null}
            </div>

            <button
              onClick={onClose}
              className="shrink-0 w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 text-2xl leading-none"
              title="Close"
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[80vh] overflow-auto pr-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
