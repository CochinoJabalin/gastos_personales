"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { Layout } from "react-grid-layout";

interface ViewContextType {
  hideValues: boolean;
  setHideValues: (v: boolean) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  dashboardLayout: Layout[];
  setDashboardLayout: (layout: Layout[]) => void;
  saveDashboardLayout: () => void;
  resetDashboardLayout: () => void;
}

const ViewContext = createContext<ViewContextType>({
  hideValues: false,
  setHideValues: () => {},
  editMode: false,
  setEditMode: () => {},
  dashboardLayout: [],
  setDashboardLayout: () => {},
  saveDashboardLayout: () => {},
  resetDashboardLayout: () => {},
});

// Default dashboard layout configuration
const DEFAULT_DASHBOARD_LAYOUT: Layout[] = [
  { i: "balance-total", x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: "tasa-ahorro", x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: "resumen-anual", x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: "top-categorias", x: 0, y: 2, w: 6, h: 3, minW: 4, minH: 3 },
  { i: "velocidad-gasto", x: 6, y: 2, w: 6, h: 3, minW: 4, minH: 3 },
  { i: "donut-chart", x: 0, y: 5, w: 4, h: 3, minW: 3, minH: 3 },
  { i: "bar-chart", x: 4, y: 5, w: 8, h: 3, minW: 6, minH: 3 },
  { i: "gasto-fijo", x: 0, y: 8, w: 6, h: 2, minW: 4, minH: 2 },
  { i: "gasto-variable", x: 6, y: 8, w: 6, h: 2, minW: 4, minH: 2 },
  { i: "proyeccion-mes", x: 0, y: 10, w: 6, h: 3, minW: 4, minH: 3 },
  { i: "salud-financiera", x: 6, y: 10, w: 6, h: 3, minW: 4, minH: 3 },
  { i: "diversificacion", x: 0, y: 13, w: 12, h: 3, minW: 8, minH: 3 },
];

const LAYOUT_STORAGE_KEY = "dashboard-layout-v1";
const HIDE_VALUES_KEY = "hide-values";

export function ViewProvider({ children }: { children: ReactNode }) {
  const [hideValues, setHideValuesState] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dashboardLayout, setDashboardLayoutState] = useState<Layout[]>(DEFAULT_DASHBOARD_LAYOUT);

  // Load layout and hideValues from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Layout[];
        setDashboardLayoutState(parsed);
      }
      const savedHide = localStorage.getItem(HIDE_VALUES_KEY);
      if (savedHide) {
        setHideValuesState(savedHide === "true");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  const setHideValues = (v: boolean) => {
    setHideValuesState(v);
    try {
      localStorage.setItem(HIDE_VALUES_KEY, String(v));
    } catch {}
  };

  const setDashboardLayout = (layout: Layout[]) => {
    setDashboardLayoutState(layout);
  };

  const saveDashboardLayout = () => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(dashboardLayout));
    } catch (error) {
      console.error("Error saving dashboard layout:", error);
    }
  };

  const resetDashboardLayout = () => {
    setDashboardLayoutState(DEFAULT_DASHBOARD_LAYOUT);
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch (error) {
      console.error("Error resetting dashboard layout:", error);
    }
  };

  return (
    <ViewContext.Provider
      value={{
        hideValues,
        setHideValues,
        editMode,
        setEditMode,
        dashboardLayout,
        setDashboardLayout,
        saveDashboardLayout,
        resetDashboardLayout,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
