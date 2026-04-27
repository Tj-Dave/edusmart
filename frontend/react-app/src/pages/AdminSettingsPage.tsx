import { FormEvent, useEffect, useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import { InstitutionConfig, adminApi } from '../services/api';

const linesToArray = (value: string) =>
  value
    .split('\n')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export default function AdminSettingsPage() {
  const token = localStorage.getItem('auth_token') || '';
  const [config, setConfig] = useState<InstitutionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailMode, setEmailMode] = useState<'none' | 'allowlist' | 'denylist'>('none');
  const [allowedDomainsText, setAllowedDomainsText] = useState('');
  const [whitelistText, setWhitelistText] = useState('');
  const [blacklistText, setBlacklistText] = useState('');

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getInstitution(token);
      setConfig(response);
      setEmailMode(response.email_policy_mode || 'none');
      setAllowedDomainsText((response.allowed_email_domains || []).join('\n'));
      setWhitelistText((response.email_whitelist || []).join('\n'));
      setBlacklistText((response.email_blacklist || []).join('\n'));
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to load admin settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const updated = await adminApi.updateInstitution(token, {
        email_policy_mode: emailMode,
        allowed_email_domains: linesToArray(allowedDomainsText),
        email_whitelist: linesToArray(whitelistText),
        email_blacklist: linesToArray(blacklistText),
      });
      setConfig(updated);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to save email policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Settings"
      subtitle="Platform-wide policy controls for registration and system governance."
    >
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading settings...</div>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Registration Email Policy</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enforced on `/auth/register`. Use one entry per line for domains or full email addresses.
          </p>
          <form onSubmit={handleSave} className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-slate-700">Policy mode</label>
            <select
              value={emailMode}
              onChange={(event) => setEmailMode(event.target.value as 'none' | 'allowlist' | 'denylist')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
            >
              <option value="none">None</option>
              <option value="allowlist">Allowlist</option>
              <option value="denylist">Denylist</option>
            </select>

            <label className="text-sm font-medium text-slate-700">Allowed email domains</label>
            <textarea
              value={allowedDomainsText}
              onChange={(event) => setAllowedDomainsText(event.target.value)}
              rows={4}
              placeholder="example.edu"
              className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />

            <label className="text-sm font-medium text-slate-700">Whitelist (email or domain)</label>
            <textarea
              value={whitelistText}
              onChange={(event) => setWhitelistText(event.target.value)}
              rows={4}
              placeholder="dean@example.edu"
              className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />

            <label className="text-sm font-medium text-slate-700">Blacklist (email or domain)</label>
            <textarea
              value={blacklistText}
              onChange={(event) => setBlacklistText(event.target.value)}
              rows={4}
              placeholder="blocked@example.edu"
              className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />

            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Policy'}
            </button>
          </form>

          {config && (
            <div className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
              Last updated: {config.updated_at}
            </div>
          )}
        </section>
      )}
    </AdminLayout>
  );
}
