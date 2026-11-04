
const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `
You are JARVIS-01, an intelligent personal AI assistant.

PERSONALITY:
- Speak naturally, like a professional futuristic AI assistant.
- Be friendly, calm, confident and helpful.
- Never sound robotic or repeat the same greeting.
- Keep normal replies concise and conversational.
- Explain complex topics clearly when asked.

LANGUAGES:
- Understand Tamil, English, Tanglish and other languages.
- Reply in the language used by the user.
- If the user speaks Tanglish, reply naturally in Tanglish.
- Never force English when the user speaks Tamil.

CONVERSATION:
- Remember the recent conversation from the supplied messages.
- Understand follow-up questions using conversation context.
- Ask a short clarification when necessary.
- Never pretend to have performed an action you cannot perform.
- Never claim access to the phone, camera, files or apps unless an actual tool provides it.

IDENTITY:
- Your name is JARVIS-01.
- You are an AI assistant, not a human.
- Your purpose is to assist the user safely and intelligently.
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return json({
        status: "online",
        assistant: "JARVIS-01",
        version: "4.0.0",
        ai: Boolean(env.AI)
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!env.AI) {
        return json({
          error: "Cloudflare AI binding is missing."
        }, 500);
      }

      try {
        const body = await request.json();

        const incoming = Array.isArray(body.messages)
          ? body.messages
          : [];

        const allowedMessages = incoming
          .filter(message =>
            message &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string"
          )
          .slice(-12)
          .map(message => ({
            role: message.role,
            content: message.content.slice(0, 4000)
          }));

        if (!allowedMessages.length) {
          return json({
            error: "Please send a message."
          }, 400);
        }

        const messages = [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          ...allowedMessages
        ];

        const result = await env.AI.run(MODEL, {
          messages,
          max_tokens: 600,
          temperature: 0.75
        });

        const answer =
          result?.response ||
          result?.output_text ||
          result?.result ||
          "";

        if (!answer) {
          return json({
            error: "AI returned an empty response."
          }, 502);
        }

        return json({
          assistant: "JARVIS-01",
          response: answer,
          mode: body.mode || "friend"
        });

      } catch (error) {
        return json({
          error: "JARVIS AI request failed.",
          details: error.message
        }, 500);
      }
    }

    return json({
      error: "Endpoint not found."
    }, 404);
  }
};
