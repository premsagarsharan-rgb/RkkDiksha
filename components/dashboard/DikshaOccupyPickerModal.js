"use client";

import { useMemo, useState } from "react";
import LayerModal from "@/components/LayerModal";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function countStats(list) {
  const out = { total: 0, male: 0, female: 0, other: 0, single: 0, couple: 0, family: 0 };
  for (const a of list || []) {
    out.total++;
    const g = a?.customer?.gender;
    if (g === "MALE") out.male++;
    else if (g === "FEMALE") out.female++;
    else out.other++;

    const k = a?.kind || "SINGLE";
    if (k === "COUPLE") out.couple++;
    else if (k === "FAMILY") out.family++;
    else out.single++;
  }
  return out;
}

function labelCustomer(a) {
  const c = a?.customer || {};
  const name = c?.name || "—";
  const roll = c?.rollNo ? ` (${c.rollNo})` : "";
  const kind = a?.kind ? ` • ${a.kind}${a.roleInPair ? `(${a.roleInPair})` : ""}` : "";
  return `${name}${roll}${kind}`;
}

export default function DikshaOccupyPickerModal({
  open,
  onClose,
  onPick,
  title = "Occupy Diksha Date",
  groupSize = 1,
}) {
  const today = useMemo(() => new Date(), []);
  const minDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), [today]); // tomorrow

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(minDate));
  const [selected, setSelected] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const monthLabel = useMemo(() => {
    return monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [monthCursor]);

  const cells = useMemo(() => {
    const first = startOfMonth(monthCursor);
    const firstDow = first.getDay();
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - firstDow);

    const out = [];
    for (let i = 0; i < 42; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return out;
  }, [monthCursor]);

  async function openPreview(dateKey) {
    setPreviewBusy(true);
    setPreviewData({ dateKey, container: null, assignments: [], reserved: [], error: null });
    setPreviewOpen(true);

    try {
      const cRes = await fetch("/api/calander/container/by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, mode: "DIKSHA" }),
      });
      const cData = await cRes.json().catch(() => ({}));
      if (!cRes.ok) {
        setPreviewData({ dateKey, container: null, assignments: [], reserved: [], error: cData.error || "Container load failed" });
        return;
      }

      const containerObj = cData?.container?.value ?? cData?.container;
      const containerId = containerObj?._id;
      if (!containerId) {
        setPreviewData({ dateKey, container: null, assignments: [], reserved: [], error: "Invalid container response" });
        return;
      }

      const dRes = await fetch(`/api/calander/container/${containerId}?includeReserved=1`);
      const dData = await dRes.json().catch(() => ({}));
      if (!dRes.ok) {
        setPreviewData({ dateKey, container: null, assignments: [], reserved: [], error: dData.error || "Details load failed" });
        return;
      }

      setPreviewData({
        dateKey,
        container: dData.container || containerObj,
        assignments: dData.assignments || [],
        reserved: dData.reserved || [],
        error: null,
      });
    } catch {
      setPreviewData({ dateKey, container: null, assignments: [], reserved: [], error: "Network error" });
    } finally {
      setPreviewBusy(false);
    }
  }

  const assignedStats = useMemo(() => countStats(previewData?.assignments || []), [previewData?.assignments]);
  const reservedStats = useMemo(() => countStats(previewData?.reserved || []), [previewData?.reserved]);

  const limit = previewData?.container?.limit || 20;
  const used = assignedStats.total + reservedStats.total;
  const remaining = limit - used;
  const canOccupy = !previewBusy && !previewData?.error && (used + groupSize <= limit);

  return (
    <>
      <LayerModal
        open={open}
        layerName="Occupy"
        title={title}
        sub="Date click → container preview"
        onClose={() => {
          setPreviewOpen(false);
          setPreviewData(null);
          setSelected("");
          onClose?.();
        }}
        maxWidth="max-w-3xl"
        disableBackdropClose
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <button type="button" onClick={() => setMonthCursor((m) => addMonths(m, -1))} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">
            Prev
          </button>
          <div className="font-semibold">{monthLabel}</div>
          <button type="button" onClick={() => setMonthCursor((m) => addMonths(m, 1))} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] sm:text-xs mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center text-white/60">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === monthCursor.getMonth();

            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const minStart = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
            const disabled = dayStart < minStart;

            const isSelected = selected === key;

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelected(key);
                  openPreview(key);
                }}
                className={[
                  "h-10 rounded-xl border text-sm",
                  inMonth ? "" : "opacity-40",
                  disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10",
                  isSelected ? "bg-white text-black font-semibold" : "bg-transparent text-white",
                  "border-white/10",
                ].join(" ")}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-white/50">
          Selected: <b>{selected || "—"}</b> • Group size: <b>{groupSize}</b>
        </div>
      </LayerModal>

      <LayerModal
        open={previewOpen}
        layerName="Diksha Container"
        title="Diksha Container Preview"
        sub={previewData?.dateKey ? `${previewData.dateKey} • DIKSHA` : "Loading..."}
        onClose={() => setPreviewOpen(false)}
        maxWidth="max-w-4xl"
        disableBackdropClose
      >
        {previewBusy ? (
          <div className="text-white/60">Loading...</div>
        ) : previewData?.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {previewData.error}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-white/60">LIMIT</div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Limit: {limit}</span>
                <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Used: {used}</span>
                <span className={`px-2 py-1 rounded-full border ${remaining <= 0 ? "bg-red-500/15 border-red-400/20" : "bg-emerald-500/15 border-emerald-400/20"}`}>
                  Remaining: {remaining}
                </span>
              </div>
              <div className="mt-2 text-xs text-white/50">
                Occupy karega: <b>{groupSize}</b> slot(s). Allowed: <b>{canOccupy ? "YES" : "NO (Housefull)"}</b>
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <Box title="IN CONTAINER" stats={assignedStats} tone="normal" />
              <Box title="RESERVED / OCCUPIED (Meeting holds)" stats={reservedStats} tone="green" />
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <ListBox title="Cards in Container" list={previewData?.assignments || []} />
              <ListBox title="Reserved Holds" list={previewData?.reserved || []} />
            </div>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setPreviewOpen(false)} className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15">
            Back
          </button>

          <button
            type="button"
            disabled={!previewData?.dateKey || !canOccupy}
            onClick={() => onPick?.(previewData.dateKey)}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
          >
            Confirm Occupy
          </button>
        </div>
      </LayerModal>
    </>
  );
}

