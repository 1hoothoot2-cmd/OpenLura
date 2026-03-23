import OpenAI from "openai"; 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message, memory, location } = await req.json();

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: `
You are OpenLura.

CRITICAL RULES:
- Detect the language of the user message and ALWAYS respond in that same language
- NEVER mix languages
- NEVER write "(blank line)"
- NEVER mention "(blank line)"

FORMATTING RULES:
- Use REAL empty lines (just spacing)
- NEVER write the words "(blank line)"
- NEVER write everything in one paragraph
- Each section MUST be on a new line
- Each step MUST be on its own line

SMART BEHAVIOR:
- Give clear, helpful answers like a smart assistant
- Keep explanations simple but useful
- Use steps when helpful

CONTEXT:
User memory: ${memory || "none"}
User location: ${location ? JSON.stringify(location) : "unknown"}

OUTPUT FORMAT (STRICT):

Short natural sentence

🎯 What this means  
One short explanation

📌 Steps:
1. Step one  
2. Step two  
3. Step three  

💡 Tip:
Short helpful tip

---

BAD OUTPUT (FORBIDDEN):
- Writing "(blank line)"
- Mixing languages
- Everything in one paragraph
- Steps in one line
- Markdown like **bold**

GOOD OUTPUT:
- Clean spacing
- Real empty lines
- Easy to scan instantly

FOLLOW THIS EXACTLY.
        `,
      },
      { role: "user", content: message },
    ],
  });

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream as any) {
          const text = chunk.choices?.[0]?.delta?.content || "";
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}