import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { sql, getOwnedProject, saveDeliverable, getAttachments } from "@/lib/db";
import { projectContext, SYSTEM_PROMPT, TYPE_PROMPTS } from "@/lib/prompts";
import { ALL_TYPES } from "@/lib/catalog";

export const maxDuration = 300;

export async function POST(req, { params }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, userId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { type, focus, instructions } = await req.json();
  if (!ALL_TYPES.includes(type)) {
    return Response.json({ error: "Unknown deliverable type" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const attachments = await getAttachments(id, { includeData: true });
  const context = projectContext(project, attachments);

  // If the user gave regeneration instructions, include them (plus the
  // previous version, when available) so the new output incorporates them.
  let revision = "";
  const userInstructions = instructions?.trim();
  if (userInstructions) {
    let prev = "";
    try {
      const { rows } = await sql`
        SELECT content FROM deliverables WHERE project_id = ${id} AND type = ${type}`;
      prev = rows[0]?.content || "";
    } catch {}
    revision = `\n\nREVISION REQUEST: The homeowner asked you to incorporate the following into this regeneration: "${userInstructions}". Treat this as a priority over any conflicting earlier assumptions.`;
    if (prev && type !== "budget") {
      revision += `\n\nPREVIOUS VERSION (revise it per the request above, keeping what still applies):\n${prev.slice(0, 12000)}`;
    }
  }

  try {
    if (type === "budget") {
      return await generateBudget(openai, model, context, id, revision);
    }
    if (type === "contractors") {
      return await generateContractors(openai, model, context, id, revision);
    }
    if (type === "design") {
      const photos = attachments.filter((a) => a.kind === "image");
      return await generateDesign(openai, model, context, id, project, revision, userInstructions, photos);
    }

    let userContent = `${context}\n\nTASK:\n${TYPE_PROMPTS[type]}`;
    if (type === "steps") {
      userContent += `\n\nSPECIFIC TASK TO DETAIL: ${focus?.trim() || "the most critical task in this project"}`;
    }
    userContent += revision;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const content = completion.choices[0].message.content;
    const data = type === "steps" ? { focus: focus?.trim() || "" } : null;
    await saveDeliverable(id, type, content, data);
    return Response.json({ content, data });
  } catch (err) {
    console.error(`generate ${type} failed:`, err);
    return Response.json(
      { error: err?.message || "Generation failed. Check your OpenAI key and billing, then try again." },
      { status: 500 }
    );
  }
}

async function generateBudget(openai, model, context, projectId, revision = "") {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nTASK:\n${TYPE_PROMPTS.budget}${revision}` },
    ],
  });

  let items = [];
  try {
    items = JSON.parse(completion.choices[0].message.content).items || [];
  } catch {
    throw new Error("Budget generation returned invalid data. Try again.");
  }

  await sql`DELETE FROM budget_items WHERE project_id = ${projectId}`;
  for (const item of items) {
    if (!item.name) continue;
    await sql`
      INSERT INTO budget_items (project_id, name, category, planned, actual)
      VALUES (${projectId}, ${String(item.name)}, ${item.category || "Other"},
              ${Number(item.planned) || 0}, 0)`;
  }
  await saveDeliverable(projectId, "budget", "Budget tracker initialized. Edit amounts in the table.");

  const { rows: budgetItems } = await sql`
    SELECT id, name, category, planned, actual FROM budget_items
    WHERE project_id = ${projectId} ORDER BY category, id`;
  return Response.json({ content: "", budgetItems });
}

async function generateContractors(openai, model, context, projectId, revision = "") {
  const input = `${SYSTEM_PROMPT}\n\n${context}\n\nTASK:\n${TYPE_PROMPTS.contractors}${revision}`;
  let content;
  try {
    const response = await openai.responses.create({
      model,
      tools: [{ type: "web_search" }],
      input,
    });
    content = response.output_text;
  } catch (e1) {
    try {
      // Older API naming
      const response = await openai.responses.create({
        model,
        tools: [{ type: "web_search_preview" }],
        input,
      });
      content = response.output_text;
    } catch (e2) {
      // Fallback: no live search — give guidance + directory links instead
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${context}\n\nTASK:\nWeb search is unavailable. List the trades this project needs, then for each trade provide direct search links the homeowner can click, formatted as Markdown links to Google Maps (https://www.google.com/maps/search/TRADE+near+ZIP), Yelp, and Angi. Include how to vet contractors (license lookup, insurance, quotes) for their state. Start with a note that live search was unavailable.`,
          },
        ],
      });
      content = completion.choices[0].message.content;
    }
  }
  await saveDeliverable(projectId, "contractors", content);
  return Response.json({ content });
}

async function generateDesign(openai, model, context, projectId, project, revision = "", userInstructions = "", photos = []) {
  // 1) Written design spec — grounded in the homeowner's photos when available
  const visionPhotos = photos.slice(0, 6); // cap to keep the request reasonable
  const specText = `${context}\n\nTASK:\n${TYPE_PROMPTS.design}${revision}${
    visionPhotos.length
      ? `\n\n${visionPhotos.length} photo(s) of the actual existing space/project are attached. Ground the design in what you can see: work with the real dimensions, constraints, and surroundings.`
      : ""
  }`;
  const userMessage = visionPhotos.length
    ? {
        role: "user",
        content: [
          { type: "text", text: specText },
          ...visionPhotos.map((p) => ({
            type: "image_url",
            image_url: { url: `data:${p.mime};base64,${p.data}` },
          })),
        ],
      }
    : { role: "user", content: specText };

  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, userMessage],
  });
  const content = completion.choices[0].message.content;

  // 2) Photorealistic renders
  const summaries = photos.map((p) => p.summary).filter(Boolean).join(" ").slice(0, 1500);
  const photoDetails = summaries ? ` Existing space details: ${summaries}` : "";
  const imagePrompt = `Photorealistic photograph of this completed home improvement project, professionally built, magazine quality, natural lighting: ${project.title}. ${project.description}${userInstructions ? `. Important design direction: ${userInstructions}` : ""}${photoDetails}`.slice(0, 3000);
  const images = [];
  try {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1536x1024",
      quality: "medium",
      n: 2,
    });
    for (const d of result.data) if (d.b64_json) images.push(d.b64_json);
  } catch (e1) {
    try {
      const result = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt.slice(0, 3900),
        size: "1792x1024",
        response_format: "b64_json",
        n: 1,
      });
      for (const d of result.data) if (d.b64_json) images.push(d.b64_json);
    } catch (e2) {
      console.error("image generation failed:", e2);
    }
  }

  const data = { images };
  await saveDeliverable(projectId, "design", content, data);
  return Response.json({
    content,
    data,
    warning: images.length ? null : "Images could not be generated (check that your OpenAI account has image access). The written design spec is ready.",
  });
}
