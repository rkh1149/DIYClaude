import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { sql, getOwnedProject, getAttachments } from "@/lib/db";

export const maxDuration = 300;

const IMAGE_PROMPT = `You are an expert contractor reviewing a homeowner's photo for a DIY project. Describe everything DIY-relevant you can see: the space and existing conditions, visible materials and their apparent condition, approximate dimensions you can infer (state they are estimates), problems or constraints visible (damage, wiring, plumbing, access, slope), and anything that affects planning, cost, or safety. Be concise and factual — 1-3 short paragraphs. If something is ambiguous, say so rather than guessing.`;

const DOC_PROMPT = `You are an expert contractor reviewing a document a homeowner attached to their DIY project. Summarize everything relevant to planning the project: requirements, dimensions, materials, prices/quotes, constraints, style preferences, and any instructions. Be concise — 1-3 short paragraphs plus key figures. Note anything unclear.`;

// Analyze attachments that don't yet have a summary. Returns all attachments' summaries.
export async function POST(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const attachments = await getAttachments(id, { includeData: true });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const projectInfo = `Project: ${project.title}. ${project.description}`;

  for (const a of attachments) {
    if (a.summary) continue; // already analyzed (or user-edited)
    let summary = "";
    try {
      if (a.kind === "image") {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `${IMAGE_PROMPT}\n\nContext: ${projectInfo}` },
                { type: "image_url", image_url: { url: `data:${a.mime};base64,${a.data}` } },
              ],
            },
          ],
        });
        summary = completion.choices[0].message.content;
      } else if (a.mime === "application/pdf") {
        const response = await openai.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                { type: "input_file", filename: a.filename, file_data: `data:application/pdf;base64,${a.data}` },
                { type: "input_text", text: `${DOC_PROMPT}\n\nContext: ${projectInfo}` },
              ],
            },
          ],
        });
        summary = response.output_text;
      } else {
        // Plain text / markdown document
        const text = Buffer.from(a.data, "base64").toString("utf8").slice(0, 30000);
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: "user", content: `${DOC_PROMPT}\n\nContext: ${projectInfo}\n\nDOCUMENT (${a.filename}):\n${text}` },
          ],
        });
        summary = completion.choices[0].message.content;
      }
    } catch (err) {
      console.error(`analyze ${a.kind} failed:`, err);
      summary = "";
    }
    if (summary) {
      await sql`UPDATE attachments SET summary = ${summary} WHERE id = ${a.id}`;
      a.summary = summary;
    }
  }

  return Response.json({
    attachments: attachments.map(({ id: aid, kind, filename, mime, summary, user_verified }) => ({
      id: aid, kind, filename, mime, summary, user_verified,
    })),
  });
}
