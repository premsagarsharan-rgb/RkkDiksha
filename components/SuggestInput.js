// components/SuggestInput.js
"use client";
import { useMemo, useState } from "react";

export default function SuggestInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  dark = false,
  allowScroll = true,
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const v = (value || "").toLowerCase();
    const list = v
      ? suggestions.filter((s) => String(s).toLowerCase().includes(v))
      : suggestions;
    return list.slice(0, 120);
  }, [value, suggestions]);

  const base = dark
    ? "bg-black/30 border-white/10 text-white placeholder:text-white/40 focus:ring-blue-500/40"
    : "bg-white border-gray-200 text-black placeholder:text-gray-400 focus:ring-black/20";

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 ${base}`}
      />

      {open && filtered.length > 0 && (
        <div
          className={`absolute z-[200] mt-2 w-full rounded-2xl border overflow-hidden ${
            dark ? "bg-black/90 backdrop-blur border-white/10" : "bg-white border-gray-200"
          } ${allowScroll ? "max-h-60 overflow-y-auto" : ""}`}
        >
          {filtered.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={() => { onChange(String(s)); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs ${
                dark ? "text-white/90 hover:bg-white/10" : "text-black hover:bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
