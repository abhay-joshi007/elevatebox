import { askOpenAi } from "./openai.js";

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

  return askOpenAi({
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

  const result = await askOpenAi({
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

  return askOpenAi({
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
