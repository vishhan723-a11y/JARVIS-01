
"use strict";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `
You are JARVIS-01, an intelligent personal AI assistant.

PERSONALITY:
- Speak naturally like a human assistant.
- Be friendly, intelligent, confident and helpful.
- Understand Tamil, English and Thunglish.
- Reply in the same language used by the user.
- Use natural spoken Thunglish when the user speaks Thunglish.
- Never sound robotic or repeat unnecessary phrases.
- Remember the conversation context provided to you.
- Ask questions naturally when needed.

IDENTITY:
- Your name is JARVIS-01.
- You are the user's AI assistant and friendly companion.
- Be supportive, respectful and honest.
- Never pretend to have performed an action you haven't performed.

MODES:
- friend: Casual and friendly.
- professional: Clear and respectful.
- funny: Light humour.
- motivation: Encouraging and practical.

RULES:
- Give useful and accurate answers.
- Never invent information.
- Explain technical steps clearly.
- Do not claim to control devices without an actual integration.
- Keep responses suitable for voice conversations.
- Respond naturally and conversationally.
`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function getMode(mode) {
  const modes = {
    friend: "Be casual, friendly and conversational.",
    professional: "Be professional, clear and respectful.",
    funny: "Use light, appropriate humour.",
    motivation: "Be encouraging and practical."
  };

  return modes[mode] || modes.friend;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return json({
        status: "online",
        assistant: "JARVIS-01",
        version: "1.0.0",
        ai: Boolean(env.AI),
        message: "JARVIS-01 system is ready."
      });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return json({
          error: "POST method required."
        }, 405);
      }

      if (!env.AI) {
        return json({
          error: "Workers AI binding is missing. Configure AI in Cloudflare."
        }, 503);
      }

      try {
        const body = await request.json();

        const message = String(body.message || "").trim();

        if (!message) {
          return json({
            error: "Message is required."
          }, 400);
        }

        if (message.length > 3000) {
          return json({
            error: "Message is too long. Maximum 3000 characters."
          }, 400);
        }

        const mode = String(body.mode || "friend")
          .toLowerCase();

        const history = Array.isArray(body.history)
          ? body.history.slice(-10)
          : [];

        const messages = [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              "\n\nCURRENT PERSONALITY MODE:\n" +
              getMode(mode)
          }
        ];

        for (const item of history) {
          if (
            !item ||
            !["user", "assistant"].includes(item.role) ||
            typeof item.content !== "string"
          ) {
            continue;
          }

          messages.push({
            role: item.role,
            content: item.content.slice(0, 3000)
          });
        }

        messages.push({
          role: "user",
          content: message
        });

        const result = await env.AI.run(MODEL, {
          messages,
          max_tokens: 700,
          temperature: 0.7
        });

        const answer = String(
          result.response || ""
        ).trim();

        if (!answer) {
          return json({
            error: "JARVIS could not generate a response."
          }, 502);
        }

        return json({
          status: "success",
          assistant: "JARVIS-01",
          mode,
          response: answer
        });

      } catch (error) {
        return json({
          status: "error",
          error: "JARVIS AI request failed.",
          details: String(error.message || error)
        }, 500);
      }
    }

    return json({
      error: "Endpoint not found.",
      assistant: "JARVIS-01"
    }, 404);
  }
};
