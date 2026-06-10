import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { GROUPS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Plan any DIY project, <span className="text-amber-600">big or small</span>
          </h1>
          <p className="mt-4 text-lg text-stone-600">
            Describe your project. Answer a few smart questions. Get complete plans,
            photorealistic designs, materials lists, local contractors, schedules,
            cost estimates, and step-by-step guides.
          </p>
          <div className="mt-8">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-amber-600 px-6 py-3 text-base font-semibold text-white hover:bg-amber-500">
                Sign in to get started
              </button>
            </SignInButton>
          </div>
        </div>
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.flatMap((g) => g.items).map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <h3 className="font-semibold">{item.label}</h3>
              <p className="mt-1 text-sm text-stone-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    );
  }

  let projects = [];
  let dbError = null;
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT id, title, description, zip_code, status, created_at
      FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC`;
    projects = rows;
  } catch (err) {
    dbError = err?.message || "Database not reachable.";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Link
          href="/new"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          + New Project
        </Link>
      </div>

      {dbError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Database not connected</p>
          <p className="mt-1">
            Add a Postgres database in Vercel (Storage tab → Create Database → Neon) and redeploy.
            Details in the README. Error: {dbError}
          </p>
        </div>
      )}

      {!dbError && projects.length === 0 && (
        <div className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 text-stone-600">
            Start with anything — a leaky faucet, a new deck, a basement remodel.
          </p>
          <Link
            href="/new"
            className="mt-6 inline-block rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
          >
            Create your first project
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-amber-400 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{p.title}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "clarifying"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {p.status === "clarifying" ? "Needs answers" : "Ready"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-stone-600">{p.description}</p>
            <p className="mt-3 text-xs text-stone-400">
              {new Date(p.created_at).toLocaleDateString()}
              {p.zip_code ? ` · ZIP ${p.zip_code}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
