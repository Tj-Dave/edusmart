interface ScoreChipProps {
  label: string;
  value?: number | null;
  denominator?: number | null;
}

const formatScore = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return Number(value).toFixed(1);
};

export default function ScoreChip({ label, value, denominator }: ScoreChipProps) {
  const hasDenominator = denominator !== null && denominator !== undefined && Number.isFinite(denominator);

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-blue-600">{label}</p>
      <p className="text-base font-semibold text-blue-900">
        {formatScore(value)}
        {hasDenominator ? ` / ${formatScore(denominator)}` : ''}
      </p>
    </div>
  );
}
