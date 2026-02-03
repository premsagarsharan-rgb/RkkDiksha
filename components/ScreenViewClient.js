"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function themeBg(theme) {
  if (theme === "blue")
    return "bg-[radial-gradient(1200px_600px_at_15%_10%,rgba(59,130,246,0.25),transparent_55%),linear-gradient(to_bottom_right,#05070c,#070a12,#05070c)]";
  if (theme === "purple")
    return "bg-[radial-gradient(1200px_600px_at_15%_10%,rgba(168,85,247,0.26),transparent_55%),linear-gradient(to_bottom_right,#05070c,#070a12,#05070c)]";
  if (theme === "emerald")
    return "bg-[radial-gradient(1200px_600px_at_15%_10%,rgba(16,185,129,0.22),transparent_55%),linear-gradient(to_bottom_right,#05070c,#070a12,#05070c)]";
  return "bg-[radial-gradient(1200px_600px_at_15%_10%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(900px_500px_at_80%_25%,rgba(236,72,153,0.16),transparent_55%),radial-gradient(1000px_600px_at_35%_90%,rgba(34,197,94,0.14),transparent_55%),linear-gradient(to_bottom_right,#05070c,#070a12,#05070c)]";
}

function Chip({ k, v }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-white/60">{k}</div>
      <div className="text-white font-semibold">{String(v ?? "—")}</div>
    </div>
  );
}

function SlideMovie({ slide }) {
  const snaps = slide?.snapshots || [];
  const kind = slide?.kind || "SINGLE";

  if (snaps.length <= 1) {
    const s = snaps[0] || {};
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/45 via-white/5 to-black/45 p-8 shadow-[0_0_90px_rgba(59,130,246,0.14)]">
        <div className="text-[11px] text-white/60 tracking-widest">
          SYSBYTE • PRESENTATION
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-3xl sm:text-4xl font-extrabold truncate">
              {s.name || "—"}
            </div>
            <div className="text-white/70 mt-2 text-sm sm:text-base line-clamp-2">
              {s.address ||
                [s.city, s.state, s.country].filter(Boolean).join(", ") ||
                "—"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-white/60">Roll No</div>
            <div className="mt-1 px-4 py-2 rounded-2xl bg-white text-black font-extrabold text-xl">
              {s.rollNo || "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Chip k="Age" v={s.age || "—"} />
          <Chip k="Gender" v={s.gender || "—"} />
          <Chip k="DB" v={s.sourceDb || "—"} />
          <Chip k="Kind" v={kind} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/45 via-white/5 to-black/45 p-8 shadow-[0_0_90px_rgba(168,85,247,0.12)]">
      <div className="text-[11px] text-white/60 tracking-widest">
        SYSBYTE • GROUP
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-2xl font-extrabold">
          {kind} • {snaps.length} Members
        </div>
        <div className="text-xs text-white/60">One slide (group)</div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {snaps.map((s, i) => (
          <div
            key={s.customerId || i}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{s.name || "—"}</div>
                <div className="text-xs text-white/60">
                  Roll: {s.rollNo || "—"} • {s.gender || "—"}
                </div>
              </div>
              <div className="text-xs text-white/60">#{i + 1}</div>
            </div>
            <div className="mt-2 text-xs text-white/70 line-clamp-2">
              {s.address || [s.city, s.state].filter(Boolean).join(", ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * pollMs:
 * - default: embedded ? 0 : 2000
 * - pass pollMs={0} to fully disable auto refresh
 */
export default function ScreenViewClient({ viewCode, embedded = false, pollMs }) {
  const effectivePollMs =
    typeof pollMs === "number" ? pollMs : embedded ? 0 : 2000;

  const aliveRef = useRef(true);

  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function load({ soft = false } = {}) {
    if (!viewCode) return;

    if (soft) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/screens/view/${encodeURIComponent(viewCode)}`);
      const data = await res.json().catch(() => ({}));

      if (!aliveRef.current) return;

      if (!res.ok) {
        setScreen({ error: data.error || "Invalid view code" });
        return;
      }

      const next = data.screen;

      // avoid re-render if nothing changed
      setScreen((prev) => {
        if (!prev || prev.error) return next;
        if (prev?.updatedAt && next?.updatedAt && prev.updatedAt === next.updatedAt)
          return prev;
        return next;
      });
    } finally {
      if (!aliveRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }

  // initial load (on code change)
  useEffect(() => {
    if (!viewCode) return;
    load({ soft: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewCode]);

  // auto-poll (only if enabled)
  useEffect(() => {
    if (!viewCode) return;
    if (!effectivePollMs || effectivePollMs <= 0) return;

    let stop = false;
    let t = null;

    const tick = async () => {
      if (stop) return;

      // pause polling if tab hidden
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        t = setTimeout(tick, effectivePollMs);
        return;
      }

      await load({ soft: true });
      t = setTimeout(tick, effectivePollMs);
    };

    t = setTimeout(tick, effectivePollMs);

    return () => {
      stop = true;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewCode, effectivePollMs]);

  const slides = screen?.slides || [];
  const theme = screen?.settings?.theme || "aurora";

  useEffect(() => {
    if (!slides.length) {
      setIdx(0);
      return;
    }
    if (idx >= slides.length) setIdx(0);
  }, [slides.length, idx]);

  const current = slides[idx] || null;
  const bg = useMemo(() => themeBg(theme), [theme]);

  // Keyboard support: ArrowLeft/ArrowRight
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e?.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (!slides.length) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => (slides.length ? (i + 1) % slides.length : 0));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  const Wrapper = ({ children }) =>
    embedded ? (
      <div className={`rounded-3xl ${bg} p-4 sm:p-6`}>{children}</div>
    ) : (
      <div className={`min-h-screen ${bg} text-white`}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6">{children}</div>
      </div>
    );

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-xs text-white/60">VIEW CODE</div>
          <div className="text-lg font-bold truncate">{viewCode || "—"}</div>
          <div className="text-xs text-white/50 truncate">
            {screen?.title ? `${screen.title} • By ${screen.createdByUsername || "—"}` : ""}
          </div>
          <div className="text-[11px] text-white/50 mt-1">
            Keyboard: ← Prev • → Next
            {effectivePollMs > 0 ? ` • Live: ON (${effectivePollMs}ms)` : " • Live: OFF"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load({ soft: false })}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            disabled={!slides.length}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs disabled:opacity-60"
          >
            Prev
          </button>

          <button
            type="button"
            disabled={!slides.length}
            onClick={() => setIdx((i) => (slides.length ? (i + 1) % slides.length : 0))}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : screen?.error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-200">
          {screen.error}
        </div>
      ) : !current ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
          <div className="text-2xl font-bold">Screen Blank</div>
          <div className="text-white/60 text-sm mt-2">
            Creator card push karega tab slides show hongi.
          </div>
        </div>
      ) : (
        <>
          <SlideMovie slide={current} />
          <div className="mt-2 text-xs text-white/60">
            Slide {idx + 1}/{slides.length}
          </div>
        </>
      )}
    </Wrapper>
  );
}
