"use client";

import { useState } from "react";

function toCode5(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

export default function ScreensViewer() {
  const [viewCodeInput, setViewCodeInput] = useState("");

  function openFullscreen() {
    const code = toCode5(viewCodeInput);
    if (code.length !== 5) return alert("Enter 5-char view code");
    window.open(`/screen/view/${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const code = toCode5(viewCodeInput);
    if (code.length !== 5) return alert("Enter 5-char view code");

    const url = `${window.location.origin}/screen/view/${code}`;
    await navigator.clipboard.writeText(url);
    alert("Viewer link copied");
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-white font-semibold text-lg">Screens • View</div>
          <div className="text-xs text-white/60">
            Enter 5-char code → open full-screen viewer (TV/Monitor).
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
            onClick={openFullscreen}
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold"
            type="button"
          >
            Open
          </button>

          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-white text-sm"
            type="button"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
