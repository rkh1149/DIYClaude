# Family DIY Planner

A private website for family and friends. Describe any DIY project — big or small — answer a few clarifying questions, then generate any of 17 deliverables:

**Core:** Complete Plans · Design + Photorealistic Renders · Materials List · Schedule · Cost Estimate · Step-by-Step Guide (for any task you name)
**Hiring & skills:** Local Contractors (live web search) · Skill Assessment
**Prep & safety:** Tools List (buy/rent/borrow) · Permits & Code Checklist · Safety Briefing · Weather & Timing
**Shopping & budget:** Shopping List by store section · Budget Tracker (planned vs. actual, editable)
**Guidance:** Common Mistakes & Pro Tips · Maintenance Plan · Video Resources

Built with Next.js, Clerk (individual logins), OpenAI (GPT + gpt-image-1 + web search), and Postgres. Deploys on Vercel.

---

## One-time setup (~20 minutes)

### 1. Push to GitHub

```bash
cd "DIY Web Site"
git init
git add .
git commit -m "Family DIY Planner"
```

Create an empty repo on github.com (e.g., `family-diy-planner`, private is fine), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/family-diy-planner.git
git branch -M main
git push -u origin main
```

### 2. Create a Clerk app (logins)

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → Create application.
2. Name it "Family DIY Planner". Enable **Email** sign-in.
3. **Restrict who can join:** Configure → Restrictions → set sign-up mode to **Restricted**. Then invite family/friends by email under **Users → Invitations**. (Or leave it open and just don't share the URL widely.)
4. Copy the **Publishable key** and **Secret key** from the API Keys page.

### 3. Get an OpenAI API key

1. Go to [platform.openai.com](https://platform.openai.com) → API keys → Create new secret key.
2. Add billing (Settings → Billing). Set a monthly usage limit (e.g., $20) so costs can't run away.
3. For photorealistic images, gpt-image-1 may require organization verification (Settings → Organization → Verify). If unavailable, the app automatically falls back to DALL·E 3.

### 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo. Framework auto-detects as Next.js.
2. Before/after the first deploy, add Environment Variables (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `OPENAI_API_KEY` | your OpenAI key |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
   | `CLERK_SECRET_KEY` | from Clerk |

3. **Add the database:** Project → Storage → Create Database → **Neon (Postgres)** → connect to this project. This injects `POSTGRES_URL` automatically. Tables are created automatically on first use.
4. Redeploy (Deployments → ⋯ → Redeploy) so all env vars take effect.
5. Optional: increase function timeout headroom — Project → Settings → Functions → enable Fluid Compute (image + web-search generations can take 1–3 minutes).

### 5. Go live with Clerk production keys (when ready)

Test keys (`pk_test_/sk_test_`) work immediately on your vercel.app URL. For a custom domain, create a **Production** instance in Clerk, follow its DNS steps, and swap the two Clerk env vars.

---

## Inviting family & friends

Clerk dashboard → Users → Invitations → enter their email. They get a link, create a password, and can start planning projects. Each person sees only their own projects.

## Costs

- Vercel: free (Hobby tier)
- Clerk: free up to 10,000 users
- Neon Postgres: free tier is plenty
- OpenAI: pay-per-use — roughly $0.02–0.10 per text deliverable, $0.10–0.30 for designs with images, a bit more for contractor web search. A typical full project ≈ $0.50–1.50.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3000
```

## Changing the AI model

Set `OPENAI_MODEL` in Vercel env vars (defaults to `gpt-4o`). Any current OpenAI chat model works.

## How it's organized

```
app/
  page.jsx                     Dashboard (or landing page when signed out)
  new/page.jsx                 New project form
  projects/[id]/page.jsx       Clarifying questions + deliverables workspace
  api/projects/...             Create/read/update/delete projects
  api/projects/[id]/clarify    Generates clarifying questions
  api/projects/[id]/generate   Generates any deliverable (text, images, web search)
  api/projects/[id]/budget     Saves budget tracker edits
lib/
  catalog.js                   The 17 deliverable types
  prompts.js                   AI prompts per deliverable
  db.js                        Postgres schema + helpers
```
