// JARVIS backend (Cloudflare Worker). Serves the web UI and POST /api/chat.
// AI runs on Cloudflare Workers AI: no API key needed, usage limits follow your Cloudflare plan.
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const RATE_LIMIT = 20; // requests per minute per IP (per Worker instance)
const hits = new Map();

const PERSONALITIES = {
  friend: "Be warm, casual and encouraging, like a close friend.",
  professional: "Be formal, precise and concise.",
  funny: "Be witty and light-hearted, but still correct.",
  motivation: "Be upbeat and motivating, and give practical next steps.",
};

function systemPrompt(personality, lang) {
  return [
    "You are JARVIS, a personal AI voice assistant. Keep answers short and clear because they are read aloud.",
    PERSONALITIES[personality] || PERSONALITIES.friend,
    "Detect the user's language. If they write English, reply in English. If they write Tamil script, reply in Tamil. If they write Tamil in English letters (Thunglish), reply in Thunglish. Do not switch languages unless the user does.",
    "Preferred speech language: " + (lang || "en-IN") + ".",
    "Never claim to have opened apps, sent messages or changed device settings. Never invent search results. If you are unsure, say so.",
  ].join(" ");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const err = (status, code, message) => json({ error: { code, message } }, status);

function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) { hits.set(ip, { count: 1, reset: now + 60000 }); return false; }
  rec.count++;
  return rec.count > RATE_LIMIT;
}

async function chat(request, env) {
  if (!env.AI) return err(503, "AI_NOT_CONFIGURED", "The AI binding is missing. Check wrangler.toml has the [ai] section.");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (limited(ip)) return err(429, "RATE_LIMIT", "Too many requests. Wait a minute and try again.");

  let data;
  try { data = await request.json(); } catch { return err(400, "BAD_REQUEST", "Request body must be valid JSON."); }

  if (!Array.isArray(data.messages) || data.messages.length === 0) return err(400, "BAD_REQUEST", "messages must be a non-empty array.");
  const messages = data.messages.slice(-MAX_MESSAGES).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
  ).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return err(400, "BAD_REQUEST", "The last message must come from the user.");

  try {
    const result = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: systemPrompt(data.personality, data.lang) }, ...messages],
      max_tokens: 400,
    });
    const reply = (result && (result.response || result.result)) || "";
    if (!reply) return err(502, "EMPTY_REPLY", "The AI returned an empty answer. Try again.");
    return json({ reply: String(reply).trim() });
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/limit|quota|capacity|neurons/i.test(msg)) return err(429, "QUOTA", "The AI usage limit for your Cloudflare plan was reached. Try later or upgrade the plan.");
    return err(502, "AI_UNAVAILABLE", "The AI service failed to answer. Try again in a moment.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, ai: !!env.AI });
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "Use POST for /api/chat.");
      return chat(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
