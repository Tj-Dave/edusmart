import { FormEvent, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { AdminRole, AdminUser, adminApi } from '../services/api';

const roleOptions: AdminRole[] = [
  'lecturer',
  'student',
  'teaching_assistant',
  'department_head',
  'admin',
];

const roleLabel: Record<AdminRole, string> = {
  admin: 'Admin',
  lecturer: 'Lecturer',
  student: 'Student',
  teaching_assistant: 'Teaching Assistant',
  department_head: 'Department Head',
};

interface CreateFormState {
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  full_name: string;
  university_id: string;
  department: string;
  faculty: string;
  program: string;
  year_of_study: string;
  phone: string;
}

const emptyCreateForm: CreateFormState = {
  username: '',
  email: '',
  password: '',
  role: 'lecturer',
  full_name: '',
  university_id: '',
  department: '',
  faculty: '',
  program: '',
  year_of_study: '',
  phone: '',
};

export default function AdminUsersPage() {
  const token = localStorage.getItem('auth_token') || '';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFormState>(emptyCreateForm);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreateFormState>>({});
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getUsers(token, {
        role: roleFilter === 'all' ? undefined : roleFilter,
        is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
        q: query.trim() || undefined,
        limit: 500,
      });
      setUsers(response);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((row) => row.is_active).length;
    const lecturers = users.filter((row) => row.role === 'lecturer').length;
    const students = users.filter((row) => row.role === 'student').length;
    return { total, active, lecturers, students };
  }, [users]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    await loadUsers();
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setCreating(true);
      setCreateError(null);
      await adminApi.createUser(token, {
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        role: form.role,
        full_name: form.full_name.trim() || undefined,
        university_id: form.university_id.trim() || undefined,
        department: form.department.trim() || undefined,
        faculty: form.faculty.trim() || undefined,
        program: form.program.trim() || undefined,
        year_of_study: form.year_of_study ? Number(form.year_of_study) : undefined,
        phone: form.phone.trim() || undefined,
      });
      setForm(emptyCreateForm);
      setShowCreate(false);
      await loadUsers();
    } catch (requestError: any) {
      setCreateError(requestError?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    try {
      setUpdating(true);
      setEditError(null);

      await adminApi.updateUser(token, editingUser.id, {
        email: editForm.email?.trim() || undefined,
        role: editForm.role as AdminRole,
        full_name: editForm.full_name?.trim() || undefined,
        university_id: editForm.university_id?.trim() || undefined,
        department: editForm.department?.trim() || undefined,
        faculty: editForm.faculty?.trim() || undefined,
        program: editForm.program?.trim() || undefined,
        year_of_study: editForm.year_of_study ? Number(editForm.year_of_study) : undefined,
        phone: editForm.phone?.trim() || undefined,
      });

      setEditingUser(null);
      setEditForm({});
      await loadUsers();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email || '',
      role: user.role,
      full_name: user.profile?.full_name || '',
      university_id: user.profile?.university_id || '',
      department: user.profile?.department || '',
      faculty: user.profile?.faculty || '',
      program: user.profile?.program || '',
      year_of_study: user.profile?.year_of_study?.toString() || '',
      phone: user.profile?.phone || '',
    });
    setEditError(null);
  };

  const toggleUserStatus = async (user: AdminUser) => {
    try {
      if (user.is_active) {
        await adminApi.deactivateUser(token, user.id);
      } else {
        await adminApi.activateUser(token, user.id);
      }
      await loadUsers();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to update user status.');
    }
  };

  return (
    <AdminLayout
      title="User Management"
      subtitle="Govern lecturers, students, and role assignments at platform level."
    >
      <section className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-semibold">{summary.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Lecturers</p>
          <p className="mt-1 text-2xl font-semibold">{summary.lecturers}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Students</p>
          <p className="mt-1 text-2xl font-semibold">{summary.students}</p>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username, email, or full name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as AdminRole | 'all')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {roleLabel[role]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">
              Apply
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((previous) => !previous)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              {showCreate ? 'Close Form' : 'Create User'}
            </button>
          </div>
        </form>
      </section>

      {showCreate && (
        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create User</h2>
          <p className="mt-1 text-sm text-slate-600">
            TA and Department Head roles are provisioned now but have no elevated endpoint access in this release.
          </p>
          {createError && <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
          <form onSubmit={handleCreateUser} className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              required
              value={form.username}
              onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
              placeholder="Username"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="Email (optional)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              minLength={6}
              type="password"
              value={form.password}
              onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              placeholder="Temporary password"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value as AdminRole }))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role]}
                </option>
              ))}
            </select>
            <input
              value={form.full_name}
              onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))}
              placeholder="Full name"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.phone}
              onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
              placeholder="Phone"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.university_id}
              onChange={(event) => setForm((previous) => ({ ...previous, university_id: event.target.value }))}
              placeholder="University ID"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.faculty}
              onChange={(event) => setForm((previous) => ({ ...previous, faculty: event.target.value }))}
              placeholder="Faculty"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.department}
              onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
              placeholder="Department"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.program}
              onChange={(event) => setForm((previous) => ({ ...previous, program: event.target.value }))}
              placeholder="Program"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.year_of_study}
              onChange={(event) => setForm((previous) => ({ ...previous, year_of_study: event.target.value }))}
              placeholder="Year of study"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {error && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <p className="text-sm text-slate-600">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Username</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{row.username}</td>
                    <td className="px-2 py-2 text-slate-700">{row.profile?.full_name || '—'}</td>
                    <td className="px-2 py-2 text-slate-700">{row.email || '—'}</td>
                    <td className="px-2 py-2 text-slate-700">{roleLabel[row.role]}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    
                    <td className="px-2 py-2">
                      <button
                        onClick={() => openEditUser(row)}
                        className="mr-2 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleUserStatus(row)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {row.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold">Edit User</h2>

              {editError && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <form onSubmit={handleUpdateUser} className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={editForm.username || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Username"
                />

                <input
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Email"
                />

                <select
                  value={editForm.role || 'student'}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as AdminRole }))}
                  className="rounded border px-3 py-2 text-sm"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel[role]}
                    </option>
                  ))}
                </select>

                <input
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Full Name"
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
                  value={editForm.program || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, program: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Program"
                />

                <input
                  value={editForm.year_of_study || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, year_of_study: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Year of Study"
                />

                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
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
      </section>
    </AdminLayout>
  );
}
