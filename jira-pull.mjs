// Shared Jira pull used by /api/jira and the hourly job.
// Settings (Netlify > Site configuration > Environment variables):
//   JIRA_EMAIL, JIRA_API_TOKEN  (required)   JIRA_SITE, JIRA_FILTER  (optional)
import { getStore } from "@netlify/blobs";

export const env = (k, d) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? d);
const SITE = env("JIRA_SITE", "amppf.atlassian.net");
const FILTER = env("JIRA_FILTER", "Ongoing Work For Reporting");
const TARGET_END = "customfield_10023";
const FIELDS = ["summary", "status", "issuetype", "parent", "assignee", "project", "fixVersions", "duedate", TARGET_END];
const DONE_NAMES = /^(done - complete|accepted - approved|closed|done|released)$/i;
const TESTS = /^(test|test plan|test execution)$/i;
const CANCEL = /cancel/i;
export const MAX_AGE_MS = 65 * 60 * 1000; // page loads use the saved pull while it is under ~1 hour old (the hourly job keeps it fresh)
export const DEADLINE_MS = 9000;

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function search(jql, fields) {
  const auth = "Basic " + Buffer.from(`${env("JIRA_EMAIL")}:${env("JIRA_API_TOKEN")}`).toString("base64");
  let out = [], token, guard = 0;
  do {
    const r = await fetch(`https://${SITE}/rest/api/3/search/jql`, {
      method: "POST",
      headers: { authorization: auth, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ jql, fields, maxResults: 100, ...(token ? { nextPageToken: token } : {}) }),
    });
    if (!r.ok) throw new Error(`Jira answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    out = out.concat(j.issues || []);
    token = j.isLast ? undefined : j.nextPageToken;
  } while (token && ++guard < 80);
  return out;
}
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function pool(tasks, n) { const res = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; res[k] = await tasks[k](); } })); return res; }
const rdOf = (f) => {
  const fv = (f.fixVersions || []).filter((v) => v.releaseDate).sort((a, b) => (a.releaseDate < b.releaseDate ? 1 : -1))[0];
  if (fv) return { rd: fv.releaseDate, src: "Fix version", fv: fv.name, rel: !!fv.released };
  if (f[TARGET_END]) return { rd: String(f[TARGET_END]).slice(0, 10), src: "Target end" };
  if (f.duedate) return { rd: f.duedate, src: "Due date" };
  return {};
};
const sOf = (f) => ({ s: f.status?.name || "", cat: f.status?.statusCategory?.key || "" });

export async function pull() {
  const base = await search(`filter = "${FILTER}" ORDER BY key`, FIELDS);
  const isInit = (i) => /initiative/i.test(i.fields.issuetype?.name || "");
  const inits = new Map(), epics = new Map();
  base.filter(isInit).forEach((i) => { const f = i.fields; inits.set(i.id, { id: i.id, k: i.key, n: f.summary, ...sOf(f), a: f.assignee?.displayName || null, pr: f.project?.key || i.key.split("-")[0], ...rdOf(f), f: 1 }); });
  const addEpic = (e) => {
    if (epics.has(e.id)) return; const f = e.fields;
    epics.set(e.id, { id: e.id, k: e.key, n: f.summary, ...sOf(f), a: f.assignee?.displayName || null, pr: f.project?.key || e.key.split("-")[0], pid: f.parent?.id || null, ...rdOf(f), c: [0, 0, 0, 0], cn: [0, 0, 0, 0] });
    if (f.parent && !inits.has(f.parent.id)) { const pf = f.parent.fields || {}; inits.set(f.parent.id, { id: f.parent.id, k: f.parent.key, n: pf.summary || f.parent.key, s: pf.status?.name || "", cat: pf.status?.statusCategory?.key || "", a: null, pr: f.parent.key.split("-")[0], f: 0 }); }
  };
  base.filter((i) => !isInit(i)).forEach(addEpic);
  const ik = [...inits.values()].filter((i) => i.f && !CANCEL.test(i.s)).map((i) => i.k);
  (await pool(chunks(ik, 40).map((c) => () => search(`parent in (${c.join(",")}) AND issuetype = Epic`, FIELDS)), 4)).flat().forEach(addEpic);
  const ek = [...epics.values()].filter((e) => !CANCEL.test(e.s)).map((e) => e.k);
  const kids = await pool(chunks(ek, 20).map((c) => () => search(`parent in (${c.join(",")})`, ["status", "issuetype", "parent"])), 8);
  kids.flat().forEach((ch) => {
    const f = ch.fields, e = epics.get(f.parent?.id); if (!e) return;
    const name = f.status?.name || "", cat = f.status?.statusCategory?.key || "";
    const k = CANCEL.test(name) ? 3 : DONE_NAMES.test(name) || cat === "done" ? 2 : cat === "indeterminate" ? 1 : 0;
    e.c[k]++; if (!TESTS.test(f.issuetype?.name || "")) e.cn[k]++;
  });
  return { data: { inits: [...inits.values()], epics: [...epics.values()] }, at: Date.now() };
}


export const store = () => getStore({ name: "rx", consistency: "strong" });
export const configured = () => !!(env("JIRA_EMAIL") && env("JIRA_API_TOKEN"));
