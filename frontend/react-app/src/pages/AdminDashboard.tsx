import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { AdminCourse, AdminUser, adminApi, RagOverview } from '../services/api';

const cardStyle = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm';

export default function AdminDashboard() {
  const token = localStorage.getItem('auth_token') || '';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [rag, setRag] = useState<RagOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, coursesRes, ragRes] = await Promise.all([
          adminApi.getUsers(token, { limit: 500 }),
          adminApi.getCourses(token, { limit: 500 }),
          adminApi.getRagOverview(token),
        ]);
        setUsers(usersRes);
        setCourses(coursesRes);
        setRag(ragRes);
      } catch (requestError: any) {
        setError(requestError?.message || 'Failed to load admin dashboard.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  const stats = useMemo(() => {
    const activeUsers = users.filter((row) => row.is_active).length;
    const lecturers = users.filter((row) => row.role === 'lecturer').length;
    const students = users.filter((row) => row.role === 'student').length;
    const taUsers = users.filter((row) => row.role === 'teaching_assistant').length;
    const deptHeads = users.filter((row) => row.role === 'department_head').length;
    const activeCourses = courses.filter((row) => row.is_active).length;
    const ingestion = (rag?.ingestion || {}) as Record<string, unknown>;
    const totalDocs = Number(ingestion.total_documents || 0);
    const failedDocs = Number(ingestion.failed_documents || 0);

    return {
      activeUsers,
      lecturers,
      students,
      taUsers,
      deptHeads,
      activeCourses,
      totalDocs,
      failedDocs,
    };
  }, [courses, rag, users]);

  const modelConfig = useMemo(() => (rag?.model_config || {}) as Record<string, unknown>, [rag]);

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="System-level governance overview: users, catalog, and RAG infrastructure."
    >
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading dashboard...</div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className={cardStyle}>
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Users</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.activeUsers}</p>
              <p className="mt-1 text-sm text-slate-600">Total users: {users.length}</p>
            </div>
            <div className={cardStyle}>
              <p className="text-xs uppercase tracking-wide text-slate-500">Lecturers / Students</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {stats.lecturers} / {stats.students}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                TA: {stats.taUsers} | Department Heads: {stats.deptHeads}
              </p>
            </div>
            <div className={cardStyle}>
              <p className="text-xs uppercase tracking-wide text-slate-500">Course Definitions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{courses.length}</p>
              <p className="mt-1 text-sm text-slate-600">Active: {stats.activeCourses}</p>
            </div>
            <div className={cardStyle}>
              <p className="text-xs uppercase tracking-wide text-slate-500">Ingested Documents</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalDocs}</p>
              <p className="mt-1 text-sm text-slate-600">Failed: {stats.failedDocs}</p>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className={cardStyle}>
              <h2 className="text-lg font-semibold">RAG Model Config</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Configured model</dt>
                  <dd className="font-medium text-slate-800">
                    {String(modelConfig.configured_rag_model_name || 'Not configured')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Embedding strategy</dt>
                  <dd className="font-medium text-slate-800">
                    {String(modelConfig.configured_embedding_strategy || 'Not configured')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Active query model path</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-slate-800">
                    {String(modelConfig.active_query_model || 'Unknown')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Last rebuild</dt>
                  <dd className="font-medium text-slate-800">
                    {String(modelConfig.last_rebuild_at || 'Not recorded')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={cardStyle}>
              <h2 className="text-lg font-semibold">Operational Boundary</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Admin controls governance and platform configuration only.</li>
                <li>Lecturer workflows (offerings, competencies, assessments, grading) remain lecturer-owned.</li>
                <li>Student chat and enrollment flows are unchanged and remain isolated from admin modules.</li>
                <li>TA and Department Head roles are available in RBAC but have no elevated access in v1.</li>
              </ul>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
