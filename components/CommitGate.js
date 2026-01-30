"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SuggestInput from "@/components/SuggestInput";

const LS_KEY = "sysbyte_commit_suggestions_v1";

function loadLocalSuggestions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocalSuggestions(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {}
}

export function useCommitGate({ defaultSuggestions = [] } = {}) {
  const resolver = useRef(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Commit required");
  const [subtitle, setSubtitle] = useState("");
  const [value, setValue] = useState("");

  const [localSuggestions, setLocalSuggestions] = useState([]);

  // ADD: portal safety (Next.js hydration safe)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setLocalSuggestions(loadLocalSuggestions());
  }, [open]);

  const suggestions = useMemo(() => {
    const merged = [...defaultSuggestions, ...localSuggestions];
    return Array.from(new Set(merged)).filter(Boolean);
  }, [defaultSuggestions, localSuggestions]);

  function requestCommit(opts = {}) {
    const {
      title = "Commit required",
      subtitle = "Please enter commit message",
      preset = "",
    } = opts;

    return new Promise((resolve, reject) => {
      resolver.current = { resolve, reject };
      setTitle(title);
      setSubtitle(subtitle);
      setValue(preset);
      setOpen(true);
    });
  }

  function closeCancel() {
    setOpen(false);
    const r = resolver.current;
    resolver.current = null;
    r?.reject?.(new Error("CANCELLED"));
  }

  function confirm() {
    const msg = String(value || "").trim();
    if (!msg) return;
    setOpen(false);
    const r = resolver.current;
    resolver.current = null;
    r?.resolve?.(msg);
  }

  function addToSuggestions() {
    const msg = String(value || "").trim();
    if (!msg) return;
    const next = Array.from(new Set([msg, ...localSuggestions]));
    setLocalSuggestions(next);
    saveLocalSuggestions(next);
  }

  const CommitModalNode = open ? (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 999999 }} // ADD: always above LayerModal
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_70px_rgba(59,130,246,0.12)] overflow-hidden">
        <div className="p-5 flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60">Commit Detector</div>
            <div className="text-xl font-bold">{title}</div>
            <div className="text-sm text-white/60 mt-1">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={closeCancel}
            className="text-2xl leading-none text-white/60 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-5">
          <SuggestInput
            dark
            allowScroll
            value={value}
            onChange={setValue}
            suggestions={suggestions}
            placeholder="Write commit message..."
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={addToSuggestions}
              className="flex-1 px-4 py-2 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition text-sm"
            >
              + Add Suggestion
            </button>
            <button
              type="button"
              disabled={!String(value || "").trim()}
              onClick={confirm}
              className="flex-1 px-4 py-2 rounded-2xl bg-white text-black font-semibold disabled:opacity-60 text-sm"
            >
              Confirm
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            Commit will be asked only when an action happens (Assign/Out/Edit/etc).
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // ADD: portal so stacking context issues never hide it
  const CommitModal =
    open && mounted ? createPortal(CommitModalNode, document.body) : null;

  return { requestCommit, CommitModal };
}
