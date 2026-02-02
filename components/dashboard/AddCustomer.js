"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LayerModal from "@/components/LayerModal";
import { useCommitGate } from "@/components/CommitGate";

const DRAFT_KEY_V2 = "sysbyte_addcustomer_draft_v2";
const DRAFT_KEY_V1 = "sysbyte_addcustomer_draft_v1";

const FAMILY_OPTIONS = ["mother", "father", "mother&father", "husbend", "wife", "other"];

const APPROVERS = [
  "Albeli baba",
  "sundari baba",
  "sahachari baba",
  "pyari sharan babab",
  "garbeli baba",
  "mahaMadhuri baba",
  "navalNagri baba",
  "permRasdaini baba",
  "navalKishori baba",
];

const MARITAL = ["marrid", "unmarrid", "divorce", "wido", "virakt", "sepreted"];

const INDIA_STATES_FALLBACK = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Andaman and Nicobar Islands","Lakshadweep"
];

function makeSubmissionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function hasMeaningfulDraft(form) {
  if (!form) return false;
  return Boolean(
    String(form.name || "").trim() ||
      String(form.age || "").trim() ||
      String(form.country || "").trim() ||
      String(form.state || "").trim() ||
      String(form.city || "").trim() ||
      String(form.occupation || "").trim() ||
      String(form.note || "").trim() ||
      String(form.approver || "").trim() ||
      String(form.maritalStatus || "").trim() ||
      String(form.familyPermissionRelation || "").trim() ||
      String(form.familyPermissionOther || "").trim() ||
      String(form.remarks || "").trim() ||
      form.onionGarlic ||
      form.hasPet ||
      form.hadTeacherBefore
  );
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

function Field({ label, value, onChange, required = false, placeholder = "", type = "text" }) {
  return (
    <div>
      <div className="text-xs text-white/70 mb-1">
        {label} {required ? "*" : ""}
      </div>
      <input
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, required = false }) {
  return (
    <div>
      <div className="text-xs text-white/70 mb-1">
        {label} {required ? "*" : ""}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
      >
        <option value="">Select...</option>
        {(options || []).map((x, idx) => (
          <option key={`${x}_${idx}`} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}

async function fetchIndiaStates() {
  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "India" }),
    });
    const data = await res.json().catch(() => ({}));
    const states = (data?.data?.states || []).map((s) => s.name).filter(Boolean);
    if (states.length) return uniqStrings(states);
  } catch {}
  return INDIA_STATES_FALLBACK;
}

async function fetchIndiaCities(state) {
  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "India", state }),
    });
    const data = await res.json().catch(() => ({}));
    const cities = uniqStrings(data?.data || []);
    return cities; // ✅ full list, deduped
  } catch {
    return [];
  }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const a = data.address || {};
  return {
    country: a.country || "India",
    state: a.state || a.region || "",
    city: a.city || a.town || a.village || a.county || "",
  };
}

