"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SKILL_LEVELS = ["Beginner", "Some experience", "Confident DIYer", "Advanced / trade experience"];
const BUDGETS = ["Under $500", "$500 – $2,000", "$2,000 – $10,000", "$10,000 – $50,000", "Over $50,000", "Not sure yet"];
const TIMELINES = ["A weekend", "A few weekends", "1–3 months", "3+ months", "No deadline"];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    zipCode: "",
    skillLevel: "",
    budgetRange: "",
    timeline: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">New DIY Project</h1>
      <p className="mt-1 text-stone-600">
        Describe what you want to do. Next, you&apos;ll get a few clarifying questions to nail down the details.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium">Project name *</label>
          <input
            value={form.title}
            onChange={set("title")}
            required
            placeholder="e.g., Backyard deck, Bathroom refresh, Fix squeaky stairs"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">What do you want to do? *</label>
          <textarea
            value={form.description}
            onChange={set("description")}
            required
            rows={5}
            placeholder="Describe the project in your own words — size, what exists today, what you want it to become, style ideas, anything that matters to you."
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">ZIP code</label>
            <input
              value={form.zipCode}
              onChange={set("zipCode")}
              placeholder="For contractors, pricing & weather"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Your skill level</label>
            <select
              value={form.skillLevel}
              onChange={set("skillLevel")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {SKILL_LEVELS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Budget range</label>
            <select
              value={form.budgetRange}
              onChange={set("budgetRange")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {BUDGETS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Timeline</label>
            <select
              value={form.timeline}
              onChange={set("timeline")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {TIMELINES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Continue to clarifying questions"}
        </button>
      </form>
    </main>
  );
}
