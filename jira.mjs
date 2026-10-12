// GET /api/jira            -> epic progress data (the saved pull, kept fresh by the hourly job)
// GET /api/jira?fresh=1    -> pull from Jira now (falls back to the last saved pull if Jira is slow)
// Settings: JIRA_EMAIL and JIRA_API_TOKEN (see README). An hourly job (jira-hourly.mjs) also keeps the saved pull fresh.
import { pull, json, store, configured, MAX_AGE_MS, DEADLINE_MS } from "../lib/jira-pull.mjs";

export default async (req) => {
  if (!configured()) return json({ error: "The site's Jira settings (JIRA_EMAIL and JIRA_API_TOKEN) are not set up yet." }, 500);
  const s = store();
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const cached = await s.get("jira", { type: "json" }).catch(() => null);
  if (!fresh && cached && Date.now() - cached.at < MAX_AGE_MS) return json(cached);
  try {
    const result = await Promise.race([pull(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), DEADLINE_MS))]);
    await s.setJSON("jira", result);
    return json(result);
  } catch (err) {
    if (cached) return json({ ...cached, stale: true, message: err.message === "timeout" ? "Jira took too long; showing the last saved pull. Try Refresh again in a minute." : "Jira could not be reached (" + err.message + "); showing the last saved pull." });
    return json({ error: err.message === "timeout" ? "Jira took too long to answer. Click Refresh to try again." : err.message }, 502);
  }
};

export const config = { path: "/api/jira" };
