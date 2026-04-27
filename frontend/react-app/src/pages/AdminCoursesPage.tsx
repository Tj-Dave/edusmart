import { FormEvent, useEffect, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { AdminCourse, adminApi } from '../services/api';

interface CourseFormState {
  course_code: string;
  course_name: string;
  description: string;
  department: string;
  faculty: string;
  level: string;
  credits: string;
  is_active: boolean;
}

const emptyForm: CourseFormState = {
  course_code: '',
  course_name: '',
  description: '',
  department: '',
  faculty: '',
  level: '',
  credits: '',
  is_active: true,
};

export default function AdminCoursesPage() {
  const token = localStorage.getItem('auth_token') || '';
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [editForm, setEditForm] = useState<Partial<CourseFormState>>({});
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await adminApi.getCourses(token, { limit: 500 });
      setCourses(rows);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCourse = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setCreating(true);
      setFormError(null);
      await adminApi.createCourse(token, {
        course_code: form.course_code.trim(),
        course_name: form.course_name.trim(),
        description: form.description.trim() || undefined,
        department: form.department.trim() || undefined,
        faculty: form.faculty.trim() || undefined,
        level: form.level ? Number(form.level) : undefined,
        credits: form.credits ? Number(form.credits) : undefined,
        is_active: form.is_active,
      });
      setForm(emptyForm);
      setShowCreate(false);
      await loadCourses();
    } catch (requestError: any) {
      setFormError(requestError?.message || 'Failed to create course.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCourse) return;

    try {
      setUpdating(true);
      setEditError(null);

      await adminApi.updateCourse(token, editingCourse.course_code, {
        course_name: editForm.course_name?.trim(),
        description: editForm.description?.trim() || undefined,
        department: editForm.department?.trim() || undefined,
        faculty: editForm.faculty?.trim() || undefined,
        level: editForm.level ? Number(editForm.level) : undefined,
        credits: editForm.credits ? Number(editForm.credits) : undefined,
        is_active: editForm.is_active,
      });

      setEditingCourse(null);
      setEditForm({});
      await loadCourses();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update course');
    } finally {
      setUpdating(false);
    }
  };

  const toggleCourseActive = async (course: AdminCourse) => {
    try {
      await adminApi.updateCourse(token, course.course_code, { is_active: !course.is_active });
      await loadCourses();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to update course.');
    }
  };

  const openEditCourse = (course: AdminCourse) => {
    setEditingCourse(course);
    setEditForm({
      course_code: course.course_code,
      course_name: course.course_name,
      description: course.description || '',
      department: course.department || '',
      faculty: course.faculty || '',
      level: course.level?.toString() || '',
      credits: course.credits?.toString() || '',
      is_active: course.is_active,
    });
    setEditError(null);
  };

  const removeCourse = async (courseCode: string) => {
    const confirmed = window.confirm(
      `Delete course definition "${courseCode}"? This only succeeds when no course offerings exist.`
    );
    if (!confirmed) return;

    try {
      await adminApi.deleteCourse(token, courseCode);
      await loadCourses();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to delete course.');
    }
  };

  return (
    <AdminLayout
      title="Course Definitions"
      subtitle="Manage catalog definitions only. Course offerings remain lecturer-managed."
    >
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Catalog</h2>
            <p className="text-sm text-slate-600">
              Admin can create, update, and deactivate course definitions but cannot manage offerings.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((previous) => !previous)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            {showCreate ? 'Close Form' : 'Create Course Definition'}
          </button>
        </div>
      </section>

      {showCreate && (
        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {formError && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <form onSubmit={handleCreateCourse} className="grid gap-3 md:grid-cols-3">
            <input
              required
              value={form.course_code}
              onChange={(event) => setForm((previous) => ({ ...previous, course_code: event.target.value }))}
              placeholder="Course code"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              value={form.course_name}
              onChange={(event) => setForm((previous) => ({ ...previous, course_name: event.target.value }))}
              placeholder="Course name"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.department}
              onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
              placeholder="Department"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.faculty}
              onChange={(event) => setForm((previous) => ({ ...previous, faculty: event.target.value }))}
              placeholder="Faculty"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              value={form.level}
              onChange={(event) => setForm((previous) => ({ ...previous, level: event.target.value }))}
              placeholder="Level"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={form.credits}
              onChange={(event) => setForm((previous) => ({ ...previous, credits: event.target.value }))}
              placeholder="Credits"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Description"
              className="md:col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((previous) => ({ ...previous, is_active: event.target.checked }))}
              />
              Active
            </label>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creating ? 'Saving...' : 'Save Course'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {error && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <p className="text-sm text-slate-600">Loading course definitions...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Faculty</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.course_code} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{course.course_code}</td>
                    <td className="px-2 py-2 text-slate-700">{course.course_name}</td>
                    <td className="px-2 py-2 text-slate-700">{course.department || '—'}</td>
                    <td className="px-2 py-2 text-slate-700">{course.faculty || '—'}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          course.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {course.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditCourse(course)}
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void toggleCourseActive(course)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {course.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => void removeCourse(course.course_code)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Edit Course</h2>

            {editError && (
              <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateCourse} className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={editForm.course_name || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, course_name: e.target.value }))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Course Name"
              />

              <input
                value={editForm.department || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Department"
              />

              <input
                value={editForm.faculty || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, faculty: e.target.value }))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Faculty"
              />

              <input
                value={editForm.level || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Level"
              />

              <input
                value={editForm.credits || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, credits: e.target.value }))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Credits"
              />

              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                className="md:col-span-2 rounded border px-3 py-2 text-sm"
                placeholder="Description"
              />

              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_active || false}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
