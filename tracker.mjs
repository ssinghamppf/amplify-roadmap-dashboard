// GET  /api/tracker  -> the latest uploaded Release Work Tracker workbook (404 until the first upload; the page then uses its built-in copy)
// POST /api/tracker  -> replace it. Needs header x-upload-key matching the UPLOAD_KEY environment variable.
//                       If UPLOAD_KEY is not set, uploads are turned off.
import { getStore } from "@netlify/blobs";

const env = (k, d) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? d);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "rx", consistency: "strong" });
  if (req.method === "GET") {
    const hit = await store.getWithMetadata("tracker", { type: "arrayBuffer" }).catch(() => null);
    if (!hit || !hit.data) return json({ error: "No tracker uploaded yet." }, 404);
    const m = hit.metadata || {};
    return new Response(hit.data, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cache-control": "no-store",
      "x-file-name": m.name || "", "x-file-saved": String(m.saved || ""), "x-updated-at": String(m.updatedAt || ""),
    } });
  }
  if (req.method === "POST") {
    const key = env("UPLOAD_KEY");
    if (!key) return json({ error: "Uploads are turned off for this site (UPLOAD_KEY is not set)." }, 403);
    if (req.headers.get("x-upload-key") !== key) return json({ error: "That upload key is not right." }, 403);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 10 * 1024 * 1024) return json({ error: "The file is empty or larger than 10 MB." }, 400);
    const head = new Uint8Array(buf.slice(0, 2));
    if (head[0] !== 0x50 || head[1] !== 0x4b) return json({ error: "That is not an .xlsx workbook." }, 400);
    await store.set("tracker", buf, { metadata: { name: req.headers.get("x-file-name") || "tracker.xlsx", saved: Number(req.headers.get("x-file-saved")) || Date.now(), updatedAt: Date.now() } });
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/tracker" };