export default function AddCustomer({ session }) {
  const username = session?.username || "UNKNOWN";

  const [manualOpen, setManualOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const [submissionId, setSubmissionId] = useState("");
  const inFlight = useRef(false);

  const [error, setError] = useState("");
  const [doneInfo, setDoneInfo] = useState({ rollNo: null });

  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [remarksUnlocked, setRemarksUnlocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "OTHER",

    occupation: "",
    note: "",
    approver: "",
    maritalStatus: "",

    country: "India",
    state: "",
    city: "",
    cityOther: "",

    familyPermissionRelation: "",
    familyPermissionOther: "",

    onionGarlic: false,
    hasPet: false,
    hadTeacherBefore: false,

    remarks: username,
  });

  const computedAddress = useMemo(() => {
    const c = form.country || "India";
    const s = form.state || "";
    const city = form.city === "__OTHER__" ? (form.cityOther || "") : (form.city || "");
    return [city, s, c].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  }, [form.country, form.state, form.city, form.cityOther]);

  useEffect(() => {
    try {
      const raw2 = localStorage.getItem(DRAFT_KEY_V2);
      const raw1 = localStorage.getItem(DRAFT_KEY_V1);
      const raw = raw2 || raw1;
      if (!raw) return;

      const d = JSON.parse(raw);

      if (d?.form && typeof d.form === "object") {
        setForm((prev) => ({
          ...prev,
          ...d.form,
          country: d.form.country || prev.country || "India",
          remarks: d.form.remarks || prev.remarks || username,
        }));
      }
      if (d?.submissionId) setSubmissionId(String(d.submissionId));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (!submissionId && !hasMeaningfulDraft(form)) {
        localStorage.removeItem(DRAFT_KEY_V2);
        return;
      }
      localStorage.setItem(
        DRAFT_KEY_V2,
        JSON.stringify({ submissionId: submissionId || null, form, updatedAt: new Date().toISOString() })
      );
    } catch {}
  }, [form, submissionId]);

  useEffect(() => {
    (async () => {
      const st = await fetchIndiaStates();
      setStates(st);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!form.state) {
        setCities([]);
        return;
      }
      const list = await fetchIndiaCities(form.state);
      setCities(list); // ✅ deduped list
    })();
  }, [form.state]);

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: ["Created profile (manual)", "New customer entry", "Customer submitted basic details"],
  });

  const canGoConfirm = useMemo(() => {
    const cityOk = form.city && (form.city !== "__OTHER__" || String(form.cityOther || "").trim());
    return Boolean(String(form.name || "").trim() && String(form.age || "").trim() && String(form.state || "").trim() && cityOk);
  }, [form]);

  function resetAll() {
    setError("");
    setDoneInfo({ rollNo: null });
    setSubmissionId("");
    inFlight.current = false;

    setRemarksUnlocked(false);
    setUnlockOpen(false);
    setUnlockPwd("");

    setForm({
      name: "",
      age: "",
      gender: "OTHER",
      occupation: "",
      note: "",
      approver: "",
      maritalStatus: "",
      country: "India",
      state: "",
      city: "",
      cityOther: "",
      familyPermissionRelation: "",
      familyPermissionOther: "",
      onionGarlic: false,
      hasPet: false,
      hadTeacherBefore: false,
      remarks: username,
    });

    try { localStorage.removeItem(DRAFT_KEY_V2); } catch {}
  }

  function openManualDirect() {
    if (!submissionId) setSubmissionId(makeSubmissionId());
    setForm((prev) => ({ ...prev, remarks: prev.remarks || username }));
    setManualOpen(true);
  }

  async function autofillFromGPS() {
    setError("");
    if (!navigator.geolocation) return alert("Geolocation not supported");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const info = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setForm((prev) => ({
            ...prev,
            country: "India",
            state: info.state || prev.state,
            city: info.city || prev.city,
          }));
        } catch {
          alert("AutoFetch failed");
        }
      },
      () => alert("Location permission denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function unlockRemarks() {
    setError("");
    const pwd = String(unlockPwd || "");
    if (!pwd) return setError("Enter password");

    const res = await fetch("/api/auth/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Wrong password");

    setRemarksUnlocked(true);
    setUnlockOpen(false);
    setUnlockPwd("");
  }

  async function submitManualFinal() {
    setError("");
    if (inFlight.current) return;

    if (!canGoConfirm) {
      setError("Name, Age, State, City required");
      return;
    }

    const commitMessage = await requestCommit({
      title: "Submit Customer",
      subtitle: "Customer will be created in Recent (Today DB).",
      preset: "Created profile (manual)",
    }).catch(() => null);

    if (!commitMessage) return;

    const cityFinal = form.city === "__OTHER__" ? form.cityOther : form.city;

    inFlight.current = true;

    try {
      const res = await fetch("/api/customers/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          commitMessage,

          name: form.name,
          age: form.age,
          gender: form.gender,

          // new address fields + compatibility address
          country: "India",
          state: form.state,
          city: cityFinal,
          address: computedAddress,

          occupation: form.occupation,
          note: form.note,
          approver: form.approver,
          maritalStatus: form.maritalStatus,

          familyPermission: Boolean(form.familyPermissionRelation),
          familyPermissionRelation: form.familyPermissionRelation,
          familyPermissionOther: form.familyPermissionRelation === "other" ? form.familyPermissionOther : "",

          remarks: form.remarks || username,
          remarksBy: username,

          onionGarlic: form.onionGarlic,
          hasPet: form.hasPet,
          hadTeacherBefore: form.hadTeacherBefore,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        inFlight.current = false;
        setError(data.error || "Submit failed");
        return;
      }

      setDoneInfo({ rollNo: data.rollNo || null });

      setConfirmOpen(false);
      setManualOpen(false);
      setDoneOpen(true);
    } catch {
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

        <button
          type="button"
          onClick={openManualDirect}
          className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition shadow-[0_0_35px_rgba(59,130,246,0.12)]"
        >
          + Add
        </button>
      </div>

      <LayerModal
        open={manualOpen}
        layerName="Manual Form"
        title="Manual Entry"
        sub="Fill details → Confirm"
        onClose={() => setManualOpen(false)}
        maxWidth="max-w-5xl"
        disableBackdropClose
      >
        <div className="text-[11px] text-white/50 mb-3">submissionId: {submissionId || "—"}</div>

        {error ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Age" required value={form.age} onChange={(v) => setForm({ ...form, age: v })} />

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

          <Field label="Occupation" value={form.occupation} onChange={(v) => setForm({ ...form, occupation: v })} placeholder="e.g. business/job..." />

          <div>
            <div className="text-xs text-white/70 mb-1">Country *</div>
            <select value="India" disabled className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none">
              <option value="India">India</option>
            </select>
          </div>

          <Select
            label="State"
            required
            value={form.state}
            onChange={(v) => setForm({ ...form, state: v, city: "", cityOther: "" })}
            options={states.length ? states : INDIA_STATES_FALLBACK}
          />

          <div>
            <div className="text-xs text-white/70 mb-1">City *</div>

            <select
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value, cityOther: "" })}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
              disabled={!form.state}
            >
              <option value="">Select...</option>

              {/* ✅ FIX: duplicates no longer crash; key uses idx */}
              {cities.map((c, idx) => (
                <option key={`${c}_${idx}`} value={c}>
                  {c}
                </option>
              ))}

              <option value="__OTHER__">Other</option>
            </select>

            {form.city === "__OTHER__" ? (
              <input
                value={form.cityOther}
                onChange={(e) => setForm({ ...form, cityOther: e.target.value })}
                placeholder="Type city name..."
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={autofillFromGPS}
              className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
            >
              AutoFetch State/City (GPS)
            </button>
            <div className="text-[11px] text-white/50 mt-1">
              Internet required • GPS permission required
            </div>
          </div>

          <Select
            label="Maritial Status"
            value={form.maritalStatus}
            onChange={(v) => setForm({ ...form, maritalStatus: v })}
            options={MARITAL}
          />

          <Select
            label="Approver"
            value={form.approver}
            onChange={(v) => setForm({ ...form, approver: v })}
            options={APPROVERS}
          />

          <div>
            <div className="text-xs text-white/70 mb-1">Family Permission</div>
            <select
              value={form.familyPermissionRelation}
              onChange={(e) => {
                const rel = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  familyPermissionRelation: rel,
                  familyPermissionOther: rel === "other" ? prev.familyPermissionOther : "",
                }));
              }}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">Select...</option>
              {FAMILY_OPTIONS.map((x, idx) => (
                <option key={`${x}_${idx}`} value={x}>{x}</option>
              ))}
            </select>

            {form.familyPermissionRelation === "other" ? (
              <input
                value={form.familyPermissionOther}
                onChange={(e) => setForm({ ...form, familyPermissionOther: e.target.value })}
                placeholder="Other (type here)..."
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            ) : null}
          </div>

          <div className="sm:col-span-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
            <Toggle label="Onion/Garlic?" val={form.onionGarlic} setVal={(x) => setForm({ ...form, onionGarlic: x })} />
            <Toggle label="Has Pet?" val={form.hasPet} setVal={(x) => setForm({ ...form, hasPet: x })} />
            <Toggle label="Teacher Before?" val={form.hadTeacherBefore} setVal={(x) => setForm({ ...form, hadTeacherBefore: x })} />
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs text-white/70 mb-1">Note</div>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note..."
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none min-h-[90px]"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/70">Remarks (auto)</div>
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="px-3 py-1 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
              >
                Unlock (Password)
              </button>
            </div>

            <input
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              readOnly={!remarksUnlocked}
              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${
                remarksUnlocked
                  ? "bg-black/30 border-white/10 text-white focus:ring-2 focus:ring-blue-500/40"
                  : "bg-white/5 border-white/10 text-white/70"
              }`}
            />
            <div className="text-[11px] text-white/50 mt-1">
              Default: <b>{username}</b> • Unlock ke baad edit possible
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/60">
          Computed Address: <b className="text-white">{computedAddress || "—"}</b>
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
                setError("Name, Age, State, City required");
                return;
              }
              setConfirmOpen(true);
            }}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
          >
            Confirm
          </button>
        </div>

        <div className="mt-3 text-[11px] text-white/45">
          Draft auto-saved. Modal close ho bhi jaye to data safe rahega.
        </div>
      </LayerModal>

      {/* Unlock remarks modal */}
      <LayerModal
        open={unlockOpen}
        layerName="Unlock Remarks"
        title="Unlock Remarks"
        sub="Enter your password"
        onClose={() => {
          setUnlockOpen(false);
          setUnlockPwd("");
          setError("");
        }}
        maxWidth="max-w-md"
        disableBackdropClose
      >
        {error ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <input
          type="password"
          value={unlockPwd}
          onChange={(e) => setUnlockPwd(e.target.value)}
          placeholder="Password..."
          className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setUnlockOpen(false);
              setUnlockPwd("");
              setError("");
            }}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={unlockRemarks}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-black font-semibold"
          >
            Unlock
          </button>
        </div>
      </LayerModal>

      {/* Confirm */}
      <LayerModal
        open={confirmOpen}
        layerName="Confirm"
        title="Confirm Customer"
        sub="Review → Submit"
        onClose={() => setConfirmOpen(false)}
        maxWidth="max-w-3xl"
        disableBackdropClose
      >
        {error ? (
          <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-2">
          <Line k="Name" v={form.name} />
          <Line k="Age" v={form.age} />
          <Line k="Gender" v={form.gender} />
          <Line k="Occupation" v={form.occupation || "-"} />
          <Line k="Address" v={computedAddress || "-"} />
          <Line k="Maritial Status" v={form.maritalStatus || "-"} />
          <Line k="Approver" v={form.approver || "-"} />
          <Line k="Family Permission" v={form.familyPermissionRelation ? form.familyPermissionRelation : "NO"} />
          {form.familyPermissionRelation === "other" ? <Line k="Family Other" v={form.familyPermissionOther || "-"} /> : null}
          <Line k="Remarks" v={form.remarks || "-"} />
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

      {/* Done */}
      <LayerModal
        open={doneOpen}
        layerName="Done"
        title="Customer Added"
        sub="Saved in Recent (Today DB)"
        onClose={() => {
          setDoneOpen(false);
          resetAll();
        }}
        maxWidth="max-w-2xl"
        disableBackdropClose
      >
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-center">
          <div className="text-2xl font-bold">Done</div>
          <div className="text-white/60 text-sm mt-2">Customer created successfully.</div>

          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-white/60">Roll No</div>
            <div className="text-3xl font-extrabold tracking-wide">{doneInfo.rollNo || "—"}</div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDoneOpen(false);
              resetAll();
            }}
            className="mt-5 px-5 py-3 rounded-2xl bg-white text-black font-semibold"
          >
            Close
          </button>
        </div>
      </LayerModal>

      {CommitModal}
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
