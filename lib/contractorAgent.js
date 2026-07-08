// Server-only: agentic contractor finder built on the OpenAI Agents SDK.
// The agent searches the web, verifies every website link with a tool,
// and re-searches for replacements when a link turns out to be dead —
// so dead or wrong-trade listings get corrected during generation,
// not just stripped afterwards.

import { Agent, run, tool, webSearchTool } from "@openai/agents";
import { z } from "zod";
import { isReachable, isTrustedHost } from "./links";
import { SYSTEM_PROMPT } from "./prompts";

const verifyUrls = tool({
  name: "verify_urls",
  description:
    "Check whether website URLs are currently reachable. Returns REACHABLE or DEAD for each URL. You MUST call this on every business website before including it in your final answer.",
  parameters: z.object({
    urls: z.array(z.string()).describe("Absolute http(s) URLs to check (max 10 per call)"),
  }),
  async execute({ urls }) {
    const results = await Promise.all(
      urls.slice(0, 10).map(async (u) => {
        if (isTrustedHost(u)) return [u, "REACHABLE"];
        return [u, (await isReachable(u)) ? "REACHABLE" : "DEAD"];
      })
    );
    return JSON.stringify(Object.fromEntries(results));
  },
});

const INSTRUCTIONS = `${SYSTEM_PROMPT}

You find REAL, currently operating local contractors for a homeowner's DIY project. Follow this workflow strictly:

1. Determine which trades the project needs.
2. For each trade, use web search to find 2-3 candidate businesses near the homeowner's ZIP/postal code. Capture name, town, phone, and website exactly as shown in search results. NEVER construct, guess, or recall a URL from memory. Confirm from the search results that each business actually performs that trade.
3. Before including ANY business website in your final answer, call verify_urls on it (batch several URLs per call). If a URL comes back DEAD, either search again for that business's correct website, or replace the business with another verified candidate. If no working website can be found, list the business with name, town, and phone only.
4. After the businesses for each trade, add a "Find more:" line with these always-valid links, substituting the trade and ZIP/postal code (URL-encode spaces as +): [Google Maps](https://www.google.com/maps/search/TRADE+near+CODE) and [Yelp](https://www.yelp.com/search?find_desc=TRADE&find_loc=CODE). Also mention Angi.com (US) or HomeStars.com (Canada) by name. Do not verify these.
5. End with: license/insurance verification steps for the homeowner's state or province, questions to ask when getting quotes, and a reminder to check recent reviews and confirm each business is still operating before contacting them.

Your final answer must be clean, well-structured Markdown only — no commentary about your process or tool calls.`;

export async function runContractorAgent(model, context, revision = "") {
  const agent = new Agent({
    name: "Contractor Finder",
    model,
    instructions: INSTRUCTIONS,
    tools: [webSearchTool(), verifyUrls],
  });

  const result = await run(
    agent,
    `${context}${revision}\n\nFind and verify local contractors for this project now.`,
    { maxTurns: 25 }
  );

  const output = result.finalOutput;
  if (!output || typeof output !== "string" || !output.trim()) {
    throw new Error("Contractor agent returned no output");
  }
  return output;
}
