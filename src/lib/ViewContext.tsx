"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ViewContextType {
  hideValues: boolean;
  setHideValues: (v: boolean) => void;
}

const ViewContext = createContext<ViewContextType>({
  hideValues: false,
  setHideValues: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [hideValues, setHideValues] = useState(false);
  return (
    <ViewContext.Provider value={{ hideValues, setHideValues }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