function Box({ title, stats, tone }) {
  const base = tone === "green"
    ? "border-emerald-400/20 bg-emerald-500/10"
    : "border-white/10 bg-black/25";

  return (
    <div className={`rounded-2xl border p-4 ${base}`}>
      <div className="text-xs text-white/70">{title}</div>
      <div className="text-2xl font-bold mt-1">{stats.total}</div>

      <div className="mt-2 text-xs text-white/70">Gender</div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">M {stats.male}</span>
        <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">F {stats.female}</span>
        <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">O {stats.other}</span>
      </div>

      <div className="mt-3 text-xs text-white/70">Kinds</div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Single {stats.single}</span>
        <span className="px-2 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/20">Couple {stats.couple}</span>
        <span className="px-2 py-1 rounded-full bg-blue-500/15 border border-blue-400/20">Family {stats.family}</span>
      </div>
    </div>
  );
}

function ListBox({ title, list }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 max-h-[240px] overflow-auto space-y-2 pr-1">
        {(list || []).length === 0 ? (
          <div className="text-white/60 text-sm">Empty</div>
        ) : (
          list.map((a, i) => (
            <div key={a?._id || i} className="rounded-xl border border-white/10 bg-white/5 p-2 text-sm">
              #{i + 1} — {labelCustomer(a)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
