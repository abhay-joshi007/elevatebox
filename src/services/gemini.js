import { config } from "../config.js";

function extractText(payload) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

export async function askGemini({ instructions, input, jsonSchema }) {
  const prompt = [
    instructions,
    "",
    "Return only valid JSON matching this schema:",
    JSON.stringify(jsonSchema.schema),
    "",
    inputToText(input)
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const text = extractText(payload);
  if (!text) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(payload)}`);
  }

  return JSON.parse(stripJsonFence(text));
}

function inputToText(input = []) {
  return input
    .map((message) =>
      (message.content || [])
        .map((part) => part.text || "")
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n");
}

function stripJsonFence(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
