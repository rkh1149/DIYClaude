import { auth } from "@clerk/nextjs/server";
import { sql, getOwnedProject } from "@/lib/db";

const MAX_BASE64_CHARS = 4_200_000; // ~3MB file; stays under Vercel's request limit

// Upload (or replace) an attachment. One image + one document per project.
export async function POST(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { kind, filename, mime, dataBase64 } = await req.json();
  if (!["image", "document"].includes(kind)) {
    return Response.json({ error: "kind must be image or document" }, { status: 400 });
  }
  if (!filename || !mime || !dataBase64) {
    return Response.json({ error: "filename, mime, and dataBase64 are required" }, { status: 400 });
  }
  if (dataBase64.length > MAX_BASE64_CHARS) {
    return Response.json({ error: "File too large (max ~3MB)." }, { status: 413 });
  }

  await sql`
    INSERT INTO attachments (project_id, kind, filename, mime, data, summary, user_verified)
    VALUES (${id}, ${kind}, ${filename}, ${mime}, ${dataBase64}, '', false)
    ON CONFLICT (project_id, kind)
    DO UPDATE SET filename = EXCLUDED.filename, mime = EXCLUDED.mime,
                  data = EXCLUDED.data, summary = '', user_verified = false,
                  created_at = now()`;
  return Response.json({ ok: true });
}

// Update the summary text (homeowner corrections become "verified").
export async function PATCH(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { attachmentId, summary } = await req.json();
  if (!attachmentId || typeof summary !== "string") {
    return Response.json({ error: "attachmentId and summary are required" }, { status: 400 });
  }
  await sql`
    UPDATE attachments SET summary = ${summary}, user_verified = true
    WHERE id = ${attachmentId} AND project_id = ${id}`;
  return Response.json({ ok: true });
}

// Remove an attachment.
export async function DELETE(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { attachmentId } = await req.json();
  await sql`DELETE FROM attachments WHERE id = ${attachmentId} AND project_id = ${id}`;
  return Response.json({ ok: true });
}
