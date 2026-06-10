import { createPool } from "@vercel/postgres";

const pool = createPool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export const sql = pool.sql.bind(pool);

let schemaReady;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await createTables();
      } catch (err) {
        schemaReady = null; // allow retry on next request
        throw err;
      }
    })();
  }
  return schemaReady;
}

async function createTables() {
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          zip_code TEXT DEFAULT '',
          skill_level TEXT DEFAULT '',
          budget_range TEXT DEFAULT '',
          timeline TEXT DEFAULT '',
          clarifications JSONB DEFAULT '{}'::jsonb,
          status TEXT DEFAULT 'clarifying',
          created_at TIMESTAMPTZ DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS deliverables (
          id SERIAL PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          content TEXT DEFAULT '',
          data JSONB,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE (project_id, type)
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS budget_items (
          id SERIAL PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT DEFAULT '',
          planned NUMERIC DEFAULT 0,
          actual NUMERIC DEFAULT 0
        )`;
}

export async function getOwnedProject(id, userId) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}`;
  return rows[0] || null;
}

export async function saveDeliverable(projectId, type, content, data = null) {
  await sql`
    INSERT INTO deliverables (project_id, type, content, data)
    VALUES (${projectId}, ${type}, ${content}, ${data ? JSON.stringify(data) : null})
    ON CONFLICT (project_id, type)
    DO UPDATE SET content = EXCLUDED.content, data = EXCLUDED.data, created_at = now()`;
}
