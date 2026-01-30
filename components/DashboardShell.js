"use client";

import { useMemo, useState } from "react";
import LayerModal from "@/components/LayerModal";

import RecentCustomer from "@/components/dashboard/RecentCustomer";
import AddCustomer from "@/components/dashboard/AddCustomer";
import Calander from "@/components/dashboard/Calander";
import Pending from "@/components/dashboard/Pending";
import SittingData from "@/components/dashboard/SittingData";
import UserCreate from "@/components/dashboard/UserCreate";
import UserManage from "@/components/dashboard/UserManage";

export default function DashboardShell({ session }) {
  const isAdmin = session.role === "ADMIN";
  const perms = session.permissions || {
    recent: true, add: true, calander: true, pending: true, sitting: false,
  };

  const can = (key) => (isAdmin ? true : !!perms[key]);

  const tiles = useMemo(() => {
    const t = [];
    if (can("recent")) t.push({ key: "recent", title: "Recent", sub: "Today DB", C: RecentCustomer });
    if (can("add")) t.push({ key: "add", title: "Add Customer", sub: "Manual → Recent", C: AddCustomer });
    if (can("calander")) t.push({ key: "calander", title: "Calander", sub: "Containers", C: Calander });
    if (can("pending")) t.push({ key: "pending", title: "Pending", sub: "Paused", C: Pending });
    if (can("sitting")) t.push({ key: "sitting", title: "Sitting", sub: "ACTIVE", C: SittingData });

    if (isAdmin) t.push({ key: "usercreate", title: "User Create", sub: "Create employee", C: UserCreate });
    if (isAdmin) t.push({ key: "usermanage", title: "User Manage", sub: "Permissions", C: UserManage });

    return t;
  }, [isAdmin, perms]);

  const [openKey, setOpenKey] = useState(null);
  const active = tiles.find(t => t.key === openKey);
  const ActiveComp = active?.C;

  return (
    <div className="min-h-screen text-white">
      {/* Top */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-white/60">Premium Dashboard</div>
            <div className="text-lg font-bold">Sysbyte WebApp</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold">{session.username}</div>
              <div className="text-xs text-white/60">{session.role}</div>
            </div>
            <button
              className="px-4 py-2 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <button
              key={t.key}
              onClick={() => setOpenKey(t.key)}
              className="text-left rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:bg-white/10 transition shadow-[0_0_55px_rgba(59,130,246,0.10)]"
            >
              <div className="text-xs text-white/60">{t.sub}</div>
              <div className="text-xl font-bold mt-1">{t.title}</div>
              <div className="text-sm text-white/60 mt-2">Open</div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal popup for selected component */}
      <LayerModal
        open={!!active}
        zIndex={55}
        layerIndex={1}
        layerTotal={1}
        layerName="Dashboard Component"
        title={active?.title || ""}
        sub={active?.sub || ""}
        onClose={() => setOpenKey(null)}
        maxWidth="max-w-6xl"
      >
        {ActiveComp ? <ActiveComp role={session.role} session={session} /> : null}
      </LayerModal>
    </div>
  );
}
