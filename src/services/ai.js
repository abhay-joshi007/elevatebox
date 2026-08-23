import { config } from "../config.js";
import { askGemini } from "./gemini.js";
import { askOpenAi } from "./openai.js";

export async function askAi(payload) {
  if (config.aiProvider === "gemini") {
    return askGemini(payload);
  }
  return askOpenAi(payload);
}
