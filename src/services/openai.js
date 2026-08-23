import { config } from "../config.js";

function extractTextFromOutput(output = []) {
  const messages = output.filter((item) => item.type === "message");
  const text = [];

  for (const message of messages) {
    for (const content of message.content || []) {
      if (content.type === "output_text") {
        text.push(content.text);
      }
    }
  }

  return text.join("\n").trim();
}

export async function askOpenAi({ instructions, input, jsonSchema }) {
  const body = {
    model: config.openAiModel,
    input,
    instructions,
    text: {
      format: {
        type: "json_schema",
        name: jsonSchema.name,
        schema: jsonSchema.schema,
        strict: true
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.output_parsed || extractTextFromOutput(payload.output);
  return typeof content === "string" ? JSON.parse(content) : content;
}
