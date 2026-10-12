import {requireFihGitHubOidc} from "./_fih-auth.js";

function rapidUrl(path, params = {}) {
  const configured = process.env.ls_api_url;
  if (!configured) throw new Error("ls_api_url missing");
  const u = new URL(/^https?:\/\//i.test(configured) ? configured : "https://" + configured);
  u.pathname = path;
  u.search = "";
  for (const [key, value] of Object.entries(params)) u.searchParams.set(key, String(value));
  return u;
}

async function liveScore(path, params) {
  const key = process.env.ls_api_key;
  if (!key) throw new Error("ls_api_key missing");
  const u = rapidUrl(path, params);
  const response = await fetch(u, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": u.hostname,
      "Accept": "application/json"
    }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); }
  catch { body = {raw: text.slice(0, 2000)}; }
  return {status: response.status, ok: response.ok, body};
}

export default async function handler(req, res) {
  if (!await requireFihGitHubOidc(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({error: "GET required"});

  const eid = String(req.query.eid || "").trim();
  if (!/^\d+$/.test(eid)) return res.status(400).json({error: "eid must be numeric"});

  try {
    const [pregameForm, h2h] = await Promise.all([
      liveScore("/matches/v2/get-pregame-form", {Category: "soccer", Eid: eid}),
      liveScore("/matches/v2/get-h2h", {Category: "soccer", Eid: eid})
    ]);
    return res.status(200).json({ok: true, eid, pregameForm, h2h});
  } catch (error) {
    return res.status(500).json({error: "LIVESCORE_STEP2_PROBE_FAILED", detail: String(error?.message || error)});
  }
}
