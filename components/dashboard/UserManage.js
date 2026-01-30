// components/dashboard/UserManage.js
"use client";

import { useEffect, useState } from "react";

const PERM_KEYS = [
  { key: "recent", label: "Recent" },
  { key: "add", label: "Add" },
  { key: "calander", label: "Calander" },
  { key: "pending", label: "Pending" },
  { key: "sitting", label: "Sitting" },
];

export default function UserManage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // local edit buffer: userId -> permissions object
  const [permDraft, setPermDraft] = useState({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json().catch(() => ({}));
    setItems(data.items || []);

    const d = {};
    (data.items || []).forEach((u) => {
      d[u._id] = u.permissions || {
        recent: true,
        add: true,
        calander: true,
        pending: true,
        sitting: false,
      };
    });
    setPermDraft(d);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggle(userId, key) {
    setPermDraft((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [key]: !prev?.[userId]?.[key] },
    }));
  }

  async function savePermissions(userId) {
    const permissions = permDraft[userId];
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Save failed");
    alert("Permissions updated");
    load();
  }

  async function resetPassword(userId, username) {
    const pass = prompt(`New password for ${username}?`);
    if (!pass) return;
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Reset failed");
    alert("Password updated");
  }

  async function toggleActive(userId, active) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Update failed");
    load();
  }

  if (loading) return <div className="text-white/60">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">User Manage (Permissions)</h2>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
        >
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-white/60">No users</div>
      ) : (
        <div className="space-y-3">
          {items.map((u) => (
            <div
              key={u._id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_35px_rgba(59,130,246,0.10)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">{u.username}</div>
                  <div className="text-xs text-white/60">
                    Role: {u.role} | Active: {u.active ? "YES" : "NO"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(u._id, u.active)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => resetPassword(u._id, u.username)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                  >
                    Reset Pass
                  </button>
                </div>
              </div>

              {u.role === "ADMIN" ? (
                <div className="mt-3 text-xs text-white/60">
                  Admin has all components by default (permissions not required).
                </div>
              ) : (
                <>
                  <div className="mt-4 text-xs text-white/60 mb-2">
                    Dashboard Components Allowed:
                  </div>

                  <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {PERM_KEYS.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={!!permDraft?.[u._id]?.[p.key]}
                          onChange={() => toggle(u._id, p.key)}
                        />
                        <span className="text-white/80">{p.label}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={() => savePermissions(u._id)}
                    className="mt-3 px-4 py-2 rounded-xl bg-white text-black font-semibold"
                  >
                    Save Permissions
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
