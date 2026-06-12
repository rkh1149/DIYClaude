import { auth } from "@clerk/nextjs/server";
import { sql, getOwnedProject, getAttachments } from "@/lib/db";

export async function GET(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { rows: dRows } = await sql`
    SELECT type, content, data, created_at FROM deliverables WHERE project_id = ${id}`;
  const deliverables = {};
  for (const r of dRows) deliverables[r.type] = { content: r.content, data: r.data, createdAt: r.created_at };

  const { rows: budgetItems } = await sql`
    SELECT id, name, category, planned, actual FROM budget_items
    WHERE project_id = ${id} ORDER BY category, id`;

  // Image data included for thumbnails; document data stays server-side.
  const attachments = await getAttachments(id);

  return Response.json({ project, deliverables, budgetItems, attachments });
}

export async function PATCH(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (body.answers) {
    const clar = { ...(project.clarifications || {}), answers: body.answers };
    await sql`
      UPDATE projects SET clarifications = ${JSON.stringify(clar)}, status = 'ready'
      WHERE id = ${id}`;
  } else if (body.status) {
    await sql`UPDATE projects SET status = ${body.status} WHERE id = ${id}`;
  }
  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return Response.json({ ok: true });
}
