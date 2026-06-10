"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GROUPS, getItem } from "@/lib/catalog";

export default function ProjectPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null); // { project, deliverables, budgetItems }
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      setError(res.status === 404 ? "Project not found." : "Failed to load project.");
      return;
    }
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-stone-600">{error}</main>;
  if (!data) return <Loading text="Loading project…" />;

  if (data.project.status === "clarifying") {
    return <ClarifyView id={id} project={data.project} onDone={load} />;
  }
  return <Workspace id={id} data={data} setData={setData} router={router} />;
}

function Loading({ text }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600" />
      <p className="mt-4 text-stone-600">{text}</p>
    </main>
  );
}

/* ------------------------- Clarification step ------------------------- */

function ClarifyView({ id, project, onDone }) {
  const [questions, setQuestions] = useState(project.clarifications?.questions || null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fetched = useRef(false);

  useEffect(() => {
    if (questions || fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}/clarify`, { method: "POST" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to generate questions.");
        setQuestions(d.questions);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id, questions]);

  async function submit(skip = false) {
    setBusy(true);
    setError("");
    try {
      const payload = skip ? { answers: { skipped: "User chose to skip clarification." } } : { answers };
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save answers.");
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (error && !questions) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => { fetched.current = false; setError(""); setQuestions(null); }}
          className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
      </main>
    );
  }
  if (!questions) return <Loading text="Preparing a few clarifying questions…" />;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">{project.title}</h1>
      <p className="mt-2 text-stone-600">
        A few quick questions to make your plans, estimates, and designs accurate. Answer what you can — skip anything you&apos;re unsure about.
      </p>

      <div className="mt-8 space-y-6">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="block font-medium">{q.question}</label>
            {q.hint && <p className="mt-0.5 text-sm text-stone-500">{q.hint}</p>}
            <textarea
              rows={2}
              value={answers[q.question] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.question]: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => submit(false)}
          disabled={busy}
          className="flex-1 rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save answers & continue"}
        </button>
        <button
          onClick={() => submit(true)}
          disabled={busy}
          className="rounded-lg border border-stone-300 px-5 py-3 text-stone-600 hover:bg-stone-100 disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </main>
  );
}

/* --------------------------- Main workspace --------------------------- */

function Workspace({ id, data, setData, router }) {
  const { project, deliverables, budgetItems } = data;
  const [active, setActive] = useState("plans");
  const [generating, setGenerating] = useState({});
  const [stepsFocus, setStepsFocus] = useState(deliverables.steps?.data?.focus || "");
  const [error, setError] = useState("");

  const item = getItem(active);
  const current = deliverables[active];
  const isDone = (type) => !!data.deliverables[type] || (type === "budget" && budgetItems.length > 0);

  async function generate(type) {
    setError("");
    setGenerating((g) => ({ ...g, [type]: true }));
    try {
      const res = await fetch(`/api/projects/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, focus: type === "steps" ? stepsFocus : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Generation failed.");
      setData((prev) => ({
        ...prev,
        deliverables: {
          ...prev.deliverables,
          [type]: { content: d.content, data: d.data || null },
        },
        budgetItems: d.budgetItems || prev.budgetItems,
      }));
      if (d.warning) setError(d.warning);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating((g) => ({ ...g, [type]: false }));
    }
  }

  async function deleteProject() {
    if (!confirm("Delete this project and everything generated for it?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">{project.description}</p>
          <p className="mt-1 text-xs text-stone-400">
            {project.zip_code && `ZIP ${project.zip_code} · `}
            {project.skill_level && `${project.skill_level} · `}
            {project.budget_range}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Print
          </button>
          <button
            onClick={deleteProject}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <nav className="no-print w-full shrink-0 lg:w-64">
          {GROUPS.map((group) => (
            <div key={group.name} className="mb-4">
              <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                {group.name}
              </h3>
              {group.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActive(it.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                    active === it.id ? "bg-amber-100 font-medium text-amber-900" : "hover:bg-stone-100"
                  }`}
                >
                  <span>{it.label}</span>
                  {generating[it.id] ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-stone-400 border-t-transparent" />
                  ) : isDone(it.id) ? (
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <section className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white p-6">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{item.label}</h2>
              <p className="text-sm text-stone-500">{item.desc}</p>
            </div>
            {active !== "budget" || budgetItems.length === 0 ? (
              <button
                onClick={() => generate(active)}
                disabled={!!generating[active]}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {generating[active] ? "Generating…" : current || isDone(active) ? "Regenerate" : "Generate"}
              </button>
            ) : (
              <button
                onClick={() => generate("budget")}
                disabled={!!generating.budget}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
              >
                {generating.budget ? "Regenerating…" : "Regenerate line items"}
              </button>
            )}
          </div>

          {active === "steps" && (
            <div className="no-print mt-4">
              <label className="block text-sm font-medium">Which task do you want detailed steps for?</label>
              <input
                value={stepsFocus}
                onChange={(e) => setStepsFocus(e.target.value)}
                placeholder="e.g., Setting the deck posts, Tiling the shower wall (leave blank for the most critical task)"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

          {generating[active] && (
            <p className="mt-6 text-sm text-stone-500">
              Working on it — this usually takes 30–90 seconds…
            </p>
          )}

          <div className="mt-6">
            {active === "budget" ? (
              <BudgetTable id={id} items={budgetItems} setData={setData} />
            ) : current ? (
              <>
                {active === "design" && current.data?.images?.length > 0 && (
                  <div className="mb-6 grid gap-4 sm:grid-cols-2">
                    {current.data.images.map((b64, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={`data:image/png;base64,${b64}`}
                        alt={`Design render ${i + 1}`}
                        className="w-full rounded-lg border border-stone-200"
                      />
                    ))}
                  </div>
                )}
                <article className="prose prose-stone max-w-none prose-table:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.content}</ReactMarkdown>
                </article>
              </>
            ) : (
              !generating[active] && (
                <p className="py-12 text-center text-stone-400">
                  Nothing generated yet. Click <span className="font-medium">Generate</span> above.
                </p>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------------------------- Budget tracker ---------------------------- */

function BudgetTable({ id, items, setData }) {
  const [rows, setRows] = useState(items);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setRows(items), [items]);

  if (!rows.length) {
    return (
      <p className="py-12 text-center text-stone-400">
        Click <span className="font-medium">Generate</span> to create budget line items for this project.
      </p>
    );
  }

  const update = (i, key, value) => {
    setSaved(false);
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  };
  const addRow = () => setRows((r) => [...r, { name: "", category: "Other", planned: 0, actual: 0 }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const totals = rows.reduce(
    (t, r) => ({ planned: t.planned + (Number(r.planned) || 0), actual: t.actual + (Number(r.actual) || 0) }),
    { planned: 0, actual: 0 }
  );
  const fmt = (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const d = await res.json();
      if (res.ok) {
        setData((prev) => ({ ...prev, budgetItems: d.budgetItems }));
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="py-2 pr-2 font-medium">Category</th>
              <th className="py-2 pr-2 font-medium">Planned</th>
              <th className="py-2 pr-2 font-medium">Actual</th>
              <th className="no-print" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="py-1.5 pr-2">
                  <input
                    value={row.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    className="w-full rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.category || ""}
                    onChange={(e) => update(i, "category", e.target.value)}
                    className="w-28 rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    value={row.planned}
                    onChange={(e) => update(i, "planned", e.target.value)}
                    className="w-24 rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    value={row.actual}
                    onChange={(e) => update(i, "actual", e.target.value)}
                    className="w-24 rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </td>
                <td className="no-print py-1.5">
                  <button onClick={() => removeRow(i)} className="text-stone-300 hover:text-red-500" title="Remove">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-2">Total</td>
              <td />
              <td className="py-2 pr-2">{fmt(totals.planned)}</td>
              <td className={`py-2 pr-2 ${totals.actual > totals.planned ? "text-red-600" : ""}`}>
                {fmt(totals.actual)}
              </td>
              <td className="no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="no-print mt-4 flex items-center gap-3">
        <button onClick={addRow} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">
          + Add row
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
