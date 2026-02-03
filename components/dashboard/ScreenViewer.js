"use client";

import { useState } from "react";
import LayerModal from "@/components/LayerModal";
import ScreenViewClient from "@/components/ScreenViewClient";

function toCode5(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

export default function ScreensViewer() {
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCodeActive, setViewCodeActive] = useState("");

  function openViewByCode() {
    const code = toCode5(viewCodeInput);
    if (code.length !== 5) return alert("Enter 5-char view code");
    setViewCodeActive(code);
    setViewOpen(true);
  }

  return (
    <div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-lg">Screens • View</div>
            <div className="text-xs text-white/60">
              Enter 5-char code to watch (viewer mode).
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={viewCodeInput}
              onChange={(e) => setViewCodeInput(toCode5(e.target.value))}
              placeholder="ABCDE"
              maxLength={5}
              className="w-28 tracking-widest uppercase px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
            />
            <button
              onClick={openViewByCode}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold"
              type="button"
            >
              View
            </button>
          </div>
        </div>
      </div>

      <LayerModal
        open={viewOpen}
        layerName="View Screen"
        title="Viewer"
        sub={`Code: ${viewCodeActive}`}
        onClose={() => {
          setViewOpen(false);
          setViewCodeActive("");
        }}
        maxWidth="max-w-6xl"
      >
        <ScreenViewClient viewCode={viewCodeActive} embedded />
      </LayerModal>
    </div>
  );
}
