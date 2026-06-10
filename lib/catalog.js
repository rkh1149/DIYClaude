// Client-safe catalog of all deliverable types.
export const GROUPS = [
  {
    name: "Core deliverables",
    items: [
      { id: "plans", label: "Complete Plans", desc: "Full project plan: scope, phases, approach, and key decisions." },
      { id: "design", label: "Design + Renders", desc: "Written design spec plus photorealistic AI images of the finished project." },
      { id: "materials", label: "Materials List", desc: "Itemized materials with quantities and estimated prices." },
      { id: "schedule", label: "Schedule", desc: "Task sequence with durations, dependencies, and milestones." },
      { id: "estimate", label: "Cost Estimate", desc: "DIY cost vs. hire-it-out cost ranges with a breakdown." },
      { id: "steps", label: "Step-by-Step Guide", desc: "Detailed instructions for a specific task you choose." },
    ],
  },
  {
    name: "Hiring & skills",
    items: [
      { id: "contractors", label: "Local Contractors", desc: "Real local contractors by trade, found via live web search." },
      { id: "skill", label: "Skill Assessment", desc: "DIY-able vs. hire-out verdict for each phase, based on your skill level." },
    ],
  },
  {
    name: "Prep & safety",
    items: [
      { id: "tools", label: "Tools List", desc: "What to buy, rent, or borrow — with rental cost estimates." },
      { id: "permits", label: "Permits & Code", desc: "Likely permit requirements, code considerations, and inspection points." },
      { id: "safety", label: "Safety Briefing", desc: "PPE, hazards, and when to stop and call a professional." },
      { id: "weather", label: "Weather & Timing", desc: "Best season, temperature constraints, and cure/dry times." },
    ],
  },
  {
    name: "Shopping & budget",
    items: [
      { id: "shopping", label: "Shopping List", desc: "Printable checklist organized by store section." },
      { id: "budget", label: "Budget Tracker", desc: "Planned vs. actual spend you can update as you go." },
    ],
  },
  {
    name: "Guidance",
    items: [
      { id: "mistakes", label: "Mistakes & Pro Tips", desc: "What typically goes wrong on this project, and how pros avoid it." },
      { id: "maintenance", label: "Maintenance Plan", desc: "Post-completion care schedule to protect your work." },
      { id: "videos", label: "Video Resources", desc: "Curated video search links for each major task." },
    ],
  },
];

export const ALL_TYPES = GROUPS.flatMap((g) => g.items.map((i) => i.id));

export function getItem(type) {
  for (const g of GROUPS) {
    const item = g.items.find((i) => i.id === type);
    if (item) return item;
  }
  return null;
}
