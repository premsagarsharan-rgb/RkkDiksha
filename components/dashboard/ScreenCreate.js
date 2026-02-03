"use client";

import { useEffect, useState } from "react";
import LayerModal from "@/components/LayerModal";
import { useCommitGate } from "@/components/CommitGate";
import ScreenViewClient from "@/components/ScreenViewClient";

function safeId(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.$oid) return String(x.$oid);
  return String(x);
}

function uniq(arr) {
  return Array.from(new Set((arr || []).map(String)));
}

function toCode5(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ScreensCreate() {
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [createTitle, setCreateTitle] = useState("");

  const [openId, setOpenId] = useState(null);
  const [screen, setScreen] = useState(null);

  const [newViewCode, setNewViewCode] = useState("");

  const [pickMode, setPickMode] = useState("DIKSHA");
  const [pickDate, setPickDate] = useState("");
  const [containerLoading, setContainerLoading] = useState(false);
  const [containerData, setContainerData] = useState({
    container: null,
    assignments: [],
    reserved: [],
  });

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Created screen",
      "Added slide",
      "Removed slide",
      "Cleared screen",
      "Updated view code",
      "Deleted screen",
    ],
  });

  async function loadList() {
    setLoadingList(true);
    const res = await fetch("/api/screens");
    const data = await res.json().catch(() => ({}));
    setList(data.items || []);
    setLoadingList(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  async function reloadOpenScreen() {
    if (!openId) return;
    const res = await fetch(`/api/screens/${openId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setScreen(data.screen);
    setNewViewCode(data.screen?.viewCode || "");
  }

  async function openScreen(screenId) {
    setOpenId(screenId);
    setScreen(null);

    const res = await fetch(`/api/screens/${screenId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Load failed");
      setOpenId(null);
      return;
    }

    setScreen(data.screen);
    setNewViewCode(data.screen?.viewCode || "");
  }

  async function createScreen() {
    const title = createTitle.trim();
    if (!title) return alert("Title required");

    const commitMessage = await requestCommit({
      title: "Create Screen",
      subtitle: "Blank screen will be created.",
      preset: "Created screen",
    }).catch(() => null);
    if (!commitMessage) return;

    const res = await fetch("/api/screens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Create failed");

    setCreateTitle("");
    await loadList();
    await openScreen(data.id);
  }

  async function patchScreen(payload) {
    if (!openId) return;
    const res = await fetch(`/api/screens/${openId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Update failed");

    await reloadOpenScreen(); // ✅ no polling; reload once
  }

  async function deleteScreen() {
    if (!openId || !screen) return;

    const ok = confirm(`Delete screen "${screen.title}" permanently?`);
    if (!ok) return;

    const commitMessage = await requestCommit({
      title: "Delete Screen",
      subtitle: "This will permanently delete screen & slides.",
      preset: "Deleted screen",
    }).catch(() => null);

    if (!commitMessage) return;

    const res = await fetch(`/api/screens/${openId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitMessage }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Delete failed");

    setOpenId(null);
    setScreen(null);
    await loadList();
  }

  async function loadPickedContainer() {
    if (!pickDate || !/^\d{4}-\d{2}-\d{2}$/.test(pickDate)) {
      return alert("Pick a valid date");
    }

    setContainerLoading(true);
    setContainerData({ container: null, assignments: [], reserved: [] });

    try {
      const cRes = await fetch("/api/calander/container/by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: pickDate, mode: pickMode }),
      });
      const cData = await cRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cData.error || "Container failed");

      const containerObj = cData?.container?.value ?? cData?.container;
      const containerId = safeId(containerObj?._id);
      if (!containerId) throw new Error("Invalid container");

      const dRes = await fetch(
        `/api/calander/container/${encodeURIComponent(containerId)}?includeReserved=1`
      );
      const dData = await dRes.json().catch(() => ({}));
      if (!dRes.ok) throw new Error(dData.error || "Load failed");

      setContainerData({
        container: dData.container,
        assignments: dData.assignments || [],
        reserved: dData.reserved || [],
      });
    } catch (e) {
      alert(e?.message || "Load failed");
    } finally {
      setContainerLoading(false);
    }
  }

  function getGroupCustomerIdsForAssignment(a) {
    const kind = String(a?.kind || "SINGLE").toUpperCase();
    const pairId = safeId(a?.pairId);

    if ((kind === "COUPLE" || kind === "FAMILY") && pairId) {
      const group = (containerData.assignments || []).filter(
        (x) => safeId(x?.pairId) === pairId
      );
      return {
        kind,
        customerIds: uniq(group.map((x) => safeId(x.customerId)).filter(Boolean)),
      };
    }

    return { kind: "SINGLE", customerIds: [safeId(a.customerId)].filter(Boolean) };
  }

  async function pushAssignmentToScreen(a) {
    const info = getGroupCustomerIdsForAssignment(a);
    if (!info.customerIds.length) return alert("Invalid customerId");

    const commitMessage = await requestCommit({
      title:
        info.kind === "SINGLE"
          ? "Push card to Screen"
          : `Push ${info.kind} group to Screen`,
      subtitle: `${pickMode} ${pickDate}`,
      preset: "Added slide",
    }).catch(() => null);
    if (!commitMessage) return;

    await patchScreen({
      action: "addSlide",
      kind: info.kind,
      customerIds: info.customerIds,
      origin: {
        date: containerData?.container?.date || pickDate,
        mode: containerData?.container?.mode || pickMode,
        containerId: safeId(containerData?.container?._id),
      },
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">Screens • Create</h2>
          <div className="text-xs text-white/60">Create/manage your screens.</div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder="New screen title..."
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
          />
          <button
            onClick={createScreen}
            className="px-3 py-2 rounded-xl bg-white text-black font-semibold"
            type="button"
          >
            Create
          </button>

          <button
            onClick={loadList}
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {loadingList ? (
        <div className="text-white/60">Loading...</div>
      ) : list.length === 0 ? (
        <div className="text-white/60">No screens yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <button
              key={s._id}
              onClick={() => openScreen(s._id)}
              className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4"
              type="button"
            >
              <div className="text-white font-semibold">{s.title}</div>
              <div className="text-xs text-white/60 mt-1">
                Slides: {s.slidesCount} • Code:{" "}
                <span className="text-white/80 font-semibold">
                  {s.viewCode || "—"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <LayerModal
        open={!!openId}
        layerName="Screen (Creator)"
        title={screen?.title || "Screen"}
        sub={screen?.viewCode ? `viewCode: ${screen.viewCode}` : "Loading..."}
        onClose={() => {
          setOpenId(null);
          setScreen(null);
          setPickDate("");
          setPickMode("DIKSHA");
          setContainerData({ container: null, assignments: [], reserved: [] });
        }}
        maxWidth="max-w-6xl"
      >
        {!screen ? (
          <div className="text-white/60">Loading screen...</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Control Panel</div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">VIEW CODE (5 chars)</div>
                <div className="text-lg font-bold tracking-widest">
                  {screen.viewCode || "—"}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={toCode5(newViewCode)}
                    onChange={(e) => setNewViewCode(toCode5(e.target.value))}
                    maxLength={5}
                    className="w-28 tracking-widest uppercase px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
                    placeholder="ABCDE"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const commitMessage = await requestCommit({
                        title: "Update View Code",
                        subtitle: "Change screen view code",
                        preset: "Updated view code",
                      }).catch(() => null);
                      if (!commitMessage) return;
                      await patchScreen({
                        action: "setViewCode",
                        viewCode: toCode5(newViewCode),
                      });
                    }}
                    className="px-3 py-2 rounded-xl bg-white text-black font-semibold"
                  >
                    Set
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const commitMessage = await requestCommit({
                        title: "Regenerate View Code",
                        subtitle: "New code will be generated",
                        preset: "Updated view code",
                      }).catch(() => null);
                      if (!commitMessage) return;
                      await patchScreen({ action: "regenViewCode" });
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
                  >
                    Regen
                  </button>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                <select
                  value={screen.settings?.theme || "aurora"}
                  onChange={(e) =>
                    patchScreen({
                      action: "settings",
                      settings: { ...screen.settings, theme: e.target.value },
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm"
                >
                  <option value="aurora">Theme: Aurora</option>
                  <option value="blue">Theme: Blue</option>
                  <option value="purple">Theme: Purple</option>
                  <option value="emerald">Theme: Emerald</option>
                </select>

                <select
                  value={screen.settings?.cardStyle || "movie"}
                  onChange={(e) =>
                    patchScreen({
                      action: "settings",
                      settings: { ...screen.settings, cardStyle: e.target.value },
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm"
                >
                  <option value="movie">Card: Movie</option>
                  <option value="compact">Card: Compact</option>
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    const commitMessage = await requestCommit({
                      title: "Clear Screen",
                      subtitle: "All slides will be removed",
                      preset: "Cleared screen",
                    }).catch(() => null);
                    if (!commitMessage) return;
                    await patchScreen({ action: "clearSlides" });
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-400/20 hover:bg-red-500/20 text-sm"
                >
                  Clear Slides
                </button>

                <button
                  type="button"
                  onClick={deleteScreen}
                  className="px-3 py-2 rounded-xl bg-red-600 text-white font-semibold"
                >
                  Delete Screen
                </button>
              </div>

              <div className="mt-5 text-sm font-semibold">Pick Container → Push Cards</div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickMode("DIKSHA")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm ${
                    pickMode === "DIKSHA"
                      ? "bg-white text-black font-semibold"
                      : "bg-white/10 border border-white/10"
                  }`}
                >
                  DIKSHA
                </button>
                <button
                  type="button"
                  onClick={() => setPickMode("MEETING")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm ${
                    pickMode === "MEETING"
                      ? "bg-white text-black font-semibold"
                      : "bg-white/10 border border-white/10"
                  }`}
                >
                  MEETING
                </button>
              </div>

              {/* ✅ Date picker (calendar opens) */}
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={pickDate}
                  onChange={(e) => setPickDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPickDate(ymdLocal(new Date()))}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
                  title="Set Today"
                >
                  Today
                </button>
              </div>

              <button
                type="button"
                onClick={loadPickedContainer}
                className="mt-2 w-full px-4 py-3 rounded-2xl bg-white text-black font-semibold"
              >
                Open Container
              </button>

              <div className="mt-3 text-xs text-white/60">
                {containerLoading
                  ? "Loading..."
                  : containerData?.container
                  ? `Loaded: ${containerData.container.mode} ${containerData.container.date} • IN ${containerData.assignments.length}`
                  : "No container loaded"}
              </div>

              <div className="mt-2 max-h-[360px] overflow-auto space-y-2 pr-1">
                {containerLoading ? (
                  <div className="text-white/60 text-sm">Loading...</div>
                ) : (containerData.assignments || []).length === 0 ? (
                  <div className="text-white/60 text-sm">No cards in container.</div>
                ) : (
                  containerData.assignments.map((a) => (
                    <div
                      key={safeId(a._id)}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{a.customer?.name || "—"}</div>
                          <div className="text-xs text-white/60">
                            Roll: {a.customer?.rollNo || "—"} •{" "}
                            {a.customer?.gender || "—"} • {a.kind || "SINGLE"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => pushAssignmentToScreen(a)}
                          className="px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs"
                        >
                          Push
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold mb-3">Screen Output (Preview)</div>
              {screen?.viewCode ? (
                <ScreenViewClient
  viewCode={screen.viewCode}
  embedded
  controlScreenId={openId}
  liveMode="poll"
  pollMs={500}
/>
              ) : (
                <div className="text-white/60">No viewCode</div>
              )}
            </div>
          </div>
        )}
      </LayerModal>

      {CommitModal}
    </div>
  );
}
