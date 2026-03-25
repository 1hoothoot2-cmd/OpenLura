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
  const { message, image, memory, personalMemory, location, feedback } = await req.json();
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

                const globalLearningFeedback = normalizedServerFeedback.filter(
    (item: any) =>
      item.type === "up" ||
      item.type === "down" ||
      item.type === "improve" ||
      item.source === "idea_feedback_learning"
  );

  const personalLearningFeedback = clientFeedback;

  // GLOBAL FIRST (true AI learning)
const effectiveFeedback = globalLearningFeedback;

// PERSONAL alleen als extra laag (optioneel)
const personalLayer = personalLearningFeedback;

  const feedbackLikes = globalLearningFeedback.filter(
    (f: any) => f.type === "up"
  ).length;

  const feedbackDislikes = globalLearningFeedback.filter(
    (f: any) => f.type === "down"
  ).length;

    const feedbackRecentIssues = globalLearningFeedback
    .filter(
      (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
    )
    .map((f: any) => f.userMessage || f.message)
    .filter(Boolean)
    .slice(0, 5);

  const personalRecentIssues = personalLearningFeedback
    .filter(
      (f: any) => f.type === "down" || f.source === "idea_feedback_learning"
    )
    .map((f: any) => f.userMessage || f.message)
    .filter(Boolean)
    .slice(0, 5);

    const feedbackContext =
    globalLearningFeedback.length > 0
      ? `
Likes: ${feedbackLikes}
Dislikes: ${feedbackDislikes}

Recent global issues:
${feedbackRecentIssues.join("\n") || "none"}
`
      : "none";

  const personalFeedbackContext =
    personalLearningFeedback.length > 0
      ? `
Personal issues from this user/session:
${personalRecentIssues.join("\n") || "none"}
`
      : "none";

  const normalizePromptText = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[!?.,]+$/g, "")
      .replace(/\s+/g, " ");

  const normalizedMessage = normalizePromptText(message || "");

  const matchingGlobalResponses = globalLearningFeedback.filter((f: any) => {
    const promptText = normalizePromptText(f.userMessage || "");
    return promptText === normalizedMessage && !!(f.message || "").trim();
  });

  const groupedResponsePreferences = matchingGlobalResponses.reduce(
    (acc: any, item: any) => {
      const responseText = String(item.message || "").trim();
      if (!responseText) return acc;

      if (!acc[responseText]) {
        acc[responseText] = {
          response: responseText,
          up: 0,
          down: 0,
        };
      }

      if (item.type === "up") acc[responseText].up += 1;
      if (item.type === "down") acc[responseText].down += 1;

      return acc;
    },
    {}
  );

  const rankedResponsePreferences = Object.values(groupedResponsePreferences)
    .map((item: any) => ({
      ...item,
      score: item.up - item.down,
      total: item.up + item.down,
    }))
    .sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.up !== a.up) return b.up - a.up;
      return b.total - a.total;
    });

  const bestResponsePreference = rankedResponsePreferences[0];
  const hasMixedResponseFeedback =
    rankedResponsePreferences.some((item: any) => item.up > 0) &&
    rankedResponsePreferences.some((item: any) => item.down > 0);

  const responsePreferenceContext = bestResponsePreference
    ? `
Best known response for this exact user message:
${bestResponsePreference.response}

Score: ${bestResponsePreference.score}
Positive votes: ${bestResponsePreference.up}
Negative votes: ${bestResponsePreference.down}
Mixed feedback exists: ${hasMixedResponseFeedback ? "yes" : "no"}
`
    : "none";

  globalFeedback = globalLearningFeedback;

    const completedFeedback = globalLearningFeedback.filter(
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

          const getDecayWeight = (timestamp: string | number | undefined) => {
    if (!timestamp) return 0.4;

    const time = new Date(timestamp).getTime();
    if (Number.isNaN(time)) return 0.4;

    const ageDays = (Date.now() - time) / (1000 * 60 * 60 * 24);

    if (ageDays <= 3) return 1;
    if (ageDays <= 7) return 0.85;
    if (ageDays <= 14) return 0.7;
    if (ageDays <= 30) return 0.5;
    return 0.25;
  };

  const getWeightedSignalCount = (items: any[], pattern: RegExp) => {
    return Math.round(
      items.reduce((sum: number, f: any) => {
        const text = `${f.userMessage || ""} ${f.message || ""}`.toLowerCase();
        return pattern.test(text) ? sum + getDecayWeight(f.timestamp) : sum;
      }, 0)
    );
  };

  const shorterCount = getWeightedSignalCount(
    globalLearningFeedback,
    /korter|te lang|too long|shorter/
  );

  const clearerCount = getWeightedSignalCount(
    globalLearningFeedback,
    /duidelijker|onduidelijk|clearer|unclear/
  );

  const structureCount = getWeightedSignalCount(
    globalLearningFeedback,
    /andere structuur|structuur|structure/
  );

  const vagueCount = getWeightedSignalCount(
    globalLearningFeedback,
    /te vaag|vaag|vague/
  );

  const contextCount = getWeightedSignalCount(
    globalLearningFeedback,
    /meer context|te oppervlakkig|more context|more depth/
  );

    const getSignalConfidence = (count: number) => {
    if (count >= 6) return "High";
    if (count >= 3) return "Medium";
    if (count >= 1) return "Low";
    return "None";
  };

    const learningConfidence = {
    shorter: getSignalConfidence(shorterCount),
    clearer: getSignalConfidence(clearerCount),
    structure: getSignalConfidence(structureCount),
    vague: getSignalConfidence(vagueCount),
    context: getSignalConfidence(contextCount),
  };

  const cappedLearningStrength = {
    shorter: Math.min(shorterCount, 8),
    clearer: Math.min(clearerCount, 8),
    structure: Math.min(structureCount, 8),
    vague: Math.min(vagueCount, 8),
    context: Math.min(contextCount, 8),
  };

    const activeLearningRules = [
    shorterCount >= 1 &&
      `- Keep answers shorter and cut filler aggressively (strength: ${cappedLearningStrength.shorter}, confidence: ${learningConfidence.shorter})`,
    clearerCount >= 1 &&
      `- Use simpler wording and make the explanation easier to follow (strength: ${cappedLearningStrength.clearer}, confidence: ${learningConfidence.clearer})`,
    structureCount >= 1 &&
      `- Use cleaner structure with clearer sections and flow (strength: ${cappedLearningStrength.structure}, confidence: ${learningConfidence.structure})`,
    vagueCount >= 1 &&
      `- Be more concrete, specific, and less generic (strength: ${cappedLearningStrength.vague}, confidence: ${learningConfidence.vague})`,
    contextCount >= 1 &&
      `- Add a bit more depth and explain the why more clearly (strength: ${cappedLearningStrength.context}, confidence: ${learningConfidence.context})`,
  ]
    .filter(Boolean)
    .join("\n");

    const injectedLearningRules = effectiveFeedback
    .filter(
      (f: any) =>
        f.type === "improve" ||
        f.source === "idea_feedback_learning"
    )
    .map((f: any) => (f.message || f.userMessage || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((rule: string) => `- ${rule}`)
    .join("\n");

  let globalSignals = {
    shorter: 0,
    clearer: 0,
    structure: 0,
  };

  try {
    const feedbackRes = await fetch(
      `${supabaseUrl}/rest/v1/openlura_feedback?select=message,type`,
      {
        headers: {
          apikey: supabaseServiceRoleKey!,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (feedbackRes.ok) {
      const feedbackData = await feedbackRes.json();

      feedbackData.forEach((f: any) => {
        const text = `${f.message || ""}`.toLowerCase();

        if (f.type === "down" || f.type === "improve" || f.type === "idea") {
          if (text.match(/korter|te lang|too long|shorter/)) globalSignals.shorter += 1;
          if (text.match(/duidelijker|onduidelijk|clearer|unclear/)) globalSignals.clearer += 1;
          if (text.match(/structuur|structure|opbouw/)) globalSignals.structure += 1;
        }

        if (f.type === "up") {
          if (text.match(/korter|short/)) globalSignals.shorter -= 0.5;
          if (text.match(/duidelijk|clear/)) globalSignals.clearer -= 0.5;
        }
      });
    }
  } catch (e) {
    console.warn("Global learning fetch failed");
  }

    let responseVariant = "A";

  try {
        const res = await fetch(
      `${supabaseUrl}/rest/v1/openlura_feedback?select=type,source`,
      {
        headers: {
          apikey: supabaseServiceRoleKey!,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

        if (res.ok) {
      const feedbackData = await res.json();

      const variantA = feedbackData.filter((f: any) => f.source === "ab_test_A");
      const variantB = feedbackData.filter((f: any) => f.source === "ab_test_B");

      const scoreA =
        variantA.filter((f: any) => f.type === "up").length -
        variantA.filter((f: any) => f.type === "down").length;

      const scoreB =
        variantB.filter((f: any) => f.type === "up").length -
        variantB.filter((f: any) => f.type === "down").length;

      if (variantA.length < 5 || variantB.length < 5) {
        responseVariant = Math.random() < 0.5 ? "A" : "B";
      } else if (scoreA > scoreB) {
        responseVariant = Math.random() < 0.8 ? "A" : "B";
      } else if (scoreB > scoreA) {
        responseVariant = Math.random() < 0.8 ? "B" : "A";
      } else {
        responseVariant = Math.random() < 0.5 ? "A" : "B";
      }
    }
  } catch {
    responseVariant = Math.random() < 0.5 ? "A" : "B";
  }

        const userContent: any[] = [];

    if (message) {
      userContent.push({
        type: "input_text",
        text: message,
      });
    }

    if (image) {
      userContent.push({
        type: "input_image",
        image_url: image,
      });
    }

            const normalizedMessageForRouting = (message || "").toLowerCase().trim();

    const isSimpleImageAnalysis =
      !!image &&
      (!normalizedMessageForRouting ||
        /^(wat is dit|what is this|beschrijf dit|describe this|analyseer dit|analyze this|wat zie je|what do you see|wie is dit|who is this)$/i.test(
          normalizedMessageForRouting
        ));

    const shouldUseWebSearch =
      !isSimpleImageAnalysis &&
      (
        !image ||
        /restaurant|cafe|coffee|koffie|location|locatie|where|waar|address|adres|opening|open|review|route|travel|venue|place|plek|business|bedrijf|hotel|map|maps|near|dichtbij|best|beste|news|nieuws|welke plek|which place|waar is dit|where is this|welk restaurant|which restaurant|vind locatie|find location|zoek locatie|search location/i.test(
          normalizedMessageForRouting
        )
      );

    const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    store: false,
    tools: shouldUseWebSearch ? [{ type: "web_search_preview" }] : [],
    include: shouldUseWebSearch ? ["web_search_call.action.sources"] : [],
    text: {
      verbosity: responseVariant === "A" ? "low" : "medium",
    },
    instructions: `
You are OpenLura.

You improve yourself based on user feedback.

CRITICAL RULES:
- Detect the language of the user message and ALWAYS respond in that same language
- NEVER mix languages
- NEVER write "(blank line)"
- Learn from feedback: avoid disliked responses and reinforce liked ones
- Use live web search when the user asks for current, local, location-based, business, travel, venue, opening-hours, review, route, event, or factual web-dependent information
- When web search is used:
  → ALWAYS include at least 2–3 real sources in the answer
  → Mention actual names of places, products, or locations
  → Prefer clickable, real-world useful results (restaurants, places, pages)
  → If possible, refer to the source naturally in the answer (not only at the bottom)

- Never give generic lists without sources
- Never give “top 10” style answers without at least some real references
- If you list places, businesses, cafés, restaurants, venues, or locations, prefer 3 to 5 stronger options instead of long vague lists
- For location or business recommendations, only mention options that can be supported by web results
- Make the answer itself explain WHY each option is relevant (not just names)
- For search answers: prioritize usefulness → what it is, why it fits, and what stands out
- If sources exist: align the explanation with them so links feel connected
- Never invent sources, links, addresses, ratings, opening hours, or locations
- If the answer depends on fresh web information, prefer searched information over guessing
- If an image is present and no text is provided, treat the request as: "Analyze this image and tell me clearly what it shows"
- If an image is present and text is also provided, answer the user's question using the image as primary context
- For simple image questions like "wat is dit", "wie is dit", "what is this", or "who is this", analyze the image directly first and do not rely on web search
- Only use web search with an image when the user asks for location, business, venue, travel, restaurant, address, opening hours, reviews, maps, or other fresh real-world lookup
- When both image and web search are used, first infer the most likely visual context from the image, then use search only to verify or enrich it
- Do not let web search override obvious image evidence unless the image is unclear
- For simple image analysis, answer fast and directly from the image itself
- Do not ignore the image when one is attached
- If the image is unclear, say what is visible and what is uncertain

GLOBAL FEEDBACK CONTEXT:
${feedbackContext}

PERSONAL FEEDBACK CONTEXT:
${personalFeedbackContext}

RESPONSE PREFERENCE FOR THIS EXACT MESSAGE:
${responsePreferenceContext}

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

GLOBAL AI LEARNING (CONSENSUS ENGINE):
- Shorter answers pressure: ${globalSignals.shorter}
- Clearer explanations pressure: ${globalSignals.clearer}
- Better structure pressure: ${globalSignals.structure}

CONSENSUS RULES:
- If a consensus signal is above 5, apply it strongly
- If a consensus signal is between 2 and 5, apply it lightly
- If consensus signals conflict, choose a balanced middle ground

WEIGHTED LEARNING SIGNALS (recent feedback weighs more than old feedback):
- shorter answers: ${cappedLearningStrength.shorter} (${learningConfidence.shorter})
- clearer explanations: ${cappedLearningStrength.clearer} (${learningConfidence.clearer})
- better structure: ${cappedLearningStrength.structure} (${learningConfidence.structure})
- less vague: ${cappedLearningStrength.vague} (${learningConfidence.vague})
- more context: ${cappedLearningStrength.context} (${learningConfidence.context})

GLOBAL LEARNING (all users):
${injectedLearningRules || "none"}

PERSONAL CONTEXT (single user bias):
${personalLayer.length > 0 ? "present" : "none"}
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
- Treat ACTIVE LEARNING RULES as global behavior instructions learned from all users
- Treat LEARNING INJECTION FROM FEEDBACK as global instructions learned from analytics and shared feedback
- Treat PERSONAL FEEDBACK CONTEXT and User memory as a weak preference layer
- ALWAYS prioritize GLOBAL LEARNING over personal feedback unless explicitly asked
- For general questions, prioritize global learning before personal preferences
- Only use personal preferences as an extra layer unless the user clearly asks for something personal or stylistic
- If RESPONSE PREFERENCE FOR THIS EXACT MESSAGE contains a strong positively rated answer, reuse that style as the default for similar future messages
- If RESPONSE PREFERENCE FOR THIS EXACT MESSAGE shows mixed feedback, do not copy the old answer literally; create a balanced improved version between too short and too verbose
- For simple greetings or repeated casual openers, converge toward the best globally rated phrasing instead of answering randomly
- When ACTIVE LEARNING RULES exist, follow them before default style preferences
- When LEARNING INJECTION FROM FEEDBACK exists, apply those rules directly unless they conflict with safety or the user's current request
- High confidence signals should change the reply clearly and strongly
- Medium confidence signals should noticeably influence structure, clarity, or length
- Low confidence signals should only be applied lightly as a soft preference
- Ignore signals with confidence None
- Weighted learning signals are recency-based, so follow recent repeated feedback more strongly than older feedback

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
- For search/location/business answers, prefer a compact shortlist format:
  1. name
  2. why it matches
  3. one practical detail if supported by sources
- For search/location/business answers, avoid dumping too many names at once

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
Personal user memory: ${personalMemory || memory || "none"}
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

A/B TEST VARIANT:
${responseVariant}

VARIANT RULES:
- If variant is A: be more direct, tighter, and slightly shorter
- If variant is B: be a bit more structured, slightly more explanatory, and more segmented
- Keep both variants high quality
- Do not mention the variant
- Do not mention testing

FOLLOW THIS STYLE STRICTLY.
    `,
        input: [
      {
        role: "user",
        content: [
          ...(message
            ? [
                {
                  type: "input_text",
                  text: message,
                },
              ]
            : []),
          ...(image
            ? [
                {
                  type: "input_image",
                  image_url: image,
                },
              ]
            : []),
        ],
      },
    ],
  } as any);

      const aiText =
    response.output_text ||
    (response.output || [])
      .flatMap((item: any) =>
        item.type === "message" ? item.content || [] : []
      )
      .map((part: any) => {
        if (part.type !== "output_text") return "";

        if (typeof part.text === "string") return part.text;
        if (typeof part.text?.value === "string") return part.text.value;
        if (typeof part.value === "string") return part.value;

        return "";
      })
      .join("")
      .trim();

  const annotationSources: [string, { title: string; url: string }][] = (response.output || [])
    .flatMap((item: any) =>
      item.type === "message" ? item.content || [] : []
    )
    .flatMap((part: any) =>
      part.type === "output_text" ? part.annotations || [] : []
    )
    .filter((annotation: any) => annotation.type === "url_citation" && annotation.url)
    .map(
      (annotation: any): [string, { title: string; url: string }] => [
        annotation.url,
        {
          title: annotation.title || annotation.url,
          url: annotation.url,
        },
      ]
    );

  const webSearchSources: [string, { title: string; url: string }][] = (response.output || [])
    .filter((item: any) => item.type === "web_search_call")
    .flatMap((item: any) => item.action?.sources || [])
    .filter((source: any) => source?.url)
    .map(
      (source: any): [string, { title: string; url: string }] => [
        source.url,
        {
          title: source.title || source.url,
          url: source.url,
        },
      ]
    );

  const sources = Array.from(
    new Map<string, { title: string; url: string }>([
      ...annotationSources,
      ...webSearchSources,
    ]).values()
  ).slice(0, 5);

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const chunkSize = 80;

                const safeText =
          aiText ||
          (image
            ? "Ik kon de afbeelding nog niet goed uitlezen. Probeer het nog een keer met een kortere vraag zoals: wat staat hierop?"
            : "Ik kon geen antwoord genereren. Probeer het opnieuw.");

        for (let i = 0; i < safeText.length; i += chunkSize) {
          controller.enqueue(
            encoder.encode(safeText.slice(i, i + chunkSize))
          );
        }

        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-OpenLura-Variant": responseVariant,
        "X-OpenLura-Sources": encodeURIComponent(JSON.stringify(sources)),
      },
    }
  );
}