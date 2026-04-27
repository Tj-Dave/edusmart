import { FormEvent, useEffect, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { DepartmentRecord, FacultyRecord, InstitutionConfig, adminApi } from '../services/api';

const stringifyPretty = (value: unknown) => JSON.stringify(value || {}, null, 2);

export default function AdminInstitutionPage() {
  const token = localStorage.getItem('auth_token') || '';
  const [config, setConfig] = useState<InstitutionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarText, setCalendarText] = useState('{}');
  const [policyText, setPolicyText] = useState('{}');
  const [universityName, setUniversityName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyCode, setNewFacultyCode] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentCode, setNewDepartmentCode] = useState('');
  const [newDepartmentFacultyId, setNewDepartmentFacultyId] = useState('');

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getInstitution(token);
      setConfig(response);
      setUniversityName(response.university_name || '');
      setLogoUrl(response.logo_url || '');
      setCalendarText(stringifyPretty(response.academic_calendar));
      setPolicyText(stringifyPretty(response.policy));
      if (response.faculties[0]?.id) {
        setNewDepartmentFacultyId(response.faculties[0].id);
      }
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load institution configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveInstitution = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const calendar = JSON.parse(calendarText || '{}') as Record<string, unknown>;
      const policy = JSON.parse(policyText || '{}') as Record<string, unknown>;
      const updated = await adminApi.updateInstitution(token, {
        university_name: universityName.trim(),
        logo_url: logoUrl.trim() || undefined,
        academic_calendar: calendar,
        policy,
      });
      setConfig(updated);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to save institution configuration.');
    } finally {
      setSaving(false);
    }
  };

  const createFaculty = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.createFaculty(token, {
        name: newFacultyName.trim(),
        code: newFacultyCode.trim() || undefined,
      });
      setNewFacultyName('');
      setNewFacultyCode('');
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to create faculty.');
    }
  };

  const toggleFaculty = async (faculty: FacultyRecord) => {
    try {
      await adminApi.updateFaculty(token, faculty.id, { is_active: !faculty.is_active });
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to update faculty.');
    }
  };

  const deleteFaculty = async (facultyId: string) => {
    const confirmed = window.confirm('Delete this faculty and its departments?');
    if (!confirmed) return;
    try {
      await adminApi.deleteFaculty(token, facultyId);
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to delete faculty.');
    }
  };

  const createDepartment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.createDepartment(token, {
        faculty_id: newDepartmentFacultyId,
        name: newDepartmentName.trim(),
        code: newDepartmentCode.trim() || undefined,
      });
      setNewDepartmentName('');
      setNewDepartmentCode('');
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to create department.');
    }
  };

  const toggleDepartment = async (department: DepartmentRecord) => {
    try {
      await adminApi.updateDepartment(token, department.id, { is_active: !department.is_active });
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to update department.');
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    const confirmed = window.confirm('Delete this department?');
    if (!confirmed) return;
    try {
      await adminApi.deleteDepartment(token, departmentId);
      await loadConfig();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to delete department.');
    }
  };

  return (
    <AdminLayout
      title="Institution Configuration"
      subtitle="Configure identity, academic structure, and calendar at institution level."
    >
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading institution settings...</div>
      ) : (
        <>
          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Institution Profile</h2>
            <form onSubmit={saveInstitution} className="mt-3 grid gap-3">
              <input
                value={universityName}
                onChange={(event) => setUniversityName(event.target.value)}
                placeholder="University name"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="Logo URL"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="text-sm font-medium text-slate-700">Academic Calendar JSON</label>
              <textarea
                value={calendarText}
                onChange={(event) => setCalendarText(event.target.value)}
                rows={8}
                className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              />
              <label className="text-sm font-medium text-slate-700">Policy JSON</label>
              <textarea
                value={policyText}
                onChange={(event) => setPolicyText(event.target.value)}
                rows={6}
                className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Institution Config'}
              </button>
            </form>
          </section>

          <section className="mb-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Faculties</h2>
              <form onSubmit={createFaculty} className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  required
                  value={newFacultyName}
                  onChange={(event) => setNewFacultyName(event.target.value)}
                  placeholder="Faculty name"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={newFacultyCode}
                  onChange={(event) => setNewFacultyCode(event.target.value)}
                  placeholder="Code"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add Faculty</button>
              </form>

              <div className="mt-3 space-y-2">
                {(config?.faculties || []).map((faculty) => (
                  <div key={faculty.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{faculty.name}</p>
                      <p className="text-xs text-slate-600">{faculty.code || 'No code'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void toggleFaculty(faculty)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        {faculty.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => void deleteFaculty(faculty.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Departments</h2>
              <form onSubmit={createDepartment} className="mt-3 grid gap-2 sm:grid-cols-4">
                <select
                  required
                  value={newDepartmentFacultyId}
                  onChange={(event) => setNewDepartmentFacultyId(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {(config?.faculties || []).map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={newDepartmentName}
                  onChange={(event) => setNewDepartmentName(event.target.value)}
                  placeholder="Department name"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={newDepartmentCode}
                  onChange={(event) => setNewDepartmentCode(event.target.value)}
                  placeholder="Code"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Add Department</button>
              </form>

              <div className="mt-3 space-y-2">
                {(config?.departments || []).map((department) => (
                  <div key={department.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{department.name}</p>
                      <p className="text-xs text-slate-600">
                        Code: {department.code || '—'} | Faculty ID: {department.faculty_id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void toggleDepartment(department)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        {department.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => void deleteDepartment(department.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
