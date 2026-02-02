"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function Screens({ session }) {
  // My screens list (creator)
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [createTitle, setCreateTitle] = useState("");

  // open creator screen
  const [openId, setOpenId] = useState(null);
  const [screen, setScreen] = useState(null);
  const [viewer, setViewer] = useState(null);

  // creator: viewCode edit controls
  const [newViewCode, setNewViewCode] = useState("");

  // container picker to push cards
  const [pickMode, setPickMode] = useState("DIKSHA");
  const [pickDate, setPickDate] = useState("");
  const [containerLoading, setContainerLoading] = useState(false);
  const [containerData, setContainerData] = useState({ container: null, assignments: [], reserved: [] });

  // player state (owner preview)
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  // viewer: view by code
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCodeActive, setViewCodeActive] = useState("");

  const { requestCommit, CommitModal } = useCommitGate({
    defaultSuggestions: [
      "Created screen",
      "Added slide",
      "Removed slide",
      "Cleared screen",
      "Updated screen settings",
      "Updated view code",
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

  async function openScreen(screenId) {
    setOpenId(screenId);
    setScreen(null);
    setViewer(null);
    setIdx(0);
    setPlaying(true);

    const res = await fetch(`/api/screens/${screenId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Load failed");
      setOpenId(null);
      return;
    }

    setScreen(data.screen);
    setViewer(data.viewer);
    setNewViewCode(data.screen?.viewCode || "");
  }

  // poll screen (so creator sees updates instantly)
  useEffect(() => {
    if (!openId) return;
    let alive = true;

    async function poll() {
      const res = await fetch(`/api/screens/${openId}`);
      const data = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) {
        setScreen(data.screen);
        setViewer(data.viewer);
        // keep input synced only if user not editing manually
      }
    }

    poll();
    const t = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [openId]);

  const canEdit = Boolean(viewer?.canEdit);
  const slides = screen?.slides || [];
  const current = slides[idx] || null;

  // auto play (creator preview)
  useEffect(() => {
    if (!slides.length) return;
    const intervalMs = Number(screen?.settings?.intervalMs || 3500);
    const autoplay = screen?.settings?.autoplay !== false;

    if (!playing || !autoplay) return;

    const t = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, intervalMs);

    return () => clearInterval(t);
  }, [slides.length, screen?.settings?.intervalMs, screen?.settings?.autoplay, playing]);

  useEffect(() => {
    if (!slides.length) setIdx(0);
    else if (idx >= slides.length) setIdx(0);
  }, [slides.length, idx]);

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
    // poll will refresh
  }

  async function loadPickedContainer() {
    if (!pickDate || !/^\d{4}-\d{2}-\d{2}$/.test(pickDate)) return alert("Date format YYYY-MM-DD");
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
      const containerId = containerObj?._id;
      if (!containerId) throw new Error("Invalid container");

      const dRes = await fetch(`/api/calander/container/${containerId}?includeReserved=1`);
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
    // If couple/family -> push whole group based on pairId (from same container list)
    const kind = (a?.kind || "SINGLE").toUpperCase();
    const pairId = safeId(a?.pairId);
    if ((kind === "COUPLE" || kind === "FAMILY") && pairId) {
      const group = (containerData.assignments || []).filter((x) => safeId(x?.pairId) === pairId);
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

    const title = info.kind === "SINGLE" ? "Push card to Screen" : `Push ${info.kind} group to Screen`;

    const commitMessage = await requestCommit({
      title,
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

    // jump to last
    setIdx(slides.length);
  }

  function openViewByCode() {
    const code = viewCodeInput.trim();
    if (!code) return alert("Enter view code");
    setViewCodeActive(code);
    setViewOpen(true);
  }

  return (
    <div>
      {/* Viewer (any user) */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">View Screen (Locked)</div>
            <div className="text-xs text-white/60">Enter viewCode to watch screen. No control.</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={viewCodeInput}
              onChange={(e) => setViewCodeInput(e.target.value)}
              placeholder="SV-XXXXXXXXXX"
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
            />
            <button
              onClick={openViewByCode}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold"
              type="button"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Creator */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">My Screens (Creator)</h2>
          <div className="text-xs text-white/60">Only you can control your screens.</div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder="New screen title..."
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
          />
          <button onClick={createScreen} className="px-3 py-2 rounded-xl bg-white text-black font-semibold" type="button">
            Create
          </button>

          <button onClick={loadList} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15" type="button">
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
                Slides: {s.slidesCount} • Code: <span className="text-white/80 font-semibold">{s.viewCode || "—"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Creator Screen Modal */}
      <LayerModal
        open={!!openId}
        layerName="Screen (Creator)"
        title={screen?.title || "Screen"}
        sub={screen?.viewCode ? `viewCode: ${screen.viewCode}` : "Loading..."}
        onClose={() => {
          setOpenId(null);
          setScreen(null);
          setViewer(null);
          setPickDate("");
          setPickMode("DIKSHA");
          setContainerData({ container: null, assignments: [], reserved: [] });
          setIdx(0);
          setPlaying(true);
        }}
        maxWidth="max-w-6xl"
      >
        {!screen ? (
          <div className="text-white/60">Loading screen...</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* LEFT: Control */}
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold">Control Panel</div>
              <div className="text-xs text-white/60 mt-1">You control. Others view by code.</div>

              {/* viewCode controls */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">VIEW CODE</div>
                <div className="text-lg font-bold">{screen.viewCode || "—"}</div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newViewCode}
                    onChange={(e) => setNewViewCode(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
                    placeholder="Set custom code (A-Z/0-9/-/_)"
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
                      await patchScreen({ action: "setViewCode", viewCode: newViewCode });
                    }}
                    className="px-3 py-2 rounded-xl bg-white text-black font-semibold"
                  >
                    Set
                  </button>
                </div>

                <div className="mt-2 flex gap-2">
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
                    Regenerate
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(screen.viewCode || "");
                        alert("Copied viewCode");
                      } catch {
                        alert("Copy failed");
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* settings */}
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                <select
                  value={String(screen.settings?.intervalMs || 3500)}
                  onChange={(e) => patchScreen({ action: "settings", settings: { ...screen.settings, intervalMs: Number(e.target.value) } })}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm"
                >
                  <option value="2000">Speed: 2s</option>
                  <option value="3500">Speed: 3.5s</option>
                  <option value="5000">Speed: 5s</option>
                  <option value="8000">Speed: 8s</option>
                </select>

                <select
                  value={screen.settings?.theme || "aurora"}
                  onChange={(e) => patchScreen({ action: "settings", settings: { ...screen.settings, theme: e.target.value } })}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm"
                >
                  <option value="aurora">Theme: Aurora</option>
                  <option value="blue">Theme: Blue</option>
                  <option value="purple">Theme: Purple</option>
                  <option value="emerald">Theme: Emerald</option>
                </select>

                <select
                  value={screen.settings?.cardStyle || "movie"}
                  onChange={(e) => patchScreen({ action: "settings", settings: { ...screen.settings, cardStyle: e.target.value } })}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm"
                >
                  <option value="movie">Card: Movie</option>
                  <option value="compact">Card: Compact</option>
                </select>

                <button
                  type="button"
                  onClick={() => setPlaying((v) => !v)}
                  className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-sm"
                >
                  {playing ? "Pause Preview" : "Play Preview"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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
                    setIdx(0);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-400/20 hover:bg-red-500/20 text-xs"
                >
                  Clear Slides
                </button>
              </div>

              {/* Container select */}
              <div className="mt-5 text-sm font-semibold">Pick Container → Push Cards</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickMode("DIKSHA")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm ${pickMode === "DIKSHA" ? "bg-white text-black font-semibold" : "bg-white/10 border border-white/10"}`}
                >
                  DIKSHA
                </button>
                <button
                  type="button"
                  onClick={() => setPickMode("MEETING")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm ${pickMode === "MEETING" ? "bg-white text-black font-semibold" : "bg-white/10 border border-white/10"}`}
                >
                  MEETING
                </button>
              </div>

              <input
                value={pickDate}
                onChange={(e) => setPickDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="mt-2 w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white outline-none"
              />

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

              <div className="mt-2 max-h-[340px] overflow-auto space-y-2 pr-1">
                {containerLoading ? (
                  <div className="text-white/60 text-sm">Loading...</div>
                ) : (containerData.assignments || []).length === 0 ? (
                  <div className="text-white/60 text-sm">No cards in container.</div>
                ) : (
                  containerData.assignments.map((a) => (
                    <div key={a._id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{a.customer?.name || "—"}</div>
                          <div className="text-xs text-white/60">
                            Roll: {a.customer?.rollNo || "—"} • {a.customer?.gender || "—"} • {a.kind || "SINGLE"}
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

              {/* Playlist */}
              <div className="mt-5 text-sm font-semibold">Playlist (Slides)</div>
              <div className="mt-2 max-h-[240px] overflow-auto space-y-2 pr-1">
                {slides.length === 0 ? (
                  <div className="text-white/60 text-sm">Blank screen. Push cards to start.</div>
                ) : (
                  slides.map((sl, i) => (
                    <div key={sl.slideId} className={`rounded-2xl border p-3 ${i === idx ? "border-blue-400/30 bg-blue-500/10" : "border-white/10 bg-black/20"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            #{i + 1} — {sl.snapshots?.[0]?.name || "—"} {sl.kind !== "SINGLE" ? `(${sl.kind} ${sl.snapshots?.length || 0})` : ""}
                          </div>
                          <div className="text-xs text-white/60">Roll: {sl.snapshots?.[0]?.rollNo || "—"}</div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => patchScreen({ action: "moveSlide", slideId: sl.slideId, dir: "up" })} className="px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-xs">↑</button>
                          <button type="button" onClick={() => patchScreen({ action: "moveSlide", slideId: sl.slideId, dir: "down" })} className="px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-xs">↓</button>
                          <button
                            type="button"
                            onClick={async () => {
                              const commitMessage = await requestCommit({
                                title: "Remove Slide",
                                subtitle: sl.snapshots?.[0]?.name || "slide",
                                preset: "Removed slide",
                              }).catch(() => null);
                              if (!commitMessage) return;
                              await patchScreen({ action: "removeSlide", slideId: sl.slideId });
                            }}
                            className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-400/20 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Preview Output (creator) */}
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-semibold">Screen Output (Preview)</div>
                  <div className="text-xs text-white/60">Viewers will see same via code</div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
                    disabled={!slides.length}
                  >
                    Prev
                  </button>

                  <button
                    type="button"
                    onClick={() => setIdx((i) => (slides.length ? (i + 1) % slides.length : 0))}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs"
                    disabled={!slides.length}
                  >
                    Next
                  </button>
                </div>
              </div>

              {!current ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                  <div className="text-2xl font-bold">Screen Blank</div>
                  <div className="text-white/60 text-sm mt-2">
                    Container se card push karo.
                  </div>
                </div>
              ) : (
                <ScreenViewClient viewCode={screen.viewCode} embedded />
              )}
            </div>
          </div>
        )}
      </LayerModal>

      {/* Viewer Modal (any user) */}
      <LayerModal
        open={viewOpen}
        layerName="View Screen"
        title="Viewer"
        sub={`Code: ${viewCodeActive}`}
        onClose={() => {
          setViewOpen(false);
          setViewCodeActive("");
        }}
        maxWidth="max-w-6xl"
      >
        <ScreenViewClient viewCode={viewCodeActive} embedded />
      </LayerModal>

      {CommitModal}
    </div>
  );
}
