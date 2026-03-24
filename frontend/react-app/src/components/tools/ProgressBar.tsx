interface ProgressBarProps {
  value?: number | null;
  label?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function ProgressBar({ value, label }: ProgressBarProps) {
  const normalized = clamp(Number.isFinite(value) ? Number(value) : 0);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>{label || 'Completion'}</span>
        <span>{normalized.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
