import { useEffect, useState } from 'react';

interface EditableFieldProps {
  value?: string | number | null;
  onSave: (nextValue: string) => Promise<void> | void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}

export default function EditableField({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const save = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`w-full rounded-xl border border-transparent px-2 py-1 text-left text-sm text-gray-700 transition hover:border-gray-200 hover:bg-gray-50 ${
          className || ''
        }`}
      >
        {value === null || value === undefined || String(value).trim().length === 0 ? (
          <span className="text-gray-400">{placeholder || 'Click to edit'}</span>
        ) : (
          String(value)
        )}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-2 ${className || ''}`}>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(String(value ?? ''));
            setEditing(false);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
