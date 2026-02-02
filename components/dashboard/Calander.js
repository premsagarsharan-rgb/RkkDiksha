"use client";

import { useEffect, useMemo, useState } from "react";
import LayerModal from "@/components/LayerModal";
import { useCommitGate } from "@/components/CommitGate";
import CustomerProfileModal from "@/components/CustomerProfileModal";
import DikshaOccupyPickerModal from "@/components/dashboard/DikshaOccupyPickerModal";

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function safeId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.$oid) return String(x.$oid);
  return String(x);
}

function escapeHtml(s) {
  const str = String(s ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function countGenders(list) {
  let male = 0, female = 0, other = 0;
  for (const a of list || []) {
    const g = a?.customer?.gender;
    if (g === "MALE") male++;
    else if (g === "FEMALE") female++;
    else other++;
  }
  return { male, female, other, total: male + female + other };
}

export default function Calander({ role }) {
  const [calOpen, setCalOpen] = useState(false);
  const [mode, setMode] = useState("DIKSHA");
  const [anchor, setAnchor] = useState(new Date());

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const cells = useMemo(() => monthCells(year, month), [year, month]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [summary, setSummary] = useState({});
  const todayStr = useMemo(() => ymdLocal(new Date()), []);

  // Container
  const [containerOpen, setContainerOpen] = useState(false);
  const [container, setContainer] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [reserved, setReserved] = useState([]);
  const [showList, setShowList] = useState(true);
  const [housefull, setHousefull] = useState(false);

  // Add customer layer
  const [addOpen, setAddOpen] = useState(false);
  const [sittingActive, setSittingActive] = useState([]);
  const [pickMode, setPickMode] = useState("SINGLE");
  const [selectedIds, setSelectedIds] = useState([]);
  const [pushing, setPushing] = useState(false);

  // Confirm modals
  const [confirmSingleOpen, setConfirmSingleOpen] = useState(false);
  const [confirmFamilyOpen, setConfirmFamilyOpen] = useState(false);
  const [singleTargetId, setSingleTargetId] = useState(null);

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);

  // ✅ profile context for approve-for shift (meeting reject)
  const [profileCtx, setProfileCtx] = useState(null); // { containerId, assignmentId, initialApproveStep }

  // Occupy picker
  const [occupyOpen, setOccupyOpen] = useState(false);
  const [occupyCtx, setOccupyCtx] = useState(null);

  // Reject options modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Assigned customer to container",
      "Couple assigned",
      "Family assigned",
      "Out from container",
      "Meeting reserved (occupy)",
      "Meeting confirm → Diksha",
      "Meeting reject → Pending",
      "Meeting reject → ApproveFor",
    ],
  });

  async function loadSummary() {
    const from = ymdLocal(new Date(year, month, 1));
    const to = ymdLocal(new Date(year, month + 1, 0));
    const res = await fetch(`/api/calander/summary?from=${from}&to=${to}&mode=${mode}`);
    const data = await res.json().catch(() => ({}));
    setSummary(data.map || {});
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, mode]);

  async function openContainerForDate(dateStr) {
    setHousefull(false);
    setSelectedDate(dateStr);

    const cRes = await fetch("/api/calander/container/by-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateStr, mode }),
    });

    const raw = await cRes.json().catch(() => ({}));
    if (!cRes.ok) return alert(raw.error || "Container failed");

    const containerObj = raw?.container?.value ?? raw?.container;
    if (!containerObj?._id) return alert("Invalid container response");

    const id = safeId(containerObj._id);

    const dRes = await fetch(`/api/calander/container/${id}?includeReserved=1`);
    const dData = await dRes.json().catch(() => ({}));
    if (!dRes.ok) return alert(dData.error || "Load failed");

    setContainer(dData.container);
    setAssignments(dData.assignments || []);
    setReserved(dData.reserved || []);
    setShowList(true);
    setContainerOpen(true);
  }

  async function refreshContainer() {
    if (!container?._id) return;
    const id = safeId(container._id);
    const dRes = await fetch(`/api/calander/container/${id}?includeReserved=1`);
    const dData = await dRes.json().catch(() => ({}));
    if (!dRes.ok) return;
    setContainer(dData.container);
    setAssignments(dData.assignments || []);
    setReserved(dData.reserved || []);
  }

  async function openAddCustomerLayer() {
    setHousefull(false);
    setPickMode("SINGLE");
    setSelectedIds([]);
    setSingleTargetId(null);
    setConfirmSingleOpen(false);
    setConfirmFamilyOpen(false);
    setAddOpen(true);

    const sitRes = await fetch("/api/customers/sitting");
    const sitData = await sitRes.json().catch(() => ({}));
    if (!sitRes.ok) return alert(sitData.error || "Failed to load sitting customers");

    setSittingActive((sitData.items || []).filter((c) => c.status === "ACTIVE"));
  }

  function initiateSingleAssign(customerId) {
    setSingleTargetId(customerId);
    setConfirmSingleOpen(true);
  }

  async function confirmSinglePush({ occupyDate } = {}) {
    if (!container?._id || !singleTargetId) return;

    if (container.mode === "MEETING" && !occupyDate) {
      setOccupyCtx({ type: "SINGLE", customerId: singleTargetId, groupSize: 1 });
      setOccupyOpen(true);
      return;
    }

    const commitMessage = await requestCommit({
      title: container.mode === "MEETING" ? "Meeting Assign + Occupy" : "Assign Single",
      subtitle: container.mode === "MEETING" ? `Occupy Diksha: ${occupyDate}` : "Customer will be added to container.",
      preset: container.mode === "MEETING" ? "Meeting reserved (occupy)" : "Assigned customer to container",
    }).catch(() => null);

    if (!commitMessage) return;

    setPushing(true);
    try {
      const res = await fetch(`/api/calander/container/${container._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: singleTargetId,
          source: "SITTING",
          note: "",
          commitMessage,
          occupyDate: container.mode === "MEETING" ? occupyDate : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "HOUSEFULL") setHousefull(true);
        else alert(data.error || "Assign failed");
        return;
      }

      await refreshContainer();
      await loadSummary();
      setConfirmSingleOpen(false);
      setAddOpen(false);
    } finally {
      setPushing(false);
    }
  }

  function initiateFamilyAssign() {
    if (selectedIds.length < 2) return alert("Select minimum 2 customers");
    setConfirmFamilyOpen(true);
  }

  async function confirmFamilyPush({ occupyDate } = {}) {
    if (!container?._id) return;
    const ids = selectedIds.map(safeId).filter(Boolean);
    if (ids.length < 2) return alert("Select minimum 2 customers");

    if (container.mode === "MEETING" && !occupyDate) {
      setOccupyCtx({ type: "FAMILY", customerIds: ids, groupSize: ids.length });
      setOccupyOpen(true);
      return;
    }

    const isCouple = ids.length === 2;

    const commitMessage = await requestCommit({
      title: container.mode === "MEETING" ? "Meeting Group + Occupy" : (isCouple ? "Assign Couple" : "Assign Family"),
      subtitle: container.mode === "MEETING" ? `Occupy Diksha: ${occupyDate}` : "Group will be added to container.",
      preset: container.mode === "MEETING" ? "Meeting reserved (occupy)" : (isCouple ? "Couple assigned" : "Family assigned"),
    }).catch(() => null);

    if (!commitMessage) return;

    setPushing(true);
    try {
      const res = await fetch(`/api/calander/container/${container._id}/assign-couple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: ids,
          note: "",
          commitMessage,
          occupyDate: container.mode === "MEETING" ? occupyDate : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "HOUSEFULL") setHousefull(true);
        else alert(data.error || "Family assign failed");
        return;
      }

      await refreshContainer();
      await loadSummary();
      setConfirmFamilyOpen(false);
      setAddOpen(false);
    } finally {
      setPushing(false);
    }
  }

  async function confirmMeetingCard(assignment) {
    const commitMessage = await requestCommit({
      title: "Confirm → Move to Diksha",
      subtitle: `Occupied: ${assignment.occupiedDate || "-"}`,
      preset: "Meeting confirm → Diksha",
    }).catch(() => null);

    if (!commitMessage) return;

    const res = await fetch(
      `/api/calander/container/${container._id}/assignments/${assignment._id}/confirm`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commitMessage }) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Confirm failed");

    await refreshContainer();
    await loadSummary();
  }

  async function rejectToPending(assignment) {
    const commitMessage = await requestCommit({
      title: "Reject → Push to Pending",
      subtitle: "Customer will be moved to Pending database.",
      preset: "Meeting reject → Pending",
    }).catch(() => null);

    if (!commitMessage) return;

    const res = await fetch(
      `/api/calander/container/${container._id}/assignments/${assignment._id}/reject`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commitMessage }) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Reject failed");

    setRejectOpen(false);
    setRejectTarget(null);

    await refreshContainer();
    await loadSummary();
  }

  async function outAssignment(assignmentIdRaw) {
    if (!container?._id) return;
    const assignmentId = safeId(assignmentIdRaw);

    const commitMessage = await requestCommit({
      title: "Out",
      subtitle: "If this is a couple/family, all members will go OUT.",
      preset: "Out from container",
    }).catch(() => null);

    if (!commitMessage) return;

    const res = await fetch(`/api/calander/container/${container._id}/assignments/${assignmentId}/out`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitMessage }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Out failed");

    await refreshContainer();
    await loadSummary();
  }

  async function increaseLimit() {
    if (role !== "ADMIN") return alert("Only admin can increase limit");
    if (!container?._id) return;

    const next = prompt("New limit?", String(container.limit || 20));
    if (!next) return;
    const limit = parseInt(next, 10);
    if (!Number.isFinite(limit) || limit < 1) return alert("Invalid limit");

    const res = await fetch(`/api/calander/container/${container._id}/limit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Limit update failed");

    await refreshContainer();
    await loadSummary();
  }

  function openProfile(customerObj) {
    if (!customerObj?._id) return;
    setProfileCtx(null);
    setProfileCustomer(customerObj);
    setProfileOpen(true);
  }

  // Print All unchanged (same as your previous version)
  function openPrintAllForContainer() {
    if (!container?._id) return alert("Container not ready");
    if (!assignments || assignments.length === 0) return alert("No customers in container");

    const title = `${container.date} / ${container.mode}`;
    const total = assignments.length;

    const pagesHtml = assignments
      .map((a, idx) => {
        const c = a.customer || {};
        const seq = idx + 1;
        const kind = a.kind || "SINGLE";
        const roleInPair = a.roleInPair ? ` (${a.roleInPair})` : "";

        return `
          <section class="sheet">
            <div class="sheetHead">
              <div class="muted">Sysbyte • ${escapeHtml(title)}</div>
              <div class="muted">#${seq}/${total} • ${escapeHtml(kind + roleInPair)}</div>
            </div>
            <h2 class="name">${escapeHtml(c.name || "—")}</h2>
            <div class="grid">
              <div class="field"><div class="k">RollNo</div><div class="v">${escapeHtml(c.rollNo || "—")}</div></div>
              <div class="field"><div class="k">Age</div><div class="v">${escapeHtml(c.age || "—")}</div></div>
              <div class="field"><div class="k">Gender</div><div class="v">${escapeHtml(c.gender || "—")}</div></div>
              <div class="field"><div class="k">Pincode</div><div class="v">${escapeHtml(c.pincode || "—")}</div></div>
              <div class="field full"><div class="k">Address</div><div class="v">${escapeHtml(c.address || "—")}</div></div>
              <div class="field"><div class="k">Follow Years</div><div class="v">${escapeHtml(c.followYears || "—")}</div></div>
              <div class="field"><div class="k">Club Visits</div><div class="v">${escapeHtml(c.clubVisitsBefore || "—")}</div></div>
              <div class="field"><div class="k">Month/Year</div><div class="v">${escapeHtml(c.monthYear || "—")}</div></div>
              <div class="field"><div class="k">City/State</div><div class="v">${escapeHtml((c.city || "—") + " / " + (c.state || "—"))}</div></div>
              <div class="field full"><div class="k">Description / Notes</div><div class="descBox"></div></div>
            </div>
            <div class="sig"><div class="line">Customer Signature</div><div class="line">Admin Signature</div></div>
          </section>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Print • ${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f7f7f7; color: #111; }
    .topbar { position: sticky; top: 0; z-index: 9999; background: #111; color: #fff; padding: 10px 12px; display:flex; justify-content:space-between; }
    .btn { border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 800; }
    .btnClose { background: rgba(255,255,255,0.18); color: #fff; }
    .btnPrint { background: #fff; color: #111; }
    .wrap { padding: 14px; }
    .sheet { background:#fff; border:1px solid #ddd; border-radius:14px; padding:16px; margin-bottom:14px; break-after:page; page-break-after:always; }
    .sheet:last-child { break-after:auto; page-break-after:auto; }
    .sheetHead { display:flex; justify-content:space-between; gap:10px; }
    .muted { font-size:12px; color:#666; }
    .name { margin:10px 0 6px 0; font-size:18px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
    .field { border:1px solid #eee; border-radius:10px; padding:10px; }
    .full { grid-column:1 / -1; }
    .k { font-size:11px; color:#666; margin-bottom:4px; }
    .v { font-size:14px; font-weight:700; }
    .descBox { border:1px dashed #999; border-radius:10px; height:90px; margin-top:8px; }
    .sig { margin-top:22px; display:flex; gap:16px; }
    .line { flex:1; border-top:1px solid #333; padding-top:6px; font-size:12px; }
    @media print { body{background:#fff;} .topbar{display:none;} .wrap{padding:0;} .sheet{border:none;border-radius:0;margin:0;} }
  </style>
</head><body>
  <div class="topbar">
    <div style="font-weight:900;">Print All • ${escapeHtml(title)} (${total})</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btnClose" id="btnClose" type="button">Close</button>
      <button class="btn btnPrint" id="btnPrint" type="button">Print</button>
    </div>
  </div>
  <div class="wrap">${pagesHtml}</div>
  <script>
    document.getElementById('btnPrint').addEventListener('click', function(){ window.focus(); window.print(); });
    document.getElementById('btnClose').addEventListener('click', function(){ window.close(); });
  </script>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      alert("Popup blocked. Please allow popups for printing.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const counts = countGenders(assignments);
  const reservedCounts = countGenders(reserved);

  const selectedCustomers = useMemo(() => {
    const map = new Map(sittingActive.map((c) => [safeId(c._id), c]));
    return selectedIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [selectedIds, sittingActive]);

  const targetSingle = useMemo(() => {
    return singleTargetId ? sittingActive.find((c) => safeId(c._id) === singleTargetId) : null;
  }, [singleTargetId, sittingActive]);

  const familySelectStyle = useMemo(() => {
    if (pickMode !== "FAMILY") return { border: "border-white/10", bg: "bg-black/30" };
    if (selectedIds.length === 2) return { border: "border-fuchsia-400/30", bg: "bg-fuchsia-500/10" };
    if (selectedIds.length > 2) return { border: "border-blue-400/30", bg: "bg-blue-500/10" };
    return { border: "border-white/10", bg: "bg-black/30" };
  }, [pickMode, selectedIds.length]);

  return (
    <div>
      <button
        onClick={() => { setAnchor(new Date()); setCalOpen(true); }}
        className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition"
        type="button"
      >
        Open Calander
      </button>

      {/* Layer 1: Calendar grid */}
      <LayerModal
        open={calOpen}
        layerName="Calander"
        title="Calander"
        sub="Sunday-Red Monthly Grid"
        onClose={() => {
          setCalOpen(false);
          setContainerOpen(false);
          setAddOpen(false);
          setConfirmSingleOpen(false);
          setConfirmFamilyOpen(false);
        }}
        maxWidth="max-w-5xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-base sm:text-lg font-bold">
            {anchor.toLocaleString("default", { month: "long" })} {year}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setAnchor(new Date(year, month - 1, 1))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15" type="button">◀</button>

            <div className="rounded-2xl bg-black/30 border border-white/10 p-1 flex">
              <button
                onClick={() => setMode("DIKSHA")}
                className={`px-3 sm:px-4 py-2 rounded-xl text-sm ${mode==="DIKSHA" ? "bg-white text-black font-semibold" : "text-white/70 hover:bg-white/10"}`}
                type="button"
              >
                Diksha
              </button>
              <button
                onClick={() => setMode("MEETING")}
                className={`px-3 sm:px-4 py-2 rounded-xl text-sm ${mode==="MEETING" ? "bg-white text-black font-semibold" : "text-white/70 hover:bg-white/10"}`}
                type="button"
              >
                Meeting
              </button>
            </div>

            <button onClick={() => setAnchor(new Date(year, month + 1, 1))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15" type="button">▶</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] sm:text-xs mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>(
            <div key={d} className={`${i===0 ? "text-red-300" : "text-white/70"} text-center`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} />;
            const dateStr = ymdLocal(d);
            const isSun = idx % 7 === 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            const s = summary[dateStr];

            return (
              <button
                key={dateStr}
                onClick={() => openContainerForDate(dateStr)}
                className={[
                  "min-h-[62px] sm:min-h-[84px] rounded-2xl border p-1.5 sm:p-2 text-left transition",
                  "bg-black/30 border-white/10 hover:bg-black/40",
                  isSelected ? "ring-2 ring-blue-500/60" : "",
                  isSun ? "ring-1 ring-red-500/20" : "",
                  isToday ? "ring-2 ring-emerald-400/60 border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.12)]" : "",
                ].join(" ")}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <div className={`text-xs sm:text-sm font-semibold ${isSun ? "text-red-200" : "text-white"}`}>{d.getDate()}</div>
                  {isToday ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 border border-emerald-400/20 text-emerald-200">Today</span>
                  ) : null}
                </div>

                <div className="text-[10px] text-white/50">{mode}</div>

                {s ? (
                  <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-white/80 flex gap-1.5 sm:gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">M {s.male}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">F {s.female}</span>
                  </div>
                ) : (
                  <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-white/35">—</div>
                )}
              </button>
            );
          })}
        </div>
      </LayerModal>

      {/* Layer 2: Container */}
      <LayerModal
        open={containerOpen && !!container}
        layerName="Container"
        title={container ? `${container.date} / ${container.mode}` : "Container"}
        sub={
          container?.mode === "DIKSHA"
            ? `IN ${counts.total} (M${counts.male}/F${counts.female}) • Reserved ${reservedCounts.total} • Limit ${container.limit || 20}`
            : `Total ${counts.total} | Male ${counts.male} | Female ${counts.female}`
        }
        onClose={() => {
          setContainerOpen(false);
          setAddOpen(false);
          setConfirmSingleOpen(false);
          setConfirmFamilyOpen(false);
          setRejectOpen(false);
          setRejectTarget(null);
          setContainer(null);
          setAssignments([]);
          setReserved([]);
        }}
        maxWidth="max-w-5xl"
      >
        {housefull ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
            <div className="text-sm font-semibold text-red-200">Housefull</div>
            <div className="text-xs text-red-200/80 mt-1">Limit reached. Admin can increase limit.</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
          {role === "ADMIN" && (
            <button onClick={increaseLimit} className="w-11 h-11 shrink-0 rounded-2xl bg-white text-black font-bold" title="Increase limit" type="button">+</button>
          )}

          <button type="button" onClick={openPrintAllForContainer} className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10" title="Print all">🖨</button>
          <button onClick={() => setShowList((v) => !v)} className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10" title="Toggle list" type="button">☰</button>
          <button onClick={openAddCustomerLayer} className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10" title="Add customer" type="button">＋</button>
        </div>

        {container?.mode === "DIKSHA" && reserved?.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <div className="text-sm font-semibold text-emerald-100">Reserved / Occupied (Meeting holds)</div>
            <div className="text-xs text-emerald-100/80 mt-1">Count: {reserved.length}</div>
          </div>
        ) : null}

        {!showList ? (
          <div className="text-white/60">List hidden.</div>
        ) : assignments.length === 0 ? (
          <div className="text-white/60">No customers in container.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {assignments.map((a, idx) => {
              const seq = idx + 1;
              const kind = a.kind || "SINGLE";
              const cust = a.customer;

              const isCouple = kind === "COUPLE";
              const isFamily = kind === "FAMILY";

              const cardCls = [
                "rounded-2xl border p-3 flex items-start justify-between gap-2 cursor-pointer transition",
                "hover:bg-black/35",
                isFamily ? "border-blue-400/20 bg-blue-500/10" : "",
                isCouple ? "border-fuchsia-400/20 bg-fuchsia-500/10" : "",
                !isFamily && !isCouple ? "border-white/10 bg-black/30" : "",
              ].join(" ");

              const isMeeting = container?.mode === "MEETING";

              return (
                <div
                  key={safeId(a._id)}
                  className={cardCls}
                  onClick={() => openProfile(cust)}
                  title="Click to open profile"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-white/60">
                      #{seq} • {kind}{a.roleInPair ? ` (${a.roleInPair})` : ""}
                    </div>
                    <div className="font-semibold truncate">{cust?.name}</div>
                    <div className="text-xs text-white/60 truncate">{cust?.address || "-"}</div>
                    <div className="text-[11px] text-white/50 mt-1">{cust?.gender}</div>

                    {isMeeting && a?.occupiedDate ? (
                      <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 border border-emerald-400/20 text-emerald-200">
                        Occupied: {a.occupiedDate}
                      </div>
                    ) : null}
                  </div>

                  {isMeeting ? (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); confirmMeetingCard(a); }}
                        className="px-3 py-1 rounded-xl bg-white text-black text-xs font-semibold"
                      >
                        Confirm
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectTarget(a);
                          setRejectOpen(true);
                        }}
                        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); outAssignment(a._id); }}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-xs shrink-0"
                    >
                      Out
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </LayerModal>

      {/* Reject options */}
      <LayerModal
        open={rejectOpen}
        layerName="Reject"
        title="Reject Options"
        sub="Choose action"
        onClose={() => { setRejectOpen(false); setRejectTarget(null); }}
        maxWidth="max-w-md"
        disableBackdropClose
      >
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-sm text-white/80">
            Customer: <b>{rejectTarget?.customer?.name || "—"}</b>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => rejectTarget && rejectToPending(rejectTarget)}
              className="px-4 py-3 rounded-2xl bg-white text-black font-semibold"
            >
              Push to Pending
            </button>

            {/* ✅ Approve For enabled */}
            <button
              type="button"
              onClick={() => {
                if (!rejectTarget?.customer?._id) return;

                // close reject modal
                setRejectOpen(false);

                // open profile directly in approve step
                setProfileCtx({
                  containerId: String(container?._id || ""),
                  assignmentId: String(rejectTarget._id || ""),
                  initialApproveStep: "pickDate",
                });
                setProfileCustomer(rejectTarget.customer);
                setProfileOpen(true);
              }}
              className="px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 text-white font-semibold"
            >
              Approve For (Shift)
            </button>

            <button
              type="button"
              onClick={() => { setRejectOpen(false); setRejectTarget(null); }}
              className="px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
            >
              Close
            </button>
          </div>
        </div>
      </LayerModal>

      {/* Add customer layer (same) */}
      <LayerModal
        open={addOpen}
        layerName="Add Customer"
        title="Add Customer"
        sub="Sitting ACTIVE"
        onClose={() => { setAddOpen(false); setConfirmSingleOpen(false); setConfirmFamilyOpen(false); }}
        maxWidth="max-w-4xl"
      >
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <button onClick={() => { setPickMode("SINGLE"); setSelectedIds([]); }} className={`px-4 py-2 rounded-2xl text-sm ${pickMode==="SINGLE" ? "bg-white text-black font-semibold" : "bg-white/10 hover:bg-white/15"}`} type="button">
            Single
          </button>

          <button onClick={() => { setPickMode("FAMILY"); setSelectedIds([]); }} className={`px-4 py-2 rounded-2xl text-sm ${pickMode==="FAMILY" ? "bg-white text-black font-semibold" : "bg-white/10 hover:bg-white/15"}`} type="button">
            Family (2+)
          </button>

          {pickMode === "FAMILY" && (
            <button onClick={initiateFamilyAssign} disabled={selectedIds.length < 2} className="ml-auto px-4 py-2 rounded-2xl bg-white text-black font-semibold disabled:opacity-60" type="button">
              Next
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto pr-1">
          {sittingActive.map((c) => {
            const id = safeId(c._id);
            const selected = selectedIds.includes(id);

            const familySelectedCls =
              pickMode === "FAMILY" && selected
                ? (selectedIds.length === 2 ? "border-fuchsia-400/40 bg-fuchsia-500/10" : "border-blue-400/40 bg-blue-500/10")
                : "";

            return (
              <div
                key={id}
                className={[
                  "rounded-2xl border p-3",
                  pickMode === "FAMILY" ? `border-white/10 bg-black/30` : "border-white/10 bg-black/30",
                  familySelectedCls,
                ].join(" ")}
              >
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-white/60 truncate">{c.address || "-"}</div>
                <div className="text-[11px] text-white/50 mt-1">Gender: {c.gender}</div>

                <div className="mt-3 flex justify-end gap-2">
                  {pickMode === "SINGLE" ? (
                    <button disabled={pushing} onClick={() => initiateSingleAssign(id)} className="px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs disabled:opacity-60" type="button">
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs"
                      type="button"
                    >
                      {selected ? "Selected" : "Select"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </LayerModal>

      {/* Confirm single */}
      <LayerModal open={confirmSingleOpen} layerName="Confirm Single" title="Confirm Single" sub="Review details → Push" onClose={() => setConfirmSingleOpen(false)} maxWidth="max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          {targetSingle ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60">CUSTOMER</div>
              <div className="font-semibold mt-1">{targetSingle.name}</div>
              <div className="text-xs text-white/70 mt-1">{targetSingle.address || "-"}</div>
              <div className="text-[11px] text-white/60 mt-1">Gender: {targetSingle.gender}</div>
            </div>
          ) : (
            <div className="text-white/60">No customer selected.</div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={() => setConfirmSingleOpen(false)} className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15" type="button">
              Back
            </button>
            <button onClick={() => confirmSinglePush()} disabled={pushing || !targetSingle} className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60" type="button">
              {pushing ? "Pushing..." : "Push Single"}
            </button>
          </div>
        </div>
      </LayerModal>

      {/* Confirm family */}
      <LayerModal
        open={confirmFamilyOpen}
        layerName="Confirm Family"
        title={selectedCustomers.length === 2 ? "Confirm Couple" : "Confirm Family"}
        sub="Review selected customers → Push"
        onClose={() => setConfirmFamilyOpen(false)}
        maxWidth="max-w-4xl"
      >
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmFamilyOpen(false)} className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15" type="button">
            Back
          </button>
          <button onClick={() => confirmFamilyPush()} disabled={pushing || selectedIds.length < 2} className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60" type="button">
            {pushing ? "Pushing..." : (selectedIds.length === 2 ? "Push Couple" : "Push Family")}
          </button>
        </div>
      </LayerModal>

      {/* Occupy picker */}
      <DikshaOccupyPickerModal
        open={occupyOpen}
        groupSize={occupyCtx?.groupSize || 1}
        onClose={() => { setOccupyOpen(false); setOccupyCtx(null); }}
        onPick={async (dateKey) => {
          const ctx = occupyCtx;
          setOccupyOpen(false);
          setOccupyCtx(null);

          if (!ctx) return;

          if (ctx.type === "SINGLE") await confirmSinglePush({ occupyDate: dateKey });
          else await confirmFamilyPush({ occupyDate: dateKey });
        }}
      />

      {/* Profile modal */}
      <CustomerProfileModal
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setProfileCustomer(null);
          setProfileCtx(null);
        }}
        customer={profileCustomer}
        source="SITTING"
        initialApproveStep={profileCtx?.initialApproveStep || null}
        contextContainerId={profileCtx?.containerId || null}
        contextAssignmentId={profileCtx?.assignmentId || null}
        onChanged={async () => {
          await refreshContainer();
          await loadSummary();
        }}
      />

      {CommitModal}
    </div>
  );
}
