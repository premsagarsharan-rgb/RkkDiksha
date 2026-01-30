"use client";

import { useMemo, useRef, useState } from "react";
import LayerModal from "@/components/LayerModal";
import { useCommitGate } from "@/components/CommitGate";

function makeSubmissionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function Toggle({ label, val, setVal }) {
  return (
    <button
      type="button"
      onClick={() => setVal(!val)}
      className={`rounded-2xl border px-3 py-2 text-left transition ${
        val ? "bg-white text-black border-white" : "bg-white/5 text-white border-white/10 hover:bg-white/10"
      }`}
    >
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[11px] opacity-70">{val ? "YES" : "NO"}</div>
    </button>
  );
}

function Field({ label, value, onChange, required = false, placeholder = "" }) {
  return (
    <div>
      <div className="text-xs text-white/70 mb-1">
        {label} {required ? "*" : ""}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  );
}

export default function AddCustomer() {
  // Layers (QR removed)
  const [manualOpen, setManualOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  // Form + submit locks
  const [submissionId, setSubmissionId] = useState("");
  const inFlight = useRef(false);

  const [error, setError] = useState("");
  const [doneInfo, setDoneInfo] = useState({ rollNo: null });

  const [form, setForm] = useState({
    name: "",
    age: "",
    address: "",
    pincode: "",
    gender: "OTHER",

    followYears: "",
    clubVisitsBefore: "",
    monthYear: "",

    onionGarlic: false,
    hasPet: false,
    hadTeacherBefore: false,
    familyPermission: false,
  });

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Created profile (manual)",
      "New customer entry",
      "Customer submitted basic details",
    ],
  });

  const canGoConfirm = useMemo(() => {
    return Boolean(form.name.trim() && form.age.trim() && form.address.trim());
  }, [form]);

  function resetAll() {
    setError("");
    setDoneInfo({ rollNo: null });
    setSubmissionId("");
    inFlight.current = false;

    setForm({
      name: "",
      age: "",
      address: "",
      pincode: "",
      gender: "OTHER",
      followYears: "",
      clubVisitsBefore: "",
      monthYear: "",
      onionGarlic: false,
      hasPet: false,
      hadTeacherBefore: false,
      familyPermission: false,
    });
  }

  function openManualDirect() {
    resetAll();
    setSubmissionId(makeSubmissionId());
    setManualOpen(true);
  }

  async function submitManualFinal() {
    setError("");
    if (inFlight.current) return;

    if (!canGoConfirm) {
      setError("Name, Age, Address required");
      return;
    }

    const commitMessage = await requestCommit({
      title: "Submit Customer",
      subtitle: "Customer will be created in Recent (Today DB).",
      preset: "Created profile (manual)",
    }).catch(() => null);

    if (!commitMessage) return;

    inFlight.current = true;

    try {
      const res = await fetch("/api/customers/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          commitMessage,
          ...form,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        inFlight.current = false;
        setError(data.error || "Submit failed");
        return;
      }

      setDoneInfo({
        rollNo: data.rollNo || null,
      });

      setConfirmOpen(false);
      setManualOpen(false);
      setDoneOpen(true);
    } catch (e) {
      inFlight.current = false;
      setError("Network error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/60">Entry</div>
          <h2 className="text-white font-semibold text-lg">Add Customer</h2>
        </div>

        {/* Direct manual */}
        <button
          type="button"
          onClick={openManualDirect}
          className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition shadow-[0_0_35px_rgba(59,130,246,0.12)]"
        >
          + Add
        </button>
      </div>

      {/* Layer 1: Manual Form */}
      <LayerModal
        open={manualOpen}
        layerName="Manual Form"
        title="Manual Entry"
        sub="Fill details → Confirm"
        onClose={() => setManualOpen(false)}
        maxWidth="max-w-5xl"
      >
        <div className="text-[11px] text-white/50 mb-3">
          submissionId: {submissionId || "—"}
        </div>

        {error ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Age" required value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
          <Field label="Address" required value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />

          <div>
            <div className="text-xs text-white/70 mb-1">Gender</div>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="MALE">MALE</option>
              <option value="FEMALE">FEMALE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <Field label="Kitne saal se follow" value={form.followYears} onChange={(v) => setForm({ ...form, followYears: v })} />
          <Field label="Club me pehle kitni baar aaye" value={form.clubVisitsBefore} onChange={(v) => setForm({ ...form, clubVisitsBefore: v })} />
          <Field label="Month/Year" value={form.monthYear} onChange={(v) => setForm({ ...form, monthYear: v })} />
        </div>

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Toggle label="Onion/Garlic?" val={form.onionGarlic} setVal={(x) => setForm({ ...form, onionGarlic: x })} />
          <Toggle label="Has Pet?" val={form.hasPet} setVal={(x) => setForm({ ...form, hasPet: x })} />
          <Toggle label="Teacher Before?" val={form.hadTeacherBefore} setVal={(x) => setForm({ ...form, hadTeacherBefore: x })} />
          <Toggle label="Family Permission?" val={form.familyPermission} setVal={(x) => setForm({ ...form, familyPermission: x })} />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setManualOpen(false)}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Close
          </button>

          <button
            type="button"
            disabled={!canGoConfirm}
            onClick={() => {
              setError("");
              if (!canGoConfirm) {
                setError("Name, Age, Address required");
                return;
              }
              setConfirmOpen(true);
            }}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
          >
            Confirm
          </button>
        </div>
      </LayerModal>

      {/* Layer 2: Confirm */}
      <LayerModal
        open={confirmOpen}
        layerName="Confirm"
        title="Confirm Customer"
        sub="Review → Submit"
        onClose={() => setConfirmOpen(false)}
        maxWidth="max-w-3xl"
      >
        {error ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
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
          <Line k="Onion/Garlic" v={form.onionGarlic ? "YES" : "NO"} />
          <Line k="Has Pet" v={form.hasPet ? "YES" : "NO"} />
          <Line k="Teacher Before" v={form.hadTeacherBefore ? "YES" : "NO"} />
          <Line k="Family Permission" v={form.familyPermission ? "YES" : "NO"} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={submitManualFinal}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold"
          >
            Submit (Commit required)
          </button>
        </div>
      </LayerModal>

      {/* Layer 3: Done (only RollNo) */}
      <LayerModal
        open={doneOpen}
        layerName="Done"
        title="Customer Added"
        sub="Saved in Recent (Today DB)"
        onClose={() => setDoneOpen(false)}
        maxWidth="max-w-2xl"
      >
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-center">
          <div className="text-2xl font-bold">Done</div>
          <div className="text-white/60 text-sm mt-2">
            Customer created successfully.
          </div>

          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-white/60">Roll No</div>
            <div className="text-3xl font-extrabold tracking-wide">
              {doneInfo.rollNo || "—"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDoneOpen(false)}
            className="mt-5 px-5 py-3 rounded-2xl bg-white text-black font-semibold"
          >
            Close
          </button>
        </div>
      </LayerModal>

      {/* Commit always topmost */}
      {CommitModal}
    </div>
  );
}

function Line({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-white/60 text-sm">{k}</div>
      <div className="text-white text-sm text-right break-words max-w-[60%]">{v}</div>
    </div>
  );
}
