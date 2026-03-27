type StatusTone = {
  container: string;
  label: string;
};

const STATUS_STYLE: Record<string, StatusTone> = {
  not_started: { container: 'bg-gray-100 border-gray-200', label: 'text-gray-700' },
  in_progress: { container: 'bg-blue-50 border-blue-200', label: 'text-blue-700' },
  submitted: { container: 'bg-amber-50 border-amber-200', label: 'text-amber-700' },
  ai_graded: { container: 'bg-indigo-50 border-indigo-200', label: 'text-indigo-700' },
  graded: { container: 'bg-violet-50 border-violet-200', label: 'text-violet-700' },
  finalized: { container: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-700' },
  completed: { container: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-700' },
  approved_active: { container: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-700' },
  draft: { container: 'bg-sky-50 border-sky-200', label: 'text-sky-700' },
  archived: { container: 'bg-slate-100 border-slate-200', label: 'text-slate-600' },
};

const humanize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());

interface StatusPillProps {
  status?: string | null;
}

export default function StatusPill({ status }: StatusPillProps) {
  const normalized = (status || 'not_started').toLowerCase();
  const tone = STATUS_STYLE[normalized] || STATUS_STYLE.not_started;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tone.container} ${tone.label}`}
    >
      {humanize(normalized)}
    </span>
  );
}
