"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const LayerStackContext = createContext(null);

export function LayerStackProvider({ children }) {
  const [stack, setStack] = useState([]);

  const register = useCallback((id) => {
    setStack((s) => (s.includes(id) ? s : [...s, id]));
  }, []);

  const unregister = useCallback((id) => {
    setStack((s) => (s.includes(id) ? s.filter((x) => x !== id) : s));
  }, []);

  const bringToTop = useCallback((id) => {
    setStack((s) => {
      if (!s.includes(id)) return [...s, id];
      if (s[s.length - 1] === id) return s;
      return [...s.filter((x) => x !== id), id];
    });
  }, []);

  const value = useMemo(
    () => ({ stack, register, unregister, bringToTop }),
    [stack, register, unregister, bringToTop]
  );

  return <LayerStackContext.Provider value={value}>{children}</LayerStackContext.Provider>;
}

export function useLayerStack() {
  return useContext(LayerStackContext);
}
