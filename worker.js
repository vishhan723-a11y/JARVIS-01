
"use strict";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `
You are JARVIS-01, a natural and intelligent personal AI assistant.

PERSONALITY:
- Talk naturally like a human.
- Be friendly, intelligent and confident.
- Understand Tamil, English and Tanglish.
- Reply in the same language as the user.
- Use natural spoken Tanglish when the user uses Tanglish.
- Avoid robotic and repetitive responses.
- Remember the conversation context provided.
- Ask questions naturally when necessary.

MODES:
Friend: Casual and friendly.
Professional: Clear and respectful.
Funny: Light humour.
Motivation: Encouraging and practical.

Never claim to control devices without an actual integration.
Never invent completed actions.
`;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return reply({
        status: "online",
        assistant: "JARVIS-01",
        ai: Boolean(env.AI)
      });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return reply({ error: "POST required" }, 405);
      }

      if (!env.AI) {
        return reply({
          error: "Workers AI binding is missing."
        }, 503);
      }

      try {
        const body = await request.json();

        const message = String(body.message || "").trim();

        if (!message) {
          return reply({ error: "Message required" }, 400);
        }

        if (message.length > 3000) {
          return reply({ error: "Message too long" }, 400);
        }

        const modes = [
          "friend",
          "professional",
          "funny",
          "motivation"
        ];

        const mode = modes.includes(body.mode)
          ? body.mode
          : "friend";

        const history = Array.isArray(body.history)
          ? body.history.slice(-10)
          : [];

        const messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT +
              "\nCurrent personality mode: " + mode
          },
          ...history
            .filter(item =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
            )
            .map(item => ({
              role: item.role,
              content: item.content.slice(0, 2000)
            }))
        ];

        messages.push({
          role: "user",
          content: message
        });

        const result = await env.AI.run(MODEL, {
          messages,
          max_tokens: 700,
          temperature: 0.7
        });

        const answer =
          result.response ||
          result.output_text ||
          "";

        if (!answer) {
          return reply({
            error: "AI response unavailable"
          }, 502);
        }

        return reply({
          success: true,
          assistant: "JARVIS-01",
          reply: answer
        });

      } catch (error) {
        return reply({
          success: false,
          error: "AI processing failed. Check Worker logs."
        }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return reply({ error: "API not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
