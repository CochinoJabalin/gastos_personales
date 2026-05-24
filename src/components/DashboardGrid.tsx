"use client";

import { useState, useEffect, useCallback } from "react";
import { Responsive, WidthProvider, Layout, Layouts } from "react-grid-layout";

const ResponsiveGridLayout = WidthProvider(Responsive);

const STORAGE_KEY = "dashboard-grid-layouts";

interface DashboardGridProps {
  children: React.ReactNode[];
  /** Unique keys for each child widget, matching order */
  widgetKeys: string[];
  editMode: boolean;
}

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "balance", x: 0, y: 0, w: 4, h: 4 },
    { i: "savings-rate", x: 4, y: 0, w: 4, h: 4 },
    { i: "annual-summary", x: 8, y: 0, w: 4, h: 4 },
    { i: "top-categories", x: 0, y: 4, w: 6, h: 5 },
    { i: "spend-velocity", x: 6, y: 4, w: 6, h: 5 },
    { i: "donut-chart", x: 0, y: 9, w: 4, h: 6 },
    { i: "bar-chart", x: 4, y: 9, w: 8, h: 6 },
    { i: "fixed-expense", x: 0, y: 15, w: 6, h: 4 },
    { i: "variable-expense", x: 6, y: 15, w: 6, h: 4 },
    { i: "projection", x: 0, y: 19, w: 6, h: 6 },
    { i: "financial-health", x: 6, y: 19, w: 6, h: 6 },
    { i: "investments", x: 0, y: 25, w: 12, h: 10 },
  ],
  md: [
    { i: "balance", x: 0, y: 0, w: 4, h: 4 },
    { i: "savings-rate", x: 4, y: 0, w: 4, h: 4 },
    { i: "annual-summary", x: 8, y: 0, w: 4, h: 4 },
    { i: "top-categories", x: 0, y: 4, w: 6, h: 5 },
    { i: "spend-velocity", x: 6, y: 4, w: 6, h: 5 },
    { i: "donut-chart", x: 0, y: 9, w: 4, h: 6 },
    { i: "bar-chart", x: 4, y: 9, w: 8, h: 6 },
    { i: "fixed-expense", x: 0, y: 15, w: 6, h: 4 },
    { i: "variable-expense", x: 6, y: 15, w: 6, h: 4 },
    { i: "projection", x: 0, y: 19, w: 6, h: 6 },
    { i: "financial-health", x: 6, y: 19, w: 6, h: 6 },
    { i: "investments", x: 0, y: 25, w: 12, h: 10 },
  ],
  sm: [
    { i: "balance", x: 0, y: 0, w: 12, h: 4 },
    { i: "savings-rate", x: 0, y: 4, w: 12, h: 4 },
    { i: "annual-summary", x: 0, y: 8, w: 12, h: 4 },
    { i: "top-categories", x: 0, y: 12, w: 12, h: 5 },
    { i: "spend-velocity", x: 0, y: 17, w: 12, h: 5 },
    { i: "donut-chart", x: 0, y: 22, w: 12, h: 6 },
    { i: "bar-chart", x: 0, y: 28, w: 12, h: 6 },
    { i: "fixed-expense", x: 0, y: 34, w: 12, h: 4 },
    { i: "variable-expense", x: 0, y: 38, w: 12, h: 4 },
    { i: "projection", x: 0, y: 42, w: 12, h: 6 },
    { i: "financial-health", x: 0, y: 48, w: 12, h: 6 },
    { i: "investments", x: 0, y: 54, w: 12, h: 10 },
  ],
};

function getStoredLayouts(): Layouts | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function storeLayouts(layouts: Layouts) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {}
}

export default function DashboardGrid({ children, widgetKeys, editMode }: DashboardGridProps) {
  const [layouts, setLayouts] = useState<Layouts>(DEFAULT_LAYOUTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredLayouts();
    if (stored) setLayouts(stored);
    setMounted(true);
  }, []);

  const onLayoutChange = useCallback((_layout: Layout[], allLayouts: Layouts) => {
    if (editMode) {
      setLayouts(allLayouts);
      storeLayouts(allLayouts);
    }
  }, [editMode]);

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    storeLayouts(DEFAULT_LAYOUTS);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative">
      {editMode && (
        <button
          onClick={resetLayout}
          className="absolute -top-10 right-0 z-10 flex items-center gap-xs px-sm py-1 rounded-lg text-label-caps text-[10px] uppercase bg-critical/10 text-critical hover:bg-critical/20 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          Resetear layout
        </button>
      )}
      <ResponsiveGridLayout
        className={`layout ${editMode ? "edit-mode" : ""}`}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 12, sm: 12 }}
        rowHeight={40}
        margin={[16, 16]}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={onLayoutChange}
        draggableHandle=".grid-drag-handle"
        useCSSTransforms={true}
      >
        {widgetKeys.map((key, idx) => {
          const child = children[idx];
          if (!child) return null;
          return (
            <div key={key} className={`grid-widget ${editMode ? "grid-widget-edit" : ""}`}>
              {editMode && (
                <div className="grid-drag-handle">
                  <span className="material-symbols-outlined text-sm">drag_indicator</span>
                </div>
              )}
              <div className="grid-widget-content">
                {child}
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
