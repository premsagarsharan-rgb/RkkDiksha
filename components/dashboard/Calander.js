"use client";

import { useEffect, useMemo, useState } from "react";
import LayerModal from "@/components/LayerModal";
import { useCommitGate } from "@/components/CommitGate";
import CustomerProfileModal from "@/components/CustomerProfileModal";

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

export default function Calander({ role }) {
  // Layer 1
  const [calOpen, setCalOpen] = useState(false);
  const [mode, setMode] = useState("DIKSHA");
  const [anchor, setAnchor] = useState(new Date());

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const cells = useMemo(() => monthCells(year, month), [year, month]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [summary, setSummary] = useState({});

  const todayStr = useMemo(() => ymdLocal(new Date()), []);

  // Layer 2
  const [containerOpen, setContainerOpen] = useState(false);
  const [container, setContainer] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [showList, setShowList] = useState(true);
  const [housefull, setHousefull] = useState(false);

  // Layer 3
  const [addOpen, setAddOpen] = useState(false);
  const [sittingActive, setSittingActive] = useState([]);
  const [pickMode, setPickMode] = useState("SINGLE"); // SINGLE | FAMILY
  const [selectedIds, setSelectedIds] = useState([]);
  const [pushing, setPushing] = useState(false);

  // Layer 4 (Confirmations)
  const [confirmSingleOpen, setConfirmSingleOpen] = useState(false);
  const [confirmFamilyOpen, setConfirmFamilyOpen] = useState(false);
  const [singleTargetId, setSingleTargetId] = useState(null);

  // Profile from container cards
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Assigned customer to container",
      "Couple assigned",
      "Family assigned",
      "Out from container",
      "Appointment assigned",
      "Customer shifted",
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

    const dRes = await fetch(`/api/calander/container/${id}`);
    const dData = await dRes.json().catch(() => ({}));
    if (!dRes.ok) return alert(dData.error || "Load failed");

    setContainer(dData.container);
    setAssignments(dData.assignments || []);
    setShowList(true);
    setContainerOpen(true);
  }

  async function refreshContainer() {
    if (!container?._id) return;
    const id = safeId(container._id);
    const dRes = await fetch(`/api/calander/container/${id}`);
    const dData = await dRes.json().catch(() => ({}));
    if (!dRes.ok) return;
    setContainer(dData.container);
    setAssignments(dData.assignments || []);
  }

  function genderCountFromAssignments() {
    let male = 0, female = 0, other = 0;
    for (const a of assignments) {
      const g = a.customer?.gender;
      if (g === "MALE") male++;
      else if (g === "FEMALE") female++;
      else other++;
    }
    return { male, female, other, total: male + female + other };
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

  // --- SINGLE CONFIRM FLOW ---
  function initiateSingleAssign(customerId) {
    setSingleTargetId(customerId);
    setConfirmSingleOpen(true);
  }

  async function confirmSinglePush() {
    if (!container?._id || !singleTargetId) return;

    const commitMessage = await requestCommit({
      title: "Assign Single",
      subtitle: "Customer will be added to container.",
      preset: "Assigned customer to container",
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

  // --- FAMILY (2..N) CONFIRM FLOW ---
  function initiateFamilyAssign() {
    if (selectedIds.length < 2) return alert("Select minimum 2 customers");
    setConfirmFamilyOpen(true);
  }

  async function confirmFamilyPush() {
    if (!container?._id) return;
    const ids = selectedIds.map(safeId).filter(Boolean);
    if (ids.length < 2) return alert("Select minimum 2 customers");

    const isCouple = ids.length === 2;

    const commitMessage = await requestCommit({
      title: isCouple ? "Assign Couple" : "Assign Family",
      subtitle: isCouple
        ? "2 customers will be added together as a couple."
        : `${ids.length} customers will be added together as a family.`,
      preset: isCouple ? "Couple assigned" : "Family assigned",
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
    setProfileCustomer(customerObj);
    setProfileOpen(true);
  }

  // ✅ Print ALL templates of current container (sequence #1..N)
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

              <div class="field full">
                <div class="k">Description / Notes</div>
                <div class="descBox"></div>
              </div>
            </div>

            <div class="sig">
              <div class="line">Customer Signature</div>
              <div class="line">Admin Signature</div>
            </div>
          </section>
        `;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Print • ${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f7f7f7; color: #111; }
    .topbar {
      position: sticky; top: 0; z-index: 9999;
      background: #111; color: #fff;
      padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;
    }
    .btn { border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 800; }
    .btnClose { background: rgba(255,255,255,0.18); color: #fff; }
    .btnPrint { background: #fff; color: #111; }

    .wrap { padding: 14px; }
    .sheet {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
      break-after: page;
      page-break-after: always;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }

    .sheetHead { display:flex; justify-content: space-between; gap:10px; }
    .muted { font-size: 12px; color: #666; }
    .name { margin: 10px 0 6px 0; font-size: 18px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .field { border:1px solid #eee; border-radius: 10px; padding: 10px; }
    .full { grid-column: 1 / -1; }
    .k { font-size: 11px; color: #666; margin-bottom: 4px; }
    .v { font-size: 14px; font-weight: 700; }
    .descBox { border: 1px dashed #999; border-radius: 10px; height: 90px; margin-top: 8px; }
    .sig { margin-top: 22px; display:flex; gap:16px; }
    .line { flex:1; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }

    @media print {
      body { background: #fff; }
      .topbar { display:none; }
      .wrap { padding: 0; }
      .sheet { border: none; border-radius: 0; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div style="font-weight:900;">Print All • ${escapeHtml(title)} (${total})</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btnClose" id="btnClose" type="button">Close</button>
      <button class="btn btnPrint" id="btnPrint" type="button">Print</button>
    </div>
  </div>

  <div class="wrap">
    ${pagesHtml}
  </div>

  <script>
    document.getElementById('btnPrint').addEventListener('click', function() {
      window.focus();
      window.print();
    });
    document.getElementById('btnClose').addEventListener('click', function() {
      window.close();
    });
  </script>
</body>
</html>`;

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

  const counts = genderCountFromAssignments();

  const selectedCustomers = useMemo(() => {
    const map = new Map(sittingActive.map((c) => [safeId(c._id), c]));
    return selectedIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [selectedIds, sittingActive]);

  const targetSingle = useMemo(() => {
    return singleTargetId ? sittingActive.find((c) => safeId(c._id) === singleTargetId) : null;
  }, [singleTargetId, sittingActive]);

  const familySelectStyle = useMemo(() => {
    if (pickMode !== "FAMILY") return { border: "border-white/10", bg: "bg-black/30" };
    if (selectedIds.length === 2) {
      return { border: "border-fuchsia-400/30", bg: "bg-fuchsia-500/10" };
    }
    if (selectedIds.length > 2) {
      return { border: "border-blue-400/30", bg: "bg-blue-500/10" };
    }
    return { border: "border-white/10", bg: "bg-black/30" };
  }, [pickMode, selectedIds.length]);

  return (
    <div>
      <button
        onClick={() => {
          setAnchor(new Date());
          setCalOpen(true);
        }}
        className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition"
      >
        Open Calander
      </button>

      {/* Layer 1 */}
      <LayerModal
        open={calOpen}
        zIndex={60}
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
          <div className="text-lg font-bold">
            {anchor.toLocaleString("default", { month: "long" })} {year}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setAnchor(new Date(year, month - 1, 1))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">◀</button>

            <div className="rounded-2xl bg-black/30 border border-white/10 p-1 flex">
              <button
                onClick={() => setMode("DIKSHA")}
                className={`px-4 py-2 rounded-xl text-sm ${mode==="DIKSHA" ? "bg-white text-black font-semibold" : "text-white/70 hover:bg-white/10"}`}
              >
                Diksha
              </button>
              <button
                onClick={() => setMode("MEETING")}
                className={`px-4 py-2 rounded-xl text-sm ${mode==="MEETING" ? "bg-white text-black font-semibold" : "text-white/70 hover:bg-white/10"}`}
              >
                Meeting
              </button>
            </div>

            <button onClick={() => setAnchor(new Date(year, month + 1, 1))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15">▶</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-xs mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>(
            <div key={d} className={`${i===0 ? "text-red-300" : "text-white/70"} text-center`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
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
                  "min-h-[84px] rounded-2xl border p-2 text-left transition",
                  "bg-black/30 border-white/10 hover:bg-black/40",
                  isSelected ? "ring-2 ring-blue-500/60" : "",
                  isSun ? "ring-1 ring-red-500/20" : "",
                  isToday ? "ring-2 ring-emerald-400/60 border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.12)]" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-sm font-semibold ${isSun ? "text-red-200" : "text-white"}`}>{d.getDate()}</div>
                  {isToday ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 border border-emerald-400/20 text-emerald-200">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="text-[10px] text-white/50">{mode}</div>

                {s ? (
                  <div className="mt-2 text-[11px] text-white/80 flex gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">M {s.male}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">F {s.female}</span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/35">—</div>
                )}
              </button>
            );
          })}
        </div>
      </LayerModal>

      {/* Layer 2 */}
      <LayerModal
        open={containerOpen && !!container}
        zIndex={70}
        layerName="Container"
        title={container ? `${container.date} / ${container.mode}` : "Container"}
        sub={`Total ${counts.total} | Male ${counts.male} | Female ${counts.female}`}
        onClose={() => {
          setContainerOpen(false);
          setAddOpen(false);
          setConfirmSingleOpen(false);
          setConfirmFamilyOpen(false);
          setContainer(null);
          setAssignments([]);
        }}
        maxWidth="max-w-5xl"
      >
        {housefull ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 shadow-[0_0_35px_rgba(239,68,68,0.22)] animate-[shake_.25s_ease-in-out_0s_2]">
            <div className="text-sm font-semibold text-red-200">Housefull</div>
            <div className="text-xs text-red-200/80 mt-1">Limit reached. Admin can increase limit.</div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 mb-3">
          {role === "ADMIN" && (
            <button onClick={increaseLimit} className="w-11 h-11 shrink-0 rounded-2xl bg-white text-black font-bold" title="Increase limit">+</button>
          )}

          {/* ✅ PRINT ALL */}
          <button
            type="button"
            onClick={openPrintAllForContainer}
            className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10"
            title="Print all cards in this container"
          >
            🖨
          </button>

          <button onClick={() => setShowList((v) => !v)} className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10" title="Toggle list">☰</button>
          <button onClick={openAddCustomerLayer} className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10" title="Add customer">＋</button>
        </div>

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
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      outAssignment(a._id);
                    }}
                    className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-xs shrink-0"
                  >
                    Out
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </LayerModal>

      {/* Layer 3 */}
      <LayerModal
        open={addOpen}
        zIndex={80}
        layerName="Add Customer"
        title="Add Customer"
        sub="Sitting ACTIVE"
        onClose={() => {
          setAddOpen(false);
          setConfirmSingleOpen(false);
          setConfirmFamilyOpen(false);
        }}
        maxWidth="max-w-4xl"
      >
        <div className="flex gap-2 mb-3 items-center">
          <button
            onClick={() => { setPickMode("SINGLE"); setSelectedIds([]); }}
            className={`px-4 py-2 rounded-2xl text-sm ${pickMode==="SINGLE" ? "bg-white text-black font-semibold" : "bg-white/10 hover:bg-white/15"}`}
          >
            Single
          </button>

          <button
            onClick={() => { setPickMode("FAMILY"); setSelectedIds([]); }}
            className={`px-4 py-2 rounded-2xl text-sm ${pickMode==="FAMILY" ? "bg-white text-black font-semibold" : "bg-white/10 hover:bg-white/15"}`}
          >
            Family (2+)
          </button>

          {pickMode === "FAMILY" && (
            <button
              onClick={initiateFamilyAssign}
              disabled={selectedIds.length < 2}
              className="ml-auto px-4 py-2 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
            >
              Next
            </button>
          )}
        </div>

        {pickMode === "FAMILY" ? (
          <div className="mb-3 text-sm text-white/70">
            Selected: <span className="text-white font-semibold">{selectedIds.length}</span>{" "}
            {selectedIds.length === 2 ? "(Couple color)" : selectedIds.length > 2 ? "(Family color)" : ""}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto pr-1">
          {sittingActive.map((c) => {
            const id = safeId(c._id);
            const selected = selectedIds.includes(id);

            const familySelectedCls =
              pickMode === "FAMILY" && selected
                ? (selectedIds.length === 2
                    ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                    : "border-blue-400/40 bg-blue-500/10")
                : "";

            return (
              <div
                key={id}
                className={[
                  "rounded-2xl border p-3",
                  pickMode === "FAMILY" ? `${familySelectStyle.border} ${familySelectStyle.bg}` : "border-white/10 bg-black/30",
                  familySelectedCls,
                ].join(" ")}
              >
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-white/60 truncate">{c.address || "-"}</div>
                <div className="text-[11px] text-white/50 mt-1">Gender: {c.gender}</div>

                <div className="mt-3 flex justify-end gap-2">
                  {pickMode === "SINGLE" ? (
                    <button
                      disabled={pushing}
                      onClick={() => initiateSingleAssign(id)}
                      className="px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs disabled:opacity-60"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedIds((prev) => {
                          if (prev.includes(id)) return prev.filter((x) => x !== id);
                          return [...prev, id];
                        });
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs"
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

      {/* Layer 4: Confirm Single */}
      <LayerModal
        open={confirmSingleOpen}
        layerName="Confirm Single"
        title="Confirm Single"
        sub="Review details → Push"
        onClose={() => setConfirmSingleOpen(false)}
        maxWidth="max-w-2xl"
      >
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
            <button
              onClick={() => setConfirmSingleOpen(false)}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
            >
              Back
            </button>

            <button
              onClick={confirmSinglePush}
              disabled={pushing || !targetSingle}
              className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
            >
              {pushing ? "Pushing..." : "Push Single"}
            </button>
          </div>
        </div>
      </LayerModal>

      {/* Layer 4: Confirm Family */}
      <LayerModal
        open={confirmFamilyOpen}
        layerName="Confirm Family"
        title={selectedCustomers.length === 2 ? "Confirm Couple" : "Confirm Family"}
        sub="Review selected customers → Push"
        onClose={() => setConfirmFamilyOpen(false)}
        maxWidth="max-w-4xl"
      >
        {selectedCustomers.length < 2 ? (
          <div className="text-white/60">Select minimum 2 customers first.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedCustomers.map((c, idx) => (
              <div
                key={safeId(c._id)}
                className={`rounded-2xl border p-3 ${
                  selectedCustomers.length === 2
                    ? "border-fuchsia-400/20 bg-fuchsia-500/10"
                    : "border-blue-400/20 bg-blue-500/10"
                }`}
              >
                <div className="text-xs text-white/70">#{idx + 1}</div>
                <div className="font-semibold mt-1">{c.name}</div>
                <div className="text-xs text-white/70 mt-1">{c.address || "-"}</div>
                <div className="text-[11px] text-white/60 mt-1">Gender: {c.gender}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setConfirmFamilyOpen(false)}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Back
          </button>

          <button
            onClick={confirmFamilyPush}
            disabled={pushing || selectedIds.length < 2}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
          >
            {pushing ? "Pushing..." : (selectedIds.length === 2 ? "Push Couple" : "Push Family")}
          </button>
        </div>
      </LayerModal>

      {/* Profile modal */}
      <CustomerProfileModal
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setProfileCustomer(null);
        }}
        customer={profileCustomer}
        source="SITTING"
        onChanged={async () => {
          await refreshContainer();
          await loadSummary();
        }}
      />

      {CommitModal}
    </div>
  );
}
