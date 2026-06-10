import { auth } from "@clerk/nextjs/server";
import { sql, getOwnedProject } from "@/lib/db";

export async function PUT(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { items } = await req.json();
  if (!Array.isArray(items)) {
    return Response.json({ error: "items array required" }, { status: 400 });
  }

  await sql`DELETE FROM budget_items WHERE project_id = ${id}`;
  for (const item of items) {
    if (!item.name?.trim()) continue;
    await sql`
      INSERT INTO budget_items (project_id, name, category, planned, actual)
      VALUES (${id}, ${item.name.trim()}, ${item.category || "Other"},
              ${Number(item.planned) || 0}, ${Number(item.actual) || 0})`;
  }

  const { rows } = await sql`
    SELECT id, name, category, planned, actual FROM budget_items
    WHERE project_id = ${id} ORDER BY category, id`;
  return Response.json({ budgetItems: rows });
}
