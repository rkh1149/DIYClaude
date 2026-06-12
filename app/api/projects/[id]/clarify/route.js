import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { sql, getOwnedProject, getAttachments } from "@/lib/db";
import { projectContext } from "@/lib/prompts";

export const maxDuration = 120;

export async function POST(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  // Return existing questions if already generated
  if (project.clarifications?.questions?.length) {
    return Response.json({ questions: project.clarifications.questions });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert contractor scoping a homeowner's DIY project. Ask the 4-6 clarifying questions whose answers most change the plan, materials, cost, or design (dimensions, existing conditions, style preferences, constraints). Don't ask about things already answered in the context. Return ONLY JSON: {\"questions\":[{\"question\":\"...\",\"hint\":\"short example answer or guidance\"}]}",
      },
      { role: "user", content: projectContext(project, await getAttachments(id, { includeData: true })) },
    ],
  });

  let questions = [];
  try {
    questions = JSON.parse(completion.choices[0].message.content).questions || [];
  } catch {
    return Response.json({ error: "Failed to generate questions. Try again." }, { status: 500 });
  }

  const clar = { ...(project.clarifications || {}), questions };
  await sql`UPDATE projects SET clarifications = ${JSON.stringify(clar)} WHERE id = ${id}`;
  return Response.json({ questions });
}
