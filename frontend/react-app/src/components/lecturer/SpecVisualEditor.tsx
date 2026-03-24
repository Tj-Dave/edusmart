/** SpecVisualEditor — Visual editing panel for a CourseSpec JSON.
 * Pure component: receives spec object + onChange callback.
 * Two-way sync is handled by the parent via onChange.
 */

interface CLO {
  code: string;
  bloom_level: string;
  statement: string;
}

interface AssessmentComponent {
  component: string;
  mode: string;
  week: number | null;
  weight_percent: number;
}

interface SpecHeaderFormData {
  course_name: string;
  course_code: string;
  level: string;
  credit_units: string;
  prerequisites: string;
  description: string;
  rationale: string;
  aim: string;
  lectures: string;
  practicals: string;
}

export interface VisualSpecState {
  header: SpecHeaderFormData;
  learning_outcomes: CLO[];
  assessment_plan: AssessmentComponent[];
}

interface SpecVisualEditorProps {
  spec: VisualSpecState;
  onChange: (next: VisualSpecState) => void;
}

const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition';

const LABEL_CLS = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  rows,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {rows ? (
        <textarea
          className={INPUT_CLS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <input
          className={INPUT_CLS}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export default function SpecVisualEditor({ spec, onChange }: SpecVisualEditorProps) {
  const { header, learning_outcomes, assessment_plan } = spec;

  const setHeader = (field: keyof SpecHeaderFormData, val: string) => {
    onChange({ ...spec, header: { ...header, [field]: val } });
  };

  const setCLO = (index: number, field: keyof CLO, val: string) => {
    const next = learning_outcomes.map((clo, i) => (i === index ? { ...clo, [field]: val } : clo));
    onChange({ ...spec, learning_outcomes: next });
  };

  const addCLO = () => {
    const next = [
      ...learning_outcomes,
      { code: `CLO${learning_outcomes.length + 1}`, bloom_level: '', statement: '' },
    ];
    onChange({ ...spec, learning_outcomes: next });
  };

  const removeCLO = (index: number) => {
    onChange({ ...spec, learning_outcomes: learning_outcomes.filter((_, i) => i !== index) });
  };

  const setAssessment = (index: number, field: keyof AssessmentComponent, val: string | number | null) => {
    const next = assessment_plan.map((row, i) => (i === index ? { ...row, [field]: val } : row));
    onChange({ ...spec, assessment_plan: next });
  };

  const addAssessment = () => {
    onChange({
      ...spec,
      assessment_plan: [...assessment_plan, { component: '', mode: '', week: null, weight_percent: 0 }],
    });
  };

  const removeAssessment = (index: number) => {
    onChange({ ...spec, assessment_plan: assessment_plan.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* ─── Course Header ─────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Course Header</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Course Name" value={header.course_name} onChange={(v) => setHeader('course_name', v)} placeholder="e.g. Mobile Applications Development" />
          <Field label="Course Code" value={header.course_code} onChange={(v) => setHeader('course_code', v)} placeholder="e.g. CSC 3109" />
          <Field label="Level / Semester" value={header.level} onChange={(v) => setHeader('level', v)} placeholder="Year 3: Semester 1" />
          <Field label="Credit Units" type="number" value={header.credit_units} onChange={(v) => setHeader('credit_units', v)} placeholder="4" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Lecture Hours" type="number" value={header.lectures} onChange={(v) => setHeader('lectures', v)} placeholder="30" />
          <Field label="Practical Hours" type="number" value={header.practicals} onChange={(v) => setHeader('practicals', v)} placeholder="15" />
        </div>

        <div className="mt-3">
          <Field
            label="Prerequisites (comma-separated)"
            value={header.prerequisites}
            onChange={(v) => setHeader('prerequisites', v)}
            placeholder="Object-Oriented Programming, Database Management Systems"
          />
        </div>

        <div className="mt-3 space-y-3">
          <Field label="Description" value={header.description} onChange={(v) => setHeader('description', v)} rows={3} placeholder="Course overview…" />
          <Field label="Rationale" value={header.rationale} onChange={(v) => setHeader('rationale', v)} rows={2} placeholder="Why this course matters…" />
          <Field label="Aim" value={header.aim} onChange={(v) => setHeader('aim', v)} rows={2} placeholder="Overall learning aim…" />
        </div>
      </section>

      {/* ─── Learning Outcomes ─────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">
            Learning Outcomes
            <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
              {learning_outcomes.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={addCLO}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
          >
            + Add CLO
          </button>
        </div>

        <div className="space-y-2">
          {learning_outcomes.map((clo, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 grid grid-cols-3 gap-2">
                <input
                  className={INPUT_CLS}
                  value={clo.code}
                  onChange={(e) => setCLO(i, 'code', e.target.value)}
                  placeholder="CLO1"
                />
                <input
                  className={`${INPUT_CLS} col-span-2`}
                  value={clo.bloom_level}
                  onChange={(e) => setCLO(i, 'bloom_level', e.target.value)}
                  placeholder="Bloom's level (e.g. Application)"
                />
              </div>
              <div className="flex gap-2">
                <input
                  className={`${INPUT_CLS} flex-1`}
                  value={clo.statement}
                  onChange={(e) => setCLO(i, 'statement', e.target.value)}
                  placeholder="e.g. Build responsive multi-screen UIs…"
                />
                <button
                  type="button"
                  onClick={() => removeCLO(i)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition"
                  title="Remove this CLO"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {learning_outcomes.length === 0 && (
            <p className="text-xs text-slate-400 italic">No learning outcomes defined yet. Click "+ Add CLO" to add one.</p>
          )}
        </div>
      </section>

      {/* ─── Assessment Plan ───────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Assessment Plan</h3>
          <button
            type="button"
            onClick={addAssessment}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
          >
            + Add Component
          </button>
        </div>

        {assessment_plan.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Component</th>
                  <th className="px-3 py-2 text-left font-semibold">Mode</th>
                  <th className="px-3 py-2 text-center font-semibold w-20">Week</th>
                  <th className="px-3 py-2 text-center font-semibold w-20">Weight %</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {assessment_plan.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 focus:border-blue-300 focus:outline-none focus:bg-white"
                        value={row.component}
                        onChange={(e) => setAssessment(i, 'component', e.target.value)}
                        placeholder="e.g. Mid-Semester Exam"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 focus:border-blue-300 focus:outline-none focus:bg-white"
                        value={row.mode}
                        onChange={(e) => setAssessment(i, 'mode', e.target.value)}
                        placeholder="Project, Exam, Assignment…"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="number"
                        className="w-16 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-center focus:border-blue-300 focus:outline-none focus:bg-white"
                        value={row.week ?? ''}
                        onChange={(e) => setAssessment(i, 'week', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="number"
                        className="w-16 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-center focus:border-blue-300 focus:outline-none focus:bg-white"
                        value={row.weight_percent}
                        onChange={(e) => setAssessment(i, 'weight_percent', Number(e.target.value))}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeAssessment(i)}
                        className="rounded px-1 py-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {assessment_plan.length === 0 && (
          <p className="text-xs text-slate-400 italic">No assessment components. Click "+ Add Component" to add one.</p>
        )}

        {/* Total weight indicator */}
        {assessment_plan.length > 0 && (() => {
          const total = assessment_plan.reduce((s, r) => s + (r.weight_percent || 0), 0);
          return (
            <p className={`mt-1.5 text-right text-xs font-semibold ${total === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Total weight: {total}% {total !== 100 && '⚠ should be 100%'}
            </p>
          );
        })()}
      </section>
    </div>
  );
}
