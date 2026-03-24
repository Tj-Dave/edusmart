import { type DragEvent } from 'react';

export interface RoadmapNodeData {
  id: string;
  sequenceNo: number;
  weekNo: number | null;
  title: string;
  status: string;
  taskCount: number;
  estimatedHours: number | null;
  keyContent?: string | null;
}

interface RoadmapNodeProps {
  node: RoadmapNodeData;
  isEditable: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetId: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; ring: string; badge: string; dot: string }> = {
  approved_active: {
    bg: 'bg-emerald-50 border-emerald-200',
    ring: 'ring-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-400',
  },
  draft: {
    bg: 'bg-white border-slate-200',
    ring: 'ring-blue-400',
    badge: 'bg-blue-50 text-blue-600',
    dot: 'bg-blue-400',
  },
  archived: {
    bg: 'bg-slate-50 border-slate-200',
    ring: 'ring-slate-300',
    badge: 'bg-slate-100 text-slate-500',
    dot: 'bg-slate-400',
  },
};

export default function RoadmapNode({
  node,
  isEditable,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: RoadmapNodeProps) {
  const style = STATUS_STYLES[node.status] ?? STATUS_STYLES.draft;

  return (
    <div
      draggable={isEditable}
      onDragStart={isEditable ? (e) => onDragStart(e, node.id) : undefined}
      onDragOver={isEditable ? (e) => onDragOver(e, node.id) : undefined}
      onDragLeave={isEditable ? onDragLeave : undefined}
      onDrop={isEditable ? (e) => onDrop(e, node.id) : undefined}
      onClick={() => onSelect(node.id)}
      title={`Click to ${isEditable ? 'edit' : 'view'} Week ${node.weekNo ?? node.sequenceNo}: ${node.title}`}
      className={[
        'relative flex w-44 flex-none cursor-pointer select-none flex-col rounded-2xl border p-3 shadow-sm transition-all duration-200',
        style.bg,
        isSelected ? `ring-2 ${style.ring}` : '',
        isDragging ? 'opacity-40 scale-95' : '',
        isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : '',
        'hover:shadow-md hover:-translate-y-0.5',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isEditable && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-red-200 bg-white text-[10px] font-bold text-red-600 shadow-sm hover:bg-red-50"
          aria-label={`Delete ${node.title}`}
          title={`Delete ${node.title}`}
        >
          X
        </button>
      )}

      {/* Week badge */}
      <div className={`mb-2 flex items-center justify-between gap-2 ${isEditable ? 'pl-5' : ''}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Week {node.weekNo ?? node.sequenceNo}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${style.badge}`}>
          {node.status === 'approved_active' ? 'Active' : node.status === 'draft' ? 'Draft' : 'Archived'}
        </span>
      </div>

      {/* Title */}
      <p className="line-clamp-2 flex-1 text-xs font-semibold leading-tight text-slate-800">
        {node.title}
      </p>

      {/* Footer stats */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        {node.estimatedHours !== null && (
          <span className="flex items-center gap-0.5">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
            {node.estimatedHours}h
          </span>
        )}
        {node.taskCount > 0 && (
          <span className="flex items-center gap-0.5">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 16 16">
              <rect x="2" y="4" width="12" height="2" rx="1" />
              <rect x="2" y="8" width="8" height="2" rx="1" />
              <rect x="2" y="12" width="10" height="2" rx="1" />
            </svg>
            {node.taskCount} task{node.taskCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Drag handle indicator */}
      {isEditable && (
        <div className="absolute right-2 top-2 flex flex-col gap-0.5 opacity-20">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-0.5">
              <div className="h-0.5 w-0.5 rounded-full bg-slate-500" />
              <div className="h-0.5 w-0.5 rounded-full bg-slate-500" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
