"use client";

import { useMemo, useState } from "react";
import LayerModal from "@/components/LayerModal";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";

import RecentCustomer from "@/components/dashboard/RecentCustomer";
import AddCustomer from "@/components/dashboard/AddCustomer";
import Calander from "@/components/dashboard/Calander";
import Pending from "@/components/dashboard/Pending";
import SittingData from "@/components/dashboard/SittingData";
import UserCreate from "@/components/dashboard/UserCreate";
import UserManage from "@/components/dashboard/UserManage";
import CustomerLocationTracker from "@/components/dashboard/CustomerLocationTracker";
import Screens from "@/components/dashboard/Screens";

export default function DashboardShell({ session }) {
  const themeApi = useTheme();
  const isLight = themeApi?.theme === "light";

  const isAdmin = session.role === "ADMIN";
  const perms = session.permissions || {
    recent: true,
    add: true,
    calander: true,
    pending: true,
    sitting: false,
    tracker: false,
    screens: true, // ✅ default allow (you can control from permissions later)
  };

  const can = (key) => (isAdmin ? true : !!perms[key]);

  const tiles = useMemo(() => {
    const t = [];
    if (can("recent")) t.push({ key: "recent", title: "Recent", sub: "Today DB", C: RecentCustomer });
    if (can("add")) t.push({ key: "add", title: "Add Customer", sub: "Manual → Recent", C: AddCustomer });
    if (can("calander")) t.push({ key: "calander", title: "Calander", sub: "Containers", C: Calander });
    if (can("pending")) t.push({ key: "pending", title: "Pending", sub: "Paused", C: Pending });
    if (can("sitting")) t.push({ key: "sitting", title: "Sitting", sub: "ACTIVE", C: SittingData });

    if (isAdmin || can("tracker")) t.push({ key: "tracker", title: "Tracker", sub: "Where is customer now?", C: CustomerLocationTracker });
    if (can("screens")) t.push({ key: "screens", title: "Screens", sub: "Presentation screens", C: Screens });

    if (isAdmin) t.push({ key: "usercreate", title: "User Create", sub: "Create employee", C: UserCreate });
    if (isAdmin) t.push({ key: "usermanage", title: "User Manage", sub: "Permissions", C: UserManage });

    return t;
  }, [isAdmin, perms]);

  const [openKey, setOpenKey] = useState(null);
  const active = tiles.find((t) => t.key === openKey);
  const ActiveComp = active?.C;

  const tileGlow = isLight
    ? "0 0 55px rgba(196,125,9,0.10)"
    : "0 0 55px rgba(59,130,246,0.10)";

  const topbarCls = isLight
    ? "border-b border-white/20 bg-white/20 backdrop-blur-xl"
    : "border-b border-white/10 bg-black/25 backdrop-blur-xl";

  const buttonCls = isLight
    ? "px-4 py-2 rounded-2xl bg-white/20 border border-white/20 hover:bg-white/25 transition"
    : "px-4 py-2 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition";

  const tileCls = isLight
    ? "text-left rounded-3xl border border-white/18 bg-white/12 backdrop-blur-xl p-5 hover:bg-white/18 transition"
    : "text-left rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:bg-white/10 transition";

  return (
    <div className="min-h-screen text-white">
      <div className={`sticky top-0 z-40 ${topbarCls}`}>
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

            <ThemeToggle />

            <button
              className={buttonCls}
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <button
              key={t.key}
              onClick={() => setOpenKey(t.key)}
              className={tileCls}
              style={{ boxShadow: tileGlow }}
              type="button"
            >
              <div className="text-xs text-white/60">{t.sub}</div>
              <div className="text-xl font-bold mt-1">{t.title}</div>
              <div className="text-sm text-white/60 mt-2">Open</div>
            </button>
          ))}
        </div>
      </div>

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
