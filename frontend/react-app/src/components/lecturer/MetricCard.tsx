interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

export default function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}
