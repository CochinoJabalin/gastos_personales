"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import CrowdlendingTab from "@/components/CrowdlendingTab";

const TABS = [
  { key: "portfolio", label: "investments.portfolio" },
  { key: "holdings", label: "investments.holdings" },
  { key: "dividends", label: "investments.dividends" },
  { key: "operations", label: "investments.operations" },
  { key: "crowdlending", label: "investments.crowdlending.tab" },
];

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState("crowdlending");

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-md text-on-surface">{t("investments.title")}</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-[#2D3748] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-lg py-md text-body-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-on-surface-variant"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "crowdlending" ? (
        <CrowdlendingTab />
      ) : (
        <div className="flex items-center justify-center py-xl">
          <span className="text-body-md text-on-surface-variant">Próximamente</span>
        </div>
      )}
    </div>
  );
}
