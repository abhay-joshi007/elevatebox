import { askAi } from "./ai.js";

const schema = {
  name: "lead_turn_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string" },
      summary: { type: "string" },
      classification: { type: "string", enum: ["hot", "warm", "cold"] },
      highIntent: { type: "boolean" },
      callbackRequested: { type: "boolean" },
      callbackTimeReference: { type: ["string", "null"] },
      slots: {
        type: "object",
        additionalProperties: false,
        properties: {
          budget: { type: ["string", "null"] },
          products: { type: ["string", "null"] },
          timeline: { type: ["string", "null"] },
          features: { type: ["string", "null"] }
        },
        required: ["budget", "products", "timeline", "features"]
      },
      nextObjective: {
        type: "string",
        enum: ["discover_budget", "discover_products", "discover_timeline", "discover_features", "schedule_callback", "close_high_intent", "close_general"]
      },
      reply: { type: "string" }
    },
    required: ["language", "summary", "classification", "highIntent", "callbackRequested", "callbackTimeReference", "slots", "nextObjective", "reply"]
  }
};

export async function analyzeConversationTurn(lead, callerSpeech) {
  const instructions = [
    "You are an outbound sales agent for e-commerce website development in India.",
    "Respond in the caller's active language, using Telugu, Hindi, English, or natural code-switching.",
    "Your job is to sell briefly, gather budget, product count or catalog details, timeline, and needed features, classify the lead, and decide the best next question or close.",
    "A hot lead is asking for price, speed, next steps, or ready to proceed soon.",
    "A warm lead has real interest but a barrier like budget, timing, or another decision-maker.",
    "A cold lead is browsing without urgency or budget.",
    "Keep the reply concise and natural for phone speech."
  ].join(" ");

  const transcriptBlock = lead.transcript
    .slice(-8)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join("\n");

  return askAi({
    instructions,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Known lead data: ${JSON.stringify({ language: lead.language, classification: lead.classification, slots: lead.slots, callback: lead.callback })}`,
              "Recent transcript:",
              transcriptBlock || "No previous transcript yet.",
              `Caller just said: ${callerSpeech}`
            ].join("\n")
          }
        ]
      }
    ],
    jsonSchema: schema
  });
}

export function analyzeConversationTurnFallback(lead, callerSpeech) {
  const text = String(callerSpeech || "").trim();
  const lower = text.toLowerCase();
  const slots = {
    budget: extractBudget(text) || null,
    products: extractProducts(text) || null,
    timeline: extractTimeline(text) || null,
    features: extractFeatures(text) || null
  };
  const callbackRequested = /\b(call back|callback|later|tomorrow|evening|morning|afternoon)\b/i.test(text);
  const highIntent = /\b(price|cost|start|launch|urgent|soon|proposal|demo|pay|ready)\b/i.test(text);
  const classification = highIntent ? "hot" : callbackRequested || Object.values(slots).some(Boolean) ? "warm" : "cold";
  const nextObjective = chooseFallbackObjective({ lead, slots, callbackRequested, highIntent });
  const reply = buildFallbackReply({ lead, text, slots, nextObjective, callbackRequested, highIntent });

  return {
    language: lead.language,
    summary: `Fallback analysis from caller speech: ${text || "No speech captured."}`,
    classification,
    highIntent,
    callbackRequested,
    callbackTimeReference: callbackRequested ? text : null,
    slots,
    nextObjective,
    reply
  };
}

function buildFallbackReply({ lead, text, slots, nextObjective, callbackRequested, highIntent }) {
  const heard = text ? summarizeHeardText(text) : "that";
  const acknowledgements = [];

  if (slots.products) {
    acknowledgements.push("what you want to sell");
  }
  if (slots.budget) {
    acknowledgements.push(`your budget around ${slots.budget}`);
  }
  if (slots.timeline) {
    acknowledgements.push(`your timeline of ${slots.timeline}`);
  }
  if (slots.features) {
    acknowledgements.push(`features like ${slots.features}`);
  }

  const acknowledgement = acknowledgements.length
    ? `Got it, I noted ${joinForSpeech(acknowledgements)}.`
    : `I heard you say ${heard}.`;

  if (callbackRequested) {
    return `${acknowledgement} What exact time should we call you back?`;
  }
  if (highIntent) {
    return `${acknowledgement} That sounds promising. I can share the project details on WhatsApp. Before I wrap up, what is your preferred budget and launch timeline?`;
  }

  return `${acknowledgement} ${fallbackQuestionForObjective(nextObjective, lead.language)}`;
}

function fallbackQuestionForObjective(objective, language) {
  const englishQuestions = {
    discover_budget: "Could you share the budget range you have in mind?",
    discover_products: "What products or categories should the online store handle?",
    discover_timeline: "By when do you want to launch the website?",
    discover_features: "Which features matter most, like payments, COD, inventory, or admin tools?",
    schedule_callback: "What time should we call you back?",
    close_high_intent: "Should I send the details on WhatsApp now?",
    close_general: "What else is important for this website?"
  };
  return englishQuestions[objective] || englishQuestions.close_general;
}

function summarizeHeardText(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 110 ? `${compact.slice(0, 107)}...` : compact;
}

function joinForSpeech(items) {
  if (items.length <= 1) {
    return items[0] || "";
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function chooseFallbackObjective({ lead, slots, callbackRequested, highIntent }) {
  if (callbackRequested) {
    return "schedule_callback";
  }
  if (highIntent) {
    return "close_high_intent";
  }
  if (!(slots.products || lead.slots?.products)) {
    return "discover_products";
  }
  if (!(slots.budget || lead.slots?.budget)) {
    return "discover_budget";
  }
  if (!(slots.timeline || lead.slots?.timeline)) {
    return "discover_timeline";
  }
  if (!(slots.features || lead.slots?.features)) {
    return "discover_features";
  }
  return "close_general";
}

function extractBudget(text) {
  const match = text.match(/(?:rs\.?|₹|inr)?\s*(\d+(?:[.,]\d+)?)\s*(lakh|lac|k|thousand|crore)?/i);
  if (!match || !/\b(budget|price|cost|rs|inr|lakh|lac|thousand|crore|₹)\b/i.test(text)) {
    return null;
  }
  return match[0].trim();
}

function extractProducts(text) {
  if (!/\b(sell|selling|product|products|catalog|category|store|shop|fashion|clothes|food|jewellery|electronics)\b/i.test(text)) {
    return null;
  }
  return text;
}

function extractTimeline(text) {
  const match = text.match(/\b(today|tomorrow|this week|next week|this month|next month|\d+\s*(?:day|days|week|weeks|month|months))\b/i);
  return match?.[0] || null;
}

function extractFeatures(text) {
  const features = ["payment", "payments", "cod", "inventory", "admin", "checkout", "delivery", "shipping", "multilingual", "catalog"];
  const found = features.filter((feature) => lowerIncludesWord(text, feature));
  return found.length ? found.join(", ") : null;
}

function lowerIncludesWord(text, word) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

export async function generateFollowUpMessage(lead) {
  const instructions = [
    "Write a WhatsApp follow-up after an outbound discovery call about e-commerce website development.",
    "Sound human, concise, and specific to the conversation.",
    "Include the customer's stated needs, budget, timeline, and requested features if known.",
    "Mention that the architecture image and resume are attached.",
    "Do not use bullet points."
  ].join(" ");

  const schema = {
    name: "followup_message",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        message: { type: "string" }
      },
      required: ["message"]
    }
  };

  const result = await askAi({
    instructions,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Lead summary: ${JSON.stringify({
              language: lead.language,
              classification: lead.classification,
              slots: lead.slots,
              callback: lead.callback,
              transcript: lead.transcript
            })}`
          }
        ]
      }
    ],
    jsonSchema: schema
  });

  return result.message;
}

