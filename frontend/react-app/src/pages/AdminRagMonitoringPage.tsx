import { FormEvent, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { RagOverview, adminApi } from '../services/api';

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AdminRagMonitoringPage() {
  const token = localStorage.getItem('auth_token') || '';
  const [overview, setOverview] = useState<RagOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modelName, setModelName] = useState('');
  const [embeddingStrategy, setEmbeddingStrategy] = useState('');
  const [requestRebuild, setRequestRebuild] = useState(false);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getRagOverview(token);
      setOverview(data);
      const modelConfig = (data.model_config || {}) as Record<string, unknown>;
      setModelName(String(modelConfig.configured_rag_model_name || ''));
      setEmbeddingStrategy(String(modelConfig.configured_embedding_strategy || ''));
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load RAG overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ingestion = useMemo(() => (overview?.ingestion || {}) as Record<string, unknown>, [overview]);
  const vectorStore = useMemo(() => (overview?.vector_store || {}) as Record<string, unknown>, [overview]);
  const infra = useMemo(() => (overview?.infrastructure || {}) as Record<string, unknown>, [overview]);

  const updateRagConfig = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await adminApi.updateRag(token, {
        rag_model_name: modelName.trim() || undefined,
        rag_embedding_strategy: embeddingStrategy.trim() || undefined,
        request_rebuild: requestRebuild,
      });
      setRequestRebuild(false);
      await loadOverview();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to update RAG configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="RAG Monitoring"
      subtitle="Monitor ingestion, vector index health, and infrastructure usage."
    >
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading RAG metrics...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Documents</p>
              <p className="mt-1 text-2xl font-semibold">{asNumber(ingestion.total_documents)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Chunks</p>
              <p className="mt-1 text-2xl font-semibold">{asNumber(ingestion.total_chunks)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Stored Vectors</p>
              <p className="mt-1 text-2xl font-semibold">{asNumber(ingestion.total_vectors)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Failed Docs</p>
              <p className="mt-1 text-2xl font-semibold">{asNumber(ingestion.failed_documents)}</p>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Index & Infrastructure</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Vector store available</dt>
                  <dd className="font-medium text-slate-800">{String(vectorStore.available || false)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Collections</dt>
                  <dd className="font-medium text-slate-800">{asNumber(vectorStore.collection_count)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Storage bytes</dt>
                  <dd className="font-medium text-slate-800">{asNumber(infra.vector_storage_bytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Disk used bytes</dt>
                  <dd className="font-medium text-slate-800">{asNumber(infra.disk_used_bytes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">CPU load (1m)</dt>
                  <dd className="font-medium text-slate-800">{String(infra.cpu_load_1m ?? 'N/A')}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">RAG Controls</h2>
              <form onSubmit={updateRagConfig} className="mt-3 grid gap-3">
                <input
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                  placeholder="Configured model name"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={embeddingStrategy}
                  onChange={(event) => setEmbeddingStrategy(event.target.value)}
                  placeholder="Embedding strategy"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={requestRebuild}
                    onChange={(event) => setRequestRebuild(event.target.checked)}
                  />
                  Request index rebuild
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? 'Updating...' : 'Apply RAG Changes'}
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
