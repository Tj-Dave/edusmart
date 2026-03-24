import type { ReactNode } from 'react';

export interface WorkspaceTab {
  id: string;
  label: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTab: string;
  onChange: (nextTab: string) => void;
  rightSlot?: ReactNode;
}

export default function WorkspaceTabs({ tabs, activeTab, onChange, rightSlot }: WorkspaceTabsProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {rightSlot ? <div className="xl:ml-auto xl:mr-3">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
