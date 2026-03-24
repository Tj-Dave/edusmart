import type { VisualSpecState } from './SpecVisualEditor';

interface SpecReadonlyViewProps {
  spec: VisualSpecState;
  jsonText: string;
}

const SECTION_TITLE_CLS = 'text-sm font-bold text-slate-700';
const LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500';
const VALUE_CLS = 'mt-1 text-sm text-slate-700';

const formatMultiline = (value: string) => {
  const trimmed = value.trim();
  return trimmed || 'Not provided';
};

export default function SpecReadonlyView({ spec, jsonText }: SpecReadonlyViewProps) {
  const { header, learning_outcomes, assessment_plan } = spec;

  return (
    <div className="space-y-6">
      <section>
        <h3 className={SECTION_TITLE_CLS}>Course Header</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['Course Name', header.course_name],
            ['Course Code', header.course_code],
            ['Level / Semester', header.level],
            ['Credit Units', header.credit_units],
            ['Lecture Hours', header.lectures],
            ['Practical Hours', header.practicals],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className={LABEL_CLS}>{label}</p>
              <p className={VALUE_CLS}>{String(value).trim() || 'Not provided'}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className={LABEL_CLS}>Prerequisites</p>
            <p className={VALUE_CLS}>{formatMultiline(header.prerequisites)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className={LABEL_CLS}>Description</p>
            <p className={`${VALUE_CLS} whitespace-pre-wrap`}>{formatMultiline(header.description)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className={LABEL_CLS}>Rationale</p>
            <p className={`${VALUE_CLS} whitespace-pre-wrap`}>{formatMultiline(header.rationale)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className={LABEL_CLS}>Aim</p>
            <p className={`${VALUE_CLS} whitespace-pre-wrap`}>{formatMultiline(header.aim)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className={SECTION_TITLE_CLS}>Learning Outcomes</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {learning_outcomes.length}
          </span>
        </div>
        {learning_outcomes.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
            No learning outcomes defined.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {learning_outcomes.map((clo, index) => (
              <div key={`${clo.code || 'clo'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {clo.code || `CLO${index + 1}`}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {clo.bloom_level || 'Bloom level not specified'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{formatMultiline(clo.statement)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className={SECTION_TITLE_CLS}>Assessment Plan</h3>
        {assessment_plan.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
            No assessment components defined.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Component</th>
                  <th className="px-3 py-2 text-left font-semibold">Mode</th>
                  <th className="px-3 py-2 text-center font-semibold">Week</th>
                  <th className="px-3 py-2 text-center font-semibold">Weight %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {assessment_plan.map((row, index) => (
                  <tr key={`${row.component || 'assessment'}-${index}`}>
                    <td className="px-3 py-2 text-slate-700">{row.component || 'Not provided'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.mode || 'Not provided'}</td>
                    <td className="px-3 py-2 text-center text-slate-700">{row.week ?? '-'}</td>
                    <td className="px-3 py-2 text-center text-slate-700">{row.weight_percent ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
          View Raw Spec JSON
        </summary>
        <pre className="overflow-x-auto border-t border-slate-200 px-3 py-3 text-xs text-slate-700">
          {jsonText || '{}'}
        </pre>
      </details>
    </div>
  );
}
