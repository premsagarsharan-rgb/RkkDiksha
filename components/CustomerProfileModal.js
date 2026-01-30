"use client";

import { useMemo, useState, useEffect } from "react";
import { jsPDF } from "jspdf";
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

  function buildPdfBlobUrl() {
    const data = {
      rollNo: String(customer?.rollNo || "—"),
      src: String(source || "—"),
      name: String(form?.name || "—"),
      age: String(form?.age || "—"),
      gender: String(form?.gender || "—"),
      address: String(form?.address || "—"),
      pincode: String(form?.pincode || "—"),
      followYears: String(form?.followYears || "—"),
      clubVisitsBefore: String(form?.clubVisitsBefore || "—"),
      monthYear: String(form?.monthYear || "—"),
      country: String(form?.country || "—"),
      state: String(form?.state || "—"),
      city: String(form?.city || "—"),
      onionGarlic: form?.onionGarlic ? "YES" : "NO",
      hasPet: form?.hasPet ? "YES" : "NO",
      hadTeacherBefore: form?.hadTeacherBefore ? "YES" : "NO",
      familyPermission: form?.familyPermission ? "YES" : "NO",
      desc: String(printDesc || "—"),
    };

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const gap = 6;

    let y = margin;

    const ensure = (h) => {
      if (y + h > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    const box = (x, yy, w, h) => {
      pdf.setDrawColor(180);
      pdf.roundedRect(x, yy, w, h, 2, 2);
    };

    const labelValue = (x, yy, w, label, value) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(label, x + 3, yy + 5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(10);
      const lines = pdf.splitTextToSize(String(value || "—"), w - 6);
      pdf.text(lines, x + 3, yy + 11);
    };

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(10);
    pdf.text("Sysbyte Customer Form", margin, y);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(80);
    pdf.text(`RollNo: ${data.rollNo}   |   Source: ${data.src}`, margin, y);
    y += 8;

    // 2 columns
    const colW = (pageW - margin * 2 - gap) / 2;

    ensure(22);
    box(margin, y, colW, 18);
    box(margin + colW + gap, y, colW, 18);
    labelValue(margin, y, colW, "Name", data.name);
    labelValue(margin + colW + gap, y, colW, "Age", data.age);
    y += 22;

    ensure(22);
    box(margin, y, colW, 18);
    box(margin + colW + gap, y, colW, 18);
    labelValue(margin, y, colW, "Gender", data.gender);
    labelValue(margin + colW + gap, y, colW, "Pincode", data.pincode);
    y += 22;

    // Address full
    ensure(30);
    box(margin, y, pageW - margin * 2, 24);
    labelValue(margin, y, pageW - margin * 2, "Address", data.address);
    y += 30;

    const fullW = pageW - margin * 2;

    const fullField = (label, value) => {
      ensure(20);
      box(margin, y, fullW, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(label, margin + 3, y + 5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(10);
      const lines = pdf.splitTextToSize(String(value || "—"), fullW - 6);
      pdf.text(lines, margin + 3, y + 11);
      y += 20;
    };

    fullField("Follow Years", data.followYears);
    fullField("Club Visits Before", data.clubVisitsBefore);
    fullField("Month/Year", data.monthYear);
    fullField("City / State / Country", `${data.city} / ${data.state} / ${data.country}`);

    // 4 small boxes
    ensure(26);
    const w4 = (fullW - gap * 3) / 4;
    const items = [
      ["Onion/Garlic", data.onionGarlic],
      ["Has Pet", data.hasPet],
      ["Teacher Before", data.hadTeacherBefore],
      ["Family Permission", data.familyPermission],
    ];

    for (let i = 0; i < 4; i++) {
      const x = margin + i * (w4 + gap);
      box(x, y, w4, 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text(items[i][0], x + 2, y + 5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(10);
      pdf.text(String(items[i][1]), x + 2, y + 12);
    }
    y += 24;

    // Description
    ensure(65);
    box(margin, y, fullW, 55);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text("Description / Notes", margin + 3, y + 5);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(10);
    pdf.text(pdf.splitTextToSize(data.desc, fullW - 6), margin + 3, y + 12);
    y += 62;

    // Sign
    ensure(20);
    pdf.setDrawColor(0);
    pdf.line(margin, y + 10, margin + 70, y + 10);
    pdf.line(pageW - margin - 70, y + 10, pageW - margin, y + 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(60);
    pdf.text("Customer Signature", margin, y + 16);
    pdf.text("Admin Signature", pageW - margin - 35, y + 16);

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    // revoke later (print window needs it)
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return url;
  }

  function openPdfPrintWindow(pdfUrl, autoPrint = true) {
    // HTML wrapper with iframe + print() button
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sysbyte PDF Print</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;}
    .top{position:sticky;top:0;z-index:999;background:#111;color:#fff;padding:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;}
    button{border:0;border-radius:10px;padding:10px 12px;font-weight:800;}
    .b1{background:#fff;color:#111;}
    .b2{background:rgba(255,255,255,0.18);color:#fff;}
    iframe{width:100vw;height:calc(100vh - 56px);border:0;}
  </style>
</head>
<body>
  <div class="top">
    <div>Sysbyte PDF</div>
    <div style="display:flex;gap:8px;">
      <button class="b2" id="closeBtn">Close</button>
      <button class="b1" id="printBtn">Print</button>
    </div>
  </div>

  <iframe id="pdfFrame" src="${escapeHtml(pdfUrl)}"></iframe>

  <script>
    const frame = document.getElementById('pdfFrame');
    const printBtn = document.getElementById('printBtn');
    const closeBtn = document.getElementById('closeBtn');

    function doPrint(){
      try{
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }catch(e){
        // fallback
        window.print();
      }
    }

    printBtn.addEventListener('click', doPrint);
    closeBtn.addEventListener('click', ()=>window.close());

    ${autoPrint ? "setTimeout(doPrint, 700);" : ""}
  </script>
</body>
</html>`;

    const wrapperBlob = new Blob([html], { type: "text/html" });
    const wrapperUrl = URL.createObjectURL(wrapperBlob);
    const w = window.open(wrapperUrl, "_blank");

    if (!w) {
      // popup blocked => open pdf directly in same tab (still printable from viewer menu)
      window.location.href = pdfUrl;
      URL.revokeObjectURL(wrapperUrl);
      return;
    }

    setTimeout(() => URL.revokeObjectURL(wrapperUrl), 120_000);
  }

  async function printPdfNow() {
    setPdfBusy(true);
    try {
      const pdfUrl = buildPdfBlobUrl();
      openPdfPrintWindow(pdfUrl, true); // auto print()
    } catch (e) {
      console.error(e);
      alert("PDF/Print failed (try again)");
    } finally {
      setPdfBusy(false);
    }
  }

  async function openPdfOnly() {
    setPdfBusy(true);
    try {
      const pdfUrl = buildPdfBlobUrl();
      const w = window.open(pdfUrl, "_blank");
      if (!w) window.location.href = pdfUrl;
    } catch (e) {
      console.error(e);
      alert("PDF open failed");
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

      {/* ✅ Print Modal */}
      <LayerModal
        open={printOpen}
        layerName="Print"
        title="PDF Print"
        sub="PDF + print()"
        onClose={() => setPrintOpen(false)}
        maxWidth="max-w-3xl"
      >
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs text-white/60">RollNo</div>
          <div className="text-lg font-bold text-white">{customer.rollNo || "—"}</div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Description (PDF me jayega)</div>
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
              onClick={openPdfOnly}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 disabled:opacity-60"
              title="Just open PDF"
            >
              {pdfBusy ? "Working..." : "Open PDF"}
            </button>

            <button
              type="button"
              disabled={pdfBusy}
              onClick={printPdfNow}
              className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
              title="Auto print()"
            >
              {pdfBusy ? "Printing..." : "Print Now"}
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            Agar print service off hai to Android “printer not available” dega. Settings → Printing → Default Print Service ON.
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
