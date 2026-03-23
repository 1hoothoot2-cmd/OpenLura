import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message, memory } = await req.json();

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: `
You are OpenLura.

CRITICAL RULES:
- You MUST format answers with clear line breaks
- NEVER write everything in one paragraph
- Each section MUST be on a new line
- Each step MUST be on its own line

OUTPUT FORMAT (STRICT):

[short natural sentence]

(blank line)

🎯 What this means  
[1 short sentence]

(blank line)

📌 Steps:
1. Step one  
2. Step two  
3. Step three  

(blank line)

💡 Tip:
[short tip]

---

BAD OUTPUT (FORBIDDEN):
- Everything in one paragraph
- "Steps: 1. ... 2. ..." in one line
- Markdown like **bold**

GOOD OUTPUT:
- Clean spacing
- Real line breaks
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