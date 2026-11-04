
const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const SYSTEM_PROMPT = `
You are JARVIS-01, a futuristic personal AI assistant.

PERSONALITY:
You are calm, intelligent, friendly, confident and conversational.
Speak naturally, like a helpful AI companion.
Do not sound like a customer support chatbot.
Do not repeatedly ask the user to explain.

LANGUAGE:
Understand Tamil, English and Tanglish.
Reply in the same language style as the user's latest message.
For Tanglish, use natural spoken Tamil-English.
Do not randomly switch languages.

CONVERSATION RULES:
1. Answer the exact question first.
2. Do not give generic replies to simple questions.
3. Do not ask for details when the question is already clear.
4. Remember recent conversation context.
5. Keep casual replies short and natural.
6. Give detailed explanations only when requested.
7. Avoid repeating greetings in every reply.

EXAMPLES:

User: How are you?
Assistant: I'm doing great, Commander! How are you doing?

User: Eppadi irukka JARVIS?
Assistant: Nalla irukken, Commander! Neenga eppadi irukkeenga?

User: What are you doing?
Assistant: I'm right here, ready to help you with anything.

User: Unakku enna theriyum?
Assistant: Enakku pala topics pathi help panna theriyum. Enna venum nu sollunga!

User: Thank you.
Assistant: Anytime, Commander!

User: Hey JARVIS.
Assistant: Yes, Commander. I'm listening.

IDENTITY:
Your name is JARVIS-01.
You are an AI assistant, not a human.
Never pretend to perform actions without the required tools.
Never claim access to the user's phone or apps without actual integration.

Keep your replies natural, relevant and useful.
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
        version: "5.0.0",
        ai: Boolean(env.AI)
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!env.AI) {
        return json({ error: "AI binding missing" }, 500);
      }

      try {
        const body = await request.json();

        const incoming = Array.isArray(body.messages)
          ? body.messages
          : [];

        const messages = incoming
          .filter(m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
          )
          .slice(-12)
          .map(m => ({
            role: m.role,
            content: m.content.slice(0, 4000)
          }));

        if (!messages.length) {
          return json({ error: "Message required" }, 400);
        }

        const result = await env.AI.run(MODEL, {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages
          ],
          max_tokens: 400,
          temperature: 0.65
        });

        const answer = result?.response || "";

        if (!answer) {
          return json({ error: "Empty AI response" }, 502);
        }

        return json({
          assistant: "JARVIS-01",
          response: answer.trim(),
          mode: body.mode || "friend"
        });

      } catch (error) {
        return json({
          error: "JARVIS AI error",
          details: error.message
        }, 500);
      }
    }

    return json({ error: "Endpoint not found" }, 404);
  }
};
