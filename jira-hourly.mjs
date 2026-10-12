// Runs every hour on the published site and saves a fresh Jira pull,
// so the dashboard always opens with numbers no more than an hour old (Refresh still pulls on demand).
import { pull, store, configured } from "../lib/jira-pull.mjs";

export default async () => {
  if (!configured()) { console.log("Jira settings missing; skipping hourly pull"); return; }
  const result = await pull();
  await store().setJSON("jira", result);
  console.log(`Hourly Jira pull saved: ${result.data.epics.length} epics, ${result.data.inits.length} initiatives`);
};

export const config = { schedule: "@hourly" };
