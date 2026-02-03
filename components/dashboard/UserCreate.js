"use client";

import { useMemo, useState } from "react";

const PERM_KEYS = [
  { key: "recent", label: "Recent" },
  { key: "add", label: "Add Customer" },
  { key: "calander", label: "Calander" },
  { key: "pending", label: "Pending" },
  { key: "sitting", label: "Sitting" },

  { key: "tracker", label: "Tracker" },

  // ✅ split screens
  { key: "screensCreate", label: "Screens: Create" },
  { key: "screensView", label: "Screens: View" },
];

export default function UserCreate() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");

  const [permissions, setPermissions] = useState({
    recent: true,
    add: true,
    calander: true,
    pending: true,
    sitting: false,

    tracker: false,

    screensCreate: false,
    screensView: false,

    // legacy (optional): keep false, we won't show checkbox for it
    screens: false,
  });

  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      username.trim() &&
        password.trim().length >= 4 &&
        (role === "ADMIN" || role === "USER")
    );
  }, [username, password, role]);

  function togglePerm(key) {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
  }

  async function createUser() {
    if (!canSubmit) return;

    setBusy(true);
    try {
      const nextPerms = {
        ...permissions,
        // keep legacy in sync (backward compatibility)
        screens: !!(permissions.screensCreate || permissions.screensView),
      };

      const payload = {
        username: username.trim(),
        password: password,
        role,
        permissions: role === "USER" ? nextPerms : null,
      };

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Create failed");
        return;
      }

      alert("User created ✅");
      setUsername("");
      setPassword("");
      setRole("USER");
      setPermissions({
        recent: true,
        add: true,
        calander: true,
        pending: true,
        sitting: false,
        tracker: false,
        screensCreate: false,
        screensView: false,
        screens: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_55px_rgba(59,130,246,0.10)]">
      <div className="text-xs text-white/60">Admin Tool</div>
      <div className="text-xl font-bold mt-1">Create User</div>
      <div className="text-sm text-white/60 mt-2">
        Username + Password + Role + (USER permissions)
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-white/70 mb-1">Username *</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="e.g. Sstring"
          />
        </div>

        <div>
          <div className="text-xs text-white/70 mb-1">Password * (min 4)</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="e.g. paasWordqwe"
            type="password"
          />
        </div>

        <div>
          <div className="text-xs text-white/70 mb-1">Role *</div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <div className="text-[11px] text-white/50 mt-1">
            ADMIN has all components by default.
          </div>
        </div>
      </div>

      {role === "USER" ? (
        <div className="mt-5">
          <div className="text-xs text-white/60 mb-2">
            Allowed Dashboard Components (Whitelist)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {PERM_KEYS.map((p) => (
              <label
                key={p.key}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={!!permissions[p.key]}
                  onChange={() => togglePerm(p.key)}
                />
                <span className="text-white/80">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={createUser}
        className="mt-5 w-full px-4 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60"
      >
        {busy ? "Creating..." : "Create User"}
      </button>
    </div>
  );
}
