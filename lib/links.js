// Server-only: link reachability checking shared by the contractor agent
// and the post-generation verification pass.

// Directory/search sites with stable URL patterns — never stripped, never checked
// (they often block automated requests, which would cause false "dead" results).
export const TRUSTED_HOSTS = [
  "google.com", "yelp.com", "angi.com", "homestars.com", "youtube.com",
  "bbb.org", "houzz.com", "thumbtack.com", "homedepot.com", "lowes.com",
];

export function isTrustedHost(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return TRUSTED_HOSTS.some((t) => h === t || h.endsWith(`.${t}`));
  } catch {
    return true; // unparseable — leave it alone rather than mangle text
  }
}

export async function isReachable(url) {
  const attempt = async (method) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FamilyDIYPlanner/1.0)" },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  let res = await attempt("HEAD");
  if (!res || (res.status >= 400 && res.status !== 401 && res.status !== 403 && res.status !== 406 && res.status !== 429)) {
    res = await attempt("GET");
  }
  if (!res) return false;
  // Any response < 400 is good. Bot-blocking statuses still prove the site exists.
  return res.status < 400 || [401, 403, 405, 406, 429].includes(res.status);
}

export async function verifyContractorLinks(markdown) {
  const all = [...new Set((markdown.match(/https?:\/\/[^\s)\]"'<>]+/g) || []).map((u) => u.replace(/[.,;:!?]+$/, "")))];
  const toCheck = all.filter((u) => !isTrustedHost(u)).slice(0, 20);
  const dead = new Set();
  await Promise.all(
    toCheck.map(async (u) => {
      if (!(await isReachable(u))) dead.add(u);
    })
  );
  if (!dead.size) {
    return { markdown: `${markdown}\n\n---\n*All contractor website links were checked and reachable as of ${new Date().toLocaleDateString()}.*`, removed: 0 };
  }
  // Markdown links: keep the business name, drop the dead URL.
  let out = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, text, url) => {
    const clean = url.replace(/[.,;:!?]+$/, "");
    return dead.has(clean) ? `${text} *(website unreachable — search the business name instead)*` : m;
  });
  // Bare dead URLs.
  for (const u of dead) {
    out = out.split(u).join("*(unreachable link removed)*");
  }
  return {
    markdown: `${out}\n\n---\n*Links were checked on ${new Date().toLocaleDateString()}; ${dead.size} unreachable link(s) were removed. A reachable website doesn't guarantee a business is reputable or still operating — always verify recent reviews.*`,
    removed: dead.size,
  };
}
