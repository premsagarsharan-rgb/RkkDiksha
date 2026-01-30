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

export default function CustomerProfileModal({
  open,
  onClose,
  customer,
  source, // "TODAY" | "PENDING" | "SITTING"
  onChanged,
  initialApproveStep, // optional
  initialEditMode, // optional
}) {
  const [hmmOpen, setHmmOpen] = useState(false);

  // ✅ Print
  const [printOpen, setPrintOpen] = useState(false);
  const [printDesc, setPrintDesc] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(null);

  // SaveEdit -> Confirm layer
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [err, setErr] = useState("");

  // Approve flow UI
  const [approveStep, setApproveStep] = useState(null); // null | "choose" | "pickDate" | "note"
  const [mode, setMode] = useState("DIKSHA");
  const [pickedDate, setPickedDate] = useState(null);
  const [note, setNote] = useState("");

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Created profile",
      "Corrected customer data",
      "Approved for calander container",
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

    // print reset
    setPrintOpen(false);
    setPrintDesc("");
    setPdfBusy(false);

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
      name: form?.name ?? "",
      age: form?.age ?? "",
      gender: form?.gender ?? "",
      address: form?.address ?? "",
      pincode: form?.pincode ?? "",
      followYears: form?.followYears ?? "",
      clubVisitsBefore: form?.clubVisitsBefore ?? "",
      monthYear: form?.monthYear ?? "",
      country: form?.country ?? "",
      state: form?.state ?? "",
      city: form?.city ?? "",
      onionGarlic: !!form?.onionGarlic,
      hasPet: !!form?.hasPet,
      hadTeacherBefore: !!form?.hadTeacherBefore,
      familyPermission: !!form?.familyPermission,
      desc: printDesc || "",
    };

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sysbyte Customer PDF</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
    .box { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
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
  </style>
</head>
<body>
  <div class="box">
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
  </div>
</body>
</html>`;
  }

  async function generatePdfAndOpen() {
    setPdfBusy(true);
    try {
      const html = buildPrintHtml();
      const filename = `sysbyte_${customer?.rollNo || "customer"}`;

      const res = await fetch("/api/print/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, filename }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "PDF failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");

      // cleanup later
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPdfBusy(false);
    }
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
      title: "Push to Container",
      subtitle: "Customer will be assigned to selected container.",
      preset: "Approved for calander container",
    }).catch(() => null);

    if (!commitMessage) return;

    setBusy(true);
    try {
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

  return (
    <>
      <LayerModal
        open={open}
        layerName="Customer Profile"
        title={customer.name}
        sub={`Source: ${source}`}
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
              {/* ✅ Print always visible */}
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

            {/* Actions (same as your file) */}
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
                      Assign to container
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
                        <button onClick={() => setMode("DIKSHA")} className={`flex-1 px-3 py-2 rounded-xl text-sm ${mode === "DIKSHA" ? btnPrimary + " font-semibold" : btnGhost}`}>
                          Diksha
                        </button>
                        <button onClick={() => setMode("MEETING")} className={`flex-1 px-3 py-2 rounded-xl text-sm ${mode === "MEETING" ? btnPrimary + " font-semibold" : btnGhost}`}>
                          Meeting
                        </button>
                      </div>

                      <input
                        type="date"
                        className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                          isDarkText ? "bg-white border-black/10 text-black" : "bg-white/5 border-white/10 text-white"
                        }`}
                        value={pickedDate || ""}
                        onChange={(e) => setPickedDate(e.target.value)}
                      />

                      <button onClick={() => setApproveStep("note")} disabled={!pickedDate} className={`mt-3 w-full px-4 py-2 rounded-xl font-semibold ${btnPrimary}`}>
                        Confirm Date
                      </button>
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

                      <button disabled={busy} onClick={approveToContainer} className={`mt-3 w-full px-4 py-2 rounded-xl font-semibold ${btnPrimary} disabled:opacity-60`}>
                        Push to Container
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

      {/* ✅ Print Preview modal (Generate PDF) */}
      <LayerModal
        open={printOpen}
        layerName="Print"
        title="PDF Print"
        sub="HTML → PDF convert (server)"
        onClose={() => setPrintOpen(false)}
        maxWidth="max-w-3xl"
      >
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs text-white/60">RollNo</div>
          <div className="text-lg font-bold text-white">{customer.rollNo || "—"}</div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Description (print ke andar jayega)</div>
            <textarea
              value={printDesc}
              onChange={(e) => setPrintDesc(e.target.value)}
              placeholder="Write description..."
              className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none min-h-[90px]"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPrintOpen(false)}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
            >
              Close
            </button>

            <button
              type="button"
              disabled={pdfBusy}
              onClick={generatePdfAndOpen}
              className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
            >
              {pdfBusy ? "Generating PDF..." : "Generate PDF & Open"}
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            PDF open hote hi tum browser/phone viewer se print kar sakte ho.
          </div>
        </div>
      </LayerModal>

      {/* Confirm Edit layer */}
      <LayerModal
        open={confirmEditOpen}
        layerName="Confirm Edit"
        title="Confirm Edit → Finalize"
        sub="Review → then Commit & Move"
        onClose={() => setConfirmEditOpen(false)}
        maxWidth="max-w-3xl"
      >
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-2">
          <Line k="Name" v={form.name} />
          <Line k="Age" v={form.age} />
          <Line k="Address" v={form.address} />
          <Line k="Pincode" v={form.pincode || "-"} />
          <Line k="Gender" v={form.gender} />
          <Line k="Follow Years" v={form.followYears || "-"} />
          <Line k="Club Visits" v={form.clubVisitsBefore || "-"} />
          <Line k="Month/Year" v={form.monthYear || "-"} />
          <Line k="Country" v={form.country || "-"} />
          <Line k="State" v={form.state || "-"} />
          <Line k="City" v={form.city || "-"} />
          <Line k="Onion/Garlic" v={form.onionGarlic ? "YES" : "NO"} />
          <Line k="Has Pet" v={form.hasPet ? "YES" : "NO"} />
          <Line k="Teacher Before" v={form.hadTeacherBefore ? "YES" : "NO"} />
          <Line k="Family Permission" v={form.familyPermission ? "YES" : "NO"} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => setConfirmEditOpen(false)}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 disabled:opacity-60"
          >
            Back (Edit)
          </button>

          <button
            disabled={busy}
            onClick={confirmEditAndFinalize}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
          >
            Commit & Move to Sitting
          </button>
        </div>
      </LayerModal>

      <CustomerHistoryModal open={hmmOpen} onClose={() => setHmmOpen(false)} customerId={customer._id} />
      {CommitModal}
    </>
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
      <div className="text-white text-sm text-right break-words max-w-[60%]">
        {String(v ?? "").trim() || "-"}
      </div>
    </div>
  );
}
