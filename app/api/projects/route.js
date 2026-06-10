import { auth } from "@clerk/nextjs/server";
import { sql, ensureSchema } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, title, description, zip_code, status, created_at
    FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return Response.json({ projects: rows });
}

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { title, description, zipCode, skillLevel, budgetRange, timeline } = body;
  if (!title?.trim() || !description?.trim()) {
    return Response.json({ error: "Title and description are required." }, { status: 400 });
  }
  await ensureSchema();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO projects (id, user_id, title, description, zip_code, skill_level, budget_range, timeline)
    VALUES (${id}, ${userId}, ${title.trim()}, ${description.trim()},
            ${zipCode || ""}, ${skillLevel || ""}, ${budgetRange || ""}, ${timeline || ""})`;
  return Response.json({ id });
}
