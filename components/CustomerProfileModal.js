"use client";

import { useMemo, useState, useEffect } from "react";
import LayerModal from "@/components/LayerModal";
import SuggestInput from "@/components/SuggestInput";
import CustomerHistoryModal from "@/components/CustomerHistoryModal";
import { useCommitGate } from "@/components/CommitGate";

const noteSuggestions = [
  "Bring ID proof",
  "Arrive 10 minutes early",
  "First time visitor",
  "VIP",
  "Needs follow-up",
  "Confirmed by family",
];

function escapeHtml(s) {
  const str = String(s ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* -------------------------
   Custom Calendar Helpers
-------------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fromDateKey(key) {
  const [y, m, d] = String(key || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function extractContainerCards(containerObj) {
  const a =
    containerObj?.assignments ??
    containerObj?.customers ??
    containerObj?.items ??
    containerObj?.cards ??
    [];
  return safeArray(a);
}
function cardLabel(x) {
  if (!x) return "—";
  if (typeof x === "string") return x;

  if (x.name) return x.rollNo ? `${x.name} (${x.rollNo})` : x.name;
  if (x.customer?.name) return x.customer.rollNo ? `${x.customer.name} (${x.customer.rollNo})` : x.customer.name;

  if (x.customerName) return x.customerRollNo ? `${x.customerName} (${x.customerRollNo})` : x.customerName;
  if (x.fullName) return x.fullName;

  if (x.customerId) return String(x.customerId);
  if (x._id) return String(x._id);

  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export default function CustomerProfileModal({
  open,
  onClose,
  customer,
  source, // "TODAY" | "PENDING" | "SITTING"
  onChanged,
  initialApproveStep,
  initialEditMode,

  // ✅ NEW: Meeting Reject -> ApproveFor context
  contextContainerId = null,
  contextAssignmentId = null,
}) {
  const [hmmOpen, setHmmOpen] = useState(false);

  // ✅ Print states
  const [printOpen, setPrintOpen] = useState(false);
  const [printDesc, setPrintDesc] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(null);

  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [err, setErr] = useState("");

  const [approveStep, setApproveStep] = useState(null);
  const [mode, setMode] = useState("DIKSHA");
  const [pickedDate, setPickedDate] = useState(null);
  const [note, setNote] = useState("");

  // ✅ Custom Calendar Picker states
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => startOfMonth(new Date()));
  const [datePickerSelected, setDatePickerSelected] = useState(null);

  // ✅ Show Date container preview states (count + names)
  const [showDateOpen, setShowDateOpen] = useState(false);
  const [showDateBusy, setShowDateBusy] = useState(false);
  const [showDateInfo, setShowDateInfo] = useState(null);
  // { dateKey, mode, container, assignments, reserved, error }

  const isApproveForShift = Boolean(source === "SITTING" && contextContainerId && contextAssignmentId);

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Created profile",
      "Corrected customer data",
      "Approved for calander container",
      "Meeting reject → ApproveFor",
      "Moved to pending",
      "Restored from pending",
      "Updated profile details",
      "Finalized after edit (Recent → Sitting)",
      "Customer shifted",
    ],
  });

  useEffect(() => {
    if (!open || !customer) return;

    setErr("");
    setConfirmEditOpen(false);

    setPrintOpen(false);
    setPrintDesc("");

    setForm({
      name: customer?.name || "",
      age: customer?.age || "",
      address: customer?.address || "",
      followYears: customer?.followYears || "",
      clubVisitsBefore: customer?.clubVisitsBefore || "",
      monthYear: customer?.monthYear || "",
      onionGarlic: !!customer?.onionGarlic,
      hasPet: !!customer?.hasPet,
      hadTeacherBefore: !!customer?.hadTeacherBefore,
      familyPermission: !!customer?.familyPermission,
      gender: customer?.gender || "OTHER",
      country: customer?.country || "",
      state: customer?.state || "",
      city: customer?.city || "",
      pincode: customer?.pincode || "",
    });

    const shouldAutoEdit = source === "TODAY" && Boolean(initialEditMode);
    setEditMode(shouldAutoEdit);

    setPickedDate(null);
    setNote("");

    // reset picker/preview
    setDatePickerOpen(false);
    setDatePickerSelected(null);
    setDatePickerMonth(startOfMonth(new Date()));
    setShowDateOpen(false);
    setShowDateInfo(null);

    if ((source === "TODAY" || source === "PENDING" || source === "SITTING") && initialApproveStep) {
      setApproveStep(initialApproveStep);
    } else {
      setApproveStep(null);
    }
  }, [open, customer, source, initialApproveStep, initialEditMode]);

  const genderTheme = useMemo(() => {
    if (customer?.gender === "MALE") return "from-zinc-950 via-black to-zinc-900 text-white";
    if (customer?.gender === "FEMALE") return "from-pink-700 via-fuchsia-700 to-pink-600 text-white";
    return "from-emerald-200 via-green-200 to-lime-200 text-black";
  }, [customer?.gender]);

  const canFinalizeEdit = useMemo(() => {
    if (!form) return false;
    return Boolean(String(form.name || "").trim() && String(form.age || "").trim() && String(form.address || "").trim());
  }, [form]);

  if (!open || !customer || !form) return null;

  const isDarkText = customer.gender === "OTHER";
  const panelBg = isDarkText ? "border-black/10 bg-white/65" : "border-white/10 bg-black/30";
  const btnPrimary = isDarkText ? "bg-black text-white" : "bg-white text-black";
  const btnGhost = isDarkText ? "bg-black/10 hover:bg-black/20" : "bg-white/10 hover:bg-white/20";
  const hint = isDarkText ? "text-black/60" : "text-white/60";

  function buildPrintHtml() {
    const data = {
      rollNo: customer?.rollNo || "",
      name: form?.name ?? customer?.name ?? "",
      age: form?.age ?? customer?.age ?? "",
      gender: form?.gender ?? customer?.gender ?? "",
      address: form?.address ?? customer?.address ?? "",
      pincode: form?.pincode ?? customer?.pincode ?? "",
      followYears: form?.followYears ?? customer?.followYears ?? "",
      clubVisitsBefore: form?.clubVisitsBefore ?? customer?.clubVisitsBefore ?? "",
      monthYear: form?.monthYear ?? customer?.monthYear ?? "",
      country: form?.country ?? customer?.country ?? "",
      state: form?.state ?? customer?.state ?? "",
      city: form?.city ?? customer?.city ?? "",
      onionGarlic: !!(form?.onionGarlic ?? customer?.onionGarlic),
      hasPet: !!(form?.hasPet ?? customer?.hasPet),
      hadTeacherBefore: !!(form?.hadTeacherBefore ?? customer?.hadTeacherBefore),
      familyPermission: !!(form?.familyPermission ?? customer?.familyPermission),
      desc: printDesc || "",
    };

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sysbyte Print</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; color: #111; background: #f7f7f7; }
    .topbar {
      position: sticky; top: 0; background: #111; color: #fff;
      padding: 10px 12px; display: flex; gap: 8px; align-items: center; justify-content: space-between;
      z-index: 9999;
    }
    .btn { border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 800; }
    .btnPrint { background: #fff; color: #111; }
    .btnDownload { background: rgba(255,255,255,0.18); color: #fff; }
    .btnClose { background: rgba(255,255,255,0.18); color: #fff; }
    .wrap { padding: 16px; }
    .box { background: #fff; border: 1px solid #ddd; border-radius: 14px; padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .muted { color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .field { border: 1px solid #eee; border-radius: 10px; padding: 10px; }
    .k { font-size: 11px; color: #666; margin-bottom: 4px; }
    .v { font-size: 14px; font-weight: 700; }
    .full { grid-column: 1 / -1; }
    .textarea { min-height: 80px; white-space: pre-wrap; font-weight: 600; }
    .sig { margin-top: 22px; display: flex; justify-content: space-between; gap: 16px; }
    .line { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; color: #333; }

    @media print {
      .topbar { display:none; }
      body { background: #fff; }
      .wrap { padding: 0; }
      .box { border: none; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div style="font-weight:900;">Sysbyte Print Preview</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btnDownload" id="btnDownload" type="button">Download HTML</button>
      <button class="btn btnClose" id="btnClose" type="button">Close</button>
      <button class="btn btnPrint btnPrint" id="btnPrint" type="button">Print</button>
    </div>
  </div>

  <div class="wrap">
    <div class="box" id="printRoot">
      <h1>Sysbyte Customer Form</h1>
      <div class="muted">RollNo: ${escapeHtml(data.rollNo)} | Source: ${escapeHtml(source)}</div>

      <div class="grid">
        <div class="field"><div class="k">Name</div><div class="v">${escapeHtml(data.name)}</div></div>
        <div class="field"><div class="k">Age</div><div class="v">${escapeHtml(data.age)}</div></div>

        <div class="field"><div class="k">Gender</div><div class="v">${escapeHtml(data.gender)}</div></div>
        <div class="field"><div class="k">Pincode</div><div class="v">${escapeHtml(data.pincode)}</div></div>

        <div class="field full"><div class="k">Address</div><div class="v">${escapeHtml(data.address)}</div></div>

        <div class="field"><div class="k">Follow Years</div><div class="v">${escapeHtml(data.followYears)}</div></div>
        <div class="field"><div class="k">Club Visits Before</div><div class="v">${escapeHtml(data.clubVisitsBefore)}</div></div>

        <div class="field"><div class="k">Month/Year</div><div class="v">${escapeHtml(data.monthYear)}</div></div>
        <div class="field"><div class="k">City/State</div><div class="v">${escapeHtml(data.city)} / ${escapeHtml(data.state)}</div></div>

        <div class="field"><div class="k">Onion/Garlic</div><div class="v">${data.onionGarlic ? "YES" : "NO"}</div></div>
        <div class="field"><div class="k">Has Pet</div><div class="v">${data.hasPet ? "YES" : "NO"}</div></div>

        <div class="field"><div class="k">Teacher Before</div><div class="v">${data.hadTeacherBefore ? "YES" : "NO"}</div></div>
        <div class="field"><div class="k">Family Permission</div><div class="v">${data.familyPermission ? "YES" : "NO"}</div></div>

        <div class="field full">
          <div class="k">Description / Notes</div>
          <div class="v textarea">${escapeHtml(data.desc)}</div>
        </div>
      </div>

      <div class="sig">
        <div class="line">Customer Signature</div>
        <div class="line">Admin Signature</div>
      </div>

      <div class="muted" style="margin-top:10px;">
        If printer not available: choose “Save as PDF” OR enable Android “Default Print Service”.
      </div>
    </div>
  </div>

  <script>
    document.getElementById('btnPrint').addEventListener('click', function() {
      window.focus();
      window.print();
    });

    document.getElementById('btnClose').addEventListener('click', function() {
      window.close();
    });

    document.getElementById('btnDownload').addEventListener('click', function() {
      try {
        const html = document.documentElement.outerHTML;
        const blob = new Blob([html], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sysbyte_print_${escapeHtml(data.rollNo || "customer")}.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch(e) {
        alert('Download failed');
      }
    });
  </script>
</body>
</html>`;
  }

  function openPrintPage() {
    const html = buildPrintHtml();
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

  async function pauseToPending() {
    const commitMessage = await requestCommit({
      title: "Pause → Pending",
      subtitle: "Customer will move to Pending database.",
      preset: "Moved to pending",
    }).catch(() => null);

    if (!commitMessage) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/customers/today/${customer._id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Pause failed");
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function restoreToRecent() {
    const commitMessage = await requestCommit({
      title: "Restore → Recent",
      subtitle: "Customer will move back to Recent (Today DB).",
      preset: "Restored from pending",
    }).catch(() => null);

    if (!commitMessage) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/customers/pending/${customer._id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Restore failed");
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function saveEdit() {
    if (source !== "TODAY") return alert("Edit currently enabled for Recent only");
    setErr("");
    if (!canFinalizeEdit) {
      setErr("Name, Age, Address required");
      return;
    }
    setConfirmEditOpen(true);
  }

  async function confirmEditAndFinalize() {
    if (source !== "TODAY") return;

    setErr("");
    if (!canFinalizeEdit) {
      setErr("Name, Age, Address required");
      return;
    }

    const commitMessage = await requestCommit({
      title: "Finalize to Sitting",
      subtitle: "This will move customer from Recent (Today DB) → Sitting (ACTIVE).",
      preset: "Finalized after edit (Recent → Sitting)",
    }).catch(() => null);

    if (!commitMessage) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/customers/today/${customer._id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: { ...form },
          commitMessage,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Finalize failed");
        return;
      }

      setConfirmEditOpen(false);
      setEditMode(false);
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function approveToContainer() {
    if (!pickedDate) return alert("Select date");

    const commitMessage = await requestCommit({
      title: isApproveForShift ? "Approve For (Shift)" : "Push to Container",
      subtitle: isApproveForShift
        ? "Meeting card will be shifted to selected container."
        : "Customer will be assigned to selected container.",
      preset: isApproveForShift ? "Meeting reject → ApproveFor" : "Approved for calander container",
    }).catch(() => null);

    if (!commitMessage) return;

    setBusy(true);
    try {
      // ✅ Meeting Reject -> ApproveFor (SHIFT assignment)
      if (isApproveForShift) {
        const res = await fetch(
          `/api/calander/container/${contextContainerId}/assignments/${contextAssignmentId}/approve-for`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toDate: pickedDate,
              toMode: mode,
              note,
              commitMessage,
            }),
          }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.error === "HOUSEFULL") return alert("Housefull: limit reached");
          return alert(data.error || "ApproveFor shift failed");
        }

        onChanged?.();
        onClose();
        return;
      }

      // ✅ Normal existing flow (assign)
      const cRes = await fetch("/api/calander/container/by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: pickedDate, mode }),
      });
      const cData = await cRes.json().catch(() => ({}));
      if (!cRes.ok) return alert(cData.error || "Container failed");

      const containerObj = cData?.container?.value ?? cData?.container;
      if (!containerObj?._id) return alert("Invalid container response");

      const aRes = await fetch(`/api/calander/container/${containerObj._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer._id,
          source,
          note,
          commitMessage,
        }),
      });

      const aData = await aRes.json().catch(() => ({}));
      if (!aRes.ok) {
        if (aData.error === "HOUSEFULL") return alert("Housefull: limit reached");
        return alert(aData.error || "Assign failed");
      }

      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function openCustomDatePicker() {
    const now = new Date();
    const base = pickedDate ? fromDateKey(pickedDate) : now;
    setDatePickerMonth(startOfMonth(base || now));
    setDatePickerSelected(pickedDate || null);
    setDatePickerOpen(true);
  }

  // ✅ improved: loads container detail + reserved
  async function showDateContainerPreview(dateKey) {
    if (!dateKey) return;

    setShowDateBusy(true);
    setShowDateInfo({ dateKey, mode, container: null, assignments: [], reserved: [], error: null });
    setShowDateOpen(true);

    try {
      // ensure container exists by date
      const cRes = await fetch("/api/calander/container/by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, mode }),
      });
      const cData = await cRes.json().catch(() => ({}));
      if (!cRes.ok) {
        setShowDateInfo({ dateKey, mode, container: null, assignments: [], reserved: [], error: cData.error || "Failed to load container" });
        return;
      }

      const containerObj = cData?.container?.value ?? cData?.container ?? null;
      if (!containerObj?._id) {
        setShowDateInfo({ dateKey, mode, container: null, assignments: [], reserved: [], error: "Invalid container response" });
        return;
      }

      const dRes = await fetch(`/api/calander/container/${containerObj._id}?includeReserved=1`);
      const dData = await dRes.json().catch(() => ({}));
      if (!dRes.ok) {
        setShowDateInfo({ dateKey, mode, container: null, assignments: [], reserved: [], error: dData.error || "Details load failed" });
        return;
      }

      setShowDateInfo({
        dateKey,
        mode,
        container: dData.container || containerObj,
        assignments: dData.assignments || [],
        reserved: dData.reserved || [],
        error: null,
      });
    } catch (e) {
      setShowDateInfo({ dateKey, mode, container: null, assignments: [], reserved: [], error: "Network error" });
    } finally {
      setShowDateBusy(false);
    }
  }

  function confirmPickedDate(dateKey) {
    if (!dateKey) return;
    setPickedDate(dateKey);
    setDatePickerOpen(false);
    setApproveStep("note");
  }

  return (
    <>
      <LayerModal
        open={open}
        layerName="Customer Profile"
        title={customer.name}
        sub={`Source: ${source}${isApproveForShift ? " • ApproveFor Shift" : ""}`}
        onClose={onClose}
        maxWidth="max-w-4xl"
      >
        <div className={`w-full rounded-2xl border border-white/10 bg-gradient-to-br ${genderTheme} shadow-[0_0_60px_rgba(59,130,246,0.16)] overflow-hidden`}>
          <div className="p-4 flex items-start justify-between">
            <div>
              <div className={`text-xs ${hint}`}>Customer Profile</div>
              <div className="text-xl font-bold">{customer.name}</div>
              <div className={`text-xs ${hint}`}>Source: {source}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className={`px-3 py-1 rounded-full text-xs ${btnGhost}`}
                title="Print"
              >
                Print
              </button>

              <button
                type="button"
                onClick={() => setHmmOpen(true)}
                className={`px-3 py-1 rounded-full text-xs ${btnGhost}`}
                title="HMM"
              >
                HMM
              </button>
            </div>
          </div>

          <div className="p-4 pt-0 grid lg:grid-cols-2 gap-4">
            {/* Info */}
            <div className={`rounded-2xl border p-4 ${panelBg}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Info</div>
                <button
                  type="button"
                  onClick={() => {
                    setErr("");
                    setConfirmEditOpen(false);
                    setEditMode((v) => !v);
                  }}
                  className={`px-3 py-1 rounded-full text-xs ${btnGhost}`}
                >
                  {editMode ? "Close Edit" : "Edit"}
                </button>
              </div>

              {err ? (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}

              {!editMode ? (
                <div className="mt-3 space-y-2 text-sm">
                  <Row k="RollNo" v={customer.rollNo} isDark={isDarkText} />
                  <Row k="Age" v={customer.age} isDark={isDarkText} />
                  <Row k="Address" v={customer.address} isDark={isDarkText} />
                  <Row k="Follow Years" v={customer.followYears} isDark={isDarkText} />
                  <Row k="Club Visits" v={customer.clubVisitsBefore} isDark={isDarkText} />
                  <Row k="Month/Year" v={customer.monthYear} isDark={isDarkText} />
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Step 1 (Basic)</div>
                    <div className={`text-xs ${hint}`}>AddCustomer wala part</div>

                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                      <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} isDark={isDarkText} />
                      <Input label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} isDark={isDarkText} />
                      <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} isDark={isDarkText} />
                      <Input label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} isDark={isDarkText} />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveEdit}
                    className={`w-full px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}
                  >
                    Save Edit
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={`rounded-2xl border p-4 ${panelBg}`}>
              <div className="text-sm font-semibold">Actions</div>

              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {source === "TODAY" && (
                  <>
                    <button disabled={busy} onClick={() => setApproveStep("choose")} className={`px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}>
                      Approve‑For
                    </button>
                    <button disabled={busy} onClick={pauseToPending} className={`px-4 py-2 rounded-xl ${btnGhost} disabled:opacity-60`}>
                      ⏸️ Pause → Pending
                    </button>
                  </>
                )}

                {source === "PENDING" && (
                  <>
                    <button disabled={busy} onClick={() => setApproveStep("pickDate")} className={`px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}>
                      Approve‑For
                    </button>
                    <button disabled={busy} onClick={restoreToRecent} className={`px-4 py-2 rounded-xl ${btnGhost} disabled:opacity-60`}>
                      Restore → Recent
                    </button>
                  </>
                )}

                {source === "SITTING" && (
                  <>
                    <button disabled={busy} onClick={() => setApproveStep("pickDate")} className={`px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}>
                      Approve‑For
                    </button>
                    <div className={`px-4 py-2 rounded-xl text-sm ${btnGhost} ${hint}`}>
                      {isApproveForShift ? "Shift meeting card to container" : "Assign to container"}
                    </div>
                  </>
                )}
              </div>

              {(source === "TODAY" || source === "PENDING" || source === "SITTING") && approveStep && (
                <div className={`mt-4 rounded-2xl border p-3 ${panelBg}`}>
                  {approveStep === "pickDate" && (
                    <div>
                      <div className="text-sm font-semibold">Pick Calander Date</div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMode("DIKSHA");
                            setPickedDate(null);
                            setNote("");
                          }}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm ${mode === "DIKSHA" ? btnPrimary + " font-semibold" : btnGhost}`}
                        >
                          Diksha
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMode("MEETING");
                            setPickedDate(null);
                            setNote("");
                          }}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm ${mode === "MEETING" ? btnPrimary + " font-semibold" : btnGhost}`}
                        >
                          Meeting
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={openCustomDatePicker}
                        className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm text-left ${
                          isDarkText ? "bg-white border-black/10 text-black" : "bg-white/5 border-white/10 text-white"
                        }`}
                      >
                        <div className="text-xs opacity-70">Selected Date</div>
                        <div className="font-semibold">{pickedDate || "Tap to select date"}</div>
                      </button>

                      <div className={`mt-2 text-xs ${hint}`}>
                        Date pe click karo → <b>Confirm</b> / <b>Show Date</b>
                      </div>
                    </div>
                  )}

                  {approveStep === "note" && (
                    <div>
                      <div className="text-sm font-semibold">Note (optional)</div>

                      <div className="mt-3">
                        <SuggestInput
                          dark={!isDarkText}
                          allowScroll
                          value={note}
                          onChange={setNote}
                          suggestions={noteSuggestions}
                          placeholder="Note (optional)..."
                        />
                      </div>

                      <button
                        disabled={busy}
                        onClick={approveToContainer}
                        className={`mt-3 w-full px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}
                      >
                        {isApproveForShift ? "Approve For (Shift Now)" : "Push to Container"}
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setApproveStep("pickDate")}
                        className={`mt-2 w-full px-4 py-2 rounded-xl ${btnGhost} disabled:opacity-60`}
                      >
                        Change Date
                      </button>
                    </div>
                  )}

                  {approveStep === "choose" && source === "TODAY" && (
                    <div>
                      <div className="text-sm font-semibold">Approve‑For</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={pauseToPending} disabled={busy} className={`px-3 py-2 rounded-xl text-sm ${btnGhost}`}>
                          Pending...
                        </button>
                        <button onClick={() => setApproveStep("pickDate")} disabled={busy} className={`px-3 py-2 rounded-xl text-sm font-semibold ${btnPrimary}`}>
                          APPROVE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </LayerModal>

      {/* ✅ Custom Date Picker Modal */}
      <LayerModal
        open={datePickerOpen}
        layerName="Calendar Picker"
        title={`Select Date (${mode})`}
        sub="Tap a date → Confirm / Show Date"
        onClose={() => setDatePickerOpen(false)}
        maxWidth="max-w-3xl"
      >
        <CalendarGrid
          month={datePickerMonth}
          onPrev={() => setDatePickerMonth((m) => addMonths(m, -1))}
          onNext={() => setDatePickerMonth((m) => addMonths(m, 1))}
          selectedKey={datePickerSelected}
          onSelect={(k) => setDatePickerSelected(k)}
          isDarkText={isDarkText}
        />

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!datePickerSelected}
            onClick={() => confirmPickedDate(datePickerSelected)}
            className={`flex-1 px-4 py-3 rounded-2xl font-semibold ${btnPrimary} disabled:opacity-60`}
          >
            Confirm
          </button>

          <button
            type="button"
            disabled={!datePickerSelected}
            onClick={async () => {
              await showDateContainerPreview(datePickerSelected);
            }}
            className={`flex-1 px-4 py-3 rounded-2xl ${btnGhost} disabled:opacity-60`}
          >
            Show Date
          </button>
        </div>

        <div className={`mt-3 text-xs ${hint}`}>
          Selected: <b>{datePickerSelected || "—"}</b>
        </div>
      </LayerModal>

      {/* ✅ Show Date Preview Modal (count + names + reserved) */}
      <LayerModal
        open={showDateOpen}
        layerName="Date Container"
        title="Container Preview"
        sub={showDateInfo?.dateKey ? `${showDateInfo.dateKey} • ${showDateInfo.mode}` : "Loading..."}
        onClose={() => setShowDateOpen(false)}
        maxWidth="max-w-4xl"
      >
        <div className={`rounded-3xl border p-5 ${panelBg}`}>
          {showDateBusy ? (
            <div className={hint}>Loading...</div>
          ) : showDateInfo?.error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
              {showDateInfo.error}
            </div>
          ) : !showDateInfo?.container?._id ? (
            <div className={hint}>No container found for this date.</div>
          ) : (
            <>
              <div className="text-sm font-semibold">Container</div>
              <div className={`mt-1 text-xs ${hint}`}>ID: {showDateInfo.container._id}</div>

              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs opacity-70">IN CONTAINER</div>
                  <div className="text-xl font-bold">{(showDateInfo.assignments || []).length}</div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <div className="text-xs opacity-70">RESERVED (Meeting holds)</div>
                  <div className="text-xl font-bold">{(showDateInfo.reserved || []).length}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs opacity-70">LIMIT</div>
                  <div className="text-xl font-bold">
                    {(showDateInfo.container?.limit ?? 20)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-semibold">Names (IN CONTAINER)</div>
                  <div className="mt-2 max-h-[300px] overflow-auto space-y-2 pr-1">
                    {(showDateInfo.assignments || []).length === 0 ? (
                      <div className={hint}>No cards.</div>
                    ) : (
                      (showDateInfo.assignments || []).map((x, idx) => (
                        <div key={x?._id || x?.customerId || idx} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                          <div className="font-semibold">#{idx + 1} — {cardLabel(x)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                  <div className="text-sm font-semibold">Names (RESERVED)</div>
                  <div className="mt-2 max-h-[300px] overflow-auto space-y-2 pr-1">
                    {(showDateInfo.reserved || []).length === 0 ? (
                      <div className={hint}>No reservations.</div>
                    ) : (
                      (showDateInfo.reserved || []).map((x, idx) => (
                        <div key={x?._id || x?.customerId || idx} className="rounded-2xl border border-emerald-400/20 bg-white/5 p-3 text-sm">
                          <div className="font-semibold">#{idx + 1} — {cardLabel(x)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Backward compatibility if needed */}
              <div className="mt-4 hidden">
                {extractContainerCards(showDateInfo.container).length}
              </div>
            </>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setShowDateOpen(false)} className={`flex-1 px-4 py-3 rounded-2xl ${btnGhost}`}>
              Close
            </button>
          </div>
        </div>
      </LayerModal>

      <CustomerHistoryModal open={hmmOpen} onClose={() => setHmmOpen(false)} customerId={customer._id} />
      {CommitModal}
    </>
  );
}

/* -------------------------
   Calendar Grid Component
-------------------------- */
function CalendarGrid({ month, onPrev, onNext, selectedKey, onSelect, isDarkText }) {
  const hint = isDarkText ? "text-black/60" : "text-white/60";

  const monthLabel = useMemo(() => {
    try {
      return month?.toLocaleString?.(undefined, { month: "long", year: "numeric" }) || "";
    } catch {
      return "";
    }
  }, [month]);

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const firstDow = first.getDay();
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - firstDow);

    const out = [];
    for (let i = 0; i < 42; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return out;
  }, [month]);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={onPrev} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">
          Prev
        </button>

        <div className="font-semibold">{monthLabel}</div>

        <button type="button" onClick={onNext} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">
          Next
        </button>
      </div>

      <div className={`grid grid-cols-7 gap-2 text-xs ${hint} mb-2`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isSelected = selectedKey === key;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(key)}
              className={[
                "h-10 rounded-xl border text-sm",
                inMonth ? "" : "opacity-40",
                isPast ? "opacity-35 cursor-not-allowed" : "hover:bg-white/10",
                isSelected ? "bg-white text-black font-semibold" : "bg-transparent text-white",
                isToday ? "border-blue-400/80" : "border-white/10",
              ].join(" ")}
              title={key}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className={`mt-3 text-xs ${hint}`}>Past dates disabled. Today highlight blue border.</div>
    </div>
  );
}

function Row({ k, v, isDark }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className={isDark ? "text-black/70" : "text-white/70"}>{k}</div>
      <div className={`text-right break-words max-w-[60%] ${isDark ? "text-black" : "text-white"}`}>{v || "-"}</div>
    </div>
  );
}

function Input({ label, value, onChange, isDark }) {
  return (
    <div>
      <div className={`text-xs mb-1 ${isDark ? "text-black/70" : "text-white/70"}`}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
          isDark ? "bg-white border-black/10 text-black focus:ring-black/20" : "bg-white/5 border-white/10 text-white focus:ring-blue-500/40"
        }`}
      />
    </div>
  );
}

function Line({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-white/60 text-sm">{k}</div>
      <div className="text-white text-sm text-right break-words max-w-[60%]">{String(v ?? "").trim() || "-"}</div>
    </div>
  );
}
