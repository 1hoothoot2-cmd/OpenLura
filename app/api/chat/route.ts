import OpenAI from "openai"; 

let globalFeedback: any[] = [];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getRecentServerFeedback() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return [];

  try {
    const res = await fetch(
            `${supabaseUrl}/rest/v1/openlura_feedback?select=type,message,userMessage,source,timestamp&order=timestamp.desc&limit=30`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error(
        "OpenLura server feedback fetch failed:",
        res.status,
        await res.text()
      );
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error("OpenLura server feedback fetch error:", error);
    return [];
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message, memory, location, feedback } = await req.json();
   const serverFeedback = await getRecentServerFeedback();

    const normalizedServerFeedback = serverFeedback.map((item: any) => ({
    type: item.type,
    message: item.message,
    userMessage: item.userMessage,
    source: item.source,
    timestamp: item.timestamp,
  }));

    const clientFeedback = feedback
    ? [
        {
          type: "up",
          message,
          userMessage: "",
          timestamp: Date.now(),
          weight: feedback.likes || 0,
        },
        {
          type: "down",
          message: (feedback.issues || []).join(" | "),
          userMessage: (feedback.recentIssues || []).join(" | "),
          timestamp: Date.now(),
          weight: feedback.dislikes || 0,
        },
      ].filter(
        (item: any) =>
          (item.type === "up" && item.weight > 0) ||
          (item.type === "down" &&
            (item.weight > 0 || item.message || item.userMessage))
      )
    : [];

        const effectiveFeedback = [
    ...normalizedServerFeedback.filter(
      (item: any) =>
        item.type === "up" ||
        item.type === "down" ||
        item.type === "improve" ||
        item.source === "idea_feedback_learning"
    ),
    ...clientFeedback,
  ];
  const feedbackLikes = effectiveFeedback.filter(
    (f: any) => f.type === "up"
  ).length;

  const feedbackDislikes = effectiveFeedback.filter(
    (f: any) => f.type === "down"
  ).length;

    const feedbackRecentIssues = effectiveFeedback
    .filter(
      (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
    )
    .map((f: any) => f.userMessage || f.message)
    .filter(Boolean)
    .slice(0, 5);

  const feedbackContext =
    effectiveFeedback.length > 0
      ? `
Likes: ${feedbackLikes}
Dislikes: ${feedbackDislikes}

Recent issues:
${feedbackRecentIssues.join("\n") || "none"}
`
      : "none";

  globalFeedback = effectiveFeedback;

    const completedFeedback = effectiveFeedback.filter(
    (f: any) =>
      f.type === "workflow_status" &&
      f.source === "analytics_workflow" &&
      f.message === "klaar"
  );

  const negativeFeedbackTexts = effectiveFeedback
    .filter((f: any) => f.type === "down" || f.type === "improve")
    .map((f: any) => `${f.userMessage || ""} ${f.message || ""}`.toLowerCase())
    .join(" ");

    const detectedFeedbackPatterns = [
    {
      label: "Users prefer shorter answers",
      active:
        negativeFeedbackTexts.includes("korter") ||
        negativeFeedbackTexts.includes("te lang") ||
        negativeFeedbackTexts.includes("too long") ||
        negativeFeedbackTexts.includes("shorter"),
    },
    {
      label: "Users want clearer explanations",
      active:
        negativeFeedbackTexts.includes("duidelijker") ||
        negativeFeedbackTexts.includes("onduidelijk") ||
        negativeFeedbackTexts.includes("clearer") ||
        negativeFeedbackTexts.includes("unclear"),
    },
    {
      label: "Users want more depth or context",
      active:
        negativeFeedbackTexts.includes("meer context") ||
        negativeFeedbackTexts.includes("te oppervlakkig") ||
        negativeFeedbackTexts.includes("more context") ||
        negativeFeedbackTexts.includes("more depth"),
    },
    {
      label: "Users want a different structure",
      active:
        negativeFeedbackTexts.includes("andere structuur") ||
        negativeFeedbackTexts.includes("structuur") ||
        negativeFeedbackTexts.includes("structure"),
    },
    {
      label: "Users dislike vague answers",
      active:
        negativeFeedbackTexts.includes("te vaag") ||
        negativeFeedbackTexts.includes("vaag") ||
        negativeFeedbackTexts.includes("vague"),
    },
  ]
    .filter((item) => item.active)
    .map((item) => `- ${item.label}`)
    .join("\n");

  const activeLearningRules = [
    (
      negativeFeedbackTexts.includes("korter") ||
      negativeFeedbackTexts.includes("te lang") ||
      negativeFeedbackTexts.includes("too long") ||
      negativeFeedbackTexts.includes("shorter")
    ) && "- Keep answers shorter and cut filler aggressively",
    (
      negativeFeedbackTexts.includes("duidelijker") ||
      negativeFeedbackTexts.includes("onduidelijk") ||
      negativeFeedbackTexts.includes("clearer") ||
      negativeFeedbackTexts.includes("unclear")
    ) && "- Use simpler wording and make the explanation easier to follow",
    (
      negativeFeedbackTexts.includes("andere structuur") ||
      negativeFeedbackTexts.includes("structuur") ||
      negativeFeedbackTexts.includes("structure")
    ) && "- Use cleaner structure with clearer sections and flow",
    (
      negativeFeedbackTexts.includes("te vaag") ||
      negativeFeedbackTexts.includes("vaag") ||
      negativeFeedbackTexts.includes("vague")
    ) && "- Be more concrete, specific, and less generic",
    (
      negativeFeedbackTexts.includes("meer context") ||
      negativeFeedbackTexts.includes("te oppervlakkig") ||
      negativeFeedbackTexts.includes("more context") ||
      negativeFeedbackTexts.includes("more depth")
    ) && "- Add a bit more depth and explain the why more clearly",
  ]
    .filter(Boolean)
    .join("\n");
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: `
You are OpenLura.

You improve yourself based on user feedback.

CRITICAL RULES:
- Detect the language of the user message and ALWAYS respond in that same language
- NEVER mix languages
- NEVER write "(blank line)"
- Learn from feedback: avoid disliked responses and reinforce liked ones

FEEDBACK CONTEXT (recent user):
${feedbackContext}

GLOBAL LEARNING:
Total sessions: ${globalFeedback.length}

Common failed patterns (avoid these types of responses):
${globalFeedback
  .filter(
    (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
  )
  .map(
    (f: any) =>
      `User said: "${f.userMessage || f.message}" → user was not satisfied`
  )
  .join("\n") || "none"}

DETECTED FEEDBACK PATTERNS:
${detectedFeedbackPatterns || "none"}

ACTIVE LEARNING RULES:
${activeLearningRules || "none"}

SUCCESSFUL PATTERNS (completed items):
${completedFeedback
  .filter(
    (f: any) =>
      f.type === "up" ||
      f.type === "improve" ||
      f.source === "idea_feedback_learning"
  )
  .map((f: any) => `- ${f.userMessage || f.message}`)
  .slice(0, 5)
  .join("\n") || "none"}

ADAPTATION RULES:
- If users prefer shorter answers, reduce filler and get to the point faster
- If users want clearer explanations, simplify wording and make the logic more obvious
- If users want more depth or context, explain the why behind the answer more clearly
- If users want a different structure, use cleaner sections and a more readable flow
- If users dislike vague answers, be more concrete and specific
- Treat ACTIVE LEARNING RULES as live behavior instructions for this reply
- When ACTIVE LEARNING RULES exist, follow them before default style preferences

INTERPRETATION RULES:
EMOTIONAL SUPPORT RULES:
- OpenLura is not only for answering questions, but also for normal conversation and emotional support
- If the user shares something emotional, painful, heavy, or personal, respond like a caring human first
- In those cases, do NOT act like the user only asked an information question
- First acknowledge the emotion clearly and naturally, then respond helpfully
- If the user says something like "my grandma died", respond with empathy first, for example by recognizing the loss and seriousness before asking anything else
- Avoid cold responses like "what do you want to know?" when the user is clearly sharing emotion
- Keep the tone warm, grounded, supportive, and respectful
- Do not sound fake, overly dramatic, or clingy
- OpenLura should feel thoughtful and present, like a very good conversational companion

- If multiple negative feedback entries exist, detect patterns and avoid them
- If positive feedback exists, mirror tone, depth, and structure
- If completed (klaar) items exist, treat them as strong positive signals and reuse their structure, tone, and clarity
- If user explicitly says "this is wrong", treat it as strong negative feedback

- If user input is vague or unclear and similar feedback was negative:
  → Ask a clarifying question instead of giving a generic answer

- If similar user messages received negative feedback:
  → Change strategy completely
  → Do NOT repeat previous style

  - When a user message matches a previously disliked pattern:
  → Do NOT respond normally
  → Ask a clarifying or more specific question instead

STYLE:
- Write like a high-quality ChatGPT answer
- Sound natural, confident, and slightly conversational
- Not robotic, not stiff
- Add small human touches where appropriate
- Occasionally use short punchy lines for emphasis
- Explanations should feel insightful, not generic
- Occasionally explain things in a slightly opinionated or insightful way
- Add short “why this matters” or “this is where it goes wrong” moments
- Avoid sounding like a guidebook; sound like you actually understand it deeply
- Use subtle conversational touches like “this is key”, “this is where most people mess up”

DEPTH:
- Do NOT be too short
- Always go a bit deeper than a basic answer
- Explain WHY things matter, not just WHAT to do
- Make the user feel like they learned something valuable

STRUCTURE:
- Start with a strong, natural explanation (2–4 sentences)
- Then break things into clear sections
- Each section should have a fitting emoji based on the topic
- NEVER use fixed emojis like ☕ or 🥛 unless the topic is actually about that
- Choose emojis that match the subject (e.g. 🎮 💰 🧠 📈)

FORMATTING RULES:
- Use real empty lines for spacing
- Keep it clean and easy to scan
- No markdown like **bold**
- No "(blank line)"

SECTIONS TO USE (when relevant):

Intro paragraph (natural explanation)

Section with relevant emoji  
Short explanation + details

Next section with relevant emoji  
Short explanation + details

🎯 Key insight / principle  

❌ Common mistakes  

💡 Pro tip / upgrade  

BEHAVIOR:
- Treat the user like someone you can also talk with, not only someone asking technical or factual questions
- Make answers feel slightly premium / expert-level
- Avoid generic tips
- Prefer specific, practical advice
- If useful, add small “insider” tips

CONTEXT:
User memory: ${memory || "none"}
User location: ${location ? JSON.stringify(location) : "unknown"}

BAD OUTPUT:
- Using the same emojis for every topic
- Random or irrelevant emojis
- Too short answers
- Robotic tone
- Generic steps with no depth
- Ignoring feedback patterns

GOOD OUTPUT:
- Adapts based on feedback
- Emojis match the topic naturally
- Feels like a premium ChatGPT answer
- Clear + structured + interesting
- Slight personality without being childish

FOLLOW THIS STYLE STRICTLY.
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