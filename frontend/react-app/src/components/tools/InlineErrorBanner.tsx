interface InlineErrorBannerProps {
  message?: string | null;
}

export default function InlineErrorBanner({ message }: InlineErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