export function generateFallbackFollowUpMessage(lead) {
  const need = lead.slots?.products || latestCallerText(lead) || "your e-commerce website requirement";
  const timeline = lead.slots?.timeline || "the timeline you prefer";
  const budget = lead.slots?.budget || "your planned budget";
  const features = lead.slots?.features || "catalog, payments, checkout, and admin features";

  return [
    `Hi, thanks for speaking with me about ${need}.`,
    `I noted the budget as ${budget}, timeline as ${timeline}, and key features as ${features}.`,
    "I am sharing the architecture image and resume here. Please reply with any missing details, and we can take the next step."
  ].join(" ");
}

function latestCallerText(lead) {
  return [...(lead.transcript || [])].reverse().find((entry) => entry.role === "caller")?.text || null;
}

export async function resolveCallbackTime(referenceText, timezone) {
  const schema = {
    name: "callback_time",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        isoLocal: { type: ["string", "null"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        note: { type: "string" }
      },
      required: ["isoLocal", "confidence", "note"]
    }
  };

  return askAi({
    instructions: `Convert spoken callback time references into an ISO local datetime in timezone ${timezone}. For broad but actionable phrases, use these defaults: morning=10:00, afternoon=14:00, evening=18:00 in that timezone, and explain the assumption in note. Return null only when no reasonable day or time can be inferred. Include the timezone offset in isoLocal, for example 2026-08-23T10:00:00+05:30.`,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Today is ${new Date().toISOString()}. Spoken callback reference: ${referenceText}`
          }
        ]
      }
    ],
    jsonSchema: schema
  });
}
