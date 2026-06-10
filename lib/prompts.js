// Server-only: prompt builders for each deliverable type.

// Canadian postal code: A1A 1A1 (space optional). Anything else is treated as US ZIP.
export function detectLocale(code) {
  const c = (code || "").trim();
  if (/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(c)) {
    return { currency: "CAD", currencyLabel: "Canadian dollars (CDN$)", country: "Canada" };
  }
  return { currency: "USD", currencyLabel: "US dollars (US$)", country: "United States" };
}

export function projectContext(project) {
  const c = project.clarifications || {};
  const answers = c.answers
    ? Object.entries(c.answers)
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join("\n")
    : "None provided.";
  const month = new Date().toLocaleString("en-US", { month: "long" });
  const locale = detectLocale(project.zip_code);
  return `PROJECT: ${project.title}
DESCRIPTION: ${project.description}
LOCATION (ZIP/POSTAL CODE): ${project.zip_code || "not provided"} (${locale.country})
CURRENCY: ALL prices, costs, estimates, and budgets MUST be expressed in ${locale.currencyLabel}. Use pricing realistic for ${locale.country}.
HOMEOWNER SKILL LEVEL: ${project.skill_level || "not provided"}
BUDGET RANGE: ${project.budget_range || "not provided"}
DESIRED TIMELINE: ${project.timeline || "not provided"}
CURRENT MONTH: ${month}

CLARIFICATION Q&A:
${answers}`;
}

export const SYSTEM_PROMPT = `You are an expert general contractor, architect, and DIY coach helping a homeowner plan a project. Be specific, practical, and realistic about costs, time, and difficulty. Use the homeowner's skill level and budget to calibrate advice. Always note when something is dangerous or legally requires a licensed professional (gas, structural, main electrical panel, etc.). Output clean, well-structured Markdown with headings and tables where useful. Do not invent local business names unless you have searched for them.`;

export const TYPE_PROMPTS = {
  plans: `Produce a COMPLETE PROJECT PLAN: overview and goals, scope (in and out), design approach, phases with what happens in each, key decisions the homeowner must make (with recommendations), rough dimensions/layout guidance, permit flags, and success criteria. End with a "Before you start" checklist.`,

  design: `Produce a DESIGN SPECIFICATION: overall design concept and style, layout and dimensions, materials and finishes palette (with specific product examples), color scheme, lighting and hardware choices, and 2-3 design alternatives with trade-offs. Be vivid and specific — this also drives photorealistic renders.`,

  materials: `Produce an itemized MATERIALS LIST as a Markdown table with columns: Item, Specification (size/grade/type), Quantity, Est. Unit Price, Est. Total (in the currency stated in the context). Group by category. Include 10% waste factor on lumber/tile/etc. End with grand total range and money-saving substitutions.`,

  schedule: `Produce a PROJECT SCHEDULE: Markdown table with columns Task, Duration, Depends On, Who (DIY or trade), Notes. Assume work happens on weekends unless the timeline says otherwise. Include inspection/permit wait times, delivery lead times, and cure/dry times. End with total calendar estimate (optimistic/likely/pessimistic).`,

  estimate: `Produce a COST ESTIMATE comparing: (1) full DIY, (2) hybrid (DIY + hired trades for the hard parts), (3) fully contracted. For each: line-item breakdown, low/high range, and total. Use realistic current pricing for the homeowner's country and region, in the currency stated in the context. End with a recommendation given the stated budget and skill level.`,

  steps: `Produce a detailed STEP-BY-STEP GUIDE for the specific task named below. Include: tools and materials needed for just this task, prep work, numbered steps with precise detail (measurements, fastener types, techniques), photos-worth-taking checkpoints to verify quality, common errors at each step, and safety warnings inline where relevant.`,

  contractors: `You have web search. Find REAL, currently operating contractors near the homeowner's ZIP code for each trade this project needs. For each trade: 2-4 businesses with name, town, phone or website if available, and why they fit. Note license/insurance verification steps for the homeowner's state or province. End with: questions to ask when getting quotes, and a reminder to check recent reviews on Google/Yelp themselves.`,

  skill: `Produce a SKILL ASSESSMENT: break the project into phases; for each phase give a difficulty rating (1-5), verdict (DIY / DIY-with-help / Hire out) calibrated to the stated skill level, the riskiest part, and what mastery looks like. Be honest — overconfidence is the #1 cause of DIY disasters. End with a summary table.`,

  tools: `Produce a TOOLS LIST as three Markdown tables: BUY (cheap or reused often — include est. price), RENT (expensive, single-use — include typical daily rental cost from Home Depot/local rental), BORROW/OPTIONAL (nice to have). Note which tools the project absolutely cannot proceed without, and beginner-friendly model suggestions for key purchases.`,

  permits: `Produce a PERMITS & CODE CHECKLIST for this project type and location: which permits are likely required (building/electrical/plumbing/mechanical), typical cost and timeline, which work legally requires licensed trades in most jurisdictions of the homeowner's country, key code requirements (spans, spacing, clearances, GFCI, egress, etc., as relevant), inspection points and what inspectors look for, and consequences of skipping permits. Recommend confirming with the local building department and include how to find it for the given ZIP.`,

  safety: `Produce a SAFETY BRIEFING: required PPE per phase, the specific hazards of this project (tool injuries, falls, electrical, structural, dust/fumes), hidden-danger checks for older homes (asbestos pre-1980s, lead paint pre-1978, knob-and-tube wiring), emergency prep (first aid, fire extinguisher, utility shutoffs), and clear "STOP and call a pro" tripwires. Make it scannable — this may save someone a trip to the ER.`,

  weather: `Produce a WEATHER & TIMING guide: best months for this project in the homeowner's region (infer climate from ZIP), temperature/humidity constraints for concrete, paint, stain, adhesives as relevant, cure and dry times that gate the schedule, and what to do if weather turns mid-project. Consider the current month for "start now vs. wait" advice.`,

  shopping: `Produce a printable SHOPPING LIST organized by store section (Lumber, Hardware, Electrical, Plumbing, Paint, Tools, Garden, etc.) as Markdown checklists (- [ ] item — qty — est. price). Split into "Trip 1: before you start" and "Trip 2: mid-project" where sensible. End with section totals and one combined total.`,

  budget: `Generate the initial line items for a BUDGET TRACKER. Return ONLY valid JSON: {"items":[{"name":"...","category":"Materials|Tools|Rentals|Labor|Permits|Other","planned":123}]}. 10-25 items covering everything this project will cost, with realistic planned amounts in the currency stated in the context. No markdown, no commentary.`,

  mistakes: `Produce COMMON MISTAKES & PRO TIPS: the 8-12 mistakes people most often make on this exact project (each: the mistake, why it happens, the cost of getting it wrong, and how to avoid it), followed by 5-8 pro tips that make the result look professionally done. Be specific to this project, not generic DIY advice.`,

  maintenance: `Produce a MAINTENANCE PLAN for after completion: a schedule table (Task, Frequency, Season, Time required, Materials needed), early warning signs of problems and what they mean, expected lifespan of major components, and what voids warranties on installed products.`,

  videos: `Produce a VIDEO RESOURCES guide: for each major task in this project, give 2-3 specific YouTube search links formatted as [search text](https://www.youtube.com/results?search_query=URL+ENCODED+QUERY), plus well-known channels that cover this project type well. Add a one-line note on what to watch for in each search. Do not fabricate specific video titles or view counts.`,
};
